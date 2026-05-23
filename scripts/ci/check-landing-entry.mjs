#!/usr/bin/env node
// scripts/ci/check-landing-entry.mjs
// Pre-commit landing-gate. Refuses commits that touch src/app/lib paths
// without an accompanying landing entry, in EITHER of two forms:
//
//   (1) Direct: a new same-day bullet under docs/SESSION_HANDOFF.md's
//       `## 5. Recent landings` section.
//   (2) Incoming (RECOMMENDED for multi-peer sessions): a new staged
//       file under docs/handoff-incoming/ — the file's content IS the
//       bullet, and a periodic squash (scripts/squash-handoff-incoming.mjs)
//       prepends them to §5 in batch.
//
// Why two forms — SESSION_HANDOFF.md is a structural hot-spot in this
// repo. Every src commit by every peer is forced to touch it, producing
// chronic stage-race absorption (4 races on 2026-05-16 alone). The
// incoming pattern gives each peer a unique-named per-commit file with
// zero contention surface; the squash merges them safely at session
// boundaries. See [[feedback_shared_tree_git_coordination]] for the
// failure mode catalog and CLAUDE.md "Branch + commit protocol" for the
// convention.
//
// Skip with SKIP_LANDING=1 when the commit is genuinely non-landing
// (docs-only, hotfix, test flake, WIP branch).
//
// Exit codes:
//   0 — passed (commit doesn't need a landing, or landing exists)
//   1 — blocked (src change without same-day landing)

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const HANDOFF = join(REPO_ROOT, 'docs', 'SESSION_HANDOFF.md');

if (process.env.SKIP_LANDING === '1') {
  console.log('skipping landing-gate (SKIP_LANDING=1)');
  process.exit(0);
}

const SRC_PREFIXES = [
  'backend-node/src/',
  'backend-node/prisma/',
  'frontend/app/',
  'frontend/components/',
  'frontend/lib/',
  'frontend/e2e/',
];

let staged;
try {
  staged = execSync('git diff --cached --name-only --diff-filter=ACMR', {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);
} catch (err) {
  console.error('landing-gate: failed to read staged files:', err.message);
  process.exit(1);
}

const srcChanges = staged.filter((p) =>
  SRC_PREFIXES.some((prefix) => p.startsWith(prefix)),
);

if (srcChanges.length === 0) {
  // Non-code commit (docs-only, ops, config). No landing needed.
  process.exit(0);
}

if (!existsSync(HANDOFF)) {
  console.error(`landing-gate: docs/SESSION_HANDOFF.md missing — cannot verify landing entry`);
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const raw = readFileSync(HANDOFF, 'utf8');

// The commit must add a NEW landing bullet — compare staged vs HEAD.
// Counting today-dated bullets: staged must have strictly more than HEAD.
const todayBulletRegex = new RegExp(
  `^-\\s+${today}\\s+—\\s+\\*\\*`,
  'gm',
);

const countTodayBullets = (text) =>
  ((text || '').match(todayBulletRegex) || []).length;

let stagedHandoff = '';
try {
  stagedHandoff = execSync(`git show :docs/SESSION_HANDOFF.md`, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
} catch {
  stagedHandoff = raw; // not yet staged
}

let headHandoff = '';
try {
  headHandoff = execSync(`git show HEAD:docs/SESSION_HANDOFF.md`, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
} catch {
  headHandoff = '';
}

const stagedCount = countTodayBullets(stagedHandoff);
const headCount = countTodayBullets(headHandoff);
const addsDirectLanding = stagedCount > headCount;

// Form (2): any staged file under docs/handoff-incoming/ counts as a
// landing. Convention is one file per commit at
// docs/handoff-incoming/YYYY-MM-DD-<sha7>-<topic>.md whose content is
// the full bullet text. Filter to .md files added/modified/renamed —
// the diff-filter at the git query above is already ACMR.
const addsIncomingLanding = staged.some(
  (p) => p.startsWith('docs/handoff-incoming/') && p.endsWith('.md') && !p.endsWith('/README.md'),
);

const addsNewLanding = addsDirectLanding || addsIncomingLanding;

if (!addsNewLanding) {
  const count = srcChanges.length;
  const shown = srcChanges.slice(0, 5);
  console.error('');
  console.error(
    '\x1b[31mlanding-gate: refusing commit\x1b[0m — src/app/lib changes require a landing entry in ONE of:',
  );
  console.error(
    `  (1) \x1b[1mdocs/SESSION_HANDOFF.md\x1b[0m under \x1b[1m## 5. Recent landings\x1b[0m (direct — high-contention)`,
  );
  console.error(
    `  (2) \x1b[1mdocs/handoff-incoming/${today}-<sha7>-<topic>.md\x1b[0m (incoming — RECOMMENDED, zero contention)`,
  );
  console.error('');
  console.error(`  expected bullet: \x1b[36m- ${today} — **Your landing title.**\x1b[0m ...`);
  console.error('');
  console.error('\x1b[90m  Squash incoming → §5 with: node scripts/squash-handoff-incoming.mjs\x1b[0m');
  console.error('');
  console.error(`  ${count} staged src file(s):`);
  for (const p of shown) console.error(`    • ${p}`);
  if (count > shown.length) console.error(`    … and ${count - shown.length} more`);
  console.error('');
  console.error('\x1b[90m  Bypass (genuinely non-landing commit): SKIP_LANDING=1 git commit ...\x1b[0m');
  console.error('');
  process.exit(1);
}

process.exit(0);
