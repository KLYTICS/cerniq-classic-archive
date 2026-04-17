#!/usr/bin/env node
// scripts/swarm/handoff.mjs
// Vol.4 structured between-session handoff generator. Creates the full handoff
// template from the dispatch doc §3, auto-populated with live state.
//
// Different from session:handoff (which appends a bullet to SESSION_HANDOFF.md).
// This generates a comprehensive handoff document per CLI per session.
//
// Usage:
//   npm run swarm:handoff -- create <CLI-ID> [--completed "task1" --completed "task2"]
//   npm run swarm:handoff -- pickup <CLI-ID>
//   npm run swarm:handoff -- list

import {
  loadRegistry, resolveCli, c, REPO_ROOT,
  MISSIONS_DIR, APPROVALS_PENDING,
  writeAtomic, nowIso, dateStamp, ensureDir, listJsonFiles,
} from './_lib.mjs';
import { join } from 'node:path';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const reg = loadRegistry();
const [cmd, ...args] = process.argv.slice(2);

const HANDOFF_DIR = join(REPO_ROOT, '.omx', 'state', 'team', 'handoffs');

function handoffPath(cliId, stamp) {
  return join(HANDOFF_DIR, `handoff-${cliId.toLowerCase()}-${stamp}.md`);
}

function latestHandoff(cliId) {
  ensureDir(HANDOFF_DIR);
  const prefix = `handoff-${cliId.toLowerCase()}-`;
  const files = readdirSync(HANDOFF_DIR)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.md'))
    .sort();
  if (files.length === 0) return null;
  const path = join(HANDOFF_DIR, files[files.length - 1]);
  return { path, content: readFileSync(path, 'utf8') };
}

function gitBranch() {
  try { return execSync('git rev-parse --abbrev-ref HEAD', { cwd: REPO_ROOT, encoding: 'utf8' }).trim(); }
  catch { return 'unknown'; }
}

function gitStatus() {
  try {
    return execSync('git status --porcelain', { cwd: REPO_ROOT, encoding: 'utf8' })
      .trim().split('\n').filter(Boolean).length;
  } catch { return 0; }
}

function activeMissionsFor(cliId) {
  return listJsonFiles(MISSIONS_DIR)
    .filter((m) => m.status === 'active' && m.cli_id === cliId.toUpperCase());
}

function pendingApprovalsFor(cliId) {
  return listJsonFiles(APPROVALS_PENDING)
    .filter((a) => a.cli_id === cliId.toUpperCase());
}

function sessionClaims(cliId) {
  const sessDir = join(REPO_ROOT, '.omx', 'state', 'team', 'sessions');
  const sessFile = join(sessDir, `${cliId.toLowerCase()}.json`);
  if (!existsSync(sessFile)) return [];
  try {
    const s = JSON.parse(readFileSync(sessFile, 'utf8'));
    return s.claims || [];
  } catch { return []; }
}

