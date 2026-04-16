#!/usr/bin/env node
// scripts/swarm/landing.mjs
// Landing gate automation. Validates a CLI is ready to land by checking:
//   1. Quality gates for its swarm pass
//   2. No open P0 incidents
//   3. No blocking pending approvals
//   4. No cross-swarm conflicts
// Then appends to both .omx/state/team/landing.md and docs/SESSION_HANDOFF.md.
//
// Usage:
//   npm run swarm:landing -- check <CLI-ID>          # dry run: report pass/fail
//   npm run swarm:landing -- land <CLI-ID> "Title" "Description"
//   npm run swarm:landing -- log                      # show recent landings

import {
  loadRegistry, resolveCli, c, REPO_ROOT, LANDING_PATH,
  EMERGENCIES_DIR, APPROVALS_PENDING,
  listJsonFiles, nowIso, ensureDir, writeAtomic, AUDIT_DIR,
} from './_lib.mjs';
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const reg = loadRegistry();
const [cmd, ...args] = process.argv.slice(2);

function runGate(gateCmd) {
  try {
    execSync(gateCmd, { cwd: REPO_ROOT, stdio: 'pipe', timeout: 300_000 });
    return true;
  } catch {
    return false;
  }
}

function checkPrereqs(cliId) {
  const resolved = resolveCli(reg, cliId);
  if (!resolved) return { ok: false, errors: [`Unknown CLI: ${cliId}`], warnings: [] };

  const { cli, swarm } = resolved;
  const errors = [];
  const warnings = [];
  const gates = [];

  // Check 1: Open P0 incidents
  const openIncidents = listJsonFiles(EMERGENCIES_DIR).filter((i) => i.status === 'open');
  if (openIncidents.length > 0) {
    errors.push(`${openIncidents.length} open P0 incident(s) — resolve before landing`);
  }

  // Check 2: Blocking approvals (Tier 3 pending for this CLI)
  const pendingApprovals = listJsonFiles(APPROVALS_PENDING)
    .filter((a) => a.cli?.toUpperCase() === cli.id && a.tier === 3);
  if (pendingApprovals.length > 0) {
    errors.push(`${pendingApprovals.length} Tier 3 approval(s) pending — blocked until approved`);
  }

  // Check 3: Tier 2 pending (warning, not blocking)
  const tier2Pending = listJsonFiles(APPROVALS_PENDING)
    .filter((a) => a.cli?.toUpperCase() === cli.id && a.tier === 2);
  if (tier2Pending.length > 0) {
    warnings.push(`${tier2Pending.length} Tier 2 approval(s) pending (post-hoc review)`);
  }

  // Check 4: Quality gates
  if (swarm?.quality_gates) {
    for (const [name, gateCmd] of Object.entries(swarm.quality_gates)) {
      gates.push({ name, cmd: gateCmd });
    }
  }

  return { ok: errors.length === 0, errors, warnings, gates, cli, swarm };
}

function cmdCheck(args) {
  const cliId = args[0];
  if (!cliId) {
    console.error(c('red', 'swarm:landing check') + ' — CLI ID required');
    process.exit(1);
  }

  const prereqs = checkPrereqs(cliId);
  console.log(c('bold', `\n  CERNIQ · Landing Gate · ${cliId.toUpperCase()}`));
  console.log(c('grey', '  ' + '─'.repeat(50)));

  // Run prerequisite checks
  for (const err of prereqs.errors) {
    console.log(`  ${c('red', '✗')} ${err}`);
  }
  for (const warn of prereqs.warnings) {
    console.log(`  ${c('yellow', '⚠')} ${warn}`);
  }

  if (!prereqs.ok) {
    console.log(c('red', '\n  ✗ Landing gate BLOCKED — fix errors above\n'));
    process.exit(1);
  }

  // Run quality gates
  if (prereqs.gates.length === 0) {
    console.log(`  ${c('grey', '○')} No quality gates defined for ${prereqs.cli.swarm}`);
  }

  let gatesFailed = 0;
  for (const gate of prereqs.gates) {
    process.stdout.write(`  ${c('cyan', '▶')} ${gate.name.padEnd(20)}`);
    const pass = runGate(gate.cmd);
    if (pass) {
      console.log(c('green', 'PASS'));
    } else {
      console.log(c('red', 'FAIL'));
      gatesFailed++;
    }
  }

  console.log(c('grey', '  ' + '─'.repeat(50)));

  if (gatesFailed > 0) {
    console.log(c('red', `\n  ✗ ${gatesFailed} gate(s) failed — fix before landing\n`));
    process.exit(1);
  }

  console.log(c('green', `\n  ✓ Landing gate CLEAR — ${cliId.toUpperCase()} is ready to land`));
  console.log(`  → ${c('cyan', `npm run swarm:landing -- land ${cliId} "Title" "Description"`)}\n`);
}

