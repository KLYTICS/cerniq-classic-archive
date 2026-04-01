import { ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { AuthGuard } from './auth.guard';

describe('AuthGuard (enhanced)', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  function createContext(
    request: Record<string, unknown>,
  ): ExecutionContext {
    const mockRes = { setHeader: jest.fn() };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => mockRes,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  function createGuard(jwtOverrides?: Partial<JwtService>, prismaOverrides?: any) {
    const jwtService = {
      decode: jest.fn().mockReturnValue({}),
      verify: jest.fn(),
      ...jwtOverrides,
    } as unknown as JwtService;

    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      apiKey: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
      ...prismaOverrides,
    } as unknown as PrismaService;

    return { guard: new AuthGuard(jwtService, prisma), jwtService, prisma };
  }

  describe('JWT token authentication', () => {
    it('extracts token from Authorization Bearer header', async () => {
      process.env.AUTH_ALLOW_LEGACY = 'true';
      const { guard, jwtService } = createGuard({
        decode: jest.fn().mockReturnValue({ sub: 'user-1' }),
        verify: jest.fn().mockReturnValue({
          sub: 'user-1',
          email: 'test@cerniq.io',
          role: 'admin',
        }),
      });

      const request: any = {
        headers: { authorization: 'Bearer some-token' },
        cookies: {},
        method: 'GET',
      };

      await guard.canActivate(createContext(request));
      expect(request.user).toMatchObject({ userId: 'user-1' });
    });

    it('extracts token from access_token cookie', async () => {
      process.env.AUTH_ALLOW_LEGACY = 'true';
      const { guard } = createGuard({
        decode: jest.fn().mockReturnValue({ type: 'access' }),
        verify: jest.fn().mockReturnValue({
          sub: 'cookie-user',
          email: 'cookie@cerniq.io',
        }),
      });

      const request: any = {
        headers: {},
        cookies: { access_token: 'cookie-token' },
        method: 'GET',
      };

      await guard.canActivate(createContext(request));
      expect(request.user).toMatchObject({ userId: 'cookie-user' });
    });

    it('throws UnauthorizedException when no token or API key present', async () => {
      const { guard } = createGuard();
      const request: any = {
        headers: {},
        cookies: {},
        method: 'GET',
      };

      await expect(guard.canActivate(createContext(request))).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('prefers legacy token when claims.type is "access"', async () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'anon-key';

      const fetchSpy = jest.spyOn(global, 'fetch');

      const { guard } = createGuard({
        decode: jest.fn().mockReturnValue({ type: 'access' }),
        verify: jest.fn().mockReturnValue({
          sub: 'legacy-user',
          email: 'legacy@cerniq.io',
          type: 'access',
        }),
      });

      const request: any = {
        headers: { authorization: 'Bearer legacy-jwt' },
        cookies: {},
        method: 'GET',
      };

      await guard.canActivate(createContext(request));
      // Should not call Supabase when legacy is preferred
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(request.user.userId).toBe('legacy-user');
    });
  });

  describe('API key authentication', () => {
    it('authenticates via x-api-key header for GET requests', async () => {
      const { guard, prisma } = createGuard(
        { decode: jest.fn().mockReturnValue({}) },
        {
          apiKey: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'key-1',
              keyHash: 'hash',
              keyPrefix: 'ck_live_',
              revokedAt: null,
              expiresAt: null,
              failureCount: 0,
              user: { id: 'api-user', email: 'api@cerniq.io' },
            }),
            update: jest.fn(),
          },
          user: { findUnique: jest.fn().mockResolvedValue(null) },
        },
      );

      const request: any = {
        headers: { 'x-api-key': 'ck_live_test123' },
        cookies: {},
        method: 'GET',
      };

      await guard.canActivate(createContext(request));
      expect(request.user).toMatchObject({
        userId: 'api-user',
        authMethod: 'api_key',
        role: 'api_key',
      });
    });

    it('rejects API key for non-GET (write) requests', async () => {
      const { guard } = createGuard(
        { decode: jest.fn().mockReturnValue({}) },
        {
          apiKey: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'key-1',
              keyHash: 'hash',
              keyPrefix: 'ck_live_',
              revokedAt: null,
              expiresAt: null,
              failureCount: 0,
              user: { id: 'api-user', email: 'api@cerniq.io' },
            }),
            update: jest.fn(),
          },
          user: { findUnique: jest.fn().mockResolvedValue(null) },
        },
      );

      const request: any = {
        headers: { 'x-api-key': 'ck_live_test123' },
        cookies: {},
        method: 'POST',
      };

      await expect(guard.canActivate(createContext(request))).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects revoked API key', async () => {
      const { guard } = createGuard(
        { decode: jest.fn().mockReturnValue({}) },
        {
          apiKey: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'key-1',
              revokedAt: new Date(),
              user: { id: 'u1', email: 'e@test.com' },
            }),
            update: jest.fn(),
          },
          user: { findUnique: jest.fn().mockResolvedValue(null) },
        },
      );

      const request: any = {
        headers: { 'x-api-key': 'ck_live_revoked' },
        cookies: {},
        method: 'GET',
      };

      await expect(guard.canActivate(createContext(request))).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects expired API key', async () => {
      const yesterday = new Date(Date.now() - 86400000);
      const { guard } = createGuard(
        { decode: jest.fn().mockReturnValue({}) },
        {
          apiKey: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'key-1',
              revokedAt: null,
              expiresAt: yesterday,
              user: { id: 'u1', email: 'e@test.com' },
            }),
            update: jest.fn(),
          },
          user: { findUnique: jest.fn().mockResolvedValue(null) },
        },
      );

      const request: any = {
        headers: { 'x-api-key': 'ck_live_expired' },
        cookies: {},
        method: 'GET',
      };

      await expect(guard.canActivate(createContext(request))).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('role resolution', () => {
    it('resolves role from database when available', async () => {
      process.env.AUTH_ALLOW_LEGACY = 'true';
      const { guard } = createGuard(
        {
          decode: jest.fn().mockReturnValue({ type: 'access' }),
          verify: jest.fn().mockReturnValue({
            sub: 'user-db',
            email: 'db@test.com',
            role: 'authenticated',
          }),
        },
        {
          user: {
            findUnique: jest.fn().mockResolvedValue({ role: 'SUPER_ADMIN' }),
          },
          apiKey: { findUnique: jest.fn() },
        },
      );

      const request: any = {
        headers: { authorization: 'Bearer token' },
        cookies: {},
        method: 'GET',
      };

      await guard.canActivate(createContext(request));
      expect(request.user.role).toBe('SUPER_ADMIN');
    });

    it('falls back to token role when DB lookup fails', async () => {
      process.env.AUTH_ALLOW_LEGACY = 'true';
      const { guard } = createGuard(
        {
          decode: jest.fn().mockReturnValue({ type: 'access' }),
          verify: jest.fn().mockReturnValue({
            sub: 'user-fallback',
            email: 'fallback@test.com',
            role: 'analyst',
          }),
        },
        {
          user: {
            findUnique: jest.fn().mockRejectedValue(new Error('DB error')),
          },
          apiKey: { findUnique: jest.fn() },
        },
      );

      const request: any = {
        headers: { authorization: 'Bearer token' },
        cookies: {},
        method: 'GET',
      };

      await guard.canActivate(createContext(request));
      expect(request.user.role).toBe('analyst');
    });
  });

  describe('org access', () => {
    it('reads x-organization-id header', async () => {
      process.env.AUTH_ALLOW_LEGACY = 'true';
      const { guard } = createGuard({
        decode: jest.fn().mockReturnValue({ type: 'access' }),
        verify: jest.fn().mockReturnValue({
          sub: 'user-org',
          email: 'org@test.com',
        }),
      });

      const request: any = {
        headers: {
          authorization: 'Bearer token',
          'x-organization-id': 'org-999',
        },
        cookies: {},
        method: 'GET',
      };

      await guard.canActivate(createContext(request));
      expect(request.user.orgId).toBe('org-999');
    });
  });
});
