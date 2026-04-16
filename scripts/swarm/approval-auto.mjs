#!/usr/bin/env node
// scripts/swarm/approval-auto.mjs
// Autonomous approval engine. Run periodically to:
//   - Auto-approve Tier 2 requests after TIER2_DELAY_MINUTES (default: 15)
//   - Escalate stale Tier 3 requests (1h warning, 2h critical)
//   - Auto-deny any request older than STALE_HOURS (default: 24)
//
// Usage:
//   npm run approval:auto                     # single pass
//   npm run approval:auto -- --dry-run        # preview without acting
//
// Environment:
//   TIER2_DELAY_MINUTES=15   Minutes before Tier 2 auto-approves (default: 15)
//   STALE_HOURS=24           Hours before any request auto-denies (default: 24)

import {
  APPROVALS_PENDING, APPROVALS_APPROVED, APPROVALS_DENIED,
  AUDIT_DIR, ALERTS_DIR,
  c, writeAtomic, nowIso, ensureDir, listJsonFiles,
} from './_lib.mjs';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

const TIER2_DELAY_MS = (parseInt(process.env.TIER2_DELAY_MINUTES, 10) || 15) * 60 * 1000;
const STALE_MS = (parseInt(process.env.STALE_HOURS, 10) || 24) * 60 * 60 * 1000;
const TIER3_WARN_MS = 60 * 60 * 1000;
const TIER3_CRIT_MS = 2 * 60 * 60 * 1000;

const now = Date.now();
const pending = listJsonFiles(APPROVALS_PENDING);

if (pending.length === 0) {
  console.log(c('grey', '  No pending approvals.\n'));
  process.exit(0);
}

console.log(c('bold', `\n  CERNIQ · Approval Auto-Engine${dryRun ? c('yellow', ' [DRY RUN]') : ''}\n`));

let autoApproved = 0;
let autoDenied = 0;
let escalated = 0;

for (const req of pending) {
  const reqTime = new Date(req.requested_at || 0).getTime();
  const ageMs = now - reqTime;
  const ageMin = Math.round(ageMs / 60000);
  const ageHr = (ageMs / 3600000).toFixed(1);
  const id = req.id;

  // ─── STALE: auto-deny anything > STALE_HOURS ──────────────────
  if (ageMs > STALE_MS) {
    if (dryRun) {
      console.log(`  ${c('red', '✗')} STALE DENY  ${c('bold', id)}  (${ageHr}h old)`);
    } else {
      const denied = {
        ...req,
        status: 'denied',
        denied_at: nowIso(),
        denied_by: 'auto-engine',
        denied_reason: `stale: pending for ${ageHr}h (max ${process.env.STALE_HOURS || 24}h)`,
      };
      writeAtomic(join(APPROVALS_DENIED, `${id}.json`), denied);
      rmSync(join(APPROVALS_PENDING, `${id}.json`), { force: true });
      writeAtomic(join(AUDIT_DIR, `auto-deny-${id}.json`), {
        id: `auto-deny-${id}`,
        type: 'auto-approval',
        action: 'auto-denied-stale',
        approval_id: id,
        cli: req.cli,
        tier: req.tier,
        age_hours: ageHr,
        timestamp: nowIso(),
      });
      console.log(`  ${c('red', '✗')} AUTO-DENIED  ${c('bold', id)}  (stale: ${ageHr}h)`);
    }
    autoDenied++;
    continue;
  }

  // ─── TIER 2: auto-approve after delay ─────────────────────────
  if (req.tier === 2 && ageMs > TIER2_DELAY_MS) {
    if (dryRun) {
      console.log(`  ${c('green', '✓')} AUTO-APPROVE ${c('bold', id)}  T2  (${ageMin}min old)`);
    } else {
      const approved = {
        ...req,
        status: 'approved',
        approved_at: nowIso(),
        approved_by: 'auto-engine',
        auto_reason: `consent-by-silence: no denial within ${Math.round(TIER2_DELAY_MS / 60000)}min`,
      };
      writeAtomic(join(APPROVALS_APPROVED, `${id}.json`), approved);
      rmSync(join(APPROVALS_PENDING, `${id}.json`), { force: true });
      writeAtomic(join(AUDIT_DIR, `auto-approve-${id}.json`), {
        id: `auto-approve-${id}`,
        type: 'auto-approval',
        action: 'auto-approved-tier2',
        approval_id: id,
        cli: req.cli,
        tier: 2,
        age_minutes: ageMin,
        timestamp: nowIso(),
      });
      console.log(`  ${c('green', '✓')} AUTO-APPROVED ${c('bold', id)}  T2  (${ageMin}min, consent-by-silence)`);
    }
    autoApproved++;
    continue;
  }

  // ─── TIER 2: still within delay window ────────────────────────
  if (req.tier === 2) {
    const remaining = Math.round((TIER2_DELAY_MS - ageMs) / 60000);
    console.log(`  ${c('yellow', '⏳')} PENDING T2   ${c('bold', id)}  (auto-approve in ${remaining}min)`);
    continue;
  }

  // ─── TIER 3: escalation warnings ──────────────────────────────
  if (req.tier === 3) {
    if (ageMs > TIER3_CRIT_MS) {
      if (!dryRun) {
        ensureDir(ALERTS_DIR);
        writeAtomic(join(ALERTS_DIR, `t3-stale-${id}.json`), {
          type: 'tier3-escalation',
          severity: 'CRITICAL',
          approval_id: id,
          cli: req.cli,
          action: req.action,
          age_hours: ageHr,
          message: `Tier 3 request blocking ${req.cli} for ${ageHr}h — requires T-10 decision`,
          timestamp: nowIso(),
        });
      }
      console.log(`  ${c('red', '‼')} CRITICAL T3  ${c('bold', id)}  (${ageHr}h — blocking ${req.cli})`);
      escalated++;
    } else if (ageMs > TIER3_WARN_MS) {
      console.log(`  ${c('yellow', '⚠')} WARNING T3   ${c('bold', id)}  (${ageMin}min — needs T-10 decision)`);
      escalated++;
    } else {
      console.log(`  ${c('yellow', '⏳')} PENDING T3   ${c('bold', id)}  (${ageMin}min — awaiting T-10)`);
    }
  }
}

// ─── Summary ────────────────────────────────────────────────────
console.log(c('grey', '\n  ' + '─'.repeat(55)));
const parts = [];
if (autoApproved > 0) parts.push(c('green', `${autoApproved} auto-approved`));
if (autoDenied > 0) parts.push(c('red', `${autoDenied} auto-denied (stale)`));
if (escalated > 0) parts.push(c('yellow', `${escalated} escalated`));
const remaining = pending.length - autoApproved - autoDenied;
if (remaining > 0) parts.push(c('grey', `${remaining} still pending`));
console.log(`  ${parts.join('  ')}\n`);
