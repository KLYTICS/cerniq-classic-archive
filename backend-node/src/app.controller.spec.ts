import {
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  _resetActiveRequestCount,
  _resetCachedMemoryLimit,
  AppController,
  decrementActiveRequests,
  determineOverallHealthStatus,
  getActiveRequestCount,
  getHealthMemorySnapshot,
  incrementActiveRequests,
  shouldExposeDetailedHealth,
} from './app.controller';
import { AppService } from './app.service';
import { AuthGuard } from './auth/auth.guard';
import { CacheService } from './cache/cache.service';
import { AdminGuard } from './common/guards/admin.guard';
import { EmailService } from './email/email.service';
import { MarketDataService } from './market-data/market-data.service';
import { MarketStreamManagerService } from './market-data/market-stream-manager.service';
import { PrismaService } from './prisma.service';

jest.mock('node:fs', () => {
  const actual = jest.requireActual('node:fs');
  return {
    ...actual,
    readFileSync: jest.fn(),
  };
});

jest.mock('ioredis', () => jest.fn());
jest.mock('./common/interceptors/performance.interceptor', () => ({
  getRouteMetrics: jest.fn(() => [
    { route: '/api/health', meanMs: 12.5 },
    { route: '/api/admin/ops', meanMs: 42.1 },
  ]),
}));

const { readFileSync } = jest.requireMock('node:fs');
const Redis = jest.requireMock('ioredis');

