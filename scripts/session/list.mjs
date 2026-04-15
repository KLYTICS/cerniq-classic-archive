#!/usr/bin/env node
// scripts/session/list.mjs
// Show all registered sessions, their claims, and health.
// Flags:
//   --all     include stale (dead-heartbeat) sessions
//   --json    machine-readable output

import { C, listSessions, isStale, STALE_MS } from './_lib.mjs';

const all = process.argv.includes('--all');
const json = process.argv.includes('--json');

const sessions = listSessions();
const now = Date.now();

if (json) {
  const out = sessions.map((s) => ({ ...s, stale: isStale(s, now) }));
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

if (sessions.length === 0) {
  console.log(C.gray('no sessions registered'));
  console.log(C.gray('  register: ') + 'npm run session:register -- <nickname>');
  process.exit(0);
}

const visible = all ? sessions : sessions.filter((s) => !isStale(s, now));
const hidden = sessions.length - visible.length;

console.log(C.bold(`Sessions (${visible.length}${all ? '' : ` live, ${hidden} stale hidden`}):`));
console.log('');

for (const s of visible) {
  const stale = isStale(s, now);
  const tag = stale ? C.red('[stale]') : C.green('[live]');
  const ageMin = Math.round((now - new Date(s.heartbeat_at || s.started_at).getTime()) / 60000);
  console.log(`${tag} ${C.bold(s.nickname)} — ${C.cyan(s.branch)} · pid ${s.pid} · ${ageMin}m ago`);
  if (s.notes) console.log(`        ${C.gray(s.notes)}`);
  if ((s.claims || []).length) {
    for (const c of s.claims) console.log(`        • ${c}`);
  } else {
    console.log(C.gray('        (no claims)'));
  }
  console.log('');
}

if (hidden > 0 && !all) {
  console.log(C.gray(`  ${hidden} stale session${hidden === 1 ? '' : 's'} hidden (heartbeat > ${Math.round(STALE_MS / 60000)}m old). Show with --all.`));
}
