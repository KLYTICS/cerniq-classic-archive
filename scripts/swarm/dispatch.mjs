#!/usr/bin/env node
// scripts/swarm/dispatch.mjs
// Create and manage mission dispatches for CLIs.
// Missions are written to .omx/state/missions/ as timestamped JSON files.
//
// Usage:
//   npm run swarm:dispatch -- create <CLI-ID> <PRIORITY> "Mission description"
//   npm run swarm:dispatch -- list [--active] [--swarm <name>]
//   npm run swarm:dispatch -- close <MISSION-ID>
//   npm run swarm:dispatch -- show <MISSION-ID>

import {
  loadRegistry, resolveCli, c, MISSIONS_DIR, writeAtomic, listJsonFiles,
  ensureDir, nowIso, dateStamp, priorityColor,
} from './_lib.mjs';
import { join, basename } from 'node:path';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';

const reg = loadRegistry();
const [cmd, ...args] = process.argv.slice(2);

function missionPath(id) {
  return join(MISSIONS_DIR, `${id}.json`);
}

function allMissions() {
  ensureDir(MISSIONS_DIR);
  return readdirSync(MISSIONS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try { return JSON.parse(readFileSync(join(MISSIONS_DIR, f), 'utf8')); }
      catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
}

function cmdCreate(args) {
  const cliId = args[0];
  const priority = args[1];
  const description = args.slice(2).join(' ');

  if (!cliId || !priority || !description) {
    console.error(c('red', 'swarm:dispatch create') + ' — usage: create <CLI-ID> <P0|P1|P2> "description"');
    process.exit(1);
  }

  if (!['P0', 'P1', 'P2'].includes(priority.toUpperCase())) {
    console.error(c('red', 'swarm:dispatch') + ` — invalid priority '${priority}' (use P0, P1, P2)`);
    process.exit(1);
  }

  const resolved = resolveCli(reg, cliId);
  if (!resolved) {
    console.error(c('red', `swarm:dispatch — unknown CLI: ${cliId}`));
    process.exit(1);
  }

  const { cli, swarm } = resolved;
  const id = `M-${dateStamp()}-${cli.id}`;
  const mission = {
    id,
    cli_id: cli.id,
    swarm: cli.swarm,
    terminal: swarm?.terminal || null,
    priority: priority.toUpperCase(),
    description,
    status: 'active',
    created_at: nowIso(),
    acceptance_criteria: [],
    constraints: [],
    bible_refs: swarm?.bible ? [swarm.bible] : [],
    closed_at: null,
    outcome: null,
  };

  writeAtomic(missionPath(id), mission);
  console.log(c('green', `\n  ✓ Mission dispatched: ${id}`));
  console.log(`    CLI:       ${c('bold', cli.id)} (${cli.role})`);
  console.log(`    Swarm:     ${cli.swarm}`);
  console.log(`    Priority:  ${c(priorityColor(mission.priority), mission.priority)}`);
  console.log(`    Mission:   ${description}`);
  console.log(`    File:      ${c('grey', missionPath(id))}\n`);
}

function cmdList(args) {
  const activeOnly = args.includes('--active');
  const swarmIdx = args.indexOf('--swarm');
  const swarmFilter = swarmIdx >= 0 ? args[swarmIdx + 1] : null;

  let missions = allMissions();
  if (activeOnly) missions = missions.filter((m) => m.status === 'active');
  if (swarmFilter) missions = missions.filter((m) => m.swarm?.includes(swarmFilter.toLowerCase()));

  if (missions.length === 0) {
    console.log(c('grey', '\n  No missions found.\n'));
    return;
  }

  console.log(c('bold', `\n  CERNIQ · Mission Dispatch Board · ${missions.length} mission(s)\n`));
  for (const m of missions) {
    const status = m.status === 'active'
      ? c('yellow', '▶ ACTIVE')
      : c('green', '✓ CLOSED');
    console.log(
      `  ${status}  ${c(priorityColor(m.priority), m.priority)}  ` +
      `${c('bold', m.cli_id.padEnd(8))} ${m.description.slice(0, 60)}` +
      (m.description.length > 60 ? '…' : '')
    );
    console.log(`           ${c('grey', m.id)}  ${c('grey', m.created_at.slice(0, 16))}`);
  }
  console.log('');
}

function cmdClose(args) {
  const missionId = args[0];
  const outcome = args.slice(1).join(' ') || 'completed';
  if (!missionId) {
    console.error(c('red', 'swarm:dispatch close') + ' — usage: close <MISSION-ID> [outcome]');
    process.exit(1);
  }

  const missions = allMissions();
  const mission = missions.find((m) => m.id === missionId || m.id.endsWith(missionId));
  if (!mission) {
    console.error(c('red', `swarm:dispatch — mission not found: ${missionId}`));
    process.exit(1);
  }

  mission.status = 'closed';
  mission.closed_at = nowIso();
  mission.outcome = outcome;
  writeAtomic(missionPath(mission.id), mission);
  console.log(c('green', `\n  ✓ Mission closed: ${mission.id}`));
  console.log(`    Outcome: ${outcome}\n`);
}

function cmdShow(args) {
  const missionId = args[0];
  if (!missionId) {
    console.error(c('red', 'swarm:dispatch show') + ' — usage: show <MISSION-ID>');
    process.exit(1);
  }

  const missions = allMissions();
  const mission = missions.find((m) => m.id === missionId || m.id.endsWith(missionId));
  if (!mission) {
    console.error(c('red', `swarm:dispatch — mission not found: ${missionId}`));
    process.exit(1);
  }

  console.log(`\n${c('bold', '  MISSION DISPATCH')}`);
  console.log(`  ${c('grey', '─'.repeat(50))}`);
  console.log(`  ID:          ${mission.id}`);
  console.log(`  CLI:         ${c('bold', mission.cli_id)}`);
  console.log(`  Swarm:       ${mission.swarm}`);
  console.log(`  Terminal:    ${mission.terminal}`);
  console.log(`  Priority:    ${c(priorityColor(mission.priority), mission.priority)}`);
  console.log(`  Status:      ${mission.status === 'active' ? c('yellow', 'ACTIVE') : c('green', 'CLOSED')}`);
  console.log(`  Created:     ${mission.created_at}`);
  if (mission.closed_at) console.log(`  Closed:      ${mission.closed_at}`);
  console.log(`  Description: ${mission.description}`);
  if (mission.outcome) console.log(`  Outcome:     ${mission.outcome}`);
  if (mission.bible_refs.length) console.log(`  Bibles:      ${mission.bible_refs.join(', ')}`);
  if (mission.acceptance_criteria.length) {
    console.log(`  Criteria:`);
    for (const ac of mission.acceptance_criteria) console.log(`    - ${ac}`);
  }
  console.log('');
}

function cmdHelp() {
  console.log(`
  ${c('bold', 'swarm:dispatch')} — Mission dispatch for the 100-CLI swarm

  ${c('bold', 'Commands')}
    create <CLI-ID> <P0|P1|P2> "description"   Dispatch a new mission
    list [--active] [--swarm <name>]            List missions
    show <MISSION-ID>                           Show mission details
    close <MISSION-ID> [outcome]                Close a mission

  ${c('bold', 'Examples')}
    npm run swarm:dispatch -- create E-01 P0 "Implement COSSEC PDF parser endpoint"
    npm run swarm:dispatch -- list --active
    npm run swarm:dispatch -- close M-2026-04-16T12-00-00-E-01 "Shipped, 14 tests green"
`);
}

switch (cmd) {
  case 'create':  cmdCreate(args); break;
  case 'list':    cmdList(args); break;
  case 'close':   cmdClose(args); break;
  case 'show':    cmdShow(args); break;
  case 'help':
  case '-h':
  case '--help':
  case undefined:  cmdHelp(); break;
  default:         console.error(c('red', `swarm:dispatch — unknown command: ${cmd}`)); cmdHelp(); process.exit(2);
}
