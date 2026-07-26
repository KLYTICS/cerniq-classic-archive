#!/usr/bin/env ts-node
/**
 * Seed the COSSEC PR cooperativa registry into CRM and/or product shells.
 *
 * Usage:
 *   pnpm seed:pr-registry -- --track=crm
 *   pnpm seed:pr-registry -- --track=product
 *   pnpm seed:pr-registry -- --track=both
 *   pnpm seed:pr-registry -- --track=product --workspace=<uuid>
 *   pnpm seed:pr-registry -- --track=product --owner=<userUuid>
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import pg from 'pg';
import { LeadsService } from '../src/leads/leads.service';
import { MarketRegistrySeedService } from '../src/alm/market-registry-seed.service';
import { EmailService } from '../src/email/email.service';

type Track = 'crm' | 'product' | 'both';

function parseArgs(argv: string[]): {
  track: Track;
  workspace?: string;
  owner?: string;
} {
  let track: Track = 'both';
  let workspace: string | undefined;
  let owner: string | undefined;
  for (const arg of argv.slice(2)) {
    const match = arg.match(/^--([a-zA-Z]+)=(.+)$/);
    if (!match) continue;
    const [, key, value] = match;
    if (
      key === 'track' &&
      (value === 'crm' || value === 'product' || value === 'both')
    ) {
      track = value;
    } else if (key === 'workspace') workspace = value;
    else if (key === 'owner') owner = value;
  }
  return { track, workspace, owner };
}

function createPrisma(): { prisma: PrismaClient; pool: pg.Pool } {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is required to seed the PR cooperativa registry',
    );
  }
  const pool = new pg.Pool({ connectionString, max: 5 });
  const adapter = new PrismaPg(pool);
  return { prisma: new PrismaClient({ adapter }), pool };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const { prisma, pool } = createPrisma();
  const out: Record<string, unknown> = { track: args.track };

  try {
    if (args.track === 'crm' || args.track === 'both') {
      // EmailService is unused for seed; pass a no-op stub.
      const email = {
        sendLeadNotification: async () => undefined,
        sendLeadConfirmation: async () => undefined,
      } as unknown as EmailService;
      const leads = new LeadsService(prisma as never, email);
      out.crm = await leads.seedProspectPipeline();
    }

    if (args.track === 'product' || args.track === 'both') {
      const market = new MarketRegistrySeedService(prisma as never);
      out.product = await market.seedMarketRegistry({
        workspaceId: args.workspace,
        ownerId: args.owner,
      });
    }

    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`seed-pr-registry failed: ${message}\n`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

void main();
