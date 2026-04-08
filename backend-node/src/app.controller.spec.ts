import { Test, TestingModule } from '@nestjs/testing';
import {
  AppController,
  determineOverallHealthStatus,
  getHealthMemorySnapshot,
  _resetCachedMemoryLimit,
  incrementActiveRequests,
  decrementActiveRequests,
  getActiveRequestCount,
} from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { AuthGuard } from './auth/auth.guard';
import { AdminGuard } from './common/guards/admin.guard';
import { EmailService } from './email/email.service';
import { MarketDataService } from './market-data/market-data.service';
import { MarketStreamManagerService } from './market-data/market-stream-manager.service';
import { CacheService } from './cache/cache.service';
import { ExitMetricsService } from './admin/exit-metrics.service';
import { UnauthorizedException } from '@nestjs/common';

jest.mock('node:fs', () => {
  const actual = jest.requireActual('node:fs');
  return {
    ...actual,
    readFileSync: jest.fn(),
  };
});

jest.mock('./prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({
    $queryRaw: jest.fn(),
    getPoolStats: jest.fn().mockReturnValue(null),
    demoRequest: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    institution: { count: jest.fn(), deleteMany: jest.fn() },
    balanceSheetItem: { deleteMany: jest.fn() },
    interestRateScenario: { deleteMany: jest.fn() },
    liquidityPosition: { deleteMany: jest.fn() },
    user: { count: jest.fn() },
    prospect: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    workspace: { findMany: jest.fn(), create: jest.fn() },
    reportJob: { findMany: jest.fn() },
    subscription: { count: jest.fn() },
    analysisRun: { count: jest.fn() },
    webhookSubscription: { findMany: jest.fn() },
  })),
}));

const { readFileSync } = jest.requireMock('node:fs');

