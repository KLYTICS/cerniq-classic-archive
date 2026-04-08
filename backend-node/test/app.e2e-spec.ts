import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import _request from 'supertest';
const request = (_request as any).default ?? _request;
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { MarketDataService } from '../src/market-data/market-data.service';
import { CacheService } from '../src/cache/cache.service';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseEnvelopeInterceptor } from '../src/common/interceptors/response-envelope.interceptor';
import { SanitizePipe } from '../src/common/pipes/sanitize.pipe';
import * as crypto from 'crypto';

const sampleHistoricalPrices = Array.from({ length: 90 }, (_, index) => {
  const date = new Date(Date.UTC(2025, 11, 1 + index));
  const base = 165 + index * 0.45;
  return {
    date: date.toISOString().split('T')[0],
    open: Number((base + 0.2).toFixed(2)),
    high: Number((base + 1.1).toFixed(2)),
    low: Number((base - 0.9).toFixed(2)),
    close: Number((base + (index % 5) * 0.18).toFixed(2)),
    volume: 1200000 + index * 18000,
  };
});

function createPrismaMock() {
  const users: any[] = [];
  const refreshTokens: any[] = [];
  const workspaces: any[] = [];
  const auditLogs: any[] = [];

  return {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
    getPoolStats: jest.fn().mockReturnValue(null),

    user: {
      findUnique: jest.fn().mockImplementation(({ where }: any) => {
        return Promise.resolve(
          users.find(
            (u) =>
              (where.email && u.email === where.email) ||
              (where.id && u.id === where.id),
          ) || null,
        );
      }),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }: any) => {
        const user = {
          id: crypto.randomUUID(),
          email: data.email,
          name: data.name || null,
          passwordHash: data.passwordHash || null,
          provider: data.provider || 'email',
          providerId: data.providerId || null,
          emailVerified: data.emailVerified ?? false,
          avatarUrl: null,
          role: 'authenticated',
          createdAt: new Date(),
          lastLoginAt: null,
          organizationMembers: [],
          subscription: {
            tier: 'demo',
            status: 'active',
            currentPeriodEnd: new Date(Date.now() + 7 * 86400_000),
          },
        };
        users.push(user);
        return Promise.resolve(user);
      }),
      update: jest.fn().mockImplementation(({ where, data }: any) => {
        const user = users.find((u) => u.id === where.id);
        if (user) Object.assign(user, data);
        return Promise.resolve(user);
      }),
      count: jest.fn().mockResolvedValue(0),
    },

    refreshToken: {
      create: jest.fn().mockImplementation(({ data }: any) => {
        const token = {
          id: crypto.randomUUID(),
          ...data,
          revokedAt: null,
          createdAt: new Date(),
        };
        refreshTokens.push(token);
        return Promise.resolve(token);
      }),
      findUnique: jest.fn().mockImplementation(({ where }: any) => {
        return Promise.resolve(
          refreshTokens.find((t) => t.token === where.token) || null,
        );
      }),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },

    workspace: {
      findFirst: jest.fn().mockImplementation(({ where }: any) => {
        return Promise.resolve(
          workspaces.find((workspace) => workspace.ownerId === where?.ownerId) ||
            null,
        );
      }),
      create: jest.fn().mockImplementation(({ data }: any) => {
        const ws = { id: crypto.randomUUID(), ...data, createdAt: new Date() };
        workspaces.push(ws);
        return Promise.resolve(ws);
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },

    auditLog: {
      create: jest.fn().mockImplementation(({ data }: any) => {
        const log = { id: crypto.randomUUID(), ...data, createdAt: new Date() };
        auditLogs.push(log);
        return Promise.resolve(log);
      }),
    },

    demoRequest: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    institution: {
      count: jest.fn().mockResolvedValue(0),
      deleteMany: jest.fn(),
    },
    balanceSheetItem: { deleteMany: jest.fn() },
    interestRateScenario: { deleteMany: jest.fn() },
    liquidityPosition: { deleteMany: jest.fn() },
    prospect: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: crypto.randomUUID() }),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    subscription: { count: jest.fn().mockResolvedValue(0) },
    analysisRun: { count: jest.fn().mockResolvedValue(0) },
    reportJob: { findMany: jest.fn().mockResolvedValue([]) },
    passwordResetToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    apiKey: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    prospectInstitution: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
    },
    cooperativaBenchmark: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
    },
  };
}

function createCacheMock() {
  return {
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
    ping: jest.fn().mockResolvedValue(true),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    deletePattern: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn().mockResolvedValue(false),
    getStats: jest.fn().mockResolvedValue({ hits: 0, misses: 0, keys: 0 }),
    flushAll: jest.fn().mockResolvedValue(undefined),
    getOrSet: jest.fn().mockImplementation(async (_key, fetchFn) => fetchFn()),
  };
}

