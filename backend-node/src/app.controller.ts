import { Controller, Get, Post, Patch, Delete, Param, Query, Body, Headers, HttpCode, HttpStatus, UseGuards, UnauthorizedException, Req } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { AuthGuard } from './auth/auth.guard';
import { EmailService } from './email/email.service';
import { SkipThrottle } from '@nestjs/throttler';

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

    // Auto-create prospect from demo request
    try {
      await this.prisma.prospect.create({
        data: {
          name: body.name || body.email,
          email: body.email,
          company: body.institutionName || null,
          role: null,
          stage: 'lead',
          source: 'demo_request',
          notes: body.message || null,
        },
      });
    } catch {
      // Non-critical — don't fail the demo request if prospect creation fails
    }

    return { id: record.id, message: 'Demo request received' };
  }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @SkipThrottle()
  async getHealth() {
    const checks: Record<string, string> = { api: 'up' };

    // Check DB
    try {
      await this.prisma.$queryRaw`SELECT 1`;
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

  @Get('health/detailed')
  @SkipThrottle()
  async getHealthDetailed() {
    const services: Record<string, { status: string; latencyMs: number }> = {};

    // DB check with timing
    const dbStart = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      services.database = { status: 'up', latencyMs: Date.now() - dbStart };
    } catch {
      services.database = { status: 'down', latencyMs: Date.now() - dbStart };
    }

    // Redis check with timing
    const redisStart = Date.now();
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Redis = require('ioredis');
      const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        connectTimeout: 2000,
        lazyConnect: true,
      });
      await redis.connect();
      await redis.ping();
      services.cache = { status: 'up', latencyMs: Date.now() - redisStart };
      await redis.quit();
    } catch {
      services.cache = { status: 'degraded', latencyMs: Date.now() - redisStart };
    }

    const allUp = Object.values(services).every((s) => s.status === 'up');

    return {
      status: allUp ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      services,
    };
  }

  @Get('api/admin/demo-requests')
  async getDemoRequests(@Headers('x-admin-key') adminKey: string) {
    this.verifyAdmin(adminKey);
    return this.prisma.demoRequest.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  @Delete('api/admin/demo-data')
  @HttpCode(HttpStatus.OK)
  async resetDemoData(@Headers('x-admin-key') adminKey: string) {
    this.verifyAdmin(adminKey);
    await this.prisma.balanceSheetItem.deleteMany({});
    await this.prisma.interestRateScenario.deleteMany({});
    await this.prisma.liquidityPosition.deleteMany({});
    await this.prisma.institution.deleteMany({});
    return { message: 'Demo data cleared' };
  }

  @Get('api/admin/stats')
  async getAdminStats(@Headers('x-admin-key') adminKey: string) {
    this.verifyAdmin(adminKey);
    const [demoRequests, institutions, users, prospects] = await Promise.all([
      this.prisma.demoRequest.count(),
      this.prisma.institution.count(),
      this.prisma.user.count(),
      this.prisma.prospect.count(),
    ]);
    const recentUsers = await this.prisma.user.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    });
    return { demoRequests, institutions, users, recentUsers, prospects };
  }

  @Post('api/admin/seed-prospects')
  @HttpCode(HttpStatus.CREATED)
  async seedProspects(@Headers('x-admin-key') adminKey: string) {
    this.verifyAdmin(adminKey);
    const seedJson = process.env.PROSPECT_SEED_DATA;
    if (!seedJson) {
      return { error: 'PROSPECT_SEED_DATA env var not configured', seeded: 0, total: 0 };
    }
    let seeds: Array<{ name: string; email: string; company: string; role: string; stage: 'lead' | 'contacted' | 'demo_done' | 'demo_scheduled' | 'proposal'; source: string; notes: string }>;
    try {
      seeds = JSON.parse(seedJson);
    } catch {
      return { error: 'PROSPECT_SEED_DATA is not valid JSON', seeded: 0, total: 0 };
    }

    const results = [];
    for (const seed of seeds) {
      const existing = await this.prisma.prospect.findFirst({ where: { email: seed.email } });
      if (!existing) {
        results.push(await this.prisma.prospect.create({ data: seed }));
      }
    }
    return { seeded: results.length, total: seeds.length };
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
  @SkipThrottle()
  getStatus() {
    return {
      name: 'CERNIQ API',
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

  // --- Prospect CRM Endpoints ---

  @Get('api/admin/prospects')
  async getProspects(@Headers('x-admin-key') adminKey: string, @Query('stage') stage?: string) {
    this.verifyAdmin(adminKey);
    const where = stage ? { stage: stage as any } : {};
    return this.prisma.prospect.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('api/admin/prospects')
  @HttpCode(HttpStatus.CREATED)
  async createProspect(
    @Headers('x-admin-key') adminKey: string,
    @Body() body: { name: string; email?: string; company?: string; role?: string; stage?: string; source?: string; notes?: string },
  ) {
    this.verifyAdmin(adminKey);
    return this.prisma.prospect.create({
      data: {
        name: body.name,
        email: body.email || null,
        company: body.company || null,
        role: body.role || null,
        stage: (body.stage as any) || 'lead',
        source: body.source || 'manual',
        notes: body.notes || null,
      },
    });
  }

  @Patch('api/admin/prospects/:id')
  async updateProspect(
    @Headers('x-admin-key') adminKey: string,
    @Param('id') id: string,
    @Body() body: { stage?: string; notes?: string; name?: string; email?: string; company?: string; role?: string },
  ) {
    this.verifyAdmin(adminKey);
    const data: any = {};
    if (body.stage !== undefined) data.stage = body.stage;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.name !== undefined) data.name = body.name;
    if (body.email !== undefined) data.email = body.email;
    if (body.company !== undefined) data.company = body.company;
    if (body.role !== undefined) data.role = body.role;
    return this.prisma.prospect.update({ where: { id }, data });
  }

  @Delete('api/admin/prospects/:id')
  @HttpCode(HttpStatus.OK)
  async deleteProspect(@Headers('x-admin-key') adminKey: string, @Param('id') id: string) {
    this.verifyAdmin(adminKey);
    await this.prisma.prospect.delete({ where: { id } });
    return { message: 'Prospect deleted' };
  }

  private verifyAdmin(key: string) {
    const adminKey = process.env.ADMIN_KEY;
    if (!adminKey || key !== adminKey) {
      throw new UnauthorizedException('Invalid admin key');
    }
  }
}
