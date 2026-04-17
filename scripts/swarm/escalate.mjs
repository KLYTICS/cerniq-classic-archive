#!/usr/bin/env node
// scripts/swarm/escalate.mjs
// Emergency escalation handler. Writes P0 incident files to .omx/state/emergencies/.
// All CLIs use this when they hit a production-down, data-corruption, or security event.
//
// Usage:
//   npm run swarm:escalate -- <CLI-ID> "description" [--systems backend,database]
//   npm run swarm:escalate -- list
//   npm run swarm:escalate -- resolve <INCIDENT-ID> "resolution"

import {
  loadRegistry, resolveCli, c, EMERGENCIES_DIR, writeAtomic,
  nowIso, dateStamp, ensureDir,
} from './_lib.mjs';
import { join } from 'node:path';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const reg = loadRegistry();
const [cmd, ...args] = process.argv.slice(2);

function allIncidents() {
  ensureDir(EMERGENCIES_DIR);
  return readdirSync(EMERGENCIES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try { return JSON.parse(readFileSync(join(EMERGENCIES_DIR, f), 'utf8')); }
      catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
}

function cmdCreate(args) {
  const cliId = args[0];
  if (!cliId) {
    console.error(c('red', 'swarm:escalate') + ' — CLI ID required');
    console.error('  usage: ' + c('cyan', 'npm run swarm:escalate -- E-01 "prod API 5xx on /demo" --systems backend'));
    process.exit(1);
  }

  const systemsIdx = args.indexOf('--systems');
  const systems = systemsIdx >= 0
    ? args[systemsIdx + 1]?.split(',').map((s) => s.trim()) || []
    : ['unknown'];

  const descParts = args.slice(1).filter((_, i) => {
    if (systemsIdx >= 0 && (i === systemsIdx - 1 || i === systemsIdx)) return false;
    return true;
  });
  const description = descParts.join(' ');

  if (!description) {
    console.error(c('red', 'swarm:escalate') + ' — description required');
    process.exit(1);
  }

  const resolved = resolveCli(reg, cliId);
  const id = `P0-${dateStamp()}`;

  const incident = {
    severity: 'P0',
    id,
    discovered_by: cliId.toUpperCase(),
    swarm: resolved?.cli?.swarm || 'unknown',
    timestamp: nowIso(),
    description,
    affected_systems: systems,
    immediate_actions_taken: [],
    do_not_touch: [],
    status: 'open',
    notify: 'T-10 immediately',
    resolved_at: null,
    resolution: null,
  };

  writeAtomic(join(EMERGENCIES_DIR, `${id}.json`), incident);

  console.log(c('red', '\n  ⚠⚠⚠  P0 EMERGENCY ESCALATION  ⚠⚠⚠'));
  console.log(c('grey', '  ' + '─'.repeat(50)));
  console.log(`  ID:          ${c('bold', id)}`);
  console.log(`  Discovered:  ${cliId.toUpperCase()} (${resolved?.cli?.role || 'unknown'})`);
  console.log(`  Systems:     ${systems.join(', ')}`);
  console.log(`  Description: ${description}`);
  console.log(`  Status:      ${c('red', 'OPEN')}`);
  console.log(c('grey', '  ' + '─'.repeat(50)));
  console.log(c('yellow', '\n  PROTOCOL:'));
  console.log('  1. All CLIs: STOP current work');
  console.log('  2. Release all claims: npm run session:release -- <nickname>');
  console.log('  3. Wait for T-10 (Erwin) direction');
  console.log(`  4. Incident file: ${c('grey', join(EMERGENCIES_DIR, `${id}.json`))}`);
  console.log('');
}

function cmdList() {
  const incidents = allIncidents();
  if (incidents.length === 0) {
    console.log(c('green', '\n  No incidents on record.\n'));
    return;
  }

  console.log(c('bold', `\n  CERNIQ · Emergency Log · ${incidents.length} incident(s)\n`));
  for (const inc of incidents) {
    const status = inc.status === 'open'
      ? c('red', '● OPEN')
      : c('green', '✓ RESOLVED');
    console.log(
      `  ${status}  ${c('bold', inc.id)}  ${inc.discovered_by}  ` +
      `${inc.description.slice(0, 50)}${inc.description.length > 50 ? '…' : ''}`
    );
    console.log(`           ${c('grey', inc.timestamp.slice(0, 16))}  systems: ${inc.affected_systems.join(', ')}`);
  }
  console.log('');
}

function cmdResolve(args) {
  const incidentId = args[0];
  const resolution = args.slice(1).join(' ') || 'resolved';

  if (!incidentId) {
    console.error(c('red', 'swarm:escalate resolve') + ' — incident ID required');
    process.exit(1);
  }

  const incidents = allIncidents();
  const incident = incidents.find((i) => i.id === incidentId || i.id.endsWith(incidentId));
  if (!incident) {
    console.error(c('red', `swarm:escalate — incident not found: ${incidentId}`));
    process.exit(1);
  }

  incident.status = 'resolved';
  incident.resolved_at = nowIso();
  incident.resolution = resolution;
  writeAtomic(join(EMERGENCIES_DIR, `${incident.id}.json`), incident);

  console.log(c('green', `\n  ✓ Incident resolved: ${incident.id}`));
  console.log(`    Resolution: ${resolution}\n`);
}

function cmdHelp() {
  console.log(`
  ${c('bold', 'swarm:escalate')} — P0 Emergency Escalation Handler

  ${c('bold', 'Commands')}
    <CLI-ID> "description" [--systems s1,s2]   File a P0 escalation
    list                                        Show all incidents
    resolve <INCIDENT-ID> "resolution"          Close an incident

  ${c('bold', 'Examples')}
    npm run swarm:escalate -- E-01 "API returning 5xx on /demo route" --systems backend,database
    npm run swarm:escalate -- list
    npm run swarm:escalate -- resolve P0-2026-04-16T12-00-00 "Restarted Railway service, root cause: OOM"
`);
}

switch (cmd) {
  case 'list':    cmdList(); break;
  case 'resolve': cmdResolve(args); break;
  case 'help':
  case '-h':
  case '--help':  cmdHelp(); break;
  default:
    if (cmd && !cmd.startsWith('-')) {
      cmdCreate([cmd, ...args]);
    } else {
      cmdHelp();
    }
}
