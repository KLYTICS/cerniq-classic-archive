#!/usr/bin/env ts-node
/**
 * CLI: Provision a CERNIQ demo portal for a prospect using only public filings.
 *
 * Bootstraps a NestJS standalone application context (no HTTP server) so the
 * full DI graph is wired exactly the way it runs in production. Resolves the
 * prospect by slug or ID, calls DemoSeatService.provisionFromProspect, and
 * prints the magic link, expiry, and disclosure as JSON.
 *
 * USAGE
 * ─────
 *   pnpm exec ts-node scripts/provision-demo-portal.ts caguas
 *   pnpm exec ts-node scripts/provision-demo-portal.ts caguas --email cfo@caguas.coop
 *   pnpm exec ts-node scripts/provision-demo-portal.ts caguas --ttl 30 --send-email
 *   pnpm exec ts-node scripts/provision-demo-portal.ts --slug acacia --lang en
 *   pnpm exec ts-node scripts/provision-demo-portal.ts --list
 *
 * MASTER CEO SAFETY
 * ─────────────────
 * If you pass --email data.ai.kiess@gmail.com (the master CEO), DemoSeatService
 * will reuse the existing user but will NOT downgrade their subscription to
 * tier='demo'. The result will include subscriptionUpdated=false to surface
 * that the safeguard kicked in.
 *
 * EXIT CODES
 * ──────────
 *   0  success
 *   1  prospect not found / not seeded
 *   2  validation error (missing slug, invalid TTL)
 *   3  unexpected runtime error
 */

import 'dotenv/config';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { DemoSeatService } from '../src/portal/demo-seat.service';
import { LeadsService } from '../src/leads/leads.service';
import { PrismaService } from '../src/prisma.service';
import {
  COSSEC_SNAPSHOT_2025Q4,
  COSSEC_SNAPSHOT_BY_SLUG,
} from '../src/alm/data-pull/cossec-snapshots/cossec-2025q4';

interface CliArgs {
  slug: string | null;
  email: string | null;
  name: string | null;
  ttlDays: number | undefined;
  language: 'en' | 'es' | undefined;
  sendEmail: boolean;
  list: boolean;
  json: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    slug: null,
    email: null,
    name: null,
    ttlDays: undefined,
    language: undefined,
    sendEmail: false,
    list: false,
    json: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--list') {
      args.list = true;
      continue;
    }
    if (arg === '--send-email') {
      args.sendEmail = true;
      continue;
    }
    if (arg === '--json') {
      args.json = true;
      continue;
    }
    if (arg === '--slug') {
      args.slug = argv[++i] ?? null;
      continue;
    }
    if (arg === '--email') {
      args.email = argv[++i] ?? null;
      continue;
    }
    if (arg === '--name') {
      args.name = argv[++i] ?? null;
      continue;
    }
    if (arg === '--ttl') {
      const raw = argv[++i];
      const parsed = raw ? Number(raw) : NaN;
      if (Number.isNaN(parsed) || parsed < 1 || parsed > 60) {
        throw new Error(
          `--ttl must be an integer between 1 and 60, got "${raw}"`,
        );
      }
      args.ttlDays = parsed;
      continue;
    }
    if (arg === '--lang') {
      const raw = argv[++i];
      if (raw !== 'en' && raw !== 'es') {
        throw new Error(`--lang must be 'en' or 'es', got "${raw}"`);
      }
      args.language = raw;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
    if (arg.startsWith('-')) {
      throw new Error(`Unknown flag: ${arg}`);
    }
    // Positional argument = slug
    if (!args.slug) {
      args.slug = arg;
    }
  }

  return args;
}

function printHelp() {
  process.stdout.write(`provision-demo-portal — CERNIQ sales tooling

USAGE:
  ts-node scripts/provision-demo-portal.ts <slug> [flags]

POSITIONAL:
  <slug>            COSSEC snapshot slug (e.g. caguas, acacia, oriental, bayamon)

FLAGS:
  --email <email>   Override the prospect's contact email
  --name <name>     Override the contact name
  --ttl <days>      Demo TTL in days (1-60, default 14)
  --lang <en|es>    Override preferred report language
  --send-email      Fire the demo-portal-ready email via Resend
  --list            List all available COSSEC snapshots and exit
  --json            Print the full result as JSON (default: pretty-printed summary)
  --help, -h        Show this help

EXAMPLES:
  ts-node scripts/provision-demo-portal.ts caguas
  ts-node scripts/provision-demo-portal.ts caguas --email cfo@caguas.coop --send-email
  ts-node scripts/provision-demo-portal.ts --slug acacia --ttl 30
  ts-node scripts/provision-demo-portal.ts --list
`);
}

function listSnapshots() {
  process.stdout.write('Available COSSEC snapshots:\n');
  for (const entry of COSSEC_SNAPSHOT_2025Q4) {
    const assetsM = (entry.totalAssets / 1_000_000).toFixed(0);
    process.stdout.write(
      `  ${entry.slug.padEnd(18)}  ${entry.name.padEnd(60)} $${assetsM}M  (${entry.asOfQuarter})\n`,
    );
  }
}

