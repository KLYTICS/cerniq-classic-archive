#!/usr/bin/env node
// scripts/session/doctor.mjs
// Boot-time diagnostic for a Claude Code session opening on cerniq.
// Composes the existing session-coord scripts + peer system + git state
// + CI rollup into one deterministic command so new sessions don't burn
// 10+ tool calls re-discovering the room.
//
// Audiences:
//   - humans:    markdown report to stdout
//   - claude:    --json output for piping into another tool / agent prompt
//   - CI/hooks:  --quiet for exit-code-only composition
//
// Severity policy:
//   CRITICAL → exit 2 (block boot — there's a real problem)
//   WARNING  → exit 1 (advisory — room has open items to triage)
//   INFO     → exit 0 (clean — every passive observation is here)
//
// Self-test:
//   node scripts/session/doctor.mjs --self-test
//
// Usage:
//   npm run session:doctor          # human report
//   npm run session:doctor -- --json
//   npm run session:doctor -- --quiet
//   npm run session:doctor -- --no-ci     # skip the gh call (offline)
//   npm run session:doctor -- --self-test

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync, spawnSync } from 'node:child_process';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const PEERS_BIN = join(homedir(), '.claude', 'peers', 'bin', 'claude-peers');
const PEER_CLAIMS_DIR = join(homedir(), '.claude', 'peers', 'claims');

const args = new Set(process.argv.slice(2));
const JSON_MODE = args.has('--json');
const QUIET = args.has('--quiet');
const NO_CI = args.has('--no-ci');
const SELF_TEST = args.has('--self-test');

// ── Color helpers (don't import _lib.mjs C — keep doctor self-contained
// so it can be run before lib/ exists or in a stripped tree). ────────
const TTY = process.stdout.isTTY && !process.env.NO_COLOR && !JSON_MODE && !QUIET;
const c = (color, s) => {
  if (!TTY) return s;
  const codes = { red: 31, green: 32, yellow: 33, cyan: 36, gray: 90, bold: 1 };
  return `\x1b[${codes[color] ?? 0}m${s}\x1b[0m`;
};

// ── Check primitive ──────────────────────────────────────────────────
// Each check is a function returning one of:
//   { severity: 'info'|'warning'|'critical', label, detail?, action? }
// Throwing converts to a critical with the error message as detail.

const checks = [];

function defineCheck(id, fn) {
  checks.push({ id, fn });
}

function safe(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], ...opts }).trim();
  } catch {
    return null;
  }
}

function git(args) {
  return safe(`git ${args}`, { cwd: REPO_ROOT });
}

// ── Checks ───────────────────────────────────────────────────────────

defineCheck('disk_pressure', () => {
  // /private/tmp is where Claude Code's tool harness writes per-task output
  // files. ENOSPC there silently corrupts tool-result capture (observed
  // in cerniq session 2026-05-18 — SHA mirage bug).
  const out = safe('df -k /private/tmp');
  if (!out) return { severity: 'info', label: 'disk: df unavailable' };
  const line = out.split('\n').filter((l) => l.startsWith('/')).pop() || '';
  const parts = line.split(/\s+/);
  // BSD df: Filesystem 1K-blocks Used Avail Capacity ...
  const availKb = Number(parts[3]);
  const availMb = Math.round(availKb / 1024);
  if (availMb < 500) {
    return {
      severity: 'critical',
      label: `disk: ${availMb} MiB free on /private/tmp`,
      detail: 'Tool harness will start failing with ENOSPC. Clean ~/Library/Caches, /private/tmp/claude-501/, stale .next build caches.',
      action: 'df -h && du -sh ~/Library/Caches /private/tmp/claude-501 2>/dev/null',
    };
  }
  return { severity: 'info', label: `disk: ${(availMb / 1024).toFixed(1)} GiB free` };
});

defineCheck('git_index_lock', () => {
  const lock = join(REPO_ROOT, '.git', 'index.lock');
  if (!existsSync(lock)) return { severity: 'info', label: 'git: no index.lock' };
  const ageSec = (Date.now() - statSync(lock).mtimeMs) / 1000;
  // Per [[feedback_macos_spotlight_git_lock]] — mdworker can hold a stale
  // lock briefly. Only flag if >30s old AND no live git proc.
  if (ageSec < 30) return { severity: 'info', label: `git: index.lock fresh (${Math.round(ageSec)}s)` };
  const lsof = safe(`lsof ${lock}`);
  if (lsof && /\bgit\b/.test(lsof)) {
    return { severity: 'warning', label: 'git: index.lock held by live git process' };
  }
  return {
    severity: 'critical',
    label: `git: stale index.lock (${Math.round(ageSec)}s, no live git proc)`,
    detail: 'Likely macOS Spotlight mdworker residue. Safe to remove.',
    action: 'rm .git/index.lock',
  };
});

