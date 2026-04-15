#!/usr/bin/env node
// scripts/session/release.mjs
// Release path claims from a session, or end the session entirely.
//
// Usage:
//   node scripts/session/release.mjs <nickname> <path> [<path>...]   # release specific claims
//   node scripts/session/release.mjs <nickname> --all                # release all claims, keep session
//   node scripts/session/release.mjs <nickname> --end                # delete session file

import {
  C,
  readSession,
  writeSessionAtomic,
  removeSession,
  nowIso,
} from './_lib.mjs';

const [nickname, ...rest] = process.argv.slice(2);

if (!nickname || rest.length === 0) {
  console.error(C.red('session:release') + ' — nickname and paths|--all|--end required');
  console.error('  example: ' + C.cyan('npm run session:release -- erwin-alm backend-node/src/alm'));
  process.exit(1);
}

const session = readSession(nickname);
if (!session) {
  console.error(C.yellow('session:release') + ` — session ${C.bold(nickname)} not found (already released?)`);
  process.exit(0);
}

if (rest.includes('--end')) {
  removeSession(nickname);
  console.log(C.green('✓ ended') + ` session ${C.bold(nickname)}`);
  process.exit(0);
}

if (rest.includes('--all')) {
  writeSessionAtomic(nickname, { ...session, claims: [], heartbeat_at: nowIso() });
  console.log(C.green('✓ released') + ` all claims for ${C.bold(nickname)}`);
  process.exit(0);
}

const toRelease = rest.map((p) => p.replace(/^\.\//, '').replace(/\/+$/, ''));
const before = (session.claims || []).length;
const remaining = (session.claims || []).filter((c) => !toRelease.includes(c));
const released = before - remaining.length;

if (released === 0) {
  console.log(C.yellow('session:release') + ' — no matching claims found');
  console.log(C.gray('  current claims:'));
  for (const c of session.claims || []) console.log(C.gray(`    • ${c}`));
  process.exit(0);
}

writeSessionAtomic(nickname, { ...session, claims: remaining, heartbeat_at: nowIso() });
console.log(C.green('✓ released') + ` ${released} claim${released === 1 ? '' : 's'} for ${C.bold(nickname)}`);
