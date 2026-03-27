import { Test, TestingModule } from '@nestjs/testing';
import {
  AppController,
  determineOverallHealthStatus,
  getHealthMemorySnapshot,
} from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { AuthGuard } from './auth/auth.guard';
import { EmailService } from './email/email.service';
import { MarketDataService } from './market-data/market-data.service';
import { MarketStreamManagerService } from './market-data/market-stream-manager.service';

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
  })),
}));

const { readFileSync } = jest.requireMock('node:fs') as {
  readFileSync: jest.Mock;
};

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        PrismaService,
        {
          provide: EmailService,
          useValue: {
            sendDemoRequestNotification: jest.fn(),
            sendDemoConfirmation: jest.fn(),
          },
        },
        {
          provide: MarketDataService,
          useValue: { getHealth: jest.fn().mockReturnValue({ status: 'up' }) },
        },
        {
          provide: MarketStreamManagerService,
          useValue: { getStreamStatus: jest.fn().mockReturnValue({}) },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AppController>(AppController);
    readFileSync.mockReset();
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

  it('falls back to heap usage when no container limit is exposed', () => {
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
});
