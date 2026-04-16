#!/usr/bin/env node
// scripts/swarm/fleet.mjs
// Fleet status dashboard. Aggregates:
//   - Vol.4 100-CLI registry (swarm assignments)
//   - Vol.3 50-terminal registry (agent layer progress)
//   - Active missions
//   - Latest health check
//   - Open incidents
//   - Live sessions
//
// Usage:
//   npm run swarm:fleet                   # full dashboard
//   npm run swarm:fleet -- --compact      # one-line-per-swarm

import {
  loadRegistry, allClisBySwarm, c, swarmGlyph, priorityColor,
  MISSIONS_DIR, HEALTH_DIR, EMERGENCIES_DIR, APPROVALS_PENDING,
  APPROVALS_APPROVED, APPROVALS_DENIED, AUDIT_DIR, REPO_ROOT,
  listJsonFiles, ensureDir,
} from './_lib.mjs';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const reg = loadRegistry();
const args = process.argv.slice(2);
const compact = args.includes('--compact');

function loadVol3() {
  const path = join(REPO_ROOT, '.cerniq', 'terminals.json');
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch { return null; }
}

function latestHealthSnapshot() {
  if (!existsSync(HEALTH_DIR)) return null;
  const files = readdirSync(HEALTH_DIR).filter((f) => f.endsWith('.json')).sort();
  if (files.length === 0) return null;
  try { return JSON.parse(readFileSync(join(HEALTH_DIR, files[files.length - 1]), 'utf8')); }
  catch { return null; }
}

function activeMissions() {
  return listJsonFiles(MISSIONS_DIR).filter((m) => m.status === 'active');
}

function openIncidents() {
  return listJsonFiles(EMERGENCIES_DIR).filter((i) => i.status === 'open');
}

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

function pendingApprovals() {
  return listJsonFiles(APPROVALS_PENDING);
}

function auditCount() {
  ensureDir(AUDIT_DIR);
  return readdirSync(AUDIT_DIR).filter((f) => f.endsWith('.json') || f.endsWith('.jsonl')).length;
}

// ─── Dashboard ──────────────────────────────────────────────────────────

const vol3 = loadVol3();
const health = latestHealthSnapshot();
const missions = activeMissions();
const incidents = openIncidents();
const sessions = liveSessions();
const approvals = pendingApprovals();
const auditEntries = auditCount();
const grouped = allClisBySwarm(reg);

console.log(c('bold', '\n  ╔═══════════════════════════════════════════════════════════╗'));
console.log(c('bold', '  ║           CERNIQ · FLEET STATUS DASHBOARD                ║'));
console.log(c('bold', '  ╚═══════════════════════════════════════════════════════════╝'));

// ─── Incidents ──────────────────────────────────────────────────────────

if (incidents.length > 0) {
  console.log(c('red', `\n  ⚠ ${incidents.length} OPEN P0 INCIDENT(S):`));
  for (const i of incidents) {
    console.log(`    ${c('red', '●')} ${c('bold', i.id)}  ${i.description.slice(0, 50)}`);
  }
}

// ─── Health ─────────────────────────────────────────────────────────────

if (health) {
  const { summary } = health;
  const statusLine = summary.critical_down > 0
    ? c('red', `${summary.critical_down} CRITICAL DOWN`)
    : c('green', 'ALL HEALTHY');
  console.log(`\n  ${c('bold', 'Health:')} ${statusLine}  ` +
    `${c('green', `${summary.green}G`)} ${c('yellow', `${summary.yellow}Y`)} ${c('red', `${summary.red}R`)}  ` +
    c('grey', `@ ${health.timestamp.slice(11, 19)}`));
} else {
  console.log(`\n  ${c('bold', 'Health:')} ${c('grey', 'no snapshot (run: npm run swarm:health)')}`);
}

// ─── Vol3 Progress ──────────────────────────────────────────────────────

if (vol3) {
  const counts = { shipped: 0, in_progress: 0, claimed: 0, not_started: 0 };
  for (const t of vol3.terminals) counts[t.status] = (counts[t.status] || 0) + 1;
  const total = vol3.terminals.length;
  const pct = Math.round((counts.shipped / total) * 100);
  console.log(
    `\n  ${c('bold', 'Vol.3 Agent Layer:')} ${c('green', `${counts.shipped}`)}/${total} shipped (${pct}%)  ` +
    `${c('yellow', `${counts.in_progress} active`)}  ${c('grey', `${counts.not_started} pending`)}`
  );
}

// ─── Active Sessions ────────────────────────────────────────────────────

