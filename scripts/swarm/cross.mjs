#!/usr/bin/env node
// scripts/swarm/cross.mjs
// Cross-swarm conflict detector. Scans for:
//   1. Overlapping scope paths between active missions in different swarms
//   2. Active sessions with claims that cross swarm boundaries
//   3. Vol.3 terminal claims conflicting with Vol.4 scope
//   4. Pending approvals that may conflict
//
// Usage:
//   npm run swarm:cross                     # full conflict scan
//   npm run swarm:cross -- --verbose        # include file-level detail
//   npm run swarm:cross -- --json           # machine-readable

import {
  loadRegistry, c, REPO_ROOT, MISSIONS_DIR, APPROVALS_PENDING,
  listJsonFiles, ensureDir,
} from './_lib.mjs';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const reg = loadRegistry();
const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const jsonMode = args.includes('--json');

function liveSessions() {
  const sessDir = join(REPO_ROOT, '.omx', 'state', 'team', 'sessions');
  if (!existsSync(sessDir)) return [];
  const staleMs = 30 * 60 * 1000;
  const now = Date.now();
  return readdirSync(sessDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try { return JSON.parse(readFileSync(join(sessDir, f), 'utf8')); }
      catch { return null; }
    })
    .filter((s) => {
      if (!s) return false;
      const hb = new Date(s.heartbeat_at || s.started_at || 0).getTime();
      return (now - hb) < staleMs;
    });
}

function vol3Terminals() {
  const path = join(REPO_ROOT, '.cerniq', 'terminals.json');
  if (!existsSync(path)) return [];
  try {
    const reg = JSON.parse(readFileSync(path, 'utf8'));
    return reg.terminals || [];
  } catch { return []; }
}

function pathsOverlap(a, b) {
  const na = a.replace(/\/+$/, '') + '/';
  const nb = b.replace(/\/+$/, '') + '/';
  return na === nb || na.startsWith(nb) || nb.startsWith(na);
}

const conflicts = [];

// ─── Check 1: Active mission scope overlaps across swarms ───────────────

const activeMissions = listJsonFiles(MISSIONS_DIR).filter((m) => m.status === 'active');
for (let i = 0; i < activeMissions.length; i++) {
  for (let j = i + 1; j < activeMissions.length; j++) {
    const a = activeMissions[i];
    const b = activeMissions[j];
    if (a.swarm === b.swarm) continue;

    const swarmA = reg.swarms[a.swarm];
    const swarmB = reg.swarms[b.swarm];
    if (!swarmA?.scope_paths || !swarmB?.scope_paths) continue;

    const overlaps = [];
    for (const pa of swarmA.scope_paths) {
      for (const pb of swarmB.scope_paths) {
        if (pathsOverlap(pa, pb)) overlaps.push({ a: pa, b: pb });
      }
    }

    if (overlaps.length > 0) {
      conflicts.push({
        type: 'mission-scope-overlap',
        severity: 'WARN',
        a: { mission: a.id, cli: a.cli_id, swarm: a.swarm },
        b: { mission: b.id, cli: b.cli_id, swarm: b.swarm },
        overlaps,
      });
    }
  }
}

// ─── Check 2: Session claims crossing swarm boundaries ──────────────────

const sessions = liveSessions();
for (const sess of sessions) {
  if (!sess.claims || sess.claims.length === 0) continue;
  const nickname = sess.nickname?.toUpperCase();
  const cli = reg.clis.find((c) => c.id === nickname);
  if (!cli) continue;

  const swarm = reg.swarms[cli.swarm];
  if (!swarm?.scope_paths) continue;

  const outOfScope = sess.claims.filter((claim) => {
    return !swarm.scope_paths.some((sp) => pathsOverlap(claim, sp));
  }).filter((claim) => {
    return !claim.startsWith('.omx/') && !claim.startsWith('docs/');
  });

  if (outOfScope.length > 0) {
    conflicts.push({
      type: 'session-scope-violation',
      severity: 'WARN',
      session: sess.nickname,
      swarm: cli.swarm,
      allowed: swarm.scope_paths,
      violations: outOfScope,
    });
  }
}