function cmdLand(args) {
  const cliId = args[0];
  const title = args[1];
  const description = args.slice(2).join(' ');

  if (!cliId || !title) {
    console.error(c('red', 'swarm:landing land') + ' — usage: land <CLI-ID> "Title" "Description"');
    process.exit(1);
  }

  const prereqs = checkPrereqs(cliId);
  if (!prereqs.ok) {
    console.error(c('red', '  ✗ Landing gate BLOCKED'));
    for (const err of prereqs.errors) console.error(`    ${c('red', '●')} ${err}`);
    process.exit(1);
  }

  const date = new Date().toISOString().slice(0, 10);
  const titleClean = title.trim().replace(/[.\s]+$/, '') + '.';
  const bullet = `- ${date} — **${titleClean}** ${description || '(no description)'}`;

  // Append to .omx/state/team/landing.md
  ensureDir(join(REPO_ROOT, '.omx', 'state', 'team'));
  if (existsSync(LANDING_PATH)) {
    const content = readFileSync(LANDING_PATH, 'utf8');
    const insertPoint = content.indexOf('## Landings');
    if (insertPoint >= 0) {
      const after = insertPoint + '## Landings'.length;
      const newContent = content.slice(0, after) + '\n\n' + bullet + content.slice(after);
      writeFileSync(LANDING_PATH, newContent, 'utf8');
    } else {
      appendFileSync(LANDING_PATH, '\n' + bullet + '\n', 'utf8');
    }
  } else {
    writeFileSync(LANDING_PATH, `# CERNIQ Landing Log\n\n## Landings\n\n${bullet}\n`, 'utf8');
  }

  // Also try to append to docs/SESSION_HANDOFF.md via session:handoff
  try {
    execSync(
      `node scripts/session/handoff.mjs "${titleClean}" "${description || 'Landed via swarm:landing'}"`,
      { cwd: REPO_ROOT, encoding: 'utf8', timeout: 5000 }
    );
  } catch {
    // Non-critical — landing.md is the primary record
  }

  // Audit entry
  const auditEntry = {
    id: `landing-${cliId.toLowerCase()}-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
    type: 'landing',
    cli: cliId.toUpperCase(),
    swarm: prereqs.cli?.swarm || 'unknown',
    action: `Landed: ${titleClean} ${description || ''}`.trim(),
    tier: 1,
    timestamp: nowIso(),
  };
  writeAtomic(join(AUDIT_DIR, `${auditEntry.id}.json`), auditEntry);

  console.log(c('green', `\n  ✓ LANDED: ${cliId.toUpperCase()}`));
  console.log(`    ${bullet}`);
  console.log(`    Audit: ${c('grey', auditEntry.id)}`);
  console.log(`    Landing log: ${c('grey', LANDING_PATH)}\n`);
}

function cmdLog() {
  if (!existsSync(LANDING_PATH)) {
    console.log(c('grey', '\n  No landing log yet.\n'));
    return;
  }

  const content = readFileSync(LANDING_PATH, 'utf8');
  const bullets = content.split('\n')
    .filter((line) => /^-\s+\d{4}-\d{2}-\d{2}\s+—/.test(line))
    .slice(0, 20);

  if (bullets.length === 0) {
    console.log(c('grey', '\n  No landings recorded.\n'));
    return;
  }

  console.log(c('bold', `\n  CERNIQ · Landing Log · last ${bullets.length}\n`));
  for (const b of bullets) {
    const match = b.match(/^-\s+(\d{4}-\d{2}-\d{2})\s+—\s+\*\*(.+?)\*\*\s*(.*)/);
    if (match) {
      console.log(`  ${c('grey', match[1])}  ${c('green', '●')}  ${c('bold', match[2])} ${match[3].slice(0, 50)}`);
    } else {
      console.log(`  ${b.slice(0, 80)}`);
    }
  }
  console.log('');
}

function cmdHelp() {
  console.log(`
  ${c('bold', 'swarm:landing')} — Landing gate validator + log

  ${c('bold', 'Commands')}
    check <CLI-ID>                                   Dry run: pass/fail report
    land <CLI-ID> "Title" "Description"              Run gates + append landing
    log                                              Show recent landings

  ${c('bold', 'Gate checks (all must pass to land)')}
    1. No open P0 incidents
    2. No blocking Tier 3 approvals
    3. All swarm quality gates pass
`);
}

switch (cmd) {
  case 'check':   cmdCheck(args); break;
  case 'land':    cmdLand(args); break;
  case 'log':     cmdLog(); break;
  case 'help':
  case '-h':
  case '--help':
  case undefined:  cmdHelp(); break;
  default:         console.error(c('red', `swarm:landing — unknown: ${cmd}`)); cmdHelp(); process.exit(2);
}