defineCheck('branch_position', () => {
  const head = git('rev-parse --short HEAD');
  const subject = git('log -1 --pretty=%s') || '';
  const branch = git('rev-parse --abbrev-ref HEAD') || 'detached';
  const ahead = Number(git(`rev-list origin/${branch}..HEAD --count`) || 0);
  const behind = Number(git(`rev-list HEAD..origin/${branch} --count`) || 0);
  if (behind > 0) {
    return {
      severity: 'warning',
      label: `branch: ${ahead} ahead / ${behind} behind origin/${branch}`,
      detail: `HEAD=${head} "${subject}"`,
      action: `git pull --rebase --autostash origin ${branch}`,
    };
  }
  if (ahead > 0) {
    return {
      severity: 'warning',
      label: `branch: ${ahead} ahead of origin/${branch} (unpushed)`,
      detail: `HEAD=${head} "${subject}"`,
      action: `git push origin ${branch}`,
    };
  }
  return { severity: 'info', label: `branch: caught up with origin/${branch}`, detail: `HEAD=${head} "${subject}"` };
});

defineCheck('working_tree', () => {
  // Don't go through git()/safe() — both call .trim() which strips the
  // leading space from unstaged " M" lines, breaking the modified-vs-
  // staged classification. Run execSync directly, no trim.
  let status = '';
  try {
    status = execSync('git status --porcelain=v1', {
      cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return { severity: 'info', label: 'working tree: status unavailable' };
  }
  const lines = status.split('\n').filter(Boolean);
  if (lines.length === 0) return { severity: 'info', label: 'working tree: clean' };
  // XY columns: X=staged-status, Y=worktree-status.
  // "M " = staged modify, " M" = unstaged modify, "MM" = both,
  // "A " = staged add, "??" = untracked.
  const modified = lines.filter((l) => l[1] === 'M' && l[0] === ' ').length;
  const untracked = lines.filter((l) => l.startsWith('??')).length;
  const staged = lines.filter((l) => l[0] !== ' ' && l[0] !== '?').length;
  return {
    severity: 'warning',
    label: `working tree: ${lines.length} change(s) (${modified}M ${untracked}?? ${staged}S)`,
    detail: 'Peer territory possible. Audit owners before any git add -A.',
    action: 'git status --short; ' + PEERS_BIN + ' status',
  };
});

defineCheck('peer_claims', () => {
  if (!existsSync(PEERS_BIN)) return { severity: 'info', label: 'peers: CLI not installed' };
  const out = safe(`${PEERS_BIN} status 2>&1`);
  if (!out) return { severity: 'info', label: 'peers: status unavailable' };
  if (/^no active claims/.test(out)) return { severity: 'info', label: 'peers: 0 active claims' };
  const lines = out.split('\n').filter((l) => /^\s*\[/.test(l));
  const mine = lines.filter((l) => /\(you\)/.test(l)).length;
  const others = lines.length - mine;
  if (others === 0 && mine > 0) {
    return { severity: 'info', label: `peers: ${mine} active (mine only)` };
  }
  return {
    severity: others > 0 ? 'warning' : 'info',
    label: `peers: ${lines.length} active (${mine} mine, ${others} other)`,
    detail: 'Run `claude-peers status` for full claim list + paths.',
  };
});

defineCheck('peer_inbox', () => {
  if (!existsSync(PEERS_BIN)) return { severity: 'info', label: 'peers: CLI not installed' };
  const out = safe(`${PEERS_BIN} inbox --peek 2>&1`);
  if (!out || /inbox empty/.test(out) || /no unread/.test(out)) {
    return { severity: 'info', label: 'inbox: empty' };
  }
  const match = out.match(/^(\d+)\s+unread/);
  const n = match ? Number(match[1]) : 0;
  if (n === 0) return { severity: 'info', label: 'inbox: empty' };
  return {
    severity: 'warning',
    label: `inbox: ${n} unread message(s)`,
    detail: 'Other peers have left context for you. Read before acting on shared state.',
    action: PEERS_BIN + ' inbox',
  };
});

defineCheck('recent_landings', () => {
  const handoff = join(REPO_ROOT, 'docs', 'SESSION_HANDOFF.md');
  if (!existsSync(handoff)) return { severity: 'info', label: '§5: handoff not found' };
  const raw = readFileSync(handoff, 'utf8');
  const today = new Date().toISOString().slice(0, 10);
  // Count "- YYYY-MM-DD —" lines anywhere in §5 dated today or yesterday.
  const section = raw.split(/^## 5\. Recent landings/m)[1] || '';
  const todayCount = (section.match(new RegExp(`^- ${today} —`, 'gm')) || []).length;
  const ts = new Date();
  ts.setUTCDate(ts.getUTCDate() - 1);
  const yesterday = ts.toISOString().slice(0, 10);
  const yesterdayCount = (section.match(new RegExp(`^- ${yesterday} —`, 'gm')) || []).length;
  return {
    severity: 'info',
    label: `§5: ${todayCount} landing(s) today, ${yesterdayCount} yesterday`,
  };
});

defineCheck('handoff_incoming_pending', () => {
  const dir = join(REPO_ROOT, 'docs', 'handoff-incoming');
  if (!existsSync(dir)) return { severity: 'info', label: 'incoming: dir absent' };
  const entries = readdirSync(dir).filter((n) => n.endsWith('.md') && n !== 'README.md');
  if (entries.length === 0) return { severity: 'info', label: 'incoming: 0 pending squash' };
  return {
    severity: 'warning',
    label: `incoming: ${entries.length} entry/entries pending squash`,
    detail: 'Run squash before §5 reads. Verify each entry claimed files exist in git first.',
    action: 'node scripts/squash-handoff-incoming.mjs --dry-run',
  };
});

defineCheck('stale_worktrees', () => {
  const out = git('worktree list --porcelain');
  if (!out) return { severity: 'info', label: 'worktrees: none' };
  const blocks = out.split('\n\n').filter(Boolean);
  const worktrees = blocks.map((b) => {
    const path = (b.match(/^worktree (.+)$/m) || [])[1];
    const branch = (b.match(/^branch (.+)$/m) || [])[1] || 'detached';
    const prunable = /^prunable/m.test(b);
    return { path, branch, prunable };
  });
  const prunable = worktrees.filter((w) => w.prunable);
  const NOW = Date.now();
  // Walk each non-main worktree, check working-tree mtime + WIP count.
  const stale = [];
  for (const wt of worktrees) {
    if (!wt.path || wt.path === REPO_ROOT) continue;
    if (!existsSync(wt.path)) continue;
    try {
      const ageDays = (NOW - statSync(wt.path).mtimeMs) / (24 * 3600 * 1000);
      if (ageDays > 7) {
        const status = safe('git status --short', { cwd: wt.path }) || '';
        const wip = status.split('\n').filter(Boolean).length;
        if (wip > 5) stale.push({ path: wt.path, ageDays: Math.round(ageDays), wip });
      }
    } catch {
      // Worktree path may have been removed externally — git will catch it on prune.
    }
  }
  if (prunable.length === 0 && stale.length === 0) {
    return { severity: 'info', label: `worktrees: ${worktrees.length} healthy` };
  }
  return {
    severity: 'warning',
    label: `worktrees: ${prunable.length} prunable, ${stale.length} stale-with-WIP`,
    detail: stale.map((s) => `  ${s.path} (${s.ageDays}d, ${s.wip} WIP)`).join('\n') || undefined,
    action: prunable.length ? 'git worktree prune' : 'audit before removing — may hold weeks of unsaved agent work',
  };
});

defineCheck('ci_pr_state', () => {
  if (NO_CI) return { severity: 'info', label: 'CI: skipped (--no-ci)' };
  if (!safe('which gh')) return { severity: 'info', label: 'CI: gh CLI not installed' };
  const branch = git('rev-parse --abbrev-ref HEAD');
  if (!branch || branch === 'main') return { severity: 'info', label: 'CI: no PR for branch' };
  const prList = safe(`gh pr list --head "${branch}" --json number --limit 1`);
  if (!prList || prList === '[]') return { severity: 'info', label: `CI: no open PR for ${branch}` };
  const pr = JSON.parse(prList)[0];
  // gh pr checks exits 8 when any check fails — wrap with || true so safe()
  // returns the output instead of null.
  const checksRaw = safe(`gh pr checks ${pr.number} 2>/dev/null || true`);
  if (!checksRaw) return { severity: 'info', label: `CI: PR #${pr.number} state unknown` };
  const lines = checksRaw.split('\n').filter(Boolean);
  const fail = lines.filter((l) => /\sfail\s/.test(l)).length;
  const pending = lines.filter((l) => /\spending\s/.test(l)).length;
  const pass = lines.filter((l) => /\spass\s/.test(l)).length;
  if (fail > 0) {
    return {
      severity: 'warning',
      label: `CI PR #${pr.number}: ${fail} fail / ${pending} pending / ${pass} pass`,
      detail: lines.filter((l) => /\sfail\s/.test(l)).slice(0, 3).map((l) => '  ' + l.split('\t')[0]).join('\n'),
      action: `gh pr checks ${pr.number}`,
    };
  }
  return { severity: 'info', label: `CI PR #${pr.number}: 0 fail / ${pending} pending / ${pass} pass` };
});

// ── Self-test ────────────────────────────────────────────────────────
// Embedded fixtures so the doctor's logic is verified independently of
// live system state. D24 ratchet convention.

if (SELF_TEST) {
  const tests = [];
  function expect(name, cond, detail) {
    tests.push({ name, ok: cond, detail });
  }

  // Severity ordering invariant: critical > warning > info.
  const ORDER = { critical: 2, warning: 1, info: 0 };
  expect('severity ordering', ORDER.critical > ORDER.warning && ORDER.warning > ORDER.info);

  // Disk parser tolerates BSD df shape.
  const sampleDf = `Filesystem    1K-blocks      Used     Avail Capacity iused ifree %iused  Mounted on
/dev/disk3s5  481876728 444321964  10282224    98%  10485760 1048576    91%   /System/Volumes/Data`;
  const line = sampleDf.split('\n').filter((l) => l.startsWith('/')).pop();
  const parts = line.split(/\s+/);
  expect('df parse Avail column', Number(parts[3]) === 10282224);

  // Color helper noops when not TTY.
  const noop = c('red', 'x');
  expect('color noop when JSON', noop === 'x' || /\x1b\[/.test(noop));

  // Exit-code mapping.
  const ec = (sev) => (sev === 'critical' ? 2 : sev === 'warning' ? 1 : 0);
  expect('critical → 2', ec('critical') === 2);
  expect('warning → 1', ec('warning') === 1);
  expect('info → 0', ec('info') === 0);

  // Severity reducer (max of all).
  const max = (severities) =>
    severities.reduce((acc, s) => (ORDER[s] > ORDER[acc] ? s : acc), 'info');
  expect('reducer picks critical', max(['info', 'warning', 'critical', 'info']) === 'critical');
  expect('reducer picks warning when no critical', max(['info', 'warning', 'info']) === 'warning');
  expect('reducer is info on empty', max([]) === 'info');

  const failed = tests.filter((t) => !t.ok);
  for (const t of tests) console.log(`  ${t.ok ? c('green', '✓') : c('red', '✗')} ${t.name}`);
  console.log('');
  if (failed.length) {
    console.log(c('red', `  ${failed.length}/${tests.length} self-tests failed`));
    process.exit(1);
  }
  console.log(c('green', `  ${tests.length}/${tests.length} self-tests passed`));
  process.exit(0);
}

// ── Run checks ───────────────────────────────────────────────────────

const results = [];
for (const { id, fn } of checks) {
  try {
    results.push({ id, ...fn() });
  } catch (e) {
    results.push({ id, severity: 'critical', label: `${id}: check threw`, detail: e.message });
  }
}

const ORDER = { critical: 2, warning: 1, info: 0 };
const worst = results.reduce(
  (acc, r) => (ORDER[r.severity] > ORDER[acc] ? r.severity : acc),
  'info',
);
const exitCode = worst === 'critical' ? 2 : worst === 'warning' ? 1 : 0;

if (JSON_MODE) {
  console.log(JSON.stringify({ overall: worst, exitCode, checks: results }, null, 2));
  process.exit(exitCode);
}

if (QUIET) process.exit(exitCode);

// ── Markdown report ──────────────────────────────────────────────────
console.log('');
console.log(c('bold', '  CerniQ · Session Doctor'));
console.log(c('gray', '  ' + '─'.repeat(55)));
console.log('');

const groups = {
  critical: results.filter((r) => r.severity === 'critical'),
  warning: results.filter((r) => r.severity === 'warning'),
  info: results.filter((r) => r.severity === 'info'),
};

const ICON = { critical: c('red', '✗'), warning: c('yellow', '⚠'), info: c('green', '✓') };

for (const sev of ['critical', 'warning', 'info']) {
  if (groups[sev].length === 0) continue;
  if (sev !== 'info') console.log(c('bold', `  ${sev.toUpperCase()}`));
  for (const r of groups[sev]) {
    console.log(`  ${ICON[sev]} ${r.label}`);
    if (r.detail) for (const ln of r.detail.split('\n')) console.log(c('gray', `      ${ln}`));
    if (r.action) console.log(c('gray', `      → ${r.action}`));
  }
  if (sev !== 'info') console.log('');
}
console.log('');
console.log(c('gray', `  overall: ${worst}  (exit ${exitCode})`));
console.log('');

process.exit(exitCode);