// ─── Check 3: Vol.3 terminal claims vs Vol.4 active missions ────────────

const vol3Active = vol3Terminals().filter((t) => t.status === 'claimed' || t.status === 'in_progress');
for (const t of vol3Active) {
  for (const mission of activeMissions) {
    const missionSwarm = reg.swarms[mission.swarm];
    if (!missionSwarm?.scope_paths) continue;

    const tFiles = t.files || [];
    const overlaps = [];
    for (const tf of tFiles) {
      for (const sp of missionSwarm.scope_paths) {
        if (pathsOverlap(tf, sp)) overlaps.push({ vol3_file: tf, vol4_scope: sp });
      }
    }

    if (overlaps.length > 0) {
      conflicts.push({
        type: 'vol3-vol4-overlap',
        severity: 'INFO',
        vol3_terminal: t.id,
        vol3_task: t.task,
        vol4_mission: mission.id,
        vol4_cli: mission.cli_id,
        overlaps,
      });
    }
  }
}

// ─── Check 4: Pending approvals for the same target ─────────────────────

const pendingApprovals = listJsonFiles(APPROVALS_PENDING);
for (let i = 0; i < pendingApprovals.length; i++) {
  for (let j = i + 1; j < pendingApprovals.length; j++) {
    const a = pendingApprovals[i];
    const b = pendingApprovals[j];
    if (a.type === b.type && a.target === b.target && a.cli !== b.cli) {
      conflicts.push({
        type: 'duplicate-approval',
        severity: 'WARN',
        a: { id: a.id, cli: a.cli, action: a.action },
        b: { id: b.id, cli: b.cli, action: b.action },
      });
    }
  }
}

// ─── Output ─────────────────────────────────────────────────────────────

if (jsonMode) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), conflicts }, null, 2));
  process.exit(conflicts.length > 0 ? 1 : 0);
}

console.log(c('bold', '\n  CERNIQ · Cross-Swarm Conflict Scan'));
console.log(c('grey', '  ' + '─'.repeat(55)));

if (conflicts.length === 0) {
  console.log(c('green', '\n  ✓ No cross-swarm conflicts detected\n'));
  console.log(c('grey', `  Checked: ${activeMissions.length} missions, ${sessions.length} sessions, ${vol3Active.length} Vol.3 claims, ${pendingApprovals.length} approvals\n`));
  process.exit(0);
}

const warns = conflicts.filter((c) => c.severity === 'WARN');
const infos = conflicts.filter((c) => c.severity === 'INFO');

for (const con of conflicts) {
  const sev = con.severity === 'WARN' ? c('yellow', 'WARN') : c('cyan', 'INFO');

  switch (con.type) {
    case 'mission-scope-overlap':
      console.log(`\n  ${sev}  Mission scope overlap`);
      console.log(`    ${c('bold', con.a.cli)} (${con.a.swarm}) ↔ ${c('bold', con.b.cli)} (${con.b.swarm})`);
      if (verbose) {
        for (const o of con.overlaps) console.log(`      ${c('grey', `${o.a} ↔ ${o.b}`)}`);
      }
      break;
    case 'session-scope-violation':
      console.log(`\n  ${sev}  Session ${c('bold', con.session)} has claims outside ${con.swarm} scope`);
      if (verbose) {
        for (const v of con.violations) console.log(`      ${c('yellow', '●')} ${v}`);
      }
      break;
    case 'vol3-vol4-overlap':
      console.log(`\n  ${sev}  Vol.3 terminal ${c('bold', con.vol3_terminal)} overlaps Vol.4 mission ${c('bold', con.vol4_cli)}`);
      break;
    case 'duplicate-approval':
      console.log(`\n  ${sev}  Duplicate approvals: ${c('bold', con.a.cli)} + ${c('bold', con.b.cli)} → same target`);
      break;
  }
}

console.log(c('grey', '\n  ' + '─'.repeat(55)));
console.log(`  ${c('yellow', `${warns.length} warning(s)`)}  ${c('cyan', `${infos.length} info(s)`)}\n`);
process.exit(warns.length > 0 ? 1 : 0);
