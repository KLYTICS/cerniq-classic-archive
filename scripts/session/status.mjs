#!/usr/bin/env node
// scripts/session/status.mjs
// Unified cross-layer status. Shows:
//   (1) this terminal's repo-layer session (by CERNIQ_SESSION env)
//   (2) all live repo-layer peers
//   (3) all live user-global claude-peers on project=cerniq
//
// Flags:
//   --json  machine-readable
//
// Usage: npm run session:status

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import {
  C,
  SESSIONS_DIR,
  STALE_MS,
  listSessions,
  isStale,
  currentSessionNickname,
} from './_lib.mjs';

const jsonMode = process.argv.includes('--json');
const PEER_CLAIMS_DIR = join(homedir(), '.claude', 'peers', 'claims');

function readJson(p) {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

function collectPeerClaims() {
  if (!existsSync(PEER_CLAIMS_DIR)) return [];
  const now = Date.now();
  const out = [];
  for (const f of readdirSync(PEER_CLAIMS_DIR)) {
    if (!f.startsWith('cerniq__') || !f.endsWith('.json')) continue;
    const c = readJson(join(PEER_CLAIMS_DIR, f));
    if (!c) continue;
    const hb = new Date(c.last_heartbeat || c.started_at || 0).getTime();
    const ttl = (c.ttl_seconds ?? 1800) * 1000;
    if (now - hb > ttl) continue;
    out.push({ ...c, _age_ms: now - hb, _ttl_ms: ttl });
  }
  return out;
}

const now = Date.now();
const me = currentSessionNickname();
const repoSessions = listSessions();
const peerClaims = collectPeerClaims();

if (jsonMode) {
  console.log(JSON.stringify({
    current_nickname: me,
    peer_session_id: process.env.CLAUDE_PEERS_SESSION || null,
    repo_sessions: repoSessions.map((s) => ({ ...s, stale: isStale(s, now) })),
    peer_claims: peerClaims,
  }, null, 2));
  process.exit(0);
}

// ── Human view ───────────────────────────────────────────────────────────
console.log(C.bold('CerniQ session status'));
console.log('');

// My identity
console.log(`  ${C.gray('CERNIQ_SESSION')}        ${me ? C.cyan(me) : C.gray('(unset)')}`);
console.log(`  ${C.gray('CLAUDE_PEERS_SESSION')}  ${process.env.CLAUDE_PEERS_SESSION ? C.cyan(process.env.CLAUDE_PEERS_SESSION) : C.gray('(unset)')}`);
console.log('');

// Repo layer
const liveRepo = repoSessions.filter((s) => !isStale(s, now));
console.log(C.bold(`Repo layer (${liveRepo.length} live):`));
if (liveRepo.length === 0) {
  console.log(C.gray('  (none)'));
} else {
  for (const s of liveRepo) {
    const self = s.nickname === me ? C.green(' ← this terminal') : '';
    const ageMin = Math.round((now - new Date(s.heartbeat_at || s.started_at).getTime()) / 60000);
    console.log(`  • ${C.bold(s.nickname)} on ${C.cyan(s.branch)} · ${ageMin}m ago${self}`);
    for (const c of s.claims || []) console.log(`      ${c}`);
  }
}
console.log('');

// Peer layer (CerniQ only)
console.log(C.bold(`Peer layer — project=cerniq (${peerClaims.length} live):`));
if (peerClaims.length === 0) {
  console.log(C.gray('  (none)'));
} else {
  for (const c of peerClaims) {
    const self = c.session_id === process.env.CLAUDE_PEERS_SESSION ? C.green(' ← this terminal') : '';
    const ageMin = Math.round(c._age_ms / 60000);
    const ttlMin = Math.round(c._ttl_ms / 60000);
    console.log(`  • ${C.bold(c.session_id)}${c.scope ? ':' + c.scope : ''} · ${ageMin}m ago (ttl ${ttlMin}m)${self}`);
    if (c.note) console.log(`      ${C.gray(c.note)}`);
    for (const p of c.paths || []) console.log(`      ${p}`);
  }
}
console.log('');

const skewWarn = [];
if (me && !repoSessions.find((s) => s.nickname === me)) {
  skewWarn.push(`CERNIQ_SESSION=${me} but no repo session file — run 'npm run session:register -- ${me}'`);
}
if (skewWarn.length) {
  for (const w of skewWarn) console.log(C.yellow('  ⚠ ') + w);
  console.log('');
}

console.log(C.gray(`  stale threshold: ${Math.round(STALE_MS / 60000)}m (repo) / 30m (peer TTL)`));
