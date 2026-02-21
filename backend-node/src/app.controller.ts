import { Controller, Get, Post, Delete, Body, HttpCode, HttpStatus, UseGuards, Req } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { AuthGuard } from './auth/auth.guard';
import { EmailService } from './email/email.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
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

    // Send email notifications (fire-and-forget)
    this.emailService.sendDemoRequestNotification(body).catch(() => {});
    this.emailService.sendDemoConfirmation({ name: body.name, email: body.email }).catch(() => {});

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

  @Get('api/admin/demo-requests')
  async getDemoRequests() {
    return this.prisma.demoRequest.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  @Delete('api/admin/demo-data')
  @HttpCode(HttpStatus.OK)
  async resetDemoData() {
    await this.prisma.balanceSheetItem.deleteMany({});
    await this.prisma.interestRateScenario.deleteMany({});
    await this.prisma.liquidityPosition.deleteMany({});
    await this.prisma.institution.deleteMany({});
    return { message: 'Demo data cleared' };
  }

  @Get('api/admin/stats')
  async getAdminStats() {
    const [demoRequests, institutions, users] = await Promise.all([
      this.prisma.demoRequest.count(),
      this.prisma.institution.count(),
      this.prisma.user.count(),
    ]);
    const recentUsers = await this.prisma.user.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    });
    return { demoRequests, institutions, users, recentUsers };
  }

  // --- Workspace Endpoints ---

  @Get('api/workspaces')
  @UseGuards(AuthGuard)
  async getWorkspaces(@Req() req: any) {
    return this.prisma.workspace.findMany({
      where: { ownerId: req.user.userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('api/workspaces')
  @UseGuards(AuthGuard)
  async createWorkspace(@Req() req: any, @Body() body: { name: string }) {
    return this.prisma.workspace.create({
      data: {
        name: body.name || 'My Workspace',
        ownerId: req.user.userId,
      },
    });
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
