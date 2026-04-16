#!/usr/bin/env node
// scripts/swarm/approval.mjs
// Tier 2/3 approval queue. CLIs request, T-10 approves/denies.
//
// Usage:
//   npm run approval -- request <cli-id> <tier> "<action>" "<target>"
//   npm run approval -- list [--pending|--approved|--denied|--all]
//   npm run approval -- approve <id>
//   npm run approval -- deny <id> "<reason>"
//   npm run approval -- check <id>            # poll: exits 0 if approved

import {
  APPROVALS_PENDING, APPROVALS_APPROVED, APPROVALS_DENIED,
  AUDIT_DIR, loadRegistry, resolveCli, c, writeAtomic, nowIso, dateStamp,
  ensureDir, listJsonFiles,
} from './_lib.mjs';
import { existsSync, readFileSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join, basename } from 'node:path';

const [subcommand, ...args] = process.argv.slice(2);

if (!subcommand || subcommand === '--help') {
  console.log(`
  ${c('bold', 'CERNIQ Approval Queue')}

  ${c('cyan', 'request')} <cli-id> <tier> "<action>" "<target>"   File a Tier 2/3 approval request
  ${c('cyan', 'list')}    [--pending|--approved|--denied|--all]    List approval queue (default: pending)
  ${c('cyan', 'approve')} <id>                                    Approve a pending request
  ${c('cyan', 'deny')}    <id> "<reason>"                         Deny a pending request
  ${c('cyan', 'check')}   <id>                                    Poll: exit 0=approved, 1=pending, 2=denied
  `);
  process.exit(0);
}

function generateId(cliId) {
  return `${cliId}-${dateStamp()}`.toLowerCase();
}

function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch { return null; }
}

function listDir(dir) {
  ensureDir(dir);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json') && !f.startsWith('.'))
    .map((f) => ({ file: f, ...readJson(join(dir, f)) }))
    .filter((r) => r.id);
}

// ─── SUBCOMMANDS ────────────────────────────────────────────────────────

if (subcommand === 'request') {
  const [cliId, tierStr, action, target] = args;
  const tier = parseInt(tierStr, 10);

  if (!cliId || !tier || !action) {
    console.error(c('red', 'approval request') + ' — requires: <cli-id> <tier> "<action>" "<target>"');
    process.exit(1);
  }
  if (tier < 2 || tier > 3) {
    console.error(c('red', 'approval request') + ' — tier must be 2 or 3 (tier 0/1 do not need approval)');
    process.exit(1);
  }

  const reg = loadRegistry();
  const resolved = resolveCli(reg, cliId);
  const swarmKey = resolved?.cli?.swarm || 'unknown';
  const terminal = resolved?.swarm?.terminal || 'unknown';

  const id = generateId(cliId);
  const request = {
    id,
    tier,
    cli: cliId.toUpperCase(),
    swarm: swarmKey,
    terminal,
    action,
    target: target || 'unspecified',
    status: 'pending',
    requested_at: nowIso(),
  };

  const path = join(APPROVALS_PENDING, `${id}.json`);
  writeAtomic(path, request);

  console.log(c('green', '✓ approval request filed'));
  console.log(`  ${c('bold', 'ID:')}       ${id}`);
  console.log(`  ${c('bold', 'Tier:')}     ${tier}`);
  console.log(`  ${c('bold', 'CLI:')}      ${cliId.toUpperCase()} (${swarmKey})`);
  console.log(`  ${c('bold', 'Action:')}   ${action}`);
  console.log(`  ${c('bold', 'Target:')}   ${target || 'unspecified'}`);
  console.log(`  ${c('bold', 'File:')}     ${path}`);

  if (tier === 3) {
    console.log('');
    console.log(c('yellow', '  ⏳ Tier 3: blocked until T-10 approves.'));
    console.log(c('grey', `  Poll: npm run approval -- check ${id}`));
  } else {
    console.log('');
    console.log(c('cyan', '  ℹ Tier 2: execute now, queued for post-hoc review.'));
  }
}

else if (subcommand === 'list') {
  const filter = args[0] || '--pending';
  const dirs = {
    '--pending': [['pending', APPROVALS_PENDING]],
    '--approved': [['approved', APPROVALS_APPROVED]],
    '--denied': [['denied', APPROVALS_DENIED]],
    '--all': [
      ['pending', APPROVALS_PENDING],
      ['approved', APPROVALS_APPROVED],
      ['denied', APPROVALS_DENIED],
    ],
  };

  const targets = dirs[filter] || dirs['--pending'];

  console.log(c('bold', '\n  CERNIQ · Approval Queue\n'));

  let total = 0;
  for (const [label, dir] of targets) {
    const items = listDir(dir);
    if (items.length === 0) continue;
    total += items.length;

    const statusColor = label === 'pending' ? 'yellow' : label === 'approved' ? 'green' : 'red';
    console.log(`  ${c('bold', label.toUpperCase())} (${items.length})`);

    for (const item of items.sort((a, b) => (b.requested_at || '').localeCompare(a.requested_at || ''))) {
      const tierLabel = `T${item.tier}`;
      const tierColor = item.tier === 3 ? 'red' : 'yellow';
      console.log(
        `    ${c(statusColor, '●')} ${c(tierColor, tierLabel)} ${c('bold', (item.cli || '?').padEnd(8))} ` +
        `${(item.action || '').slice(0, 40).padEnd(40)} ` +
        `${c('grey', item.id)}`
      );
    }
    console.log('');
  }

  if (total === 0) {
    console.log(c('grey', '  No items in queue.\n'));
  }
}