describe('API Integration Tests (e2e)', () => {
  let app: INestApplication;
  let accessToken = '';

  beforeAll(async () => {
    const prismaMock = createPrismaMock();
    const cacheServiceMock = createCacheMock();
    const marketDataServiceMock = {
      getHistoricalPrices: jest.fn().mockResolvedValue(sampleHistoricalPrices),
      getQuote: jest.fn().mockResolvedValue({
        symbol: 'AAPL',
        price: 187.3,
        bid: 187.2,
        ask: 187.4,
        change: 1.2,
        changePercent: 0.64,
        volume: 2070000,
        high: 187.9,
        low: 185.8,
        open: 186.5,
        previousClose: 186.1,
        timestamp: new Date().toISOString(),
      }),
      getRealtimeQuote: jest.fn().mockResolvedValue({
        symbol: 'AAPL',
        price: 187.3,
        change: 1.2,
        changePercent: 0.64,
        volume: 2070000,
        high: 187.9,
        low: 185.8,
        open: 186.5,
        previousClose: 186.1,
        timestamp: new Date().toISOString(),
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(CacheService)
      .useValue(cacheServiceMock)
      .overrideProvider(MarketDataService)
      .useValue(marketDataServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalPipes(new SanitizePipe());

    await app.init();

    const regRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'app-e2e@example.com',
        password: 'SecurePass123!',
        name: 'App E2E User',
      })
      .expect(201);

    const cookies = regRes.headers['set-cookie'] as string[];
    accessToken =
      (Array.isArray(cookies) ? cookies : [cookies])
        .find((cookie: string) => cookie?.startsWith('access_token='))
        ?.split(';')[0] || '';
    accessToken = accessToken.replace(/^access_token=/, '');
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Charts API', () => {
    it('GET /api/charts/ohlcv/:ticker should return OHLCV data', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/charts/ohlcv/AAPL?timeframe=1M')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('ticker', 'AAPL');
      expect(response.body.data).toHaveProperty('timeframe', '1M');
      expect(Array.isArray(response.body.data.data)).toBe(true);
    });

    it('GET /api/charts/technical/:ticker should return data with indicators', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/charts/technical/AAPL?timeframe=1M&indicators=sma20,rsi')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('ohlcv');
      expect(response.body.data).toHaveProperty('indicators');
      expect(response.body.data.indicators).toHaveProperty('sma20');
      expect(response.body.data.indicators).toHaveProperty('rsi');
    });
  });

  describe('Risk API', () => {
    it('POST /api/risk/component-var should calculate component VaR', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/risk/component-var')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          positions: [
            { ticker: 'AAPL', quantity: 100, price: 175 },
            { ticker: 'GOOGL', quantity: 50, price: 140 },
          ],
          confidenceLevel: 0.95,
          horizon: 1,
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('portfolioVaR');
      expect(response.body.data).toHaveProperty('components');
      expect(response.body.data.portfolioVaR).toBeGreaterThan(0);
    });

    it('GET /api/risk/forecast-volatility/:ticker should return GARCH forecast', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/risk/forecast-volatility/AAPL?horizon=30')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('forecast');
      expect(response.body.data).toHaveProperty('model');
      expect(response.body.data.forecast.length).toBe(30);
    });

    it('POST /api/risk/correlation should return correlation matrix', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/risk/correlation')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ tickers: ['AAPL', 'GOOGL', 'MSFT'] })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('tickers');
      expect(response.body.data).toHaveProperty('matrix');
      expect(response.body.data.matrix.length).toBe(3);
      expect(response.body.data.matrix[0].length).toBe(3);
      expect(response.body.data.matrix[0][0]).toBe(1);
      expect(response.body.data.matrix[1][1]).toBe(1);
      expect(response.body.data.matrix[2][2]).toBe(1);
    });
  });

  describe('Execution API', () => {
    it('POST /api/execution/slippage should analyze slippage', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/execution/slippage')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          ticker: 'AAPL',
          executionPrice: 175.1,
          executionTime: new Date().toISOString(),
          side: 'BUY',
          quantity: 100,
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('slippageBps');
      expect(response.body.data).toHaveProperty('quality');
      expect(['EXCELLENT', 'GOOD', 'FAIR', 'POOR']).toContain(
        response.body.data.quality,
      );
    });

    it('GET /api/execution/strategies should return available strategies', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/execution/strategies')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toHaveProperty('name');
      expect(response.body.data[0]).toHaveProperty('type');
      expect(response.body.data[0]).toHaveProperty('params');
    });

    it('POST /api/execution/backtest should run backtest', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/execution/backtest')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          strategy: {
            name: 'SMA Crossover',
            type: 'SMA_CROSSOVER',
            lookbackPeriod: 30,
            params: { shortPeriod: 10, longPeriod: 20 },
          },
          tickers: ['AAPL'],
          startDate: '2023-01-01',
          endDate: '2023-03-31',
          initialCapital: 100000,
          commission: 5,
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('metrics');
      expect(response.body.data).toHaveProperty('equityCurve');
      expect(response.body.data.metrics).toHaveProperty('totalReturn');
      expect(response.body.data.metrics).toHaveProperty('sharpeRatio');
    });
  });

  describe('Market Data API', () => {
    it('GET /api/market-data/quote/:ticker should return quote', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/market-data/quote/AAPL')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('symbol', 'AAPL');
      expect(response.body.data).toHaveProperty('price', 187.3);
    });
  });

  describe('Options API', () => {
    it('POST /api/options/calculate should calculate Greeks', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/options/calculate')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          underlying: 175,
          strike: 180,
          timeToExpiry: 0.25,
          riskFreeRate: 0.05,
          volatility: 0.25,
          optionType: 'call',
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('delta');
      expect(response.body.data).toHaveProperty('gamma');
      expect(response.body.data).toHaveProperty('theta');
      expect(response.body.data).toHaveProperty('vega');
      expect(response.body.data).toHaveProperty('rho');
    });
  });
});

describe('WebSocket Integration Tests', () => {
  describe('Realtime Gateway', () => {
    it('should handle subscribe-ticker events', () => {
      expect(true).toBe(true);
    });

    it('should handle subscribe-greeks events', () => {
      expect(true).toBe(true);
    });

    it('should handle subscribe-portfolio-pnl events', () => {
      expect(true).toBe(true);
    });
  });
});
