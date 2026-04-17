#!/usr/bin/env node
// scripts/swarm/metrics.mjs
// Aggregates operational telemetry across all swarm subsystems.
// Reads from .omx/state/ subdirectories and produces a unified metrics snapshot.
//
// Usage:
//   npm run swarm:metrics                   # dashboard view
//   npm run swarm:metrics -- --json         # machine-readable
//   npm run swarm:metrics -- --emit <event> # record a metric event

import {
  c, MISSIONS_DIR, HEALTH_DIR, EMERGENCIES_DIR, ALERTS_DIR,
  OMX_STATE, REPO_ROOT, listJsonFiles, writeAtomic, nowIso, ensureDir,
} from './_lib.mjs';
import { readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const METRICS_PATH = join(REPO_ROOT, '.omx', 'metrics.json');
const EVENTS_DIR = join(OMX_STATE, 'metrics-events');

function readCurrentMetrics() {
  if (!existsSync(METRICS_PATH)) return {};
  try { return JSON.parse(readFileSync(METRICS_PATH, 'utf8')); }
  catch { return {}; }
}

function countFiles(dir) {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter((f) => f.endsWith('.json')).length;
}

function latestFile(dir) {
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  if (files.length === 0) return null;
  try { return JSON.parse(readFileSync(join(dir, files[files.length - 1]), 'utf8')); }
  catch { return null; }
}

function sessionsDir() {
  return join(OMX_STATE, 'team', 'sessions');
}

function liveSessions() {
  const dir = sessionsDir();
  if (!existsSync(dir)) return [];
  const staleMs = 30 * 60 * 1000;
  const now = Date.now();
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try { return JSON.parse(readFileSync(join(dir, f), 'utf8')); }
      catch { return null; }
    })
    .filter((s) => {
      if (!s) return false;
      const hb = new Date(s.heartbeat_at || s.started_at || 0).getTime();
      return (now - hb) < staleMs;
    });
}

function missionsByStatus() {
  const missions = listJsonFiles(MISSIONS_DIR);
  return {
    active: missions.filter((m) => m.status === 'active').length,
    closed: missions.filter((m) => m.status === 'closed').length,
    total: missions.length,
  };
}

function incidentsByStatus() {
  const incidents = listJsonFiles(EMERGENCIES_DIR);
  return {
    open: incidents.filter((i) => i.status === 'open').length,
    resolved: incidents.filter((i) => i.status === 'resolved').length,
    total: incidents.length,
  };
}

function healthSummary() {
  const latest = latestFile(HEALTH_DIR);
  if (!latest) return { status: 'unknown', checks: 0, timestamp: null };
  const s = latest.summary || {};
  let status = 'GREEN';
  if (s.red > 0) status = 'RED';
  else if (s.yellow > 0) status = 'YELLOW';
  return {
    status,
    checks: s.total || 0,
    green: s.green || 0,
    yellow: s.yellow || 0,
    red: s.red || 0,
    critical_down: s.critical_down || 0,
    timestamp: latest.timestamp,
    snapshots_total: countFiles(HEALTH_DIR),
  };
}

function gatherMetrics() {
  const sessions = liveSessions();
  const missions = missionsByStatus();
  const incidents = incidentsByStatus();
  const health = healthSummary();
  const totalClaims = sessions.reduce((sum, s) => sum + (s.claims?.length || 0), 0);

  return {
    timestamp: nowIso(),
    sessions: {
      live: sessions.length,
      total_claims: totalClaims,
      nicknames: sessions.map((s) => s.nickname),
    },
    missions,
    incidents,
    health,
    alerts: { total: countFiles(ALERTS_DIR) },
    health_snapshots: countFiles(HEALTH_DIR),
  };
}

function cmdEmit(args) {
  const eventType = args[0];
  const eventData = args.slice(1).join(' ');
  if (!eventType) {
    console.error(c('red', 'swarm:metrics --emit') + ' — event type required');
    process.exit(1);
  }

  ensureDir(EVENTS_DIR);
  const event = {
    type: eventType,
    data: eventData || null,
    timestamp: nowIso(),
    pid: process.pid,
    cli: process.env.CERNIQ_SESSION || null,
  };

  const fileName = `${nowIso().replace(/[:.]/g, '-')}-${eventType}.json`;
  writeAtomic(join(EVENTS_DIR, fileName), event);
  console.log(c('green', `  ✓ metric event: ${eventType}`));
}

if (args.includes('--emit')) {
  const emitIdx = args.indexOf('--emit');
  cmdEmit(args.slice(emitIdx + 1));
  process.exit(0);
}

const metrics = gatherMetrics();

const existing = readCurrentMetrics();
const merged = {
  ...existing,
  last_activity: metrics.timestamp,
  swarm: metrics,
};
writeAtomic(METRICS_PATH, merged);

if (jsonMode) {
  console.log(JSON.stringify(metrics, null, 2));
  process.exit(0);
}

const h = metrics.health;
const healthStatus = h.status === 'GREEN' ? c('green', 'GREEN')
  : h.status === 'YELLOW' ? c('yellow', 'YELLOW')
  : h.status === 'RED' ? c('red', 'RED')
  : c('grey', 'UNKNOWN');

console.log(c('bold', '\n  CERNIQ · Swarm Telemetry'));
console.log(c('grey', `  ${metrics.timestamp}`));
console.log(c('grey', '  ' + '─'.repeat(50)));

console.log(`\n  ${c('bold', 'Fleet Health')}     ${healthStatus}`);
if (h.timestamp) {
  console.log(`    ${c('green', `${h.green}G`)} ${c('yellow', `${h.yellow}Y`)} ${c('red', `${h.red}R`)}  ` +
    `(${h.snapshots_total} snapshots)  ${c('grey', `@ ${h.timestamp.slice(11, 19)}`)}`);
}

console.log(`\n  ${c('bold', 'Sessions')}         ${metrics.sessions.live} live, ${metrics.sessions.total_claims} claims`);
if (metrics.sessions.nicknames.length > 0) {
  console.log(`    ${c('grey', metrics.sessions.nicknames.join(', '))}`);
}

console.log(`\n  ${c('bold', 'Missions')}         ${c('yellow', `${metrics.missions.active} active`)}  ${c('green', `${metrics.missions.closed} closed`)}  (${metrics.missions.total} total)`);

if (metrics.incidents.open > 0) {
  console.log(`\n  ${c('red', `⚠ Incidents`)}      ${c('red', `${metrics.incidents.open} OPEN`)}  ${c('green', `${metrics.incidents.resolved} resolved`)}`);
} else {
  console.log(`\n  ${c('bold', 'Incidents')}        ${c('green', '0 open')}  ${c('grey', `${metrics.incidents.resolved} resolved`)}`);
}

console.log(c('grey', '\n  ' + '─'.repeat(50)));
console.log(c('grey', `  written to: ${METRICS_PATH}\n`));