else if (subcommand === 'approve') {
  const id = args[0];
  if (!id) {
    console.error(c('red', 'approval approve') + ' — requires <id>');
    process.exit(1);
  }

  const pendingPath = join(APPROVALS_PENDING, `${id}.json`);
  if (!existsSync(pendingPath)) {
    console.error(c('red', 'approval approve') + ` — not found in pending: ${id}`);
    const approvedPath = join(APPROVALS_APPROVED, `${id}.json`);
    if (existsSync(approvedPath)) console.error(c('grey', '  (already approved)'));
    process.exit(1);
  }

  const request = readJson(pendingPath);
  const approved = {
    ...request,
    status: 'approved',
    approved_at: nowIso(),
    approved_by: 'T-10',
  };

  const targetPath = join(APPROVALS_APPROVED, `${id}.json`);
  writeAtomic(targetPath, approved);
  rmSync(pendingPath);

  const auditEntry = {
    id: `audit-${id}`,
    type: 'approval',
    action: 'approved',
    approval_id: id,
    cli: request.cli,
    tier: request.tier,
    description: request.action,
    timestamp: nowIso(),
  };
  writeAtomic(join(AUDIT_DIR, `${auditEntry.id}.json`), auditEntry);

  console.log(c('green', '✓ approved') + ` ${c('bold', id)}`);
  console.log(`  CLI ${c('cyan', request.cli)} may now execute: ${request.action}`);
}

else if (subcommand === 'deny') {
  const [id, ...reasonParts] = args;
  const reason = reasonParts.join(' ');

  if (!id) {
    console.error(c('red', 'approval deny') + ' — requires <id> "<reason>"');
    process.exit(1);
  }

  const pendingPath = join(APPROVALS_PENDING, `${id}.json`);
  if (!existsSync(pendingPath)) {
    console.error(c('red', 'approval deny') + ` — not found in pending: ${id}`);
    process.exit(1);
  }

  const request = readJson(pendingPath);
  const denied = {
    ...request,
    status: 'denied',
    denied_at: nowIso(),
    denied_by: 'T-10',
    denied_reason: reason || 'no reason given',
  };

  const targetPath = join(APPROVALS_DENIED, `${id}.json`);
  writeAtomic(targetPath, denied);
  rmSync(pendingPath);

  const auditEntry = {
    id: `audit-${id}`,
    type: 'approval',
    action: 'denied',
    approval_id: id,
    cli: request.cli,
    tier: request.tier,
    description: request.action,
    reason: denied.denied_reason,
    timestamp: nowIso(),
  };
  writeAtomic(join(AUDIT_DIR, `${auditEntry.id}.json`), auditEntry);

  console.log(c('red', '✗ denied') + ` ${c('bold', id)}`);
  console.log(`  Reason: ${denied.denied_reason}`);
  if (request.tier === 2) {
    console.log(c('yellow', '  ⚠ Tier 2: action may have already executed. CLI must revert.'));
  }
}

else if (subcommand === 'check') {
  const id = args[0];
  if (!id) {
    console.error(c('red', 'approval check') + ' — requires <id>');
    process.exit(1);
  }

  if (existsSync(join(APPROVALS_APPROVED, `${id}.json`))) {
    console.log(c('green', '✓ approved'));
    process.exit(0);
  } else if (existsSync(join(APPROVALS_DENIED, `${id}.json`))) {
    const denied = readJson(join(APPROVALS_DENIED, `${id}.json`));
    console.log(c('red', '✗ denied') + (denied?.denied_reason ? ` — ${denied.denied_reason}` : ''));
    process.exit(2);
  } else if (existsSync(join(APPROVALS_PENDING, `${id}.json`))) {
    console.log(c('yellow', '⏳ pending'));
    process.exit(1);
  } else {
    console.error(c('red', 'approval check') + ` — unknown id: ${id}`);
    process.exit(3);
  }
}

else {
  console.error(c('red', `approval: unknown subcommand: ${subcommand}`));
  console.error('  run: ' + c('cyan', 'npm run approval -- --help'));
  process.exit(1);
}
