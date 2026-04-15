#!/usr/bin/env node
// scripts/session/register.mjs
// Register an interactive Claude Code terminal session against the shared
// working tree. Mints a session file with nickname, pid, branch, cwd, and
// heartbeat. Re-running with the same nickname refreshes the heartbeat.
//
// Usage:
//   node scripts/session/register.mjs <nickname>
//   npm run session:register -- <nickname>
//
// Example nicknames: erwin-alm, erwin-portal, reviewer, audit-sweep.

import {
  C,
  nowIso,
  readSession,
  writeSessionAtomic,
  currentBranch,
  liveSessions,
  SESSIONS_DIR,
} from './_lib.mjs';

const nickname = process.argv[2];

if (!nickname || !/^[a-z0-9][a-z0-9-]{1,31}$/.test(nickname)) {
  console.error(C.red('session:register') + ' — nickname required');
  console.error('  format: lowercase letters/digits/hyphens, 2–32 chars');
  console.error('  example: ' + C.cyan('npm run session:register -- erwin-alm'));
  process.exit(1);
}

const existing = readSession(nickname);
const now = nowIso();

const session = existing
  ? { ...existing, heartbeat_at: now, pid: process.pid, branch: currentBranch(), cwd: process.cwd() }
  : {
      nickname,
      pid: process.pid,
      started_at: now,
      heartbeat_at: now,
      branch: currentBranch(),
      cwd: process.cwd(),
      claims: [],
      notes: '',
    };

writeSessionAtomic(nickname, session);

const others = liveSessions(nickname);
console.log(
  (existing ? C.yellow('↻ refreshed') : C.green('✓ registered')) +
    ` session ${C.bold(nickname)} — branch ${C.cyan(session.branch)}, pid ${session.pid}`,
);
console.log(C.gray(`  state: ${SESSIONS_DIR}/${nickname}.json`));

if (others.length) {
  console.log('');
  console.log(C.bold('Other live sessions:'));
  for (const s of others) {
    const claimCount = (s.claims || []).length;
    console.log(
      `  • ${C.cyan(s.nickname)} on ${s.branch} — ${claimCount} claim${claimCount === 1 ? '' : 's'}` +
        (s.notes ? `  ${C.gray(`(${s.notes})`)}` : ''),
    );
  }
  console.log('');
  console.log(C.gray('  Inspect claims: ') + 'npm run session:list');
}
