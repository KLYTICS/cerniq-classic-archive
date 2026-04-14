#!/usr/bin/env node
// scripts/cerniq-cross.mjs
// Cross-worktree / cross-terminal status aggregator.
//
// Lists every live git worktree (skips prunable/stale), shows each one's
// branch, HEAD, modified file count, lane classification of changes, and
// latest Recent-landings entry if it has its own SESSION_HANDOFF.md.
// Highlights collisions — two worktrees modifying the same path — so
// terminals on a multi-worktree setup don't stomp each other.
//
// Exit codes:
//   0 — no collisions
//   1 — one or more path collisions detected
//   2 — setup error (not in a git repo, etc.)

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, sep, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

// Lane map: longest-prefix-wins classification of repo-relative paths.
// Keep this ordered most-specific first.
const LANES = [
  ['backend-node/src/auth/', 'auth'],
  ['backend-node/src/billing/', 'billing'],
  ['backend-node/src/portal/', 'portal'],
  ['backend-node/src/alm/', 'alm'],
  ['backend-node/src/pipeline/', 'pipeline'],
  ['backend-node/src/ai/', 'ai'],
  ['backend-node/src/admin/', 'admin'],
  ['backend-node/prisma/', 'schema'],
  ['backend-node/src/', 'backend-misc'],
  ['frontend/app/portal/', 'portal'],
  ['frontend/app/auth/', 'auth'],
  ['frontend/app/login/', 'auth'],
  ['frontend/app/admin/', 'admin'],
  ['frontend/app/dashboard/', 'dashboard'],
  ['frontend/app/onboarding/', 'onboarding'],
  ['frontend/app/', 'frontend-pages'],
  ['frontend/components/', 'frontend-ui'],
  ['frontend/lib/', 'frontend-lib'],
  ['frontend/e2e/', 'e2e'],
  ['docs/', 'docs'],
  ['scripts/', 'ops'],
  ['.github/', 'ci'],
];

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  grey: '\x1b[90m',
};
const tty = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (color, s) => (tty ? `${C[color]}${s}${C.reset}` : s);

function fail(msg) {
  console.error(c('red', `cerniq:cross — ${msg}`));
  process.exit(2);
}

function run(cmd, args, opts = {}) {
  try {
    return execFileSync(cmd, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      ...opts,
    }).trim();
  } catch {
    return '';
  }
}

// Parse `git worktree list --porcelain` into structured records.
function listWorktrees() {
  const raw = run('git', ['worktree', 'list', '--porcelain'], {
    cwd: REPO_ROOT,
  });
  if (!raw) fail('not in a git repository or git unavailable');

  const worktrees = [];
  let current = null;
  for (const line of raw.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (current) worktrees.push(current);
      current = { path: line.slice('worktree '.length), head: '', branch: '', prunable: false, detached: false };
    } else if (line.startsWith('HEAD ')) {
      current.head = line.slice('HEAD '.length).slice(0, 8);
    } else if (line.startsWith('branch ')) {
      current.branch = line.slice('branch '.length).replace('refs/heads/', '');
    } else if (line === 'detached') {
      current.detached = true;
    } else if (line.startsWith('prunable')) {
      current.prunable = true;
    }
  }
  if (current) worktrees.push(current);
  return worktrees;
}

function classifyLane(path) {
  const p = path.split(sep).join(posix.sep);
  for (const [prefix, lane] of LANES) {
    if (p.startsWith(prefix)) return lane;
  }
  return 'other';
}

function modifiedPaths(worktreePath) {
  const out = run('git', ['-C', worktreePath, 'status', '--porcelain=v1'], {});
  if (!out) return [];
  return out
    .split('\n')
    .map((line) => line.slice(3).trim())
    .filter((p) => p && !p.startsWith('"'));
}

function latestLanding(worktreePath) {
  const handoff = join(worktreePath, 'docs', 'SESSION_HANDOFF.md');
  if (!existsSync(handoff)) return null;
  let raw;
  try {
    raw = readFileSync(handoff, 'utf8');
  } catch {
    return null;
  }
  const m = raw.match(/^-\s+(\d{4}-\d{2}-\d{2})\s+—\s+\*\*([^*]+?)\*\*/m);
  return m ? { date: m[1], title: m[2].slice(0, 64) } : null;
}

// Main.
const worktrees = listWorktrees();
const alive = worktrees.filter((w) => !w.prunable && existsSync(w.path));
const dead = worktrees.filter((w) => w.prunable || !existsSync(w.path));

// Aggregate modified files per worktree.
const byWorktree = [];
const pathOwners = new Map(); // repoRelativePath -> [worktreePaths]
for (const wt of alive) {
  const paths = modifiedPaths(wt.path);
  const lanes = new Map();
  for (const p of paths) {
    const lane = classifyLane(p);
    lanes.set(lane, (lanes.get(lane) ?? 0) + 1);
    const owners = pathOwners.get(p) ?? [];
    owners.push(wt.path);
    pathOwners.set(p, owners);
  }
  const landing = latestLanding(wt.path);
  byWorktree.push({
    ...wt,
    modifiedCount: paths.length,
    lanes,
    latestLanding: landing,
  });
}

// Collisions: paths modified in more than one worktree.
const collisions = [];
for (const [path, owners] of pathOwners) {
  if (owners.length > 1) collisions.push({ path, owners });
}

// Render.
console.log('');
console.log(c('bold', 'CerniQ — Cross-Worktree Terminal Map'));
console.log(c('grey', '─'.repeat(64)));
console.log(
  c('grey', `${alive.length} live · ${dead.length} prunable/stale (ignored)`),
);
console.log('');

for (const wt of byWorktree) {
  const label = wt.branch
    ? c('cyan', wt.branch)
    : c('yellow', `(detached ${wt.head})`);
  const short = wt.path.replace(process.env.HOME ?? '', '~');
  console.log(`${c('bold', label)}  ${c('grey', short)}`);
  console.log(
    `  HEAD ${c('bold', wt.head)}   modified: ${
      wt.modifiedCount === 0
        ? c('green', '0')
        : c('yellow', String(wt.modifiedCount))
    }`,
  );
  if (wt.lanes.size > 0) {
    const laneList = [...wt.lanes.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([lane, count]) => `${lane}×${count}`)
      .join(', ');
    console.log(`  lanes: ${c('cyan', laneList)}`);
  }
  if (wt.latestLanding) {
    console.log(
      `  last landing: ${c('grey', wt.latestLanding.date)} ${c(
        'grey',
        '· ' + wt.latestLanding.title,
      )}`,
    );
  }
  console.log('');
}

if (collisions.length > 0) {
  console.log(
    c('red', `⚠ Collisions — ${collisions.length} path(s) modified in multiple worktrees:`),
  );
  for (const col of collisions) {
    console.log(`  ${c('red', col.path)}`);
    for (const owner of col.owners) {
      console.log(c('grey', `    ← ${owner.replace(process.env.HOME ?? '', '~')}`));
    }
  }
  console.log('');
  console.log(
    c('yellow', 'Resolve before committing in any terminal — concurrent edits to the same file will fight.'),
  );
  process.exit(1);
}

console.log(c('green', '✓ no cross-worktree collisions'));
process.exit(0);
