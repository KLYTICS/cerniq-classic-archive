import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
  UnauthorizedException,
  Req,
  NotFoundException,
} from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { AuthGuard } from './auth/auth.guard';
import { EmailService } from './email/email.service';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { DemoRequestDto } from './dto/demo-request.dto';
import { MarketDataService } from './market-data/market-data.service';
import { MarketStreamManagerService } from './market-data/market-stream-manager.service';

function shouldExposeDetailedHealth(): boolean {
  const raw = (process.env.HEALTH_DETAILS_PUBLIC || '').trim().toLowerCase();
  if (raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on') {
    return true;
  }
  return process.env.NODE_ENV !== 'production';
}

const BYTES_PER_MB = 1048576;
const CGROUP_MEMORY_LIMIT_PATHS = [
  '/sys/fs/cgroup/memory.max',
  '/sys/fs/cgroup/memory/memory.limit_in_bytes',
];
const UNBOUNDED_MEMORY_THRESHOLD = 1n << 60n;

export interface HealthMemorySnapshot {
  source: 'container' | 'heap';
  primaryPercent: number;
  heapPercent: number | null;
  rssPercent: number | null;
  heapUsedMB: number;
  heapTotalMB: number;
  rssMB: number;
  limitMB: number | null;
}

function toMegabytes(bytes: number): number {
  return Math.round(bytes / BYTES_PER_MB);
}

function toPercent(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    return null;
  }
  if (denominator <= 0) {
    return null;
  }
  return +((numerator / denominator) * 100).toFixed(1);
}

function parseContainerMemoryLimit(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'max') {
    return null;
  }

  try {
    const bytes = BigInt(trimmed);
    if (bytes <= 0n || bytes >= UNBOUNDED_MEMORY_THRESHOLD) {
      return null;
    }
    return Number(bytes);
  } catch {
    return null;
  }
}

// Cache container memory limit at module load — cgroup limits don't change at runtime
let _cachedMemoryLimit: number | null | undefined;
function readContainerMemoryLimitBytes(): number | null {
  if (_cachedMemoryLimit !== undefined) return _cachedMemoryLimit;
  for (const p of CGROUP_MEMORY_LIMIT_PATHS) {
    try {
      const raw = readFileSync(p, 'utf8');
      const parsed = parseContainerMemoryLimit(raw);
      if (parsed !== null) {
        _cachedMemoryLimit = parsed;
        return parsed;
      }
    } catch {
      // Best-effort only. Local dev and some hosts will not expose cgroups.
    }
  }
  _cachedMemoryLimit = null;
  return null;
}

export function getHealthMemorySnapshot(
  mem: NodeJS.MemoryUsage = process.memoryUsage(),
): HealthMemorySnapshot {
  const limitBytes = readContainerMemoryLimitBytes();
  const heapPercent = toPercent(mem.heapUsed, mem.heapTotal);
  const rssPercent =
    limitBytes !== null ? toPercent(mem.rss, limitBytes) : null;
  const source: HealthMemorySnapshot['source'] =
    rssPercent !== null ? 'container' : 'heap';
  const primaryPercent =
    source === 'container' ? (rssPercent ?? 0) : (heapPercent ?? 0);

  return {
    source,
    primaryPercent,
    heapPercent,
    rssPercent,
    heapUsedMB: toMegabytes(mem.heapUsed),
    heapTotalMB: toMegabytes(mem.heapTotal),
    rssMB: toMegabytes(mem.rss),
    limitMB: limitBytes !== null ? toMegabytes(limitBytes) : null,
  };
}

function isDependencyDegraded(status: string | undefined): boolean {
  return status === 'degraded' || status === 'down' || status === 'unhealthy';
}

