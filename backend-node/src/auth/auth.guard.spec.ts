import { ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  function createContext(request: Record<string, unknown>): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;
  }

  it('accepts CERNIQ legacy access tokens even when Supabase is configured', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'supabase-anon-key';
    process.env.AUTH_ALLOW_LEGACY = 'false';

    const jwtService = {
      decode: jest.fn().mockReturnValue({ type: 'access' }),
      verify: jest.fn().mockReturnValue({
        sub: 'user-123',
        email: 'operator@cerniq.io',
        type: 'access',
      }),
    } as unknown as JwtService;

    const prisma = {} as PrismaService;
    const guard = new AuthGuard(jwtService, prisma);

    const fetchSpy = jest.spyOn(global, 'fetch');
    const request: Record<string, unknown> = {
      cookies: { access_token: 'legacy-token' },
      headers: {},
      method: 'GET',
    };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(request.user).toMatchObject({
      userId: 'user-123',
      email: 'operator@cerniq.io',
      authMethod: 'token',
    });
  });

  it('throws UnauthorizedException when no token and no API key', async () => {
    const jwtService = {
      decode: jest.fn(),
      verify: jest.fn(),
    } as unknown as JwtService;

    const prisma = {} as PrismaService;
    const guard = new AuthGuard(jwtService, prisma);

    const request: Record<string, unknown> = {
      cookies: {},
      headers: {},
      method: 'GET',
    };

    await expect(guard.canActivate(createContext(request))).rejects.toThrow('Invalid or expired token');
  });

  it('extracts Bearer token from Authorization header', async () => {
    const jwtService = {
      decode: jest.fn().mockReturnValue({ type: 'access' }),
      verify: jest.fn().mockReturnValue({
        sub: 'user-456',
        email: 'test@cerniq.io',
        type: 'access',
      }),
    } as unknown as JwtService;

    const prisma = {} as PrismaService;
    const guard = new AuthGuard(jwtService, prisma);

    const request: Record<string, unknown> = {
      headers: { authorization: 'Bearer my-jwt-token' },
      method: 'GET',
    };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(jwtService.verify).toHaveBeenCalledWith('my-jwt-token');
  });

  it('sets X-API-Key-Expires-In-Days header when key expires within 14 days', async () => {
    const jwtService = {
      decode: jest.fn(),
      verify: jest.fn(),
    } as unknown as JwtService;

    const expiresInDays = 7;
    const expiresAt = new Date(Date.now() + expiresInDays * 86_400_000);

    const prisma = {
      apiKey: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'key-1',
          keyHash: 'hash',
          keyPrefix: 'ck_live_',
          revokedAt: null,
          expiresAt,
          user: { id: 'user-key', email: 'apiuser@test.com' },
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    } as unknown as PrismaService;

    const guard = new AuthGuard(jwtService, prisma);

    const responseHeaders: Record<string, string> = {};
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'x-api-key': 'ck_live_test_key_value' },
          method: 'GET',
        }),
        getResponse: () => ({
          setHeader: (name: string, value: string) => { responseHeaders[name] = value; },
        }),
      }),
    } as ExecutionContext;

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(responseHeaders['X-API-Key-Expires-In-Days']).toBeDefined();
    expect(responseHeaders['Warning']).toContain('API key expires');
  });

  it('throws ForbiddenException for non-GET API key requests', async () => {
    const { ForbiddenException } = require('@nestjs/common');
    const jwtService = {
      decode: jest.fn(),
      verify: jest.fn(),
    } as unknown as JwtService;

    const prisma = {
      apiKey: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'key-2',
          keyHash: 'hash',
          keyPrefix: 'ck_live_',
          revokedAt: null,
          expiresAt: null,
          user: { id: 'user-key', email: 'apiuser@test.com' },
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    } as unknown as PrismaService;

    const guard = new AuthGuard(jwtService, prisma);

    const request: Record<string, unknown> = {
      headers: { 'x-api-key': 'ck_live_test_key' },
      method: 'POST', // Non-read-only
    };

    await expect(guard.canActivate(createContext(request))).rejects.toThrow('API keys are read-only');
  });

  it('rejects revoked API keys', async () => {
    const jwtService = {
      decode: jest.fn(),
      verify: jest.fn(),
    } as unknown as JwtService;

    const prisma = {
      apiKey: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'key-3',
          keyHash: 'hash',
          keyPrefix: 'ck_live_',
          revokedAt: new Date(),
          expiresAt: null,
          user: { id: 'user-key', email: 'apiuser@test.com' },
        }),
      },
    } as unknown as PrismaService;

    const guard = new AuthGuard(jwtService, prisma);

    const request: Record<string, unknown> = {
      headers: { 'x-api-key': 'ck_live_revoked_key' },
      method: 'GET',
    };

    await expect(guard.canActivate(createContext(request))).rejects.toThrow('Invalid or expired token');
  });

  it('rejects expired API keys', async () => {
    const jwtService = {
      decode: jest.fn(),
      verify: jest.fn(),
    } as unknown as JwtService;

    const prisma = {
      apiKey: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'key-4',
          keyHash: 'hash',
          keyPrefix: 'ck_live_',
          revokedAt: null,
          expiresAt: new Date('2020-01-01'), // Expired
          user: { id: 'user-key', email: 'apiuser@test.com' },
        }),
      },
    } as unknown as PrismaService;

    const guard = new AuthGuard(jwtService, prisma);

    const request: Record<string, unknown> = {
      headers: { 'x-api-key': 'ck_live_expired_key' },
      method: 'GET',
    };

    await expect(guard.canActivate(createContext(request))).rejects.toThrow('Invalid or expired token');
  });

  it('enforces org access when KLYTICS_REQUIRE_ORG is true', async () => {
    process.env.KLYTICS_REQUIRE_ORG = 'true';
    process.env.SUPABASE_URL = '';
    process.env.SUPABASE_SERVICE_ROLE_KEY = '';

    const jwtService = {
      decode: jest.fn().mockReturnValue({ type: 'access' }),
      verify: jest.fn().mockReturnValue({
        sub: 'user-org-test',
        email: 'org@test.com',
        type: 'access',
      }),
    } as unknown as JwtService;

    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'authenticated' }) },
    } as unknown as PrismaService;

    const guard = new AuthGuard(jwtService, prisma);

    // No org header and no orgId in token => should fail
    const request: Record<string, unknown> = {
      cookies: { access_token: 'valid-token' },
      headers: {},
      method: 'GET',
    };

    await expect(guard.canActivate(createContext(request))).rejects.toThrow();

    delete process.env.KLYTICS_REQUIRE_ORG;
  });

  it('falls back to legacy token when allowLegacy is true', async () => {
    process.env.AUTH_ALLOW_LEGACY = 'true';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon';

    const jwtService = {
      decode: jest.fn().mockReturnValue({ some: 'claim' }), // Not type=access
      verify: jest.fn().mockReturnValue({
        sub: 'user-legacy',
        email: 'legacy@test.com',
      }),
    } as unknown as JwtService;

    // Mock Supabase fetch to fail
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
    } as Response);

    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;

    const guard = new AuthGuard(jwtService, prisma);

    const request: Record<string, unknown> = {
      headers: { authorization: 'Bearer some-token' },
      method: 'GET',
    };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect((request.user as any).userId).toBe('user-legacy');

    fetchSpy.mockRestore();
    delete process.env.AUTH_ALLOW_LEGACY;
  });

  it('resolves role from database when available', async () => {
    const jwtService = {
      decode: jest.fn().mockReturnValue({ type: 'access' }),
      verify: jest.fn().mockReturnValue({
        sub: 'user-db-role',
        email: 'role@test.com',
        type: 'access',
        role: 'authenticated',
      }),
    } as unknown as JwtService;

    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'admin' }) },
    } as unknown as PrismaService;

    const guard = new AuthGuard(jwtService, prisma);

    const request: Record<string, unknown> = {
      cookies: { access_token: 'valid-token' },
      headers: {},
      method: 'GET',
    };

    await guard.canActivate(createContext(request));
    expect((request.user as any).role).toBe('admin');
  });

  it('falls back to token role when DB lookup fails', async () => {
    const jwtService = {
      decode: jest.fn().mockReturnValue({ type: 'access' }),
      verify: jest.fn().mockReturnValue({
        sub: 'user-db-err',
        email: 'err@test.com',
        type: 'access',
        role: 'analyst',
      }),
    } as unknown as JwtService;

    const prisma = {
      user: { findUnique: jest.fn().mockRejectedValue(new Error('DB down')) },
    } as unknown as PrismaService;

    const guard = new AuthGuard(jwtService, prisma);

    const request: Record<string, unknown> = {
      cookies: { access_token: 'valid-token' },
      headers: {},
      method: 'GET',
    };

    await guard.canActivate(createContext(request));
    expect((request.user as any).role).toBe('analyst');
  });
});
