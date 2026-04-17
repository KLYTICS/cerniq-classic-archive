#!/usr/bin/env node
// scripts/cerniq-terminal.mjs
// The between-terminals CLI for the Vol.3 50-terminal execution model.
//
// Wraps .cerniq/terminals.json with claim/handoff semantics and delegates
// cross-session visibility to ~/.claude/peers/. A pick here writes a peers
// claim so any parallel Claude session (or worktree, via cerniq-cross) sees
// the write-set and surfaces overlap.
//
// Exit codes:
//   0 — ok
//   1 — overlap or refused claim
//   2 — setup error (bad args, missing registry, etc.)

import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const REGISTRY_PATH = join(REPO_ROOT, '.cerniq', 'terminals.json');
const HANDOFF_DIR = join(REPO_ROOT, '.cerniq', 'handoff');
const PEERS_BIN = join(homedir(), '.claude', 'peers', 'bin', 'claude-peers');

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', cyan: '\x1b[36m', grey: '\x1b[90m',
};
const tty = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (color, s) => (tty ? `${C[color]}${s}${C.reset}` : s);

function die(msg, code = 2) {
  console.error(c('red', `cerniq:terminal — ${msg}`));
  process.exit(code);
}

function loadRegistry() {
  if (!existsSync(REGISTRY_PATH)) die(`registry not found at ${REGISTRY_PATH}`);
  try {
    return JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
  } catch (e) {
    die(`registry parse error: ${e.message}`);
  }
}

function saveRegistry(reg) {
  // Atomic-ish write: write to temp then rename so readers never see partial.
  const tmp = `${REGISTRY_PATH}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(reg, null, 2) + '\n', 'utf8');
  execFileSync('mv', [tmp, REGISTRY_PATH]);
}

function findTerminal(reg, id) {
  const t = reg.terminals.find((x) => x.id.toUpperCase() === id.toUpperCase());
  if (!t) die(`unknown terminal id: ${id}`);
  return t;
}

function setStatus(reg, id, status) {
  const t = findTerminal(reg, id);
  t.status = status;
  t.updated_at = new Date().toISOString();
  saveRegistry(reg);
  return t;
}

// Call claude-peers with args; returns stdout, surfaces non-zero via stderr.
function peers(args, opts = {}) {
  if (!existsSync(PEERS_BIN)) {
    // Fail open — between-terminals CLI still functional without peers.
    return { ok: false, stdout: '', stderr: 'peers CLI not installed' };
  }
  const res = spawnSync(PEERS_BIN, args, {
    encoding: 'utf8', cwd: REPO_ROOT, ...opts,
  });
  return {
    ok: res.status === 0,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
    code: res.status,
  };
}

function statusGlyph(s) {
  switch (s) {
    case 'shipped':     return c('green',  '✓');
    case 'in_progress': return c('yellow', '▶');
    case 'claimed':     return c('cyan',   '◉');
    case 'released':    return c('grey',   '↶');
    default:            return c('grey',   '·');
  }
}

function sprintTag(n) {
  const colors = [null, 'cyan', 'blue', 'yellow'];
  return c(colors[n] || 'grey', `S${n}`);
}

// ─── Commands ────────────────────────────────────────────────────────────

function cmdList(args) {
  const reg = loadRegistry();
  const filter = parseFilter(args);
  const rows = reg.terminals.filter((t) => matchFilter(t, filter));
  if (rows.length === 0) { console.log(c('grey', '  (no terminals match)')); return; }

  console.log(c('bold', `\n  CERNIQ · 50-terminal registry · ${rows.length}/${reg.terminals.length} shown\n`));
  const byCluster = groupBy(rows, 'cluster');
  for (const cluster of Object.keys(byCluster).sort()) {
    const meta = reg.clusters[cluster];
    console.log(`  ${c('bold', cluster)}  ${meta.name}  ${c('grey', `· ${meta.owner_role}`)}`);
    for (const t of byCluster[cluster]) {
      const crit = t.critical ? c('red', '!') : ' ';
      console.log(
        `    ${statusGlyph(t.status)} ${c('bold', t.id.padEnd(3))} ${crit} ${sprintTag(t.sprint)}  ` +
        `${t.task.length > 70 ? t.task.slice(0, 67) + '…' : t.task}`
      );
    }
  }
  console.log('');
}

function parseFilter(args) {
  const f = { cluster: null, sprint: null, status: null, critical: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--cluster') f.cluster = args[++i]?.toUpperCase();
    else if (a === '--sprint') f.sprint = Number(args[++i]);
    else if (a === '--status') f.status = args[++i];
    else if (a === '--critical') f.critical = true;
    else if (a === '--open') f.status = 'not_started';
  }
  return f;
}
function matchFilter(t, f) {
  if (f.cluster && t.cluster !== f.cluster) return false;
  if (f.sprint && t.sprint !== f.sprint) return false;
  if (f.status && t.status !== f.status) return false;
  if (f.critical && !t.critical) return false;
  return true;
}
function groupBy(xs, k) {
  return xs.reduce((acc, x) => { (acc[x[k]] ||= []).push(x); return acc; }, {});
}

function cmdShow(args) {
  const id = args[0]; if (!id) die('usage: show <id>');
  const reg = loadRegistry();
  const t = findTerminal(reg, id);
  console.log('');
  console.log(`  ${c('bold', t.id)}  ${c('cyan', reg.clusters[t.cluster].name)}  ${sprintTag(t.sprint)}  ${statusGlyph(t.status)} ${t.status}`);
  if (t.critical) console.log(`  ${c('red', 'CRITICAL')} — exclusive claim on write-set`);
  if (t.agent) console.log(`  ${c('grey', 'agent:')}        ${t.agent}`);
  console.log(`  ${c('grey', 'task:')}         ${t.task}`);
  console.log(`  ${c('grey', 'hours_est:')}    ${t.hours_est}`);
  console.log(`  ${c('grey', 'write-set:')}    ${(t.files || []).join(', ') || '—'}`);
  console.log(`  ${c('grey', 'read-set:')}     ${(t.reads || []).join(', ') || '—'}`);
  console.log(`  ${c('grey', 'depends_on:')}   ${(t.depends_on || []).join(', ') || '—'}`);
  console.log(`  ${c('grey', 'unblocks:')}     ${(t.unblocks || []).join(', ') || '—'}`);
  if (t.claimed_by)   console.log(`  ${c('grey', 'claimed_by:')}   ${t.claimed_by}`);
  if (t.updated_at)   console.log(`  ${c('grey', 'updated_at:')}   ${t.updated_at}`);
  console.log('');
}

function cmdDeps(args) {
  const id = args[0]; if (!id) die('usage: deps <id>');
  const reg = loadRegistry();
  const t = findTerminal(reg, id);
  const resolveIds = (ids) => (ids || []).map((x) => reg.terminals.find((r) => r.id === x)).filter(Boolean);
  const up = resolveIds(t.depends_on);
  const down = resolveIds(t.unblocks);
  console.log(`\n  ${c('bold', t.id)}  ${t.task}\n`);
  console.log(c('grey', '  blocked by:'));
  if (up.length === 0) console.log('    (nothing — ready to start)');
  for (const u of up) console.log(`    ${statusGlyph(u.status)} ${u.id}  ${u.task}`);
  console.log(c('grey', '\n  unblocks:'));
  if (down.length === 0) console.log('    (leaf — nothing waits on this)');
  for (const d of down) console.log(`    ${statusGlyph(d.status)} ${d.id}  ${d.task}`);
  console.log('');
}

function cmdPick(args) {
  const id = args[0]; if (!id) die('usage: pick <id> [--note "..."]');
  const reg = loadRegistry();
  const t = findTerminal(reg, id);

  // Guard: terminal already claimed by another session?
  if (t.status !== 'not_started' && t.status !== 'released') {
    die(`terminal ${t.id} is ${t.status} (claimed_by=${t.claimed_by || 'unknown'}). ` +
        `Run 'cerniq-terminal release ${t.id}' first or 'resume ${t.id}' to continue.`, 1);
  }

  // Guard: unresolved deps?
  const unmet = (t.depends_on || []).filter((dep) => {
    const d = reg.terminals.find((x) => x.id === dep);
    return d && d.status !== 'shipped';
  });
  if (unmet.length > 0) {
    console.warn(c('yellow', `  warning — depends_on not shipped: ${unmet.join(', ')}`));
  }

  // Critical terminals take exclusive; others advisory. We rely on peers'
  // overlap detection for the advisory layer.
  const noteIdx = args.indexOf('--note');
  const note = noteIdx >= 0 ? args[noteIdx + 1] : `terminal ${t.id} — ${t.task.slice(0, 40)}`;
  const paths = (t.files || []).join(',');
  const scope = `agents-${t.id.toLowerCase()}`;

  const peersRes = peers(['claim', 'cerniq', scope, '--paths', paths, '--note', note]);
  if (!peersRes.ok) {
    // Overlap from peers: for critical, refuse; otherwise warn and continue.
    if (t.critical) {
      console.error(peersRes.stderr);
      die(`CRITICAL terminal ${t.id} — exclusive claim refused by peers.`, 1);
    } else {
      console.warn(c('yellow', `  peers warning: ${peersRes.stderr.trim()}`));
    }
  } else if (peersRes.stdout) {
    process.stdout.write(peersRes.stdout);
  }

  t.status = 'claimed';
  t.claimed_by = process.env.CLAUDE_SESSION_ID || process.env.USER || 'local';
  t.claimed_at = new Date().toISOString();
  t.updated_at = t.claimed_at;
  saveRegistry(reg);

  console.log(c('green', `\n  ✓ claimed ${t.id} — ${t.task}`));
  console.log(c('grey', `    write-set: ${paths || '(none)'}`));
  console.log(c('grey', `    next: cerniq-terminal start ${t.id}\n`));
}

function cmdStart(args) {
  const id = args[0]; if (!id) die('usage: start <id>');
  const reg = loadRegistry();
  const t = findTerminal(reg, id);
  if (t.status !== 'claimed') die(`terminal ${t.id} must be claimed first (current: ${t.status})`, 1);
  setStatus(reg, id, 'in_progress');
  console.log(c('cyan', `  ▶ ${t.id} in progress`));
}

function cmdDone(args) {
  const id = args[0]; if (!id) die('usage: done <id>');
  const reg = loadRegistry();
  const t = findTerminal(reg, id);
  if (t.status === 'shipped') { console.log(c('grey', `  ${t.id} already shipped`)); return; }
  setStatus(reg, id, 'shipped');
  peers(['release', 'cerniq']);
  console.log(c('green', `  ✓ ${t.id} shipped`));
  const next = (t.unblocks || []).map((x) => reg.terminals.find((r) => r.id === x)).filter(Boolean);
  if (next.length) {
    console.log(c('grey', '  unblocked:'));
    for (const n of next) console.log(`    ${statusGlyph(n.status)} ${n.id}  ${n.task}`);
  }
}

function cmdRelease(args) {
  const id = args[0]; if (!id) die('usage: release <id>');
  const reg = loadRegistry();
  const t = findTerminal(reg, id);
  t.status = 'not_started';
  t.claimed_by = null;
  t.updated_at = new Date().toISOString();
  saveRegistry(reg);
  peers(['release', 'cerniq']);
  console.log(c('grey', `  ↶ ${t.id} released`));
}

function cmdStatus() {
  const reg = loadRegistry();
  const by = { shipped: 0, in_progress: 0, claimed: 0, not_started: 0, released: 0 };
  for (const t of reg.terminals) by[t.status] = (by[t.status] || 0) + 1;
  const total = reg.terminals.length;
  const pct = Math.round((by.shipped / total) * 100);
  console.log(c('bold', `\n  CERNIQ · 50-terminal progress  ${by.shipped}/${total}  (${pct}%)\n`));
  console.log(`    ${c('green', '✓')} shipped      ${by.shipped}`);
  console.log(`    ${c('yellow', '▶')} in progress  ${by.in_progress}`);
  console.log(`    ${c('cyan', '◉')} claimed      ${by.claimed}`);
  console.log(`    ${c('grey', '·')} not started  ${by.not_started}`);
  console.log('');
  const peersRes = peers(['status']);
  if (peersRes.ok && peersRes.stdout) {
    console.log(c('grey', '  — peers snapshot —'));
    process.stdout.write(peersRes.stdout);
  }
}

function cmdHandoff(args) {
  const id = args[0]; if (!id) die('usage: handoff <id>');
  const reg = loadRegistry();
  const t = findTerminal(reg, id);
  mkdirSync(HANDOFF_DIR, { recursive: true });
  const path = join(HANDOFF_DIR, `${t.id}.md`);
  const now = new Date().toISOString();
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const entry = `\n## ${now} — ${t.claimed_by || 'unknown'}\n\nStatus at handoff: ${t.status}\nTask: ${t.task}\n\n> TODO: record progress notes, unknowns, and next step\n`;
  writeFileSync(path, existing || `# Handoff · ${t.id}\n${entry}`, 'utf8');
  peers(['heartbeat']);
  console.log(c('cyan', `  ✎ handoff note at ${path}`));
  console.log(c('grey', `    next session: cerniq-terminal resume ${t.id}`));
}

function cmdResume(args) {
  const id = args[0]; if (!id) die('usage: resume <id>');
  const reg = loadRegistry();
  const t = findTerminal(reg, id);
  const path = join(HANDOFF_DIR, `${t.id}.md`);
  if (!existsSync(path)) die(`no handoff note at ${path}`, 1);
  console.log(c('bold', `\n  Resuming ${t.id}  ${t.task}\n`));
  process.stdout.write(readFileSync(path, 'utf8'));
  console.log('');
}

// ─── Doctor — registry integrity check ───────────────────────────────────

function cmdDoctor() {
  const reg = loadRegistry();
  const ids = new Set();
  const issues = [];
  const VALID_STATUS = new Set(['not_started', 'claimed', 'in_progress', 'shipped', 'released']);
  const clusterKeys = new Set(Object.keys(reg.clusters));

  // Pass 1: structural integrity
  for (const t of reg.terminals) {
    if (ids.has(t.id)) issues.push({ sev: 'ERR', id: t.id, msg: `duplicate terminal id` });
    ids.add(t.id);
    if (!clusterKeys.has(t.cluster)) issues.push({ sev: 'ERR', id: t.id, msg: `unknown cluster '${t.cluster}'` });
    if (![1, 2, 3].includes(t.sprint)) issues.push({ sev: 'WARN', id: t.id, msg: `sprint ${t.sprint} outside [1,3]` });
    if (!VALID_STATUS.has(t.status)) issues.push({ sev: 'ERR', id: t.id, msg: `unknown status '${t.status}'` });
    if (t.critical && (!t.files || t.files.length === 0)) issues.push({ sev: 'WARN', id: t.id, msg: 'critical=true but no files in write-set' });
  }

  // Pass 2: dep refs exist
  for (const t of reg.terminals) {
    for (const dep of (t.depends_on || [])) {
      if (!ids.has(dep)) issues.push({ sev: 'ERR', id: t.id, msg: `depends_on '${dep}' does not exist` });
    }
    for (const un of (t.unblocks || [])) {
      if (!ids.has(un)) issues.push({ sev: 'ERR', id: t.id, msg: `unblocks '${un}' does not exist` });
    }
  }

  // Pass 3: symmetry check — if A.unblocks includes B, then B.depends_on should include A
  for (const t of reg.terminals) {
    for (const un of (t.unblocks || [])) {
      const target = reg.terminals.find((x) => x.id === un);
      if (target && !(target.depends_on || []).includes(t.id)) {
        issues.push({ sev: 'WARN', id: t.id, msg: `unblocks ${un} but ${un}.depends_on does not include ${t.id}` });
      }
    }
  }

  // Pass 4: cycle detection via topological sort (Kahn's algorithm)
  const inDeg = new Map(); const adj = new Map();
  for (const t of reg.terminals) { inDeg.set(t.id, 0); adj.set(t.id, []); }
  for (const t of reg.terminals) {
    for (const dep of (t.depends_on || [])) {
      if (adj.has(dep)) { adj.get(dep).push(t.id); inDeg.set(t.id, (inDeg.get(t.id) || 0) + 1); }
    }
  }
  const queue = []; for (const [id, deg] of inDeg) if (deg === 0) queue.push(id);
  let visited = 0;
  while (queue.length > 0) {
    const cur = queue.shift(); visited++;
    for (const next of (adj.get(cur) || [])) {
      inDeg.set(next, inDeg.get(next) - 1);
      if (inDeg.get(next) === 0) queue.push(next);
    }
  }
  if (visited < reg.terminals.length) {
    const stuck = reg.terminals.filter((t) => inDeg.get(t.id) > 0).map((t) => t.id);
    issues.push({ sev: 'ERR', id: '-', msg: `dependency cycle detected involving: ${stuck.join(', ')}` });
  }

  // Pass 5: files exist (check parent dir at least)
  for (const t of reg.terminals) {
    for (const f of (t.files || [])) {
      const abs = join(REPO_ROOT, f);
      const dir = dirname(abs);
      if (!existsSync(dir) && !f.includes('__')) {
        issues.push({ sev: 'WARN', id: t.id, msg: `parent dir missing for file: ${f}` });
      }
    }
  }

  // Report
  const errs = issues.filter((i) => i.sev === 'ERR');
  const warns = issues.filter((i) => i.sev === 'WARN');
  console.log(c('bold', `\n  cerniq:terminal doctor — registry integrity\n`));
  if (issues.length === 0) {
    console.log(c('green', '  ✓ all checks passed\n'));
    return;
  }
  for (const i of errs) console.log(`  ${c('red', 'ERR')}  [${i.id}]  ${i.msg}`);
  for (const i of warns) console.log(`  ${c('yellow', 'WARN')} [${i.id}]  ${i.msg}`);
  console.log(`\n  ${c('red', String(errs.length))} errors, ${c('yellow', String(warns.length))} warnings\n`);
  if (errs.length > 0) process.exit(1);
}

// ─── Graph — DAG visualization by sprint ─────────────────────────────────

function cmdGraph(args) {
  const reg = loadRegistry();
  const format = args.includes('--mermaid') ? 'mermaid' : 'ascii';

  if (format === 'mermaid') {
    console.log('graph LR');
    for (const t of reg.terminals) {
      const shape = t.critical ? `{{${t.id}}}` : `[${t.id}]`;
      const cls = t.status === 'shipped' ? ':::shipped' : t.status === 'in_progress' ? ':::active' : '';
      console.log(`  ${t.id}${shape}${cls}`);
      for (const dep of (t.depends_on || [])) console.log(`  ${dep} --> ${t.id}`);
    }
    console.log('  classDef shipped fill:#22c55e,color:#fff');
    console.log('  classDef active fill:#eab308,color:#000');
    return;
  }

  // ASCII: show by sprint, terminals grouped by cluster, arrows simplified
  for (const sprint of [1, 2, 3]) {
    const terms = reg.terminals.filter((t) => t.sprint === sprint);
    if (terms.length === 0) continue;
    console.log(c('bold', `\n  ── Sprint ${sprint} ──────────────────────────────────`));
    const byCluster = groupBy(terms, 'cluster');
    for (const cluster of Object.keys(byCluster).sort()) {
      const row = byCluster[cluster].map((t) => {
        const glyph = statusGlyph(t.status);
        const crit = t.critical ? c('red', '!') : ' ';
        return `${glyph}${crit}${t.id}`;
      });
      const meta = reg.clusters[cluster];
      const deps = byCluster[cluster]
        .flatMap((t) => (t.depends_on || []).filter((d) => !byCluster[cluster].some((x) => x.id === d)))
        .filter((v, i, a) => a.indexOf(v) === i);
      const arrow = deps.length ? c('grey', ` ← ${deps.join(',')}`) : '';
      console.log(`    ${c('cyan', cluster.padEnd(3))} ${row.join('  ')}${arrow}  ${c('grey', meta.name)}`);
    }
  }

  // Critical path: longest chain of non-shipped terminals
  const topo = topoSort(reg.terminals);
  const dist = new Map();
  let maxDist = 0; let maxId = null;
  for (const id of topo) {
    const t = reg.terminals.find((x) => x.id === id);
    if (t.status === 'shipped') { dist.set(id, 0); continue; }
    const d = Math.max(1, ...(t.depends_on || []).map((dep) => (dist.get(dep) || 0) + 1));
    dist.set(id, d);
    if (d > maxDist) { maxDist = d; maxId = id; }
  }
  if (maxId) {
    const chain = []; let cur = maxId;
    while (cur) {
      chain.unshift(cur);
      const t = reg.terminals.find((x) => x.id === cur);
      const parents = (t.depends_on || []).filter((d) => {
        const dt = reg.terminals.find((x) => x.id === d);
        return dt && dt.status !== 'shipped';
      });
      cur = parents.sort((a, b) => (dist.get(b) || 0) - (dist.get(a) || 0))[0] || null;
    }
    console.log(c('bold', `\n  critical path (${chain.length} deep):`));
    console.log(`    ${chain.map((id) => { const t = reg.terminals.find((x) => x.id === id); return `${statusGlyph(t.status)}${t.id}`; }).join(' → ')}\n`);
  }
}

function topoSort(terminals) {
  const inDeg = new Map(); const adj = new Map(); const result = [];
  for (const t of terminals) { inDeg.set(t.id, 0); adj.set(t.id, []); }
  for (const t of terminals) {
    for (const dep of (t.depends_on || [])) {
      if (adj.has(dep)) { adj.get(dep).push(t.id); inDeg.set(t.id, (inDeg.get(t.id) || 0) + 1); }
    }
  }
  const q = []; for (const [id, deg] of inDeg) if (deg === 0) q.push(id);
  while (q.length > 0) { const cur = q.shift(); result.push(cur); for (const n of (adj.get(cur) || [])) { inDeg.set(n, inDeg.get(n) - 1); if (inDeg.get(n) === 0) q.push(n); } }
  return result;
}

// ─── Diff — peer claims vs. registry ─────────────────────────────────────

function cmdDiff() {
  const reg = loadRegistry();
  const peersRes = peers(['status', '--json']);
  let peerClaims = [];
  if (peersRes.ok && peersRes.stdout) {
    try {
      const parsed = JSON.parse(peersRes.stdout);
      peerClaims = Array.isArray(parsed) ? parsed : Array.isArray(parsed.active) ? parsed.active : [];
    } catch { /* peers might not support --json */ }
  }
  // If --json not supported or returned non-array, parse plain text for paths
  if (peerClaims.length === 0 && peersRes.stdout) {
    const pathMatches = peersRes.stdout.matchAll(/paths=([^\s]+)/g);
    for (const m of pathMatches) {
      peerClaims.push({ paths: m[1].split(',') });
    }
  }

  const peerPaths = new Set(peerClaims.flatMap((c) => c.paths || []));
  const regPaths = new Map();
  for (const t of reg.terminals) {
    for (const f of (t.files || [])) regPaths.set(f, t);
  }

  console.log(c('bold', `\n  cerniq:terminal diff — peer claims vs. registry\n`));

  // Peer paths not in any terminal's write-set
  const unmapped = [];
  for (const p of peerPaths) {
    let found = false;
    for (const [f] of regPaths) {
      if (p === f || f.startsWith(p) || p.startsWith(f)) { found = true; break; }
    }
    if (!found) unmapped.push(p);
  }
  if (unmapped.length > 0) {
    console.log(c('yellow', '  peer paths outside any terminal write-set:'));
    for (const p of unmapped) console.log(`    ${c('grey', p)}`);
  }

  // Terminals claimed in registry but no matching peer claim
  const claimed = reg.terminals.filter((t) => t.status === 'claimed' || t.status === 'in_progress');
  const orphanClaims = claimed.filter((t) => {
    return !(t.files || []).some((f) => {
      for (const p of peerPaths) if (p === f || f.startsWith(p) || p.startsWith(f)) return true;
      return false;
    });
  });
  if (orphanClaims.length > 0) {
    console.log(c('yellow', '\n  terminals claimed in registry but no matching peer claim:'));
    for (const t of orphanClaims) console.log(`    ${t.id}  ${t.task}`);
  }

  if (unmapped.length === 0 && orphanClaims.length === 0) {
    console.log(c('green', '  ✓ peers and registry are in sync\n'));
  } else {
    console.log('');
  }
}

function cmdHelp() {
  console.log(`
  ${c('bold', 'cerniq-terminal')} — 50-terminal parallel work CLI

  ${c('bold', 'Discover')}
    list [--cluster X] [--sprint N] [--status S] [--critical] [--open]
    show <id>                  details for one terminal
    deps <id>                  upstream + downstream deps
    status                     overall progress + peers snapshot

  ${c('bold', 'Claim lifecycle')}
    pick <id> [--note "..."]   claim + create peers claim on write-set
    start <id>                 mark in_progress
    done <id>                  mark shipped + release peers
    release <id>               abandon a claim

  ${c('bold', 'Handoff (mid-session)')}
    handoff <id>               write .cerniq/handoff/<id>.md + keep peers alive
    resume <id>                print last handoff note

  ${c('bold', 'Integrity + observability')}
    doctor                     validate registry (deps, cycles, files, symmetry)
    graph [--mermaid]          DAG visualization + critical path
    diff                       compare peer claims vs. registry

  ${c('grey', 'Doctrine: .cerniq/CONTRACTS.md')}
  ${c('grey', 'Registry: .cerniq/terminals.json')}
`);
}

// ─── Entry ───────────────────────────────────────────────────────────────

const [, , cmd, ...rest] = process.argv;
switch (cmd) {
  case 'list':     cmdList(rest); break;
  case 'show':     cmdShow(rest); break;
  case 'deps':     cmdDeps(rest); break;
  case 'pick':     cmdPick(rest); break;
  case 'start':    cmdStart(rest); break;
  case 'done':     cmdDone(rest); break;
  case 'release':  cmdRelease(rest); break;
  case 'status':   cmdStatus(); break;
  case 'handoff':  cmdHandoff(rest); break;
  case 'resume':   cmdResume(rest); break;
  case 'doctor':   cmdDoctor(); break;
  case 'graph':    cmdGraph(rest); break;
  case 'diff':     cmdDiff(); break;
  case 'help':
  case '-h':
  case '--help':
  case undefined:  cmdHelp(); break;
  default:         die(`unknown command: ${cmd}\n  run 'cerniq-terminal help'`);
}