function cmdCreate(args) {
  const cliId = args[0];
  if (!cliId) {
    console.error(c('red', 'swarm:handoff create') + ' — CLI ID required');
    process.exit(1);
  }

  const resolved = resolveCli(reg, cliId);
  if (!resolved) {
    console.error(c('red', `swarm:handoff — unknown CLI: ${cliId}`));
    process.exit(1);
  }

  const completedItems = [];
  const inProgressItems = [];
  const blockedItems = [];
  let i = 1;
  while (i < args.length) {
    if (args[i] === '--completed' && args[i + 1]) { completedItems.push(args[++i]); }
    else if (args[i] === '--in-progress' && args[i + 1]) { inProgressItems.push(args[++i]); }
    else if (args[i] === '--blocked' && args[i + 1]) { blockedItems.push(args[++i]); }
    i++;
  }

  const { cli, swarm } = resolved;
  const now = nowIso();
  const branch = gitBranch();
  const dirtyFiles = gitStatus();
  const missions = activeMissionsFor(cli.id);
  const approvals = pendingApprovalsFor(cli.id);
  const claims = sessionClaims(cli.id);
  const stamp = dateStamp();

  const gates = swarm?.quality_gates
    ? Object.entries(swarm.quality_gates).map(([k, v]) => `- [ ] ${k}: \`${v}\``).join('\n')
    : '- [ ] (no gates defined for this swarm)';

  const content = `# CERNIQ SESSION HANDOFF — ${now.slice(0, 16).replace('T', ' ')} AST
CLI Nickname: ${cli.id.toLowerCase()}
Terminal: ${swarm?.terminal || '—'} | Department: ${cli.swarm}
Branch: ${branch}
Dirty files: ${dirtyFiles}

## COMPLETED THIS SESSION
${completedItems.length > 0 ? completedItems.map((t) => `- [x] ${t}`).join('\n') : '- [ ] (fill in completed tasks)'}

## IN PROGRESS (needs pickup)
${inProgressItems.length > 0 ? inProgressItems.map((t) => `- [ ] ${t}`).join('\n') : '- [ ] (fill in work-in-progress)'}
${claims.length > 0 ? `\nFiles claimed: ${claims.join(', ')}` : ''}

## BLOCKED
${blockedItems.length > 0 ? blockedItems.map((t) => `- ${t}`).join('\n') : '- (none)'}

## ACTIVE MISSIONS
${missions.length > 0 ? missions.map((m) => `- ${m.priority} ${m.id}: ${m.description}`).join('\n') : '- (none)'}

## PENDING APPROVALS
${approvals.length > 0 ? approvals.map((a) => `- ⏳ ${a.type}: ${a.description} (${a.id})`).join('\n') : '- (none)'}

## IMPORTANT CONTEXT FOR NEXT CLI
- (add anything the next agent MUST know before touching this code)

## LANDING GATE STATUS
${gates}
- [ ] Session released: npm run session:release -- ${cli.id.toLowerCase()}

---
*Write to: .omx/state/team/handoffs/handoff-${cli.id.toLowerCase()}-${stamp}.md*
*Append landing bullet: npm run session:handoff -- "Title" "Description"*
`;

  const path = handoffPath(cli.id, stamp);
  writeAtomic(path, content);

  console.log(c('green', `\n  ✓ Handoff created: ${cli.id}`));
  console.log(`    Path: ${c('grey', path)}`);
  console.log(`    Branch: ${branch}`);
  console.log(`    Missions: ${missions.length} active`);
  console.log(`    Approvals: ${approvals.length} pending`);
  console.log(`    Claims: ${claims.length}`);
  console.log('');
  console.log(c('yellow', '  Edit the handoff file to fill in specifics, then:'));
  console.log(`    npm run session:release -- ${cli.id.toLowerCase()}`);
  console.log('');
}

function cmdPickup(args) {
  const cliId = args[0];
  if (!cliId) {
    console.error(c('red', 'swarm:handoff pickup') + ' — CLI ID required');
    process.exit(1);
  }

  const last = latestHandoff(cliId);
  if (!last) {
    console.log(c('grey', `\n  No handoff found for ${cliId.toUpperCase()}.\n`));
    return;
  }

  console.log(c('bold', `\n  ── Resuming ${cliId.toUpperCase()} ──────────────────────────────────`));
  console.log(c('grey', `  ${last.path}\n`));
  console.log(last.content);
}

function cmdList() {
  ensureDir(HANDOFF_DIR);
  const files = readdirSync(HANDOFF_DIR)
    .filter((f) => f.startsWith('handoff-') && f.endsWith('.md'))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.log(c('grey', '\n  No handoffs on record.\n'));
    return;
  }

  console.log(c('bold', `\n  CERNIQ · Handoff Archive · ${files.length} handoff(s)\n`));

  const grouped = {};
  for (const f of files) {
    const match = f.match(/^handoff-([a-z0-9-]+)-(\d{4}-\d{2}-\d{2})/);
    if (match) {
      const cli = match[1].toUpperCase();
      if (!grouped[cli]) grouped[cli] = [];
      grouped[cli].push({ file: f, date: match[2] });
    }
  }

  for (const [cli, handoffs] of Object.entries(grouped).sort()) {
    const latest = handoffs[0];
    console.log(
      `  ${c('bold', cli.padEnd(10))} ` +
      `${c('grey', `${handoffs.length} handoff(s), latest: ${latest.date}`)}`
    );
  }
  console.log(`\n  ${c('grey', 'Pickup: npm run swarm:handoff -- pickup <CLI-ID>')}\n`);
}

function cmdHelp() {
  console.log(`
  ${c('bold', 'swarm:handoff')} — Vol.4 structured between-session handoff

  ${c('bold', 'Commands')}
    create <CLI-ID> [--completed "task"] [--in-progress "task"] [--blocked "task"]
    pickup <CLI-ID>                          Show latest handoff to resume
    list                                     List all handoffs by CLI

  ${c('bold', 'Examples')}
    npm run swarm:handoff -- create E-01 --completed "Shipped COSSEC parser" --in-progress "NCUA endpoint"
    npm run swarm:handoff -- pickup E-01
`);
}

switch (cmd) {
  case 'create':   cmdCreate(args); break;
  case 'pickup':   cmdPickup(args); break;
  case 'list':     cmdList(); break;
  case 'help':
  case '-h':
  case '--help':
  case undefined:  cmdHelp(); break;
  default:         console.error(c('red', `swarm:handoff — unknown: ${cmd}`)); cmdHelp(); process.exit(2);
}
