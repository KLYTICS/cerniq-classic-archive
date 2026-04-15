#!/usr/bin/env node
// scripts/ci/check-claim-conflicts.mjs
//
// Pre-commit advisory gate. Checks whether this commit's staged files overlap
// any *other* live session's claimed paths, across two independent coordination
// layers:
//
//   (1) Repo-scoped:  .omx/state/team/sessions/<nickname>.json
//                     (written by `npm run session:claim`)
//   (2) User-global:  ~/.claude/peers/claims/cerniq__<sid>.json
//                     (written by `claude-peers claim cerniq ...`)
//
// Both layers are additive and advisory. Self-exclusion:
//   - CERNIQ_SESSION       → skip that nickname in layer (1)
//   - CLAUDE_PEERS_SESSION → skip that sid      in layer (2)
//
// Exit codes:
//   0 — no conflicts, SKIP_CLAIMS=1, or warn-only (default)
//   1 — STRICT_CLAIMS=1 and conflicts were found
//
// Bypass env:
//   SKIP_CLAIMS=1    skip the check entirely (e.g., automated rebase)
//   STRICT_CLAIMS=1  turn warn into block (rare; use for release branches)
//
// Style matches scripts/ci/check-landing-entry.mjs — the sibling gate.

import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const SESSIONS_DIR = join(REPO_ROOT, '.omx', 'state', 'team', 'sessions');
const PEER_CLAIMS_DIR = join(homedir(), '.claude', 'peers', 'claims');
const STALE_MS = 30 * 60 * 1000;

const C = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  gray: (s) => `\x1b[90m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

if (process.env.SKIP_CLAIMS === '1') {
  console.log(C.gray('skipping claim-conflict check (SKIP_CLAIMS=1)'));
  process.exit(0);
}

// ── 1. Staged files ─────────────────────────────────────────────────────
let staged;
try {
  staged = execSync('git diff --cached --name-only --diff-filter=ACMR', {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);
} catch (err) {
  // Match landing-gate behaviour: git failure is the committer's problem,
  // not this gate's. Surface clearly so it isn't a silent pass.
  console.error(C.red('claim-gate: failed to read staged files:'), err.message);
  process.exit(1);
}

if (staged.length === 0) process.exit(0);

// ── 2. Collect active claims from both layers ────────────────────────────
const now = Date.now();
const selfNickname = process.env.CERNIQ_SESSION || null;
const selfPeerSid = process.env.CLAUDE_PEERS_SESSION || null;

function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

function collectRepoClaims() {
  if (!existsSync(SESSIONS_DIR)) return [];
  const claims = [];
  for (const f of readdirSync(SESSIONS_DIR)) {
    if (!f.endsWith('.json')) continue;
    const s = readJson(join(SESSIONS_DIR, f));
    if (!s) continue;
    if (s.nickname === selfNickname) continue;
    const hb = new Date(s.heartbeat_at || s.started_at || 0).getTime();
    if (now - hb > STALE_MS) continue;
    for (const p of s.claims || []) {
      claims.push({ path: p, owner: s.nickname, layer: 'repo' });
    }
  }
  return claims;
}

function collectPeerClaims() {
  if (!existsSync(PEER_CLAIMS_DIR)) return [];
  const claims = [];
  for (const f of readdirSync(PEER_CLAIMS_DIR)) {
    if (!f.startsWith('cerniq__') || !f.endsWith('.json')) continue;
    const c = readJson(join(PEER_CLAIMS_DIR, f));
    if (!c) continue;
    if (c.session_id === selfPeerSid) continue;
    const hb = new Date(c.last_heartbeat || c.started_at || 0).getTime();
    const ttl = (c.ttl_seconds ?? 1800) * 1000;
    if (now - hb > ttl) continue;
    const label = `${c.session_id}${c.scope ? ':' + c.scope : ''}`;
    for (const p of c.paths || []) {
      claims.push({ path: p, owner: label, layer: 'peer' });
    }
  }
  return claims;
}

const allClaims = [...collectRepoClaims(), ...collectPeerClaims()];
if (allClaims.length === 0) process.exit(0);

// ── 3. Match staged paths against claims ─────────────────────────────────
// A claim covers a staged file iff stagedFile === claim.path OR
// stagedFile starts with claim.path + '/'. We explicitly avoid the
// `startsWith(claim.path)` trap that would match "src/foo" against
// "src/foobar".
function claimCoversFile(claimPath, filePath) {
  const norm = claimPath.replace(/\/+$/, '');
  return filePath === norm || filePath.startsWith(norm + '/');
}

const hits = [];
for (const file of staged) {
  for (const c of allClaims) {
    if (claimCoversFile(c.path, file)) {
      hits.push({ file, claim: c.path, owner: c.owner, layer: c.layer });
    }
  }
}

if (hits.length === 0) process.exit(0);

// ── 4. Report ────────────────────────────────────────────────────────────
const strict = process.env.STRICT_CLAIMS === '1';
const header = strict
  ? C.red('claim-gate: refusing commit — ') + 'staged files overlap another live session'
  : C.yellow('claim-gate: warning — ') + 'staged files overlap another live session';

console.error('');
console.error(header);
console.error('');

// Group by (owner, layer) for readable output
const grouped = new Map();
for (const h of hits) {
  const key = `${h.owner}  (${h.layer})`;
  if (!grouped.has(key)) grouped.set(key, []);
  grouped.get(key).push(h);
}
for (const [key, list] of grouped) {
  console.error(`  ${C.bold(key)}`);
  for (const h of list) {
    console.error(`    ${C.cyan(h.file)} covered by claim ${C.cyan(h.claim)}`);
  }
  console.error('');
}

console.error(C.gray('  Coordinate with the other session, then:'));
console.error(C.gray('    • ask them to `release` the overlapping path'));
console.error(C.gray('    • bypass (this commit only):  SKIP_CLAIMS=1 git commit ...'));
console.error('');

process.exit(strict ? 1 : 0);