if (sessions.length > 0) {
  console.log(`\n  ${c('bold', 'Live Sessions:')} ${sessions.length}`);
  for (const s of sessions) {
    const claims = (s.claims || []).length;
    console.log(`    ${c('cyan', '●')} ${c('bold', s.nickname.padEnd(20))} branch:${s.branch}  claims:${claims}`);
  }
} else {
  console.log(`\n  ${c('bold', 'Live Sessions:')} ${c('grey', 'none')}`);
}

// ─── Active Missions ────────────────────────────────────────────────────

if (missions.length > 0) {
  console.log(`\n  ${c('bold', 'Active Missions:')} ${missions.length}`);
  for (const m of missions) {
    console.log(
      `    ${c('yellow', '▶')} ${c(priorityColor(m.priority), m.priority)} ` +
      `${c('bold', m.cli_id.padEnd(8))} ${m.description.slice(0, 45)}${m.description.length > 45 ? '…' : ''}`
    );
  }
} else {
  console.log(`\n  ${c('bold', 'Active Missions:')} ${c('grey', 'none')}`);
}

// ─── Approvals ──────────────────────────────────────────────────────────

if (approvals.length > 0) {
  const t3 = approvals.filter((a) => a.tier === 3);
  const t2 = approvals.filter((a) => a.tier === 2);
  console.log(
    `\n  ${c('bold', 'Pending Approvals:')} ` +
    `${t3.length > 0 ? c('red', `${t3.length} Tier 3 (blocking)`) : ''}` +
    `${t3.length > 0 && t2.length > 0 ? '  ' : ''}` +
    `${t2.length > 0 ? c('yellow', `${t2.length} Tier 2 (post-hoc)`) : ''}`
  );
  for (const a of approvals.slice(0, 5)) {
    const tierColor = a.tier === 3 ? 'red' : 'yellow';
    console.log(
      `    ${c(tierColor, `T${a.tier}`)} ${c('bold', (a.cli || '?').padEnd(8))} ${(a.action || '').slice(0, 45)}`
    );
  }
} else {
  console.log(`\n  ${c('bold', 'Pending Approvals:')} ${c('green', 'none')}`);
}

// ─── Audit + Autonomy Tiers ─────────────────────────────────────────────

console.log(`\n  ${c('bold', 'Audit Trail:')} ${c('grey', `${auditEntries} entries`)}`);
if (reg.autonomy_tiers) {
  const tierKeys = Object.keys(reg.autonomy_tiers).sort();
  const tierLine = tierKeys.map((k) => {
    const t = reg.autonomy_tiers[k];
    const col = k === 'X' ? 'red' : k === '3' ? 'red' : k === '2' ? 'yellow' : k === '1' ? 'cyan' : 'green';
    return c(col, `${k}:${t.name}`);
  }).join('  ');
  console.log(`  ${c('bold', 'Autonomy:')}    ${tierLine}`);
}

// ─── Swarm Summary ──────────────────────────────────────────────────────

console.log(c('bold', '\n  Swarm Allocation:'));
console.log(c('grey', '  ' + '─'.repeat(55)));

for (const [swarmKey, clis] of Object.entries(grouped).sort()) {
  const swarm = reg.swarms[swarmKey];
  const terminal = swarm?.terminal || '—';
  const p0 = clis.filter((c) => c.priority === 'P0').length;
  const p1 = clis.filter((c) => c.priority === 'P1').length;
  const p2 = clis.filter((c) => c.priority === 'P2').length;
  const gateCount = swarm?.quality_gates ? Object.keys(swarm.quality_gates).length : 0;

  if (compact) {
    console.log(
      `  ${c('cyan', swarmGlyph(swarmKey))} ${swarmKey.padEnd(24)} ` +
      `${c('grey', terminal.padEnd(5))} ` +
      `${String(clis.length).padStart(3)} CLIs  ` +
      `${c('red', `${p0}P0`)} ${c('yellow', `${p1}P1`)} ${c('cyan', `${p2}P2`)}  ` +
      `${c('grey', `${gateCount} gates`)}`
    );
  } else {
    console.log(
      `  ${c('cyan', swarmGlyph(swarmKey))} ${c('bold', swarmKey.padEnd(24))} ` +
      `${c('grey', terminal)}  ${clis.length} CLIs  ` +
      `(${c('red', `${p0}P0`)} ${c('yellow', `${p1}P1`)} ${c('cyan', `${p2}P2`)})  ` +
      `${c('grey', `${gateCount} quality gates`)}`
    );
  }
}

console.log(c('grey', '\n  ' + '─'.repeat(55)));
console.log(
  `  ${c('bold', 'Total:')} ${reg.clis.length} CLIs across ${Object.keys(reg.swarms).length} swarms + ` +
  `${Object.keys(reg.terminals).length} terminals`
);
console.log('');