describe('AppController', () => {
  let controller: AppController;
  let prisma: any;
  let cacheService: any;
  let emailService: any;
  let exitMetricsService: any;

  beforeEach(async () => {
    cacheService = {
      get: jest.fn(),
      set: jest.fn(),
      ping: jest.fn().mockResolvedValue(true),
      redis: null,
    };
    emailService = {
      sendDemoRequestNotification: jest.fn().mockResolvedValue(undefined),
      sendDemoConfirmation: jest.fn().mockResolvedValue(undefined),
    };
    exitMetricsService = {
      getExitMetrics: jest.fn().mockResolvedValue({
        mrr: 0,
        arr: 0,
        activeInstitutions: 0,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        PrismaService,
        {
          provide: EmailService,
          useValue: emailService,
        },
        {
          provide: MarketDataService,
          useValue: { getHealth: jest.fn().mockReturnValue({ status: 'up' }) },
        },
        {
          provide: MarketStreamManagerService,
          useValue: { getStreamStatus: jest.fn().mockReturnValue({}) },
        },
        {
          provide: CacheService,
          useValue: cacheService,
        },
        {
          provide: ExitMetricsService,
          useValue: exitMetricsService,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AppController>(AppController);
    prisma = module.get<PrismaService>(PrismaService);
    readFileSync.mockReset();
    _resetCachedMemoryLimit();

    // Reset shutdown state
    (AppController as any).shuttingDown = false;
  });

  // ── Basic ──────────────────────────────────────────────────────────

  it('should return "Hello World!"', () => {
    expect(controller.getHello()).toBe('Hello World!');
  });

  // ── API Status ─────────────────────────────────────────────────────

  it('should return API status', () => {
    const status = controller.getStatus();
    expect(status.name).toBe('CERNIQ API');
    expect(status.version).toBe('2.0.0');
    expect(status.endpoints).toBeDefined();
    expect(status.endpoints).toHaveProperty('marketData');
    expect(status.endpoints).toHaveProperty('charts');
    expect(status.endpoints).toHaveProperty('risk');
  });

  // ── Memory Snapshot ────────────────────────────────────────────────

  it('uses cgroup memory limits when available', () => {
    _resetCachedMemoryLimit();
    readFileSync.mockReturnValueOnce('536870912');

    const snapshot = getHealthMemorySnapshot({
      rss: 268435456,
      heapTotal: 134217728,
      heapUsed: 67108864,
      external: 0,
      arrayBuffers: 0,
    });

    expect(snapshot.source).toBe('container');
    expect(snapshot.primaryPercent).toBe(50);
    expect(snapshot.rssPercent).toBe(50);
    expect(snapshot.limitMB).toBe(512);
  });

  it('falls back to heap usage when no container limit is exposed', () => {
    _resetCachedMemoryLimit();
    readFileSync.mockImplementation(() => {
      throw new Error('missing');
    });

    const snapshot = getHealthMemorySnapshot({
      rss: 268435456,
      heapTotal: 200,
      heapUsed: 100,
      external: 0,
      arrayBuffers: 0,
    });

    expect(snapshot.source).toBe('heap');
    expect(snapshot.primaryPercent).toBe(50);
    expect(snapshot.heapPercent).toBe(50);
    expect(snapshot.rssPercent).toBeNull();
    expect(snapshot.limitMB).toBeNull();
  });

  it('ignores "max" cgroup limit', () => {
    _resetCachedMemoryLimit();
    readFileSync.mockReturnValueOnce('max');

    const snapshot = getHealthMemorySnapshot({
      rss: 268435456,
      heapTotal: 200,
      heapUsed: 100,
      external: 0,
      arrayBuffers: 0,
    });

    expect(snapshot.source).toBe('heap');
    expect(snapshot.limitMB).toBeNull();
  });

  it('handles very large cgroup values as unbounded', () => {
    _resetCachedMemoryLimit();
    // Value > 2^60 is treated as unbounded
    readFileSync.mockReturnValueOnce('9999999999999999999999');

    const snapshot = getHealthMemorySnapshot({
      rss: 100000,
      heapTotal: 200,
      heapUsed: 100,
      external: 0,
      arrayBuffers: 0,
    });

    expect(snapshot.source).toBe('heap');
    expect(snapshot.limitMB).toBeNull();
  });

  it('caches memory limit after first read', () => {
    _resetCachedMemoryLimit();
    readFileSync.mockReturnValueOnce('536870912');

    getHealthMemorySnapshot({
      rss: 100,
      heapTotal: 200,
      heapUsed: 100,
      external: 0,
      arrayBuffers: 0,
    });
    // Second call should use cache and not call readFileSync again
    readFileSync.mockClear();
    getHealthMemorySnapshot({
      rss: 100,
      heapTotal: 200,
      heapUsed: 100,
      external: 0,
      arrayBuffers: 0,
    });
    expect(readFileSync).not.toHaveBeenCalled();
  });

  // ── determineOverallHealthStatus ───────────────────────────────────

  it('marks health degraded for degraded dependencies', () => {
    const status = determineOverallHealthStatus({
      dbConnected: true,
      checks: { api: 'up', cache: 'up', marketData: 'degraded' },
      memory: {
        source: 'container',
        primaryPercent: 42,
        heapPercent: 50,
        rssPercent: 42,
        heapUsedMB: 64,
        heapTotalMB: 128,
        rssMB: 256,
        limitMB: 512,
      },
    });
    expect(status).toBe('degraded');
  });

  it('keeps health ok for healthy dependencies and safe memory', () => {
    const status = determineOverallHealthStatus({
      dbConnected: true,
      checks: { api: 'up', cache: 'up', marketData: 'healthy' },
      memory: {
        source: 'container',
        primaryPercent: 42,
        heapPercent: 50,
        rssPercent: 42,
        heapUsedMB: 64,
        heapTotalMB: 128,
        rssMB: 256,
        limitMB: 512,
      },
    });
    expect(status).toBe('ok');
  });

  it('marks health down when DB is disconnected', () => {
    const status = determineOverallHealthStatus({
      dbConnected: false,
      checks: { api: 'up', database: 'down' },
      memory: {
        source: 'heap',
        primaryPercent: 10,
        heapPercent: 10,
        rssPercent: null,
        heapUsedMB: 10,
        heapTotalMB: 100,
        rssMB: 20,
        limitMB: null,
      },
    });
    expect(status).toBe('down');
  });

  it('marks health degraded when container memory >= 90%', () => {
    const status = determineOverallHealthStatus({
      dbConnected: true,
      checks: { api: 'up' },
      memory: {
        source: 'container',
        primaryPercent: 92,
        heapPercent: 50,
        rssPercent: 92,
        heapUsedMB: 64,
        heapTotalMB: 128,
        rssMB: 460,
        limitMB: 500,
      },
    });
    expect(status).toBe('degraded');
  });

  it('marks health degraded when heap memory >= 95%', () => {
    const status = determineOverallHealthStatus({
      dbConnected: true,
      checks: { api: 'up' },
      memory: {
        source: 'heap',
        primaryPercent: 96,
        heapPercent: 96,
        rssPercent: null,
        heapUsedMB: 96,
        heapTotalMB: 100,
        rssMB: 100,
        limitMB: null,
      },
    });
    expect(status).toBe('degraded');
  });

  it('marks health degraded for "down" dependency status', () => {
    const status = determineOverallHealthStatus({
      dbConnected: true,
      checks: { api: 'up', cache: 'down' },
      memory: {
        source: 'heap',
        primaryPercent: 30,
        heapPercent: 30,
        rssPercent: null,
        heapUsedMB: 30,
        heapTotalMB: 100,
        rssMB: 50,
        limitMB: null,
      },
    });
    expect(status).toBe('degraded');
  });

  it('marks health degraded for "unhealthy" dependency status', () => {
    const status = determineOverallHealthStatus({
      dbConnected: true,
      checks: { api: 'up', marketData: 'unhealthy' },
      memory: {
        source: 'heap',
        primaryPercent: 30,
        heapPercent: 30,
        rssPercent: null,
        heapUsedMB: 30,
        heapTotalMB: 100,
        rssMB: 50,
        limitMB: null,
      },
    });
    expect(status).toBe('degraded');
  });

  // ── Active Request Counter ─────────────────────────────────────────

  describe('active request counter', () => {
    it('increments and decrements', () => {
      const baseline = getActiveRequestCount();
      incrementActiveRequests();
      expect(getActiveRequestCount()).toBe(baseline + 1);
      decrementActiveRequests();
      expect(getActiveRequestCount()).toBe(baseline);
    });
  });

  // ── Health Endpoint ────────────────────────────────────────────────

  describe('GET /health', () => {
    it('returns healthy status when all checks pass', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      const result = await controller.getHealth();
      expect(result.status).toBeDefined();
      expect(result.db).toBe('connected');
      expect(result.version).toBe('2.0.0');
      expect(result.services).toBeDefined();
      expect(result.services.api).toBe('up');
      expect(result.services.database).toBe('up');
      expect(result.memory).toBeDefined();
    });

    it('reports database down on query failure', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));
      const result = await controller.getHealth();
      expect(result.db).toBe('error');
      expect(result.services.database).toBe('down');
      expect(result.status).toBe('down');
    });

    it('reports cache degraded when ping fails', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      cacheService.ping.mockResolvedValue(false);
      const result = await controller.getHealth();
      expect(result.services.cache).toBe('degraded');
    });

    it('reports cache degraded when ping throws', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      cacheService.ping.mockRejectedValue(new Error('Redis down'));
      const result = await controller.getHealth();
      expect(result.services.cache).toBe('degraded');
    });

    it('includes pool stats when available', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      prisma.getPoolStats.mockReturnValue({
        totalCount: 5,
        idleCount: 3,
        waitingCount: 0,
        maxSize: 10,
      });
      const result = await controller.getHealth();
      expect(result.connectionPool).toBeDefined();
      expect(result.connectionPool!.totalConnections).toBe(5);
    });
  });

  // ── Liveness ───────────────────────────────────────────────────────

  describe('GET /health/live', () => {
    it('returns alive status', () => {
      const result = controller.getLiveness();
      expect(result.status).toBe('alive');
      expect(result.pid).toBe(process.pid);
      expect(typeof result.uptime).toBe('number');
    });
  });

  // ── Ready ──────────────────────────────────────────────────────────

  describe('GET /ready', () => {
    it('returns ready when all checks pass', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      cacheService.ping.mockResolvedValue(true);
      const res = { status: jest.fn() };
      const result = await controller.getReady(res as any);
      expect(result.ready).toBe(true);
      expect(result.checks.database).toBe('ok');
      expect(result.checks.cache).toBe('ok');
      expect(result.checks.shutdown).toBe('ok');
    });

    it('returns not ready when DB fails', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('DB down'));
      cacheService.ping.mockResolvedValue(true);
      const res = { status: jest.fn() };
      const result = await controller.getReady(res as any);
      expect(result.ready).toBe(false);
      expect(result.checks.database).toBe('fail');
      expect(res.status).toHaveBeenCalledWith(503);
    });

    it('returns not ready during shutdown', async () => {
      (AppController as any).shuttingDown = true;
      prisma.$queryRaw.mockResolvedValue([]);
      cacheService.ping.mockResolvedValue(true);
      const res = { status: jest.fn() };
      const result = await controller.getReady(res as any);
      expect(result.ready).toBe(false);
      expect(result.checks.shutdown).toBe('fail');
    });
  });

  // ── Demo Request ───────────────────────────────────────────────────

  describe('POST /api/demo-request', () => {
    it('creates a demo request and returns id', async () => {
      prisma.demoRequest.create.mockResolvedValue({ id: 'dr-1' });
      prisma.prospect.create.mockResolvedValue({ id: 'p-1' });

      const body = {
        email: 'test@example.com',
        name: 'John Doe',
        institutionName: 'Coop Test',
        institutionType: 'cooperativa',
        totalAssets: '$100M-$500M',
      };
      const result = await controller.submitDemoRequest(body as any);
      expect(result.id).toBe('dr-1');
      expect(result.message).toBe('Demo request received');
      expect(prisma.demoRequest.create).toHaveBeenCalled();
    });

    it('sends email notifications', async () => {
      prisma.demoRequest.create.mockResolvedValue({ id: 'dr-2' });
      prisma.prospect.create.mockResolvedValue({ id: 'p-2' });

      const body = {
        email: 'test@example.com',
        name: 'Jane Doe',
      };
      await controller.submitDemoRequest(body as any);

      expect(emailService.sendDemoRequestNotification).toHaveBeenCalledWith(
        body,
      );
      expect(emailService.sendDemoConfirmation).toHaveBeenCalledWith({
        name: 'Jane Doe',
        email: 'test@example.com',
      });
    });

    it('does not fail when prospect creation fails', async () => {
      prisma.demoRequest.create.mockResolvedValue({ id: 'dr-3' });
      prisma.prospect.create.mockRejectedValue(new Error('Duplicate'));

      const body = { email: 'test@example.com', name: 'Dup User' };
      const result = await controller.submitDemoRequest(body as any);
      // Should still return success
      expect(result.id).toBe('dr-3');
    });
  });

  // ── Admin Endpoints ────────────────────────────────────────────────

  describe('admin endpoints', () => {
    const adminKey = 'test-admin-key';

    beforeEach(() => {
      process.env.ADMIN_KEY = adminKey;
    });

    afterEach(() => {
      delete process.env.ADMIN_KEY;
    });

    describe('GET /api/admin/demo-requests', () => {
      it('returns demo requests', async () => {
        prisma.demoRequest.findMany.mockResolvedValue([{ id: 'dr-1' }]);
        const result = await controller.getDemoRequests(adminKey);
        expect(result).toHaveLength(1);
      });

      it('rejects invalid admin key', async () => {
        await expect(controller.getDemoRequests('wrong-key')).rejects.toThrow(
          UnauthorizedException,
        );
      });

      it('rejects when no admin key provided', async () => {
        await expect(
          controller.getDemoRequests(undefined as any),
        ).rejects.toThrow(UnauthorizedException);
      });
    });

    describe('DELETE /api/admin/demo-data', () => {
      it('clears demo data', async () => {
        prisma.balanceSheetItem.deleteMany.mockResolvedValue({});
        prisma.interestRateScenario.deleteMany.mockResolvedValue({});
        prisma.liquidityPosition.deleteMany.mockResolvedValue({});
        prisma.institution.deleteMany.mockResolvedValue({});

        const result = await controller.resetDemoData(adminKey);
        expect(result.message).toBe('Demo data cleared');
        expect(prisma.balanceSheetItem.deleteMany).toHaveBeenCalled();
        expect(prisma.institution.deleteMany).toHaveBeenCalled();
      });
    });

    describe('GET /api/admin/stats', () => {
      it('returns admin stats', async () => {
        prisma.demoRequest.count.mockResolvedValue(10);
        prisma.institution.count.mockResolvedValue(5);
        prisma.user.count.mockResolvedValueOnce(20).mockResolvedValueOnce(3);
        prisma.prospect.count.mockResolvedValue(15);

        const result = await controller.getAdminStats(adminKey);
        expect(result.demoRequests).toBe(10);
        expect(result.institutions).toBe(5);
        expect(result.users).toBe(20);
        expect(result.prospects).toBe(15);
      });
    });

    describe('POST /api/admin/seed-prospects', () => {
      it('returns error when PROSPECT_SEED_DATA not set', async () => {
        delete process.env.PROSPECT_SEED_DATA;
        const result = await controller.seedProspects(adminKey);
        expect(result.error).toBeDefined();
        expect(result.seeded).toBe(0);
      });

      it('returns error when PROSPECT_SEED_DATA is invalid JSON', async () => {
        process.env.PROSPECT_SEED_DATA = 'not-json';
        const result = await controller.seedProspects(adminKey);
        expect(result.error).toContain('not valid JSON');
        delete process.env.PROSPECT_SEED_DATA;
      });

      it('seeds prospects from JSON data', async () => {
        const seeds = [
          {
            name: 'Prospect 1',
            email: 'p1@test.com',
            company: 'C1',
            role: 'CEO',
            stage: 'lead',
            source: 'manual',
            notes: '',
          },
        ];
        process.env.PROSPECT_SEED_DATA = JSON.stringify(seeds);
        prisma.prospect.findFirst.mockResolvedValue(null);
        prisma.prospect.create.mockResolvedValue({ id: 'p1' });

        const result = await controller.seedProspects(adminKey);
        expect(result.seeded).toBe(1);
        expect(result.total).toBe(1);
        delete process.env.PROSPECT_SEED_DATA;
      });

      it('skips existing prospects', async () => {
        const seeds = [
          {
            name: 'Existing',
            email: 'existing@test.com',
            stage: 'lead',
            source: 'manual',
          },
        ];
        process.env.PROSPECT_SEED_DATA = JSON.stringify(seeds);
        prisma.prospect.findFirst.mockResolvedValue({ id: 'existing' });

        const result = await controller.seedProspects(adminKey);
        expect(result.seeded).toBe(0);
        expect(result.total).toBe(1);
        delete process.env.PROSPECT_SEED_DATA;
      });
    });

    describe('Prospect CRM endpoints', () => {
      it('GET /api/admin/prospects lists all', async () => {
        prisma.prospect.findMany.mockResolvedValue([{ id: 'p1' }]);
        const result = await controller.getProspects(adminKey);
        expect(result).toHaveLength(1);
      });

      it('GET /api/admin/prospects filters by stage', async () => {
        prisma.prospect.findMany.mockResolvedValue([]);
        await controller.getProspects(adminKey, 'demo_done');
        expect(prisma.prospect.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ where: { stage: 'demo_done' } }),
        );
      });

      it('POST /api/admin/prospects creates prospect', async () => {
        prisma.prospect.create.mockResolvedValue({
          id: 'p2',
          name: 'New Prospect',
        });
        const result = await controller.createProspect(adminKey, {
          name: 'New Prospect',
          email: 'new@test.com',
        });
        expect(result.name).toBe('New Prospect');
      });

      it('PATCH /api/admin/prospects/:id updates prospect', async () => {
        prisma.prospect.update.mockResolvedValue({
          id: 'p1',
          stage: 'demo_done',
        });
        const result = await controller.updateProspect(adminKey, 'p1', {
          stage: 'demo_done',
          notes: 'Demo completed',
        });
        expect(result.stage).toBe('demo_done');
      });

      it('DELETE /api/admin/prospects/:id deletes prospect', async () => {
        prisma.prospect.delete.mockResolvedValue({});
        const result = await controller.deleteProspect(adminKey, 'p1');
        expect(result.message).toBe('Prospect deleted');
      });
    });
  });

  // ── Workspace Endpoints ────────────────────────────────────────────

  describe('workspace endpoints', () => {
    it('GET /api/workspaces returns user workspaces', async () => {
      prisma.workspace.findMany.mockResolvedValue([
        { id: 'ws1', name: 'My Workspace' },
      ]);
      const req = { user: { userId: 'u1' } };
      const result = await controller.getWorkspaces(req);
      expect(result).toHaveLength(1);
    });

    it('POST /api/workspaces creates workspace', async () => {
      prisma.workspace.create.mockResolvedValue({ id: 'ws2', name: 'New WS' });
      const req = { user: { userId: 'u1' } };
      const result = await controller.createWorkspace(req, { name: 'New WS' });
      expect(result.name).toBe('New WS');
    });

    it('POST /api/workspaces uses default name', async () => {
      prisma.workspace.create.mockResolvedValue({
        id: 'ws3',
        name: 'My Workspace',
      });
      const req = { user: { userId: 'u1' } };
      await controller.createWorkspace(req, { name: '' });
      expect(prisma.workspace.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'My Workspace' }),
        }),
      );
    });
  });

  // ── Shutdown draining ───────────────────────────────────────
  describe('GET /health during shutdown', () => {
    it('throws ServiceUnavailableException during shutdown', async () => {
      (AppController as any).shuttingDown = true;
      const { ServiceUnavailableException } = require('@nestjs/common');
      await expect(controller.getHealth()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('markShuttingDown', () => {
    it('sets the shutting down flag', () => {
      (AppController as any).shuttingDown = false;
      AppController.markShuttingDown();
      expect((AppController as any).shuttingDown).toBe(true);
    });
  });

  // ── GET /health/detailed ────────────────────────────────────
  describe('GET /health/detailed', () => {
    it('returns detailed health when HEALTH_DETAILS_PUBLIC is enabled', async () => {
      process.env.HEALTH_DETAILS_PUBLIC = 'true';
      prisma.$queryRaw.mockResolvedValue([]);
      cacheService.ping.mockResolvedValue(true);

      const result = await controller.getHealthDetailed();
      expect(result.status).toBeDefined();
      expect(result.services).toBeDefined();
      expect(result.memory).toBeDefined();
      expect(result.version).toBe('2.0.0');

      delete process.env.HEALTH_DETAILS_PUBLIC;
    });

    it('returns detailed health in non-production', async () => {
      delete process.env.HEALTH_DETAILS_PUBLIC;
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      prisma.$queryRaw.mockResolvedValue([]);
      cacheService.ping.mockResolvedValue(true);

      const result = await controller.getHealthDetailed();
      expect(result.status).toBeDefined();

      process.env.NODE_ENV = origEnv;
    });

    it('reports degraded when DB is down in detailed health', async () => {
      delete process.env.HEALTH_DETAILS_PUBLIC;
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      prisma.$queryRaw.mockRejectedValue(new Error('DB down'));
      cacheService.ping.mockResolvedValue(true);

      const result = await controller.getHealthDetailed();
      expect(result.services.database.status).toBe('down');
      expect(result.status).toBe('degraded');

      process.env.NODE_ENV = origEnv;
    });

    it('includes pool stats in detailed health', async () => {
      delete process.env.HEALTH_DETAILS_PUBLIC;
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      prisma.$queryRaw.mockResolvedValue([]);
      cacheService.ping.mockResolvedValue(true);
      prisma.getPoolStats.mockReturnValue({
        totalCount: 5,
        idleCount: 3,
        waitingCount: 0,
        maxSize: 10,
      });

      const result = await controller.getHealthDetailed();
      expect(result.connectionPool).toBeDefined();
      expect(result.connectionPool!.totalConnections).toBe(5);

      process.env.NODE_ENV = origEnv;
    });
  });

  // ── GET /ready — cache failure ──────────────────────────────
  describe('GET /ready — cache failures', () => {
    it('returns not ready when cache ping throws', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      cacheService.ping.mockRejectedValue(new Error('Redis down'));
      const res = { status: jest.fn() };
      const result = await controller.getReady(res as any);
      expect(result.ready).toBe(false);
      expect(result.checks.cache).toBe('fail');
    });

    it('returns not ready when cache ping returns false', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      cacheService.ping.mockResolvedValue(false);
      const res = { status: jest.fn() };
      const result = await controller.getReady(res as any);
      expect(result.ready).toBe(false);
      expect(result.checks.cache).toBe('fail');
    });
  });

  // ── GET /metrics ────────────────────────────────────────────
  describe('GET /metrics', () => {
    it('returns process metrics', async () => {
      prisma.getPoolStats.mockReturnValue({
        totalCount: 5,
        idleCount: 3,
        waitingCount: 0,
        maxSize: 10,
      });

      const result = await controller.getMetrics();
      expect(result.pid).toBe(process.pid);
      expect(result.memory).toBeDefined();
      expect(result.eventLoopLag).toBeDefined();
      expect(result.connectionPool).toBeDefined();
    });

    it('returns default pool stats when getPoolStats returns null', async () => {
      prisma.getPoolStats.mockReturnValue(null);

      const result = await controller.getMetrics();
      expect(result.connectionPool).toEqual({ active: 0, idle: 0, max: 10 });
    });
  });

  // ── GET /api/admin/ops ──────────────────────────────────────
  describe('GET /api/admin/ops', () => {
    it('returns ops data with admin key', async () => {
      process.env.ADMIN_KEY = 'test-admin-key';
      prisma.reportJob.findMany.mockResolvedValue([{ id: 'job-1' }]);
      prisma.subscription.count.mockResolvedValue(5);
      prisma.analysisRun.count.mockResolvedValue(42);

      const result = await controller.getAdminOps('test-admin-key');
      expect(result.recentJobs).toHaveLength(1);
      expect(result.activeSubscriptions).toBe(5);
      expect(result.totalAnalysisRuns).toBe(42);
      expect(result.performanceMetrics).toBeDefined();

      delete process.env.ADMIN_KEY;
    });
  });

  describe('GET /api/admin/exit-metrics', () => {
    it('returns exit metrics with admin key', async () => {
      process.env.ADMIN_KEY = 'test-admin-key';

      await expect(
        controller.getExitMetrics('test-admin-key'),
      ).resolves.toEqual({
        mrr: 0,
        arr: 0,
        activeInstitutions: 0,
      });
      expect(exitMetricsService.getExitMetrics).toHaveBeenCalled();

      delete process.env.ADMIN_KEY;
    });
  });

  // ── GET /api/admin/webhook-delivery-logs ────────────────────
  describe('GET /api/admin/webhook-delivery-logs', () => {
    it('returns webhook subscription stats', async () => {
      prisma.webhookSubscription.findMany.mockResolvedValue([
        { id: 'ws-1', isActive: true, failureCount: 0 },
        { id: 'ws-2', isActive: true, failureCount: 3 },
        { id: 'ws-3', isActive: false, failureCount: 0 },
      ]);

      const result = await controller.getWebhookDeliveryLogs();
      expect(result.total).toBe(3);
      expect(result.active).toBe(2);
      expect(result.failing).toBe(1);
      expect(result.disabled).toBe(1);
    });
  });

  // ── PATCH /api/admin/prospects/:id ──────────────────────────
  describe('PATCH /api/admin/prospects/:id edge cases', () => {
    it('only updates provided fields', async () => {
      process.env.ADMIN_KEY = 'test-admin-key';
      prisma.prospect.update.mockResolvedValue({ id: 'p1', name: 'Updated' });

      await controller.updateProspect('test-admin-key', 'p1', {
        name: 'Updated',
      });

      expect(prisma.prospect.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { name: 'Updated' },
      });
      delete process.env.ADMIN_KEY;
    });

    it('updates all fields when all provided', async () => {
      process.env.ADMIN_KEY = 'test-admin-key';
      prisma.prospect.update.mockResolvedValue({});

      await controller.updateProspect('test-admin-key', 'p1', {
        stage: 'proposal',
        notes: 'Good fit',
        name: 'New Name',
        email: 'new@test.com',
        company: 'New Co',
        role: 'CEO',
      });

      expect(prisma.prospect.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: {
          stage: 'proposal',
          notes: 'Good fit',
          name: 'New Name',
          email: 'new@test.com',
          company: 'New Co',
          role: 'CEO',
        },
      });
      delete process.env.ADMIN_KEY;
    });
  });

  // ── verifyAdmin timing-safe comparison ──────────────────────
  describe('verifyAdmin', () => {
    it('rejects when ADMIN_KEY env not set', async () => {
      delete process.env.ADMIN_KEY;
      await expect(controller.getDemoRequests('some-key')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects when key length differs', async () => {
      process.env.ADMIN_KEY = 'correct-key';
      await expect(controller.getDemoRequests('short')).rejects.toThrow(
        UnauthorizedException,
      );
      delete process.env.ADMIN_KEY;
    });
  });
});
