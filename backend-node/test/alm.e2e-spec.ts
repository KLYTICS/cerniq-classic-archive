import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import _request from 'supertest';
const request = (_request as any).default ?? _request;
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseEnvelopeInterceptor } from '../src/common/interceptors/response-envelope.interceptor';
import { SanitizePipe } from '../src/common/pipes/sanitize.pipe';
import * as crypto from 'crypto';

// Environment is configured via test/setup-env.ts (setupFiles in jest-e2e.json)

// ── Prisma mock factory ──
function createPrismaMock() {
  const leads: any[] = [];
  const demoRequests: any[] = [];
  const users: any[] = [];
  const refreshTokens: any[] = [];

  return {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),

    lead: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockImplementation(() => Promise.resolve(leads)),
      findUniqueOrThrow: jest.fn().mockImplementation(({ where }: any) => {
        const found = leads.find((l) => l.id === where.id);
        if (!found) return Promise.reject(new Error('Not found'));
        return Promise.resolve(found);
      }),
      create: jest.fn().mockImplementation(({ data }: any) => {
        const lead = {
          id: crypto.randomUUID(),
          ...data,
          status: 'NEW',
          createdAt: new Date(),
          notes: null,
          reportSentAt: null,
          convertedAt: null,
          revenueAmount: null,
        };
        leads.push(lead);
        return Promise.resolve(lead);
      }),
      update: jest.fn().mockImplementation(({ where, data }: any) => {
        const lead = leads.find((l) => l.id === where.id);
        if (lead) Object.assign(lead, data);
        return Promise.resolve(lead);
      }),
      count: jest.fn().mockResolvedValue(0),
    },

    demoRequest: {
      findMany: jest.fn().mockImplementation(() =>
        Promise.resolve(demoRequests),
      ),
      create: jest.fn().mockImplementation(({ data }: any) => {
        const req = { id: crypto.randomUUID(), ...data, createdAt: new Date() };
        demoRequests.push(req);
        return Promise.resolve(req);
      }),
      count: jest.fn().mockResolvedValue(demoRequests.length),
    },

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
        const user = { id: crypto.randomUUID(), ...data, createdAt: new Date() };
        users.push(user);
        return Promise.resolve(user);
      }),
      update: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
    },

    refreshToken: {
      create: jest.fn().mockImplementation(({ data }: any) => {
        const token = { id: crypto.randomUUID(), ...data, revokedAt: null, createdAt: new Date() };
        refreshTokens.push(token);
        return Promise.resolve(token);
      }),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },

    workspace: {
      create: jest.fn().mockResolvedValue({ id: crypto.randomUUID(), name: 'Test' }),
      findMany: jest.fn().mockResolvedValue([]),
    },

    auditLog: {
      create: jest.fn().mockResolvedValue({ id: crypto.randomUUID() }),
    },

    // Models required by AppController
    institution: { count: jest.fn().mockResolvedValue(0), deleteMany: jest.fn() },
    balanceSheetItem: { deleteMany: jest.fn() },
    interestRateScenario: { deleteMany: jest.fn() },
    liquidityPosition: { deleteMany: jest.fn() },
    prospect: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: crypto.randomUUID() }),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(null),
    },
    subscription: { count: jest.fn().mockResolvedValue(0) },
    analysisRun: { count: jest.fn().mockResolvedValue(0) },
    reportJob: { findMany: jest.fn().mockResolvedValue([]) },
    passwordResetToken: { create: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn() },
    apiKey: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn() },

    // Leads-specific models
    prospectInstitution: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: crypto.randomUUID() }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: crypto.randomUUID(),
        name: 'Test Cooperativa',
        estimatedAssets: 200_000_000,
        location: 'San Juan',
        contactRole: 'CFO',
      }),
    },
    cooperativaBenchmark: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: crypto.randomUUID() }),
    },
  };
}

