import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require('@prisma/client');

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (connectionString) {
      const poolSize = parseInt(process.env.DATABASE_POOL_SIZE || '20', 10);
      const pool = new pg.Pool({
        connectionString,
        max: poolSize,
        idleTimeoutMillis: 30_000, // Close idle connections after 30s
        connectionTimeoutMillis: 5_000, // Fail fast if pool is saturated
      });
      const adapter = new PrismaPg(pool);
      super({ adapter });
      return;
    }

    // Allow unit tests to import services without requiring a live DB URL.
    super();
  }

  async onModuleInit() {
    if (!process.env.DATABASE_URL) {
      return;
    }
    await this.$connect();
  }

  async onModuleDestroy() {
    if (!process.env.DATABASE_URL) {
      return;
    }
    await this.$disconnect();
  }
}
