#!/usr/bin/env node
// scripts/session/claim.mjs
// Claim one or more path-prefixes for the current session. Advisory:
// warns on conflict with another live session, does not block. Actual
// commit-time blocking is handled by scripts/ci/check-claim-conflicts.mjs
// (Round 2 — wired into .husky/pre-commit).
//
// Usage:
//   node scripts/session/claim.mjs <nickname> <path> [<path>...]
//   npm run session:claim -- erwin-alm backend-node/src/alm
//
// Conflicts are detected via pathsConflict() in _lib.mjs. See
// docs/SESSION_COORDINATION.md §3 for the policy.

import {
  C,
  readSession,
  writeSessionAtomic,
  liveSessions,
  findConflicts,
  nowIso,
} from './_lib.mjs';

const [nickname, ...newClaims] = process.argv.slice(2);

if (!nickname || newClaims.length === 0) {
  console.error(C.red('session:claim') + ' — nickname and at least one path required');
  console.error('  example: ' + C.cyan('npm run session:claim -- erwin-alm backend-node/src/alm frontend/app/alm'));
  process.exit(1);
}

const session = readSession(nickname);
if (!session) {
  console.error(C.red('session:claim') + ` — session ${C.bold(nickname)} not registered`);
  console.error('  run: ' + C.cyan(`npm run session:register -- ${nickname}`));
  process.exit(1);
}

// Normalize: strip leading ./ and trailing /.
const normalized = newClaims.map((p) => p.replace(/^\.\//, '').replace(/\/+$/, ''));

// Surface cross-session conflicts before mutating state.
const others = liveSessions(nickname);
const allConflicts = [];
for (const other of others) {
  const conflicts = findConflicts(normalized, other);
  if (conflicts.length) allConflicts.push(...conflicts);
}

if (allConflicts.length) {
  console.log(C.yellow('⚠ conflict') + ' — overlapping claims detected:');
  for (const c of allConflicts) {
    console.log(
      `  ${C.cyan(c.mine)} overlaps ${C.cyan(c.theirs)} (claimed by ${C.bold(c.by)})`,
    );
  }
  console.log('');
  console.log(C.gray('  Proceeding anyway — claim recorded. Coordinate with the other session.'));
  console.log('');
}

// Merge, dedupe, preserve order.
const merged = [...(session.claims || [])];
for (const p of normalized) if (!merged.includes(p)) merged.push(p);

writeSessionAtomic(nickname, { ...session, claims: merged, heartbeat_at: nowIso() });

console.log(C.green('✓ claimed') + ` ${normalized.length} path${normalized.length === 1 ? '' : 's'} for ${C.bold(nickname)}:`);
for (const p of normalized) console.log(`  • ${C.cyan(p)}`);
