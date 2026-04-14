#!/usr/bin/env node
// scripts/ci/check-landing-entry.mjs
// Pre-commit landing-gate. Refuses commits that touch src/app/lib paths
// without adding a same-day bullet under docs/SESSION_HANDOFF.md's
// `## 5. Recent landings` section.
//
// Rationale — Phase 4 convention from SESSION_HANDOFF.md:
//   "Each merged change appends to `## 5. Recent landings` below"
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
const addsNewLanding = stagedCount > headCount;

if (!addsNewLanding) {
  const count = srcChanges.length;
  const shown = srcChanges.slice(0, 5);
  console.error('');
  console.error(
    '\x1b[31mlanding-gate: refusing commit\x1b[0m — src/app/lib changes require a same-day entry in',
  );
  console.error(
    `  \x1b[1mdocs/SESSION_HANDOFF.md\x1b[0m under \x1b[1m## 5. Recent landings\x1b[0m`,
  );
  console.error('');
  console.error(`  expected bullet: \x1b[36m- ${today} — **Your landing title.**\x1b[0m ...`);
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
