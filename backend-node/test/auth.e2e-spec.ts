import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import _request from 'supertest';
const request = (_request as any).default ?? _request;
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseEnvelopeInterceptor } from '../src/common/interceptors/response-envelope.interceptor';
import { SanitizePipe } from '../src/common/pipes/sanitize.pipe';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';

// ── Environment ──
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-must-be-at-least-32-characters-long';
process.env.ADMIN_KEY = process.env.ADMIN_KEY || 'test-admin-key-e2e';
process.env.NODE_ENV = 'test';

// ── Prisma mock factory ──
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
        };
        users.push(user);
        return Promise.resolve(user);
      }),
      update: jest.fn().mockImplementation(({ where, data }: any) => {
        const user = users.find((u) => u.id === where.id);
        if (user) Object.assign(user, data);
        return Promise.resolve(user);
      }),
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
      update: jest.fn().mockImplementation(({ where, data }: any) => {
        const token = refreshTokens.find((t) => t.id === where.id);
        if (token) Object.assign(token, data);
        return Promise.resolve(token);
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },

    workspace: {
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

    // Stub out models that may be touched by global interceptors/guards
    demoRequest: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), count: jest.fn().mockResolvedValue(0) },
    institution: { count: jest.fn().mockResolvedValue(0), deleteMany: jest.fn() },
    balanceSheetItem: { deleteMany: jest.fn() },
    interestRateScenario: { deleteMany: jest.fn() },
    liquidityPosition: { deleteMany: jest.fn() },
    prospect: { count: jest.fn().mockResolvedValue(0), create: jest.fn(), findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
    subscription: { count: jest.fn().mockResolvedValue(0) },
    analysisRun: { count: jest.fn().mockResolvedValue(0) },
    reportJob: { findMany: jest.fn().mockResolvedValue([]) },
    passwordResetToken: { create: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn() },
    apiKey: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn() },

    // Internal state accessors for test assertions
    _users: users,
    _refreshTokens: refreshTokens,
  };
}

describe('Auth API Integration Tests (e2e)', () => {
  let app: INestApplication;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let jwtService: JwtService;

  beforeAll(async () => {
    prismaMock = createPrismaMock();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication();

    // Apply the same global pipes/filters/interceptors as main.ts
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

    jwtService = moduleFixture.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  // ── POST /api/auth/register ──

  describe('POST /api/auth/register', () => {
    it('should register a new user and return user data', async () => {
      const dto = {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        name: 'Test User',
      };

      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(dto)
        .expect(201);

      // Response envelope wraps the data
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data.user).toHaveProperty('email', dto.email);

      // Should set auth cookies
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieStr = Array.isArray(cookies) ? cookies.join('; ') : cookies;
      expect(cookieStr).toMatch(/access_token/);
      expect(cookieStr).toMatch(/refresh_token/);
    });

    it('should reject registration with invalid email', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'not-an-email',
          password: 'SecurePass123!',
        })
        .expect(400);

      expect(res.body).toHaveProperty('success', false);
      expect(res.body.error).toHaveProperty('code', 'BAD_REQUEST');
    });

    it('should reject registration with short password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'shortpw@example.com',
          password: '1234567', // Less than 8 chars
        })
        .expect(400);

      expect(res.body).toHaveProperty('success', false);
    });

    it('should reject registration with missing required fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({})
        .expect(400);

      expect(res.body).toHaveProperty('success', false);
    });
  });

  // ── POST /api/auth/login ──

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials and return user data', async () => {
      // First register a user so it exists in our mock
      const email = 'logintest@example.com';
      const password = 'SecurePass123!';

      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password, name: 'Login Tester' })
        .expect(201);

      // Now login. Since our mock stores the bcrypt hash in the user object,
      // we need to verify the service calls correctly.
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password })
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data.user).toHaveProperty('email', email);

      // Should set auth cookies
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
    });

    it('should reject login with wrong password', async () => {
      const email = 'wrongpw@example.com';
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'CorrectPass123!' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: 'WrongPassword99!' })
        .expect(401);

      expect(res.body).toHaveProperty('success', false);
      expect(res.body.error).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('should reject login for non-existent user', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SomePass123!',
        })
        .expect(401);

      expect(res.body).toHaveProperty('success', false);
    });

    it('should reject login with invalid email format', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: 'SomePass123!',
        })
        .expect(400);

      expect(res.body).toHaveProperty('success', false);
    });
  });

  // ── GET /api/auth/profile (protected) ──

  describe('GET /api/auth/profile', () => {
    it('should return user profile with valid JWT token', async () => {
      // Register a user
      const email = 'profile@example.com';
      const regRes = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'SecurePass123!', name: 'Profile User' })
        .expect(201);

      // Extract access token from cookies
      const cookies = regRes.headers['set-cookie'] as string[];
      const accessCookie = (Array.isArray(cookies) ? cookies : [cookies]).find(
        (c: string) => c.startsWith('access_token='),
      );
      const token = accessCookie?.split(';')[0]?.split('=')[1];
      expect(token).toBeDefined();

      // Also set up the mock to return the profile data
      const user = prismaMock._users.find((u: any) => u.email === email);
      prismaMock.user.findUnique.mockImplementation(({ where }: any) => {
        const found = prismaMock._users.find(
          (u: any) =>
            (where.email && u.email === where.email) ||
            (where.id && u.id === where.id),
        );
        if (found) {
          return Promise.resolve({
            ...found,
            organizationMembers: found.organizationMembers || [],
          });
        }
        return Promise.resolve(null);
      });

      const res = await request(app.getHttpServer())
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('email', email);
    });

    it('should return 401 without token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/profile')
        .expect(401);

      expect(res.body).toHaveProperty('success', false);
      expect(res.body.error).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(401);

      expect(res.body).toHaveProperty('success', false);
      expect(res.body.error).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('should return 401 with expired token', async () => {
      // Create a token that is already expired
      const expiredToken = jwtService.sign(
        { sub: 'fake-id', email: 'expired@test.com', type: 'access' },
        { expiresIn: '0s' },
      );

      // Small delay to ensure token has expired
      await new Promise((resolve) => setTimeout(resolve, 100));

      const res = await request(app.getHttpServer())
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(res.body).toHaveProperty('success', false);
    });
  });

  // ── POST /api/auth/logout ──

  describe('POST /api/auth/logout', () => {
    it('should clear auth cookies on logout', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('message', 'Logged out');

      // Cookies should be cleared
      const cookies = res.headers['set-cookie'];
      if (cookies) {
        const cookieStr = Array.isArray(cookies) ? cookies.join('; ') : cookies;
        // Cleared cookies have expired or empty values
        expect(cookieStr).toMatch(/access_token/);
      }
    });

    it('should succeed even without an existing session', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('message', 'Logged out');
    });
  });

  // ── Auth guard on protected endpoints ──

  describe('Auth bypass protection', () => {
    it('should reject access to /api/auth/whoami without token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/whoami')
        .expect(401);

      expect(res.body).toHaveProperty('success', false);
      expect(res.body.error).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('should reject access to /api/workspaces without token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/workspaces')
        .expect(401);

      expect(res.body).toHaveProperty('success', false);
      expect(res.body.error).toHaveProperty('code', 'UNAUTHORIZED');
    });
  });
});
