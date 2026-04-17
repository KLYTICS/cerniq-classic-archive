#!/usr/bin/env node
// scripts/swarm/boot.mjs
// Prints the composite boot prompt for a given CLI ID.
// Combines the MASTER BOOT PROMPT + swarm-specific prompt from the dispatch doc.
//
// Usage:
//   node scripts/swarm/boot.mjs <CLI-ID>
//   npm run swarm:boot -- E-01
//   npm run swarm:boot -- Q-05
//   npm run swarm:boot -- --list          # list all CLI IDs

import { loadRegistry, resolveCli, allClisBySwarm, c, swarmGlyph, priorityColor, REPO_ROOT } from './_lib.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const reg = loadRegistry();
const args = process.argv.slice(2);

if (args.includes('--list') || args.includes('-l')) {
  const grouped = allClisBySwarm(reg);
  console.log(c('bold', '\n  CERNIQ · 100-CLI Swarm Registry\n'));
  for (const [swarmKey, clis] of Object.entries(grouped).sort()) {
    const swarm = reg.swarms[swarmKey];
    const terminal = swarm ? swarm.terminal : '—';
    console.log(`  ${c('cyan', swarmGlyph(swarmKey))} ${c('bold', swarmKey.padEnd(24))} ${c('grey', terminal)}`);
    for (const cli of clis) {
      console.log(`     ${c(priorityColor(cli.priority), cli.priority)} ${c('bold', cli.id.padEnd(8))} ${cli.role}`);
    }
  }
  console.log('');
  process.exit(0);
}

const cliId = args[0];
if (!cliId) {
  console.error(c('red', 'swarm:boot') + ' — CLI ID required');
  console.error('  usage: ' + c('cyan', 'npm run swarm:boot -- E-01'));
  console.error('  list:  ' + c('cyan', 'npm run swarm:boot -- --list'));
  process.exit(1);
}

const resolved = resolveCli(reg, cliId);
if (!resolved) {
  console.error(c('red', `swarm:boot — unknown CLI: ${cliId}`));
  process.exit(1);
}

const { cli, swarm, terminal } = resolved;

const bibleHints = [];
if (swarm?.bible) bibleHints.push(swarm.bible);

const gateList = swarm?.quality_gates
  ? Object.entries(swarm.quality_gates).map(([k, v]) => `  ${k}: ${v}`).join('\n')
  : '  (none defined)';

const scopePaths = swarm?.scope_paths?.join(', ') || '(see bible)';

const dispatchPath = join(REPO_ROOT, 'docs', 'CERNIQ_MASTER_CLI_DISPATCH.md');
const hasDispatch = existsSync(dispatchPath);

console.log(`
${c('bold', '═══════════════════════════════════════════════════════════════')}
${c('bold', '  CERNIQ SWARM BOOT · ' + cli.id + ' · ' + cli.role)}
${c('bold', '═══════════════════════════════════════════════════════════════')}

${c('cyan', 'CLI ID:')}          ${cli.id}
${c('cyan', 'Swarm:')}           ${cli.swarm}
${c('cyan', 'Terminal:')}        ${swarm?.terminal || '—'} (${terminal?.name || '—'})
${c('cyan', 'Priority:')}        ${c(priorityColor(cli.priority), cli.priority)}
${c('cyan', 'Role:')}            ${cli.role}
${c('cyan', 'Scope paths:')}     ${scopePaths}
${c('cyan', 'Autonomy tiers:')}  ${reg.autonomy_tiers ? Object.entries(reg.autonomy_tiers).map(([k, t]) => `${k}=${t.name}`).join(' | ') : '—'}

${c('yellow', '── BIBLE REFERENCES ──')}
${bibleHints.length ? bibleHints.map((b) => `  cat ${b}`).join('\n') : '  (none)'}
  cat docs/CERNIQ_Vol9_PROMPT_ENGINEERING_BIBLE.md
  cat docs/CERNIQ_Vol4_SWARM_MASTER_BIBLE.md

${c('yellow', '── QUALITY GATES ──')}
${gateList}

${c('yellow', '── FIRST ACTIONS ──')}
  1. npm run session:register -- ${cli.id.toLowerCase()}
  2. Read your swarm's bible section
  3. Read docs/SESSION_HANDOFF.md for current state
  4. npm run session:claim -- ${cli.id.toLowerCase()} <paths>
  5. Execute mission queue

${c('yellow', '── AUTONOMY PROTOCOL ──')}
  Tier 0 (SILENT):      Read, grep, test, typecheck — no trace needed
  Tier 1 (AUTO+AUDIT):  Code edits in scope, branches, drafts → audit log
  Tier 2 (AUTO+REVIEW): Merge main, new routes, schema changes → approval queue (post-hoc)
  Tier 3 (PRE-APPROVE): Prod deploy, migrations, Stripe, COSSEC → BLOCKED until approved
  Tier X (FORBIDDEN):   Force push, DROP without WHERE, Float for money → REFUSED

${c('yellow', '── HARD RULES ──')}
  1. Never invent ALM numbers, compliance verdicts, or regulatory citations
  2. Never use Float for financial calculations — Decimal only (Tier X violation)
  3. Never commit secrets, .env contents, or API keys
  4. Every output must be traceable: cite file, line, or calculation source
  5. Bilingual: Spanish for cooperativa-facing, English for code/internal
  6. Tier 3 actions: npm run approval -- request ${cli.id.toLowerCase()} 3 "<action>" "<target>"
  7. Scope check: npm run scope:check -- ${cli.id.toLowerCase()}

${hasDispatch ? c('grey', '  Full dispatch: docs/CERNIQ_MASTER_CLI_DISPATCH.md') : ''}
${c('bold', '═══════════════════════════════════════════════════════════════')}
`);