describe('ALM & Health API Integration Tests (e2e)', () => {
  let app: INestApplication;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  const ADMIN_KEY = process.env.ADMIN_KEY!;

  beforeAll(async () => {
    prismaMock = createPrismaMock();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
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
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  // ── GET /health ──

  describe('GET /health', () => {
    it('should return 200 with health status', async () => {
      const res = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('status');
      expect(['ok', 'degraded', 'down']).toContain(res.body.data.status);
      expect(res.body.data).toHaveProperty('version');
      expect(res.body.data).toHaveProperty('uptime');
      expect(res.body.data).toHaveProperty('timestamp');
      expect(res.body.data).toHaveProperty('services');
    });

    it('should include memory and database info', async () => {
      const res = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(res.body.data).toHaveProperty('memoryPercent');
      expect(typeof res.body.data.memoryPercent).toBe('number');
      expect(res.body.data).toHaveProperty('db');
      expect(res.body.data).toHaveProperty('memory');
      expect(res.body.data.memory).toHaveProperty('heapUsedMB');
    });
  });

  // ── GET /ready ──

  describe('GET /ready', () => {
    it('should return readiness check status', async () => {
      const res = await request(app.getHttpServer())
        .get('/ready')
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('ready');
      expect(typeof res.body.data.ready).toBe('boolean');
      expect(res.body.data).toHaveProperty('checks');
      expect(res.body.data.checks).toHaveProperty('database');
      expect(res.body.data).toHaveProperty('timestamp');
    });

    it('should report database check result', async () => {
      const res = await request(app.getHttpServer())
        .get('/ready')
        .expect(200);

      expect(['ok', 'fail']).toContain(res.body.data.checks.database);
    });
  });

  // ── POST /api/v1/leads/submit ──

  describe('POST /api/v1/leads/submit', () => {
    it('should create a lead with valid data', async () => {
      const dto = {
        name: 'Maria Torres',
        email: 'mtorres@cooperativa.pr',
        phone: '+1-787-555-0001',
        role: 'CFO',
        institutionName: 'Cooperativa de Ahorro Test',
        institutionType: 'cooperativa',
        message: 'Interested in ALM analysis for our cooperativa.',
        source: 'landing_page',
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/leads/submit')
        .send(dto)
        .expect(201);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('leadId');
      expect(res.body.data).toHaveProperty('message');
      expect(typeof res.body.data.leadId).toBe('string');
    });

    it('should reject a lead with missing required fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/leads/submit')
        .send({
          name: 'Incomplete Lead',
          // Missing email, institutionName, institutionType
        })
        .expect(400);

      expect(res.body).toHaveProperty('success', false);
      expect(res.body.error).toHaveProperty('code', 'BAD_REQUEST');
    });

    it('should reject a lead with invalid email', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/leads/submit')
        .send({
          name: 'Bad Email',
          email: 'not-an-email',
          institutionName: 'Test Inst',
          institutionType: 'cooperativa',
        })
        .expect(400);

      expect(res.body).toHaveProperty('success', false);
    });

    it('should reject a lead with invalid institution type', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/leads/submit')
        .send({
          name: 'Bad Type',
          email: 'badtype@test.com',
          institutionName: 'Test Inst',
          institutionType: 'invalid_type',
        })
        .expect(400);

      expect(res.body).toHaveProperty('success', false);
    });

    it('should accept all valid institution types', async () => {
      const validTypes = [
        'cooperativa',
        'credit_union',
        'community_bank',
        'cpa_consultant',
        'other',
      ];

      for (const type of validTypes) {
        const res = await request(app.getHttpServer())
          .post('/api/v1/leads/submit')
          .send({
            name: `Test ${type}`,
            email: `${type}@test.com`,
            institutionName: `Test ${type} Inst`,
            institutionType: type,
          })
          .expect(201);

        expect(res.body).toHaveProperty('success', true);
        expect(res.body.data).toHaveProperty('leadId');
      }
    });
  });

  // ── GET /api/admin/demo-requests ──

  describe('GET /api/admin/demo-requests', () => {
    it('should return demo requests with valid admin key', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/demo-requests')
        .set('x-admin-key', ADMIN_KEY)
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should reject without admin key (401)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/demo-requests')
        .expect(401);

      expect(res.body).toHaveProperty('success', false);
      expect(res.body.error).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('should reject with invalid admin key', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/demo-requests')
        .set('x-admin-key', 'wrong-key-value')
        .expect(401);

      expect(res.body).toHaveProperty('success', false);
      expect(res.body.error).toHaveProperty('code', 'UNAUTHORIZED');
    });
  });

  // ── Admin stats endpoint ──

  describe('GET /api/admin/stats', () => {
    it('should return admin stats with valid admin key', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/stats')
        .set('x-admin-key', ADMIN_KEY)
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('demoRequests');
      expect(res.body.data).toHaveProperty('institutions');
      expect(res.body.data).toHaveProperty('users');
    });

    it('should reject without admin key', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/stats')
        .expect(401);

      expect(res.body).toHaveProperty('success', false);
    });
  });

  // ── GET /api/status ──

  describe('GET /api/status', () => {
    it('should return API status information', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/status')
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('name');
      expect(res.body.data).toHaveProperty('version');
      expect(res.body.data).toHaveProperty('endpoints');
    });
  });
});
