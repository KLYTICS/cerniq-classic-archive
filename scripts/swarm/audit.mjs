#!/usr/bin/env node
// scripts/swarm/audit.mjs
// Append-only audit trail for Tier 1+ actions.
//
// Usage:
//   npm run audit -- log <cli-id> <tier> "<action>" [<files-changed>]
//   npm run audit -- list [--last=N]
//   npm run audit -- stats

import {
  AUDIT_DIR, loadRegistry, resolveCli, c, writeAtomic, nowIso, dateStamp,
  ensureDir, listJsonFiles,
} from './_lib.mjs';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const [subcommand, ...args] = process.argv.slice(2);

if (!subcommand || subcommand === '--help') {
  console.log(`
  ${c('bold', 'CERNIQ Audit Trail')}

  ${c('cyan', 'log')}   <cli-id> <tier> "<action>" [files...]   Append an audit entry
  ${c('cyan', 'list')}  [--last=N]                              Show recent entries (default: 20)
  ${c('cyan', 'stats')}                                         Aggregate counts by CLI/tier
  `);
  process.exit(0);
}

function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch { return null; }
}

// ─── SUBCOMMANDS ────────────────────────────────────────────────────────

if (subcommand === 'log') {
  const [cliId, tierStr, action, ...files] = args;
  const tier = parseInt(tierStr, 10);

  if (!cliId || isNaN(tier) || !action) {
    console.error(c('red', 'audit log') + ' — requires: <cli-id> <tier> "<action>"');
    process.exit(1);
  }

  const reg = loadRegistry();
  const resolved = resolveCli(reg, cliId);

  const id = `${cliId}-${dateStamp()}`.toLowerCase();
  const entry = {
    id,
    cli: cliId.toUpperCase(),
    swarm: resolved?.cli?.swarm || 'unknown',
    terminal: resolved?.swarm?.terminal || 'unknown',
    tier,
    action,
    files_changed: files.length > 0 ? files : [],
    outcome: 'success',
    timestamp: nowIso(),
  };

  const path = join(AUDIT_DIR, `${id}.json`);
  writeAtomic(path, entry);

  const tierColor = tier >= 3 ? 'red' : tier === 2 ? 'yellow' : 'cyan';
  console.log(
    c('green', '✓ audit logged') +
    ` ${c(tierColor, `T${tier}`)} ${c('bold', cliId.toUpperCase())} ${action}`
  );
}

else if (subcommand === 'list') {
  const lastArg = args.find((a) => a.startsWith('--last='));
  const limit = lastArg ? parseInt(lastArg.split('=')[1], 10) : 20;

  ensureDir(AUDIT_DIR);
  const files = readdirSync(AUDIT_DIR)
    .filter((f) => f.endsWith('.json') && !f.startsWith('.'))
    .sort()
    .slice(-limit);

  if (files.length === 0) {
    console.log(c('grey', '\n  No audit entries.\n'));
    process.exit(0);
  }

  console.log(c('bold', `\n  CERNIQ · Audit Trail (last ${files.length})\n`));

  for (const f of files) {
    const entry = readJson(join(AUDIT_DIR, f));
    if (!entry) continue;
    const tierColor = (entry.tier || 0) >= 3 ? 'red' : (entry.tier || 0) === 2 ? 'yellow' : 'cyan';
    const ts = (entry.timestamp || '').slice(11, 19);
    const fileCount = (entry.files_changed || []).length;
    console.log(
      `  ${c('grey', ts)} ${c(tierColor, `T${entry.tier || '?'}`)} ` +
      `${c('bold', (entry.cli || '?').padEnd(8))} ` +
      `${(entry.action || '').slice(0, 45).padEnd(45)} ` +
      `${fileCount > 0 ? c('grey', `(${fileCount} files)`) : ''}`
    );
  }
  console.log('');
}

else if (subcommand === 'stats') {
  ensureDir(AUDIT_DIR);
  const entries = listJsonFiles(AUDIT_DIR);

  if (entries.length === 0) {
    console.log(c('grey', '\n  No audit entries.\n'));
    process.exit(0);
  }

  const byTier = {};
  const byCli = {};
  const bySwarm = {};

  for (const e of entries) {
    const t = `T${e.tier || '?'}`;
    byTier[t] = (byTier[t] || 0) + 1;
    byCli[e.cli || '?'] = (byCli[e.cli || '?'] || 0) + 1;
    bySwarm[e.swarm || '?'] = (bySwarm[e.swarm || '?'] || 0) + 1;
  }

  console.log(c('bold', `\n  CERNIQ · Audit Stats (${entries.length} total entries)\n`));

  console.log(c('bold', '  By Tier:'));
  for (const [t, count] of Object.entries(byTier).sort()) {
    const bar = '█'.repeat(Math.min(count, 40));
    console.log(`    ${t.padEnd(4)} ${String(count).padStart(4)}  ${c('cyan', bar)}`);
  }

  console.log(c('bold', '\n  By Swarm:'));
  for (const [s, count] of Object.entries(bySwarm).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${s.padEnd(24)} ${String(count).padStart(4)}`);
  }

  console.log(c('bold', '\n  Top CLIs:'));
  const topClis = Object.entries(byCli).sort((a, b) => b[1] - a[1]).slice(0, 10);
  for (const [cli, count] of topClis) {
    console.log(`    ${c('cyan', cli.padEnd(8))} ${String(count).padStart(4)}`);
  }
  console.log('');
}

else {
  console.error(c('red', `audit: unknown subcommand: ${subcommand}`));
  console.error('  run: ' + c('cyan', 'npm run audit -- --help'));
  process.exit(1);
}