export function determineOverallHealthStatus(params: {
  dbConnected: boolean;
  checks: Record<string, string>;
  memory: HealthMemorySnapshot;
}): 'ok' | 'degraded' | 'down' {
  if (!params.dbConnected) {
    return 'down';
  }

  const memoryThreshold =
    params.memory.source === 'container'
      ? params.memory.primaryPercent >= 90
      : params.memory.primaryPercent >= 95;

  if (memoryThreshold || Object.values(params.checks).some(isDependencyDegraded)) {
    return 'degraded';
  }

  return 'ok';
}

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly marketDataService: MarketDataService,
    private readonly marketStreamManager: MarketStreamManagerService,
  ) {}

  @Post('api/demo-request')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.CREATED)
  async submitDemoRequest(@Body() body: DemoRequestDto) {
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
    this.emailService
      .sendDemoConfirmation({ name: body.name, email: body.email })
      .catch(() => {});

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

  // Graceful shutdown: return 503 during drain period so load balancers stop routing
  private static shuttingDown = false;
  static markShuttingDown() { AppController.shuttingDown = true; }

  @Get('health')
  @SkipThrottle()
  async getHealth() {
    if (AppController.shuttingDown) {
      return { status: 'shutting_down', message: 'Instance is draining connections' };
    }
    const checks: Record<string, string> = { api: 'up' };

    // Check DB
    let dbConnected = true;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'up';
    } catch {
      checks.database = 'down';
      dbConnected = false;
    }

    // Check Redis (best-effort)
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Redis = require('ioredis');
      const redis = new Redis(
        process.env.REDIS_URL || 'redis://localhost:6379',
        {
          connectTimeout: 2000,
          lazyConnect: true,
        },
      );
      await redis.connect();
      await redis.ping();
      checks.cache = 'up';
      await redis.quit();
    } catch {
      checks.cache = 'degraded';
    }

    const marketDataHealth = this.marketDataService.getHealth(
      this.marketStreamManager.getStreamStatus(),
    );
    checks.marketData = marketDataHealth.status;

    const memory = getHealthMemorySnapshot();
    const status = determineOverallHealthStatus({
      dbConnected,
      checks,
      memory,
    });

    return {
      status,
      db: dbConnected ? 'connected' : 'error',
      memoryPercent: memory.primaryPercent,
      memorySource: memory.source,
      memory: {
        heapUsedMB: memory.heapUsedMB,
        heapTotalMB: memory.heapTotalMB,
        rssMB: memory.rssMB,
        limitMB: memory.limitMB,
        heapPercent: memory.heapPercent,
        rssPercent: memory.rssPercent,
      },
      version: '2.0.0',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      services: checks,
    };
  }

  @Get('ready')
  @SkipThrottle()
  async getReady() {
    let dbReady = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbReady = true;
    } catch {
      // DB not ready
    }

    const ready = dbReady;

    return {
      ready,
      checks: {
        database: dbReady ? 'ok' : 'fail',
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health/detailed')
  @SkipThrottle()
  async getHealthDetailed() {
    if (!shouldExposeDetailedHealth()) {
      throw new NotFoundException();
    }

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
      const redis = new Redis(
        process.env.REDIS_URL || 'redis://localhost:6379',
        {
          connectTimeout: 2000,
          lazyConnect: true,
        },
      );
      await redis.connect();
      await redis.ping();
      services.cache = { status: 'up', latencyMs: Date.now() - redisStart };
      await redis.quit();
    } catch {
      services.cache = {
        status: 'degraded',
        latencyMs: Date.now() - redisStart,
      };
    }

    const marketDataHealth = this.marketDataService.getHealth(
      this.marketStreamManager.getStreamStatus(),
    );
    const memory = getHealthMemorySnapshot();
    services.marketData = {
      status: marketDataHealth.status,
      latencyMs: 0,
    };

    const allUp = Object.values(services).every(
      (s) => s.status === 'up' || s.status === 'healthy',
    );

    return {
      status: allUp ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      uptime: process.uptime(),
      memory,
      services,
      marketData: marketDataHealth,
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
      return {
        error: 'PROSPECT_SEED_DATA env var not configured',
        seeded: 0,
        total: 0,
      };
    }
    let seeds: Array<{
      name: string;
      email: string;
      company: string;
      role: string;
      stage: 'lead' | 'contacted' | 'demo_done' | 'demo_scheduled' | 'proposal';
      source: string;
      notes: string;
    }>;
    try {
      seeds = JSON.parse(seedJson);
    } catch {
      return {
        error: 'PROSPECT_SEED_DATA is not valid JSON',
        seeded: 0,
        total: 0,
      };
    }

    const results: any[] = [];
    for (const seed of seeds) {
      const existing = await this.prisma.prospect.findFirst({
        where: { email: seed.email },
      });
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
  async getProspects(
    @Headers('x-admin-key') adminKey: string,
    @Query('stage') stage?: string,
  ) {
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
    @Body()
    body: {
      name: string;
      email?: string;
      company?: string;
      role?: string;
      stage?: string;
      source?: string;
      notes?: string;
    },
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
    @Body()
    body: {
      stage?: string;
      notes?: string;
      name?: string;
      email?: string;
      company?: string;
      role?: string;
    },
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
  async deleteProspect(
    @Headers('x-admin-key') adminKey: string,
    @Param('id') id: string,
  ) {
    this.verifyAdmin(adminKey);
    await this.prisma.prospect.delete({ where: { id } });
    return { message: 'Prospect deleted' };
  }

  @Get('api/admin/ops')
  async getAdminOps(@Headers('x-admin-key') adminKey: string) {
    this.verifyAdmin(adminKey);

    const [recentJobs, activeSubscriptions, totalAnalysisRuns] =
      await Promise.all([
        this.prisma.reportJob.findMany({
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            institutionName: true,
            status: true,
            createdAt: true,
            completedAt: true,
            errorMessage: true,
            triggeredBy: true,
          },
        }),
        this.prisma.subscription.count({ where: { status: 'active' } }),
        this.prisma.analysisRun.count(),
      ]);

    return {
      recentJobs,
      activeSubscriptions,
      totalAnalysisRuns,
    };
  }

  private verifyAdmin(key: string) {
    const adminKey = process.env.ADMIN_KEY;
    if (!adminKey || !key) {
      throw new UnauthorizedException('Invalid admin key');
    }
    // Timing-safe comparison to prevent oracle attacks
    const a = Buffer.from(key);
    const b = Buffer.from(adminKey);
    if (a.length !== b.length || !require('crypto').timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid admin key');
    }
  }
}