async function ensureProspect(
  prisma: PrismaService,
  leadsService: LeadsService,
  slug: string,
  contactEmailOverride: string | null,
): Promise<{ id: string; name: string; contactEmail: string | null }> {
  const snapshot = COSSEC_SNAPSHOT_BY_SLUG.get(slug);
  if (!snapshot) {
    throw new Error(
      `Unknown slug "${slug}". Run with --list to see available snapshots.`,
    );
  }

  // 1. Try to find by exact name match
  let prospect = await prisma.prospectInstitution.findFirst({
    where: { name: snapshot.name },
  });

  // 2. Seed the entire pipeline if missing (idempotent)
  if (!prospect) {
    process.stderr.write(
      `[provision-demo-portal] Prospect "${snapshot.name}" not found. Seeding prospect pipeline...\n`,
    );
    await leadsService.seedProspectPipeline();
    prospect = await prisma.prospectInstitution.findFirst({
      where: { name: snapshot.name },
    });
  }

  if (!prospect) {
    throw new Error(
      `Failed to seed prospect "${snapshot.name}". Check the database connection.`,
    );
  }

  // 3. Stamp the public-data identifier so DemoSeatService can resolve the puller
  if (
    prospect.publicDataIdentifier !== snapshot.slug ||
    !prospect.publicDataSource ||
    (contactEmailOverride && prospect.contactEmail !== contactEmailOverride)
  ) {
    prospect = await prisma.prospectInstitution.update({
      where: { id: prospect.id },
      data: {
        publicDataIdentifier: snapshot.slug,
        publicDataSource: prospect.publicDataSource || 'cossec',
        ...(contactEmailOverride ? { contactEmail: contactEmailOverride } : {}),
      },
    });
  }

  return {
    id: prospect.id,
    name: prospect.name,
    contactEmail: prospect.contactEmail,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.list) {
    listSnapshots();
    process.exit(0);
  }

  if (!args.slug) {
    process.stderr.write('error: missing required <slug> argument\n\n');
    printHelp();
    process.exit(2);
  }

  process.stderr.write(
    `[provision-demo-portal] Bootstrapping NestJS application context...\n`,
  );

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
    abortOnError: false,
  });

  try {
    const demo = app.get(DemoSeatService);
    const leadsService = app.get(LeadsService);
    const prisma = app.get(PrismaService);

    const prospect = await ensureProspect(
      prisma,
      leadsService,
      args.slug.trim().toLowerCase(),
      args.email,
    );

    const fallbackEmail =
      args.email || prospect.contactEmail || `demo-${args.slug}@cerniq.io`;

    process.stderr.write(
      `[provision-demo-portal] Provisioning demo seat for ${prospect.name} (${fallbackEmail})...\n`,
    );

    const result = await demo.provisionFromProspect({
      prospectId: prospect.id,
      contactEmail: fallbackEmail,
      contactName: args.name || undefined,
      ttlDays: args.ttlDays,
      preferredLanguage: args.language,
      sendEmail: args.sendEmail,
    });

    if (args.json) {
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    } else {
      printSummary(result);
    }

    process.exit(0);
  } catch (err: any) {
    const message = err?.message || String(err);
    const fullDetails = [
      'FULL ERROR DETAILS:',
      `  name:    ${err?.name || 'unknown'}`,
      `  message: ${message}`,
      `  code:    ${err?.code || 'n/a'}`,
      `  meta:    ${err?.meta ? JSON.stringify(err.meta) : 'n/a'}`,
      '',
      'STACK:',
      err?.stack || '(no stack)',
      '',
    ].join('\n');
    // Always write the full details to a file so truncation doesn't hide them
    try {
      require('fs').writeFileSync(
        '/tmp/provision-demo-portal.error.log',
        fullDetails,
      );
    } catch {
      // ignore
    }
    if (message.includes('Unknown slug') || message.includes('not found')) {
      process.stderr.write(`error: ${message}\n`);
      process.exit(1);
    }
    process.stderr.write(`error: ${message}\n`);
    process.stderr.write(
      'See /tmp/provision-demo-portal.error.log for full details.\n',
    );
    if (process.env.DEBUG) {
      process.stderr.write(`${fullDetails}\n`);
    }
    process.exit(3);
  } finally {
    await app.close().catch(() => undefined);
  }
}

function printSummary(result: {
  prospectId: string;
  userId: string;
  reportJobId: string;
  magicLinkUrl: string;
  expiresAt: string;
  contactEmail: string;
  reused: boolean;
  source: string;
  asOfQuarter: string | null;
  disclosure: string;
  reportPortalUrl: string;
  subscriptionUpdated: boolean;
}) {
  const out = process.stdout;
  out.write('\n');
  out.write(
    '  ╭───────────────────────────────────────────────────────────╮\n',
  );
  out.write(
    '  │  CERNIQ Demo Portal — Provisioned                         │\n',
  );
  out.write(
    '  ╰───────────────────────────────────────────────────────────╯\n',
  );
  out.write('\n');
  out.write(`    Prospect ID         ${result.prospectId}\n`);
  out.write(`    Portal user ID      ${result.userId}\n`);
  out.write(`    Report job ID       ${result.reportJobId}\n`);
  out.write(`    Contact email       ${result.contactEmail}\n`);
  out.write(`    Source              ${result.source}\n`);
  out.write(`    As-of quarter       ${result.asOfQuarter || '—'}\n`);
  out.write(`    Reused existing?    ${result.reused ? 'yes' : 'no'}\n`);
  out.write(
    `    Subscription set?   ${result.subscriptionUpdated ? 'yes (tier=demo)' : 'NO — protected (existing paid tier preserved)'}\n`,
  );
  out.write(`    Expires             ${result.expiresAt}\n`);
  out.write('\n');
  out.write(`    Magic link\n      ${result.magicLinkUrl}\n`);
  out.write('\n');
  out.write(`    Direct report URL\n      ${result.reportPortalUrl}\n`);
  out.write('\n');
  out.write(`    Disclosure: ${result.disclosure}\n`);
  out.write('\n');
  out.write(
    '  Next: forward the magic link to the prospect (or rerun with --send-email)\n',
  );
  out.write('\n');
}

main().catch((err) => {
  Logger.error(`Fatal error in provision-demo-portal: ${err?.message || err}`);
  process.exit(3);
});
