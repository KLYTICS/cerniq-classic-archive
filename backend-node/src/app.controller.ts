import { Controller, Get, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('api/demo-request')
  @HttpCode(HttpStatus.CREATED)
  async submitDemoRequest(
    @Body()
    body: {
      email: string;
      name?: string;
      institutionName?: string;
      institutionType?: string;
      totalAssets?: string;
      message?: string;
    },
  ) {
    const record = await this.prisma.demoRequest.create({
      data: {
        email: body.email,
        name: body.name,
        institutionName: body.institutionName,
        institutionType: body.institutionType,
        totalAssets: body.totalAssets,
        message: body.message,
      },
    });
    return { id: record.id, message: 'Demo request received' };
  }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async getHealth() {
    const checks: Record<string, string> = { api: 'up' };

    // Check DB
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      checks.database = 'up';
    } catch {
      checks.database = 'down';
    }

    // Check Redis (best-effort)
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Redis = require('ioredis');
      const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        connectTimeout: 2000,
        lazyConnect: true,
      });
      await redis.connect();
      await redis.ping();
      checks.cache = 'up';
      await redis.quit();
    } catch {
      checks.cache = 'degraded';
    }

    const allUp = Object.values(checks).every((v) => v === 'up');

    return {
      status: allUp ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      services: checks,
    };
  }

  @Get('api/status')
  getStatus() {
    return {
      name: 'CapexCycleOS API',
      version: '2.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      endpoints: {
        marketData: '/api/market-data',
        charts: '/api/charts',
        risk: '/api/risk',
        options: '/api/options',
        execution: '/api/execution',
        realtime: '/market-data (WebSocket)',
      },
    };
  }
}
