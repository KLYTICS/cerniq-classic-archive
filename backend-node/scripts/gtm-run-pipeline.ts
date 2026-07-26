#!/usr/bin/env ts-node
/**
 * CLI: Execute the full GTM pipeline against the live database.
 *
 * USAGE
 *   cd backend-node && pnpm exec ts-node scripts/gtm-run-pipeline.ts
 *   cd backend-node && pnpm exec ts-node scripts/gtm-run-pipeline.ts --linkedin ../Connections.csv
 */
import 'dotenv/config';

import * as fs from 'fs';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { GtmPipelineService } from '../src/leads/gtm-pipeline.service';

const logger = new Logger('gtm-run-pipeline');

function getArg(name: string): string | null {
  const idx = process.argv.indexOf(name);
  if (idx < 0 || idx + 1 >= process.argv.length) return null;
  return process.argv[idx + 1];
}

async function main() {
  const linkedInPath = getArg('--linkedin');
  const linkedInCsv = linkedInPath
    ? fs.readFileSync(linkedInPath, 'utf8')
    : undefined;

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const pipeline = app.get(GtmPipelineService);
    const result = await pipeline.executeFullPipeline({
      triggerSource: 'cli',
      linkedInCsv,
      persistArtifacts: true,
    });
    logger.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error: unknown) {
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await app.close();
  }
}

main();
