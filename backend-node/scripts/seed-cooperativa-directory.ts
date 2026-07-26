#!/usr/bin/env ts-node
/**
 * Seed the cooperativa leadership directory into Postgres.
 *
 * USAGE: cd backend-node && pnpm exec ts-node scripts/seed-cooperativa-directory.ts
 */
import 'dotenv/config';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { CooperativaDirectoryService } from '../src/cooperativa-directory/cooperativa-directory.service';

const logger = new Logger('seed-cooperativa-directory');

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const directory = app.get(CooperativaDirectoryService);
    const seeded = await directory.seedFullDirectory();
    const bundle = await directory.buildAgentBundle();
    logger.log(JSON.stringify({ seeded, bundleMeta: {
      institutionCount: bundle.institutionCount,
      leadershipSeatCount: bundle.leadershipSeatCount,
      schemaVersion: bundle.schemaVersion,
    }}, null, 2));
    process.exit(0);
  } catch (error: unknown) {
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await app.close();
  }
}

main();
