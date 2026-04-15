// scripts/session/_lib.mjs
// Shared helpers for the multi-terminal session coordinator.
//
// This layer coordinates *Claude Code sessions running in different terminals*
// against the same working tree. It is additive — it does not replace the
// OMX swarm substrate under .omx/state/team/<mission>/, which coordinates
// leader-launched worker pools. Ad-hoc interactive terminals register here
// under .omx/state/team/sessions/.
//
// Protocol doc: docs/SESSION_COORDINATION.md

import { mkdirSync, readdirSync, readFileSync, writeFileSync, renameSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(__dirname, '..', '..');
export const SESSIONS_DIR = join(REPO_ROOT, '.omx', 'state', 'team', 'sessions');

// Staleness: a session whose heartbeat is older than this is considered dead.
// Tuned for an interactive coding cadence — long enough to survive a long
// test run, short enough that a crashed terminal doesn't block others for an
// entire work session.
export const STALE_MS = 30 * 60 * 1000;

export const C = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  gray: (s) => `\x1b[90m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

export function ensureSessionsDir() {
  mkdirSync(SESSIONS_DIR, { recursive: true });
}

export function sessionPath(nickname) {
  return join(SESSIONS_DIR, `${nickname}.json`);
}

// Atomic write: write to tmp, rename into place. Prevents half-written files
// when two processes race on the same session file.
export function writeSessionAtomic(nickname, data) {
  ensureSessionsDir();
  const target = sessionPath(nickname);
  const tmp = `${target}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  renameSync(tmp, target);
}

export function readSession(nickname) {
  const p = sessionPath(nickname);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

export function listSessions() {
  if (!existsSync(SESSIONS_DIR)) return [];
  return readdirSync(SESSIONS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -5))
    .map((nick) => readSession(nick))
    .filter(Boolean);
}

export function removeSession(nickname) {
  const p = sessionPath(nickname);
  if (existsSync(p)) rmSync(p);
}

export function isStale(session, now = Date.now()) {
  const hb = new Date(session.heartbeat_at || session.started_at || 0).getTime();
  return now - hb > STALE_MS;
}

export function liveSessions(excludeNickname = null) {
  const now = Date.now();
  return listSessions().filter(
    (s) => s && !isStale(s, now) && s.nickname !== excludeNickname,
  );
}

// ─────────────────────────────────────────────────────────────────────────
// CONFLICT POLICY — this is the single most consequential choice in the
// coordinator. Given two sessions' claimed path-prefixes, what counts as a
// collision worth warning about?
//
// Current policy: strict prefix overlap (bidirectional). If either claim is
// a prefix of the other, or they're exactly equal, it's a conflict.
//
//   "backend-node/src/alm"           vs "backend-node/src/alm/services" → conflict
//   "backend-node/src/alm"           vs "backend-node/src/risk"         → safe
//   "docs"                           vs "docs"                          → conflict
//
// This is strict by design — false positives are cheap (you acknowledge and
// move on), false negatives are expensive (silent clobber of another
// terminal's WIP). If you want to soften (e.g. allow shared read-only tags,
// or file-level claims), edit the single predicate below; callers don't
// change.
// ─────────────────────────────────────────────────────────────────────────
export function pathsConflict(a, b) {
  const norm = (p) => p.replace(/\/+$/, '') + '/';
  const na = norm(a);
  const nb = norm(b);
  return na === nb || na.startsWith(nb) || nb.startsWith(na);
}

export function findConflicts(myClaims, otherSession) {
  const conflicts = [];
  for (const mine of myClaims) {
    for (const theirs of otherSession.claims || []) {
      if (pathsConflict(mine, theirs)) {
        conflicts.push({ mine, theirs, by: otherSession.nickname });
      }
    }
  }
  return conflicts;
}

export function nowIso() {
  return new Date().toISOString();
}

// Which session is the *caller*? Read from CERNIQ_SESSION env — the terminal
// sets this after `session:register`. Returns null if unset or invalid, in
// which case conflict checks fall back to "compare against every live session"
// (safe: no false-negative, only extra noise).
export function currentSessionNickname() {
  const raw = process.env.CERNIQ_SESSION;
  if (!raw || !/^[a-z0-9][a-z0-9-]{1,31}$/.test(raw)) return null;
  return raw;
}

export function currentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    }).trim();
  } catch {
    return 'unknown';
  }
}