describe('AppController', () => {
  const originalEnv = { ...process.env };

  let controller: AppController;
  let prisma: any;
  let emailService: any;
  let marketDataService: any;
  let marketStreamManager: any;
  let cacheService: any;

  beforeEach(async () => {
    process.env = { ...originalEnv };

    prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
      getPoolStats: jest.fn().mockReturnValue(null),
      demoRequest: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      institution: {
        count: jest.fn(),
        deleteMany: jest.fn(),
      },
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
    };
    emailService = {
      sendDemoRequestNotification: jest.fn().mockResolvedValue(undefined),
      sendDemoConfirmation: jest.fn().mockResolvedValue(undefined),
    };
    marketDataService = {
      getHealth: jest.fn().mockReturnValue({ status: 'up' }),
    };
    marketStreamManager = {
      getStreamStatus: jest.fn().mockReturnValue({ connected: true }),
    };
    cacheService = {
      get: jest.fn(),
      set: jest.fn(),
      ping: jest.fn().mockResolvedValue('PONG'),
      redis: null,
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: emailService },
        { provide: MarketDataService, useValue: marketDataService },
        {
          provide: MarketStreamManagerService,
          useValue: marketStreamManager,
        },
        { provide: CacheService, useValue: cacheService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AppController>(AppController);
    readFileSync.mockReset();
    Redis.mockReset();
    _resetCachedMemoryLimit();
    _resetActiveRequestCount();
    AppController.resetShuttingDownForTests();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return "Hello World!"', () => {
    expect(controller.getHello()).toBe('Hello World!');
  });

  it('should return API status', () => {
    const status = controller.getStatus();
    expect(status.name).toBe('CERNIQ API');
    expect(status.version).toBe('2.0.0');
    expect(status.endpoints).toBeDefined();
  });

  it('exposes detailed health outside production by default', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.HEALTH_DETAILS_PUBLIC;

    expect(shouldExposeDetailedHealth()).toBe(true);
  });

  it('hides detailed health in production unless explicitly enabled', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.HEALTH_DETAILS_PUBLIC;
    expect(shouldExposeDetailedHealth()).toBe(false);

    process.env.HEALTH_DETAILS_PUBLIC = 'yes';
    expect(shouldExposeDetailedHealth()).toBe(true);
  });

  it('uses cgroup memory limits when available', () => {
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

  it('falls back to heap usage when cgroup memory is unbounded or invalid', () => {
    readFileSync.mockReturnValueOnce('max');

    const snapshot = getHealthMemorySnapshot({
      rss: 268435456,
      heapTotal: 200,
      heapUsed: 100,
      external: 0,
      arrayBuffers: 0,
    });

    expect(snapshot.source).toBe('heap');
    expect(snapshot.primaryPercent).toBe(50);
    expect(snapshot.limitMB).toBeNull();
  });

  it('returns null percentages when memory inputs are not finite', () => {
    readFileSync.mockImplementation(() => {
      throw new Error('cgroup unavailable');
    });

    const snapshot = getHealthMemorySnapshot({
      rss: Number.NaN,
      heapTotal: 200,
      heapUsed: Number.POSITIVE_INFINITY,
      external: 0,
      arrayBuffers: 0,
    });

    expect(snapshot.source).toBe('heap');
    expect(snapshot.heapPercent).toBeNull();
    expect(snapshot.rssPercent).toBeNull();
    expect(snapshot.primaryPercent).toBe(0);
  });

  it('treats zero cgroup limits as unbounded and falls back to heap mode', () => {
    readFileSync.mockReturnValueOnce('0');

    const snapshot = getHealthMemorySnapshot({
      rss: 268435456,
      heapTotal: 0,
      heapUsed: 0,
      external: 0,
      arrayBuffers: 0,
    });

    expect(snapshot.source).toBe('heap');
    expect(snapshot.heapPercent).toBeNull();
    expect(snapshot.limitMB).toBeNull();
  });

  it('ignores malformed cgroup memory limits', () => {
    readFileSync
      .mockReturnValueOnce('not-a-number')
      .mockImplementationOnce(() => {
        throw new Error('missing cgroup file');
      });

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

  it('reuses the cached container memory limit between health snapshots', () => {
    readFileSync.mockReturnValueOnce('536870912');

    const first = getHealthMemorySnapshot({
      rss: 268435456,
      heapTotal: 134217728,
      heapUsed: 67108864,
      external: 0,
      arrayBuffers: 0,
    });
    const second = getHealthMemorySnapshot({
      rss: 268435456,
      heapTotal: 134217728,
      heapUsed: 67108864,
      external: 0,
      arrayBuffers: 0,
    });

    expect(first.limitMB).toBe(512);
    expect(second.limitMB).toBe(512);
    expect(readFileSync).toHaveBeenCalledTimes(1);
  });

  it('marks health down when the database is unavailable', () => {
    const status = determineOverallHealthStatus({
      dbConnected: false,
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

    expect(status).toBe('down');
  });

  it('marks health degraded for degraded dependencies and memory pressure', () => {
    expect(
      determineOverallHealthStatus({
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
      }),
    ).toBe('degraded');

    expect(
      determineOverallHealthStatus({
        dbConnected: true,
        checks: { api: 'up', cache: 'up', marketData: 'healthy' },
        memory: {
          source: 'container',
          primaryPercent: 90,
          heapPercent: 50,
          rssPercent: 90,
          heapUsedMB: 64,
          heapTotalMB: 128,
          rssMB: 256,
          limitMB: 512,
        },
      }),
    ).toBe('degraded');

    expect(
      determineOverallHealthStatus({
        dbConnected: true,
        checks: { api: 'up', cache: 'up', marketData: 'healthy' },
        memory: {
          source: 'heap',
          primaryPercent: 95,
          heapPercent: 95,
          rssPercent: null,
          heapUsedMB: 64,
          heapTotalMB: 128,
          rssMB: 256,
          limitMB: null,
        },
      }),
    ).toBe('degraded');
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

  it('tracks active request counters without going negative', () => {
    incrementActiveRequests();
    incrementActiveRequests();
    decrementActiveRequests();
    decrementActiveRequests();
    decrementActiveRequests();

    expect(getActiveRequestCount()).toBe(0);
  });

  it('submits demo requests and creates a prospect record', async () => {
    prisma.demoRequest.create.mockResolvedValue({ id: 'demo-1' });
    prisma.prospect.create.mockResolvedValue({ id: 'prospect-1' });

    const result = await controller.submitDemoRequest({
      email: 'risk@cerniq.io',
      name: 'Risk Ops',
      institutionName: 'CERNIQ CU',
      institutionType: 'credit_union',
      totalAssets: 250000000,
      message: 'Need a stressed ALM review',
    } as any);

    expect(prisma.demoRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'risk@cerniq.io',
        institutionName: 'CERNIQ CU',
      }),
    });
    expect(emailService.sendDemoRequestNotification).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'risk@cerniq.io' }),
    );
    expect(emailService.sendDemoConfirmation).toHaveBeenCalledWith({
      name: 'Risk Ops',
      email: 'risk@cerniq.io',
    });
    expect(prisma.prospect.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'risk@cerniq.io',
        source: 'demo_request',
        stage: 'lead',
      }),
    });
    expect(result).toEqual({
      id: 'demo-1',
      message: 'Demo request received',
    });
  });

  it('keeps demo request creation successful when side effects fail', async () => {
    prisma.demoRequest.create.mockResolvedValue({ id: 'demo-2' });
    prisma.prospect.create.mockRejectedValue(new Error('prospect unavailable'));
    emailService.sendDemoRequestNotification.mockRejectedValue(
      new Error('mail down'),
    );
    emailService.sendDemoConfirmation.mockRejectedValue(new Error('mail down'));

    await expect(
      controller.submitDemoRequest({
        email: 'ops@cerniq.io',
        name: 'Ops',
      } as any),
    ).resolves.toEqual({
      id: 'demo-2',
      message: 'Demo request received',
    });
  });

  it('returns service unavailable while the instance is draining', async () => {
    AppController.markShuttingDown();

    await expect(controller.getHealth()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('reports degraded dependencies and pool metrics in health output', async () => {
    const redisClient = {
      connect: jest.fn().mockRejectedValue(new Error('redis down')),
      ping: jest.fn(),
      quit: jest.fn(),
    };
    Redis.mockImplementation(() => redisClient);
    prisma.$queryRaw.mockRejectedValue(new Error('db down'));
    prisma.getPoolStats.mockReturnValue({
      totalCount: 7,
      idleCount: 2,
      waitingCount: 1,
      maxSize: 20,
    });
    marketDataService.getHealth.mockReturnValue({ status: 'degraded' });

    const result = await controller.getHealth();

    expect(result.status).toBe('down');
    expect(result.db).toBe('error');
    expect(result.services).toEqual({
      api: 'up',
      database: 'down',
      cache: 'degraded',
      marketData: 'degraded',
    });
    expect(result.connectionPool).toEqual({
      totalConnections: 7,
      idleConnections: 2,
      waitingRequests: 1,
      maxSize: 20,
    });
  });

  it('returns readiness failures and sets HTTP 503 when dependencies fail', async () => {
    const res = { status: jest.fn() };
    prisma.$queryRaw.mockRejectedValue(new Error('db down'));
    cacheService.ping.mockResolvedValue('');
    AppController.markShuttingDown();

    const result = await controller.getReady(res as any);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(result.ready).toBe(false);
    expect(result.checks).toEqual({
      database: 'fail',
      cache: 'fail',
      shutdown: 'fail',
    });
  });

  it('marks readiness cache failures when redis ping throws', async () => {
    const res = { status: jest.fn() };
    cacheService.ping.mockRejectedValue(new Error('redis unavailable'));

    const result = await controller.getReady(res as any);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(result.checks).toEqual({
      database: 'ok',
      cache: 'fail',
      shutdown: 'ok',
    });
  });

  it('returns readiness success when dependencies are healthy', async () => {
    const res = { status: jest.fn() };

    const result = await controller.getReady(res as any);

    expect(res.status).not.toHaveBeenCalled();
    expect(result.ready).toBe(true);
    expect(result.checks).toEqual({
      database: 'ok',
      cache: 'ok',
      shutdown: 'ok',
    });
  });

  it('reports a healthy lightweight health check when dependencies are up', async () => {
    const redisClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      ping: jest.fn().mockResolvedValue('PONG'),
      quit: jest.fn().mockResolvedValue(undefined),
    };
    Redis.mockImplementation(() => redisClient);
    prisma.getPoolStats.mockReturnValue(null);
    marketDataService.getHealth.mockReturnValue({ status: 'healthy' });

    const result = await controller.getHealth();

    expect(result.status).toBe('ok');
    expect(result.db).toBe('connected');
    expect(result.services).toEqual({
      api: 'up',
      database: 'up',
      cache: 'up',
      marketData: 'healthy',
    });
    expect(result).not.toHaveProperty('connectionPool');
  });

  it('returns liveness metadata for load balancers', () => {
    const result = controller.getLiveness();

    expect(result).toEqual({
      status: 'alive',
      pid: process.pid,
      uptime: expect.any(Number),
    });
  });

  it('returns detailed health when explicitly enabled in production', async () => {
    const redisClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      ping: jest.fn().mockResolvedValue('PONG'),
      quit: jest.fn().mockResolvedValue(undefined),
    };
    Redis.mockImplementation(() => redisClient);
    process.env.NODE_ENV = 'production';
    process.env.HEALTH_DETAILS_PUBLIC = 'true';
    prisma.getPoolStats.mockReturnValue({
      totalCount: 3,
      idleCount: 1,
      waitingCount: 0,
      maxSize: 10,
    });
    marketDataService.getHealth.mockReturnValue({
      status: 'healthy',
      feeds: ['iex'],
    });

    const result = await controller.getHealthDetailed();

    expect(result.status).toBe('healthy');
    expect(result.services.database.status).toBe('up');
    expect(result.services.cache.status).toBe('up');
    expect(result.services.marketData.status).toBe('healthy');
    expect(result.connectionPool).toEqual({
      totalConnections: 3,
      idleConnections: 1,
      waitingRequests: 0,
      maxSize: 10,
    });
  });

  it('returns degraded detailed health when database and cache timing checks fail', async () => {
    const redisClient = {
      connect: jest.fn().mockRejectedValue(new Error('redis down')),
      ping: jest.fn(),
      quit: jest.fn(),
    };
    Redis.mockImplementation(() => redisClient);
    process.env.NODE_ENV = 'production';
    process.env.HEALTH_DETAILS_PUBLIC = 'true';
    prisma.$queryRaw.mockRejectedValue(new Error('db down'));
    prisma.getPoolStats.mockReturnValue(null);
    marketDataService.getHealth.mockReturnValue({ status: 'degraded' });

    const result = await controller.getHealthDetailed();

    expect(result.status).toBe('degraded');
    expect(result.services.database.status).toBe('down');
    expect(result.services.cache.status).toBe('degraded');
    expect(result.services.marketData.status).toBe('degraded');
  });

  it('hides detailed health in production unless explicitly exposed', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.HEALTH_DETAILS_PUBLIC;

    await expect(controller.getHealthDetailed()).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns metrics with fallback pool stats and active request count', async () => {
    incrementActiveRequests();
    incrementActiveRequests();
    prisma.getPoolStats.mockReturnValue(null);

    const result = await controller.getMetrics();

    expect(result.activeRequests).toBe(2);
    expect(result.connectionPool).toEqual({ active: 0, idle: 0, max: 10 });
    expect(result.memory.heapUsedMB).toBeGreaterThanOrEqual(0);
  });

  it('summarizes webhook delivery logs for operators', async () => {
    prisma.webhookSubscription.findMany.mockResolvedValue([
      { id: '1', isActive: true, failureCount: 0 },
      { id: '2', isActive: true, failureCount: 3 },
      { id: '3', isActive: false, failureCount: 1 },
    ]);

    const result = await controller.getWebhookDeliveryLogs();

    expect(result).toEqual({
      total: 3,
      active: 2,
      failing: 2,
      disabled: 1,
      subscriptions: expect.any(Array),
    });
  });

  it('returns admin demo requests when the admin key is valid', async () => {
    process.env.ADMIN_KEY = 'secret-key';
    prisma.demoRequest.findMany.mockResolvedValue([{ id: 'demo-1' }]);

    const result = await controller.getDemoRequests('secret-key');

    expect(prisma.demoRequest.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    expect(result).toEqual([{ id: 'demo-1' }]);
  });

  it('clears demo data for administrators', async () => {
    process.env.ADMIN_KEY = 'secret-key';

    const result = await controller.resetDemoData('secret-key');

    expect(prisma.balanceSheetItem.deleteMany).toHaveBeenCalledWith({});
    expect(prisma.interestRateScenario.deleteMany).toHaveBeenCalledWith({});
    expect(prisma.liquidityPosition.deleteMany).toHaveBeenCalledWith({});
    expect(prisma.institution.deleteMany).toHaveBeenCalledWith({});
    expect(result).toEqual({ message: 'Demo data cleared' });
  });

  it('returns admin stats with recent-user counts', async () => {
    process.env.ADMIN_KEY = 'secret-key';
    prisma.demoRequest.count.mockResolvedValue(5);
    prisma.institution.count.mockResolvedValue(2);
    prisma.user.count.mockResolvedValueOnce(8).mockResolvedValueOnce(3);
    prisma.prospect.count.mockResolvedValue(11);

    const result = await controller.getAdminStats('secret-key');

    expect(result).toEqual({
      demoRequests: 5,
      institutions: 2,
      users: 8,
      recentUsers: 3,
      prospects: 11,
    });
  });

  it('returns a configuration error when prospect seed data is missing', async () => {
    process.env.ADMIN_KEY = 'secret-key';
    delete process.env.PROSPECT_SEED_DATA;

    await expect(controller.seedProspects('secret-key')).resolves.toEqual({
      error: 'PROSPECT_SEED_DATA env var not configured',
      seeded: 0,
      total: 0,
    });
  });

  it('returns a validation error when prospect seed data is invalid json', async () => {
    process.env.ADMIN_KEY = 'secret-key';
    process.env.PROSPECT_SEED_DATA = '{invalid-json';

    await expect(controller.seedProspects('secret-key')).resolves.toEqual({
      error: 'PROSPECT_SEED_DATA is not valid JSON',
      seeded: 0,
      total: 0,
    });
  });

  it('seeds only new prospects from configured seed data', async () => {
    process.env.ADMIN_KEY = 'secret-key';
    process.env.PROSPECT_SEED_DATA = JSON.stringify([
      {
        name: 'Alpha CU',
        email: 'alpha@cerniq.io',
        company: 'Alpha',
        role: 'Treasury',
        stage: 'lead',
        source: 'seed',
        notes: 'first',
      },
      {
        name: 'Beta CU',
        email: 'beta@cerniq.io',
        company: 'Beta',
        role: 'ALCO',
        stage: 'proposal',
        source: 'seed',
        notes: 'second',
      },
    ]);
    prisma.prospect.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'existing' });
    prisma.prospect.create.mockResolvedValueOnce({ id: 'seed-1' });

    const result = await controller.seedProspects('secret-key');

    expect(prisma.prospect.create).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ seeded: 1, total: 2 });
  });

  it('returns workspaces for the authenticated owner', async () => {
    prisma.workspace.findMany.mockResolvedValue([{ id: 'ws-1' }]);

    const result = await controller.getWorkspaces({
      user: { userId: 'owner-1' },
    } as any);

    expect(prisma.workspace.findMany).toHaveBeenCalledWith({
      where: { ownerId: 'owner-1' },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toEqual([{ id: 'ws-1' }]);
  });

  it('creates workspaces and defaults the name when omitted', async () => {
    prisma.workspace.create.mockResolvedValue({
      id: 'ws-2',
      name: 'My Workspace',
    });

    const result = await controller.createWorkspace(
      { user: { userId: 'owner-1' } } as any,
      { name: '' },
    );

    expect(prisma.workspace.create).toHaveBeenCalledWith({
      data: {
        name: 'My Workspace',
        ownerId: 'owner-1',
      },
    });
    expect(result).toEqual({ id: 'ws-2', name: 'My Workspace' });
  });

  it('filters prospects by stage when provided', async () => {
    process.env.ADMIN_KEY = 'secret-key';
    prisma.prospect.findMany.mockResolvedValue([{ id: 'pros-1' }]);

    const result = await controller.getProspects('secret-key', 'proposal');

    expect(prisma.prospect.findMany).toHaveBeenCalledWith({
      where: { stage: 'proposal' },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toEqual([{ id: 'pros-1' }]);
  });

  it('lists all prospects when no stage filter is provided', async () => {
    process.env.ADMIN_KEY = 'secret-key';
    prisma.prospect.findMany.mockResolvedValue([{ id: 'pros-2' }]);

    await controller.getProspects('secret-key');

    expect(prisma.prospect.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: 'desc' },
    });
  });

  it('creates prospects with default crm values when optional fields are omitted', async () => {
    process.env.ADMIN_KEY = 'secret-key';
    prisma.prospect.create.mockResolvedValue({ id: 'pros-3' });

    const result = await controller.createProspect('secret-key', {
      name: 'New Lead',
    } as any);

    expect(prisma.prospect.create).toHaveBeenCalledWith({
      data: {
        name: 'New Lead',
        email: null,
        company: null,
        role: null,
        stage: 'lead',
        source: 'manual',
        notes: null,
      },
    });
    expect(result).toEqual({ id: 'pros-3' });
  });

  it('updates only the provided prospect fields', async () => {
    process.env.ADMIN_KEY = 'secret-key';
    prisma.prospect.update.mockResolvedValue({ id: 'pros-4' });

    const result = await controller.updateProspect('secret-key', 'pros-4', {
      stage: 'proposal',
      notes: 'Follow up',
      name: 'Lead Name',
      email: 'lead@cerniq.io',
      company: 'CERNIQ',
      role: 'CFO',
    });

    expect(prisma.prospect.update).toHaveBeenCalledWith({
      where: { id: 'pros-4' },
      data: {
        stage: 'proposal',
        notes: 'Follow up',
        name: 'Lead Name',
        email: 'lead@cerniq.io',
        company: 'CERNIQ',
        role: 'CFO',
      },
    });
    expect(result).toEqual({ id: 'pros-4' });
  });

  it('supports no-op prospect updates when no fields are provided', async () => {
    process.env.ADMIN_KEY = 'secret-key';
    prisma.prospect.update.mockResolvedValue({ id: 'pros-5' });

    await controller.updateProspect('secret-key', 'pros-5', {});

    expect(prisma.prospect.update).toHaveBeenCalledWith({
      where: { id: 'pros-5' },
      data: {},
    });
  });

  it('deletes prospects for administrators', async () => {
    process.env.ADMIN_KEY = 'secret-key';

    const result = await controller.deleteProspect('secret-key', 'pros-6');

    expect(prisma.prospect.delete).toHaveBeenCalledWith({
      where: { id: 'pros-6' },
    });
    expect(result).toEqual({ message: 'Prospect deleted' });
  });

  it('returns admin ops telemetry and recent report jobs', async () => {
    process.env.ADMIN_KEY = 'secret-key';
    prisma.reportJob.findMany.mockResolvedValue([{ id: 'job-1' }]);
    prisma.subscription.count.mockResolvedValue(4);
    prisma.analysisRun.count.mockResolvedValue(22);

    const result = await controller.getAdminOps('secret-key');

    expect(result).toEqual({
      recentJobs: [{ id: 'job-1' }],
      activeSubscriptions: 4,
      totalAnalysisRuns: 22,
      performanceMetrics: [
        { route: '/api/health', meanMs: 12.5 },
        { route: '/api/admin/ops', meanMs: 42.1 },
      ],
    });
  });

  it('rejects admin routes when the provided key length matches but contents do not', async () => {
    process.env.ADMIN_KEY = 'secret-key';

    await expect(controller.getAdminStats('secret-kez')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects admin-only routes when the admin key is missing', async () => {
    delete process.env.ADMIN_KEY;

    await expect(controller.getDemoRequests('')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
