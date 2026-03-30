import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  function createContext(request: Record<string, unknown>) {
    const response = {
      setHeader: jest.fn(),
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as ExecutionContext;

    return { context, request, response };
  }

  function createPrisma() {
    return {
      user: {
        findUnique: jest.fn().mockResolvedValue({ role: 'viewer' }),
      },
      apiKey: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    } as unknown as PrismaService;
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

    const prisma = createPrisma();
    const guard = new AuthGuard(jwtService, prisma);

    const fetchSpy = jest.spyOn(global, 'fetch');
    const { context, request } = createContext({
      cookies: { access_token: 'legacy-token' },
      headers: {},
      method: 'GET',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(request.user).toMatchObject({
      userId: 'user-123',
      email: 'operator@cerniq.io',
      authMethod: 'token',
      role: 'viewer',
    });
  });

  it('rejects requests without a token or API key', async () => {
    const jwtService = {
      decode: jest.fn(),
      verify: jest.fn(),
    } as unknown as JwtService;
    const guard = new AuthGuard(jwtService, createPrisma());

    await expect(
      guard.canActivate(createContext({ headers: {}, method: 'GET' }).context),
    ).rejects.toThrow(new UnauthorizedException('Invalid or expired token'));
  });

  it('authenticates Supabase bearer tokens and resolves the database role', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'supabase-anon-key';

    const jwtService = {
      decode: jest.fn().mockReturnValue({
        email: 'token@cerniq.io',
        role: 'portfolio_user',
      }),
      verify: jest.fn(),
    } as unknown as JwtService;
    const prisma = createPrisma();
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
      role: 'admin',
    });
    const guard = new AuthGuard(jwtService, prisma);
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'supabase-user',
        email: 'operator@cerniq.io',
      }),
    } as Response);

    const { context, request } = createContext({
      cookies: {},
      headers: { authorization: 'Bearer supabase-token' },
      method: 'GET',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject({
      userId: 'supabase-user',
      email: 'operator@cerniq.io',
      role: 'admin',
      authMethod: 'token',
    });
  });

  it('falls back to legacy verification when Supabase auth fails and legacy is allowed', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'supabase-anon-key';
    process.env.AUTH_ALLOW_LEGACY = 'true';

    const jwtService = {
      decode: jest.fn().mockReturnValue({
        email: 'legacy@cerniq.io',
        role: 'analyst',
      }),
      verify: jest.fn().mockReturnValue({
        sub: 'legacy-user',
        email: 'legacy@cerniq.io',
        role: 'analyst',
      }),
    } as unknown as JwtService;
    const guard = new AuthGuard(jwtService, createPrisma());
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response);

    const { context, request } = createContext({
      headers: { authorization: 'Bearer legacy-token' },
      method: 'GET',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject({
      userId: 'legacy-user',
      authMethod: 'token',
    });
  });

  it('rejects malformed bearer tokens when neither Supabase nor legacy validation succeeds', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'supabase-anon-key';

    const jwtService = {
      decode: jest.fn().mockReturnValue('bad-claims'),
      verify: jest.fn().mockImplementation(() => {
        throw new Error('invalid');
      }),
    } as unknown as JwtService;
    const guard = new AuthGuard(jwtService, createPrisma());
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response);

    await expect(
      guard.canActivate(
        createContext({
          headers: { authorization: 'Bearer broken-token' },
          method: 'GET',
        }).context,
      ),
    ).rejects.toThrow(new UnauthorizedException('Invalid or expired token'));
  });

  it('authenticates read-only API keys and emits expiry warnings for soon-to-expire credentials', async () => {
    const jwtService = {
      decode: jest.fn(),
      verify: jest.fn(),
    } as unknown as JwtService;
    const prisma = createPrisma();
    const expiresAt = new Date(Date.now() + 5 * 86_400_000);
    (prisma.apiKey.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'key-1',
      keyPrefix: 'ck_live_1234',
      revokedAt: null,
      expiresAt,
      user: {
        id: 'api-user',
        email: 'api@cerniq.io',
      },
    });
    const guard = new AuthGuard(jwtService, prisma);
    const { context, request, response } = createContext({
      headers: { 'x-api-key': 'ck_live_secret' },
      method: 'GET',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.apiKey.update).toHaveBeenCalledWith({
      where: { id: 'key-1' },
      data: { lastUsedAt: expect.any(Date) },
    });
    expect(response.setHeader).toHaveBeenCalledWith(
      'X-API-Key-Expires-In-Days',
      '5',
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'Warning',
      expect.stringContaining('API key expires in 5 day(s)'),
    );
    expect(request.user).toMatchObject({
      userId: 'api-user',
      role: 'api_key',
      authMethod: 'api_key',
    });
  });

  it('rejects write attempts made with API keys', async () => {
    const jwtService = {
      decode: jest.fn(),
      verify: jest.fn(),
    } as unknown as JwtService;
    const prisma = createPrisma();
    (prisma.apiKey.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'key-2',
      keyPrefix: 'ck_live_9876',
      revokedAt: null,
      expiresAt: null,
      user: {
        id: 'api-user',
        email: 'api@cerniq.io',
      },
    });
    const guard = new AuthGuard(jwtService, prisma);

    await expect(
      guard.canActivate(
        createContext({
          headers: { 'x-api-key': 'ck_live_secret' },
          method: 'POST',
        }).context,
      ),
    ).rejects.toThrow(new ForbiddenException('API keys are read-only'));
  });

  it('rejects token requests when org access is required and no org is available', async () => {
    process.env.KLYTICS_REQUIRE_ORG = 'true';

    const jwtService = {
      decode: jest.fn().mockReturnValue({ type: 'access' }),
      verify: jest.fn().mockReturnValue({
        sub: 'user-123',
        email: 'operator@cerniq.io',
        type: 'access',
      }),
    } as unknown as JwtService;
    const guard = new AuthGuard(jwtService, createPrisma());

    await expect(
      guard.canActivate(
        createContext({
          cookies: { access_token: 'legacy-token' },
          headers: {},
          method: 'GET',
        }).context,
      ),
    ).rejects.toThrow(
      new ForbiddenException('Org membership or entitlement check failed'),
    );
  });

  it('accepts entitled org members and carries the resolved org into the request user', async () => {
    process.env.KLYTICS_REQUIRE_ORG = 'true';
    process.env.KLYTICS_REQUIRE_ENTITLEMENT = 'true';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.KLYTICS_APP_ID = 'cerniq';

    const jwtService = {
      decode: jest.fn().mockReturnValue({ type: 'access', role: 'member' }),
      verify: jest.fn().mockReturnValue({
        sub: 'user-123',
        email: 'operator@cerniq.io',
        role: 'member',
        type: 'access',
      }),
    } as unknown as JwtService;
    const prisma = createPrisma();
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
      role: 'institution_admin',
    });
    const guard = new AuthGuard(jwtService, prisma);
    const fetchSpy = jest.spyOn(global, 'fetch');
    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ org_id: 'org-1', role: 'member' }],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ app_id: 'cerniq' }],
      } as Response);

    const { context, request } = createContext({
      cookies: { access_token: 'legacy-token' },
      headers: { 'x-organization-id': 'org-1' },
      method: 'GET',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(request.user).toMatchObject({
      orgId: 'org-1',
      role: 'institution_admin',
    });
  });

  it('falls back to the token role when the database role lookup fails', async () => {
    const jwtService = {
      decode: jest.fn().mockReturnValue({ type: 'access', role: 'manager' }),
      verify: jest.fn().mockReturnValue({
        sub: 'user-123',
        email: 'operator@cerniq.io',
        role: 'manager',
        type: 'access',
      }),
    } as unknown as JwtService;
    const prisma = createPrisma();
    (prisma.user.findUnique as jest.Mock).mockRejectedValueOnce(
      new Error('db offline'),
    );
    const guard = new AuthGuard(jwtService, prisma);
    const { context, request } = createContext({
      cookies: { access_token: 'legacy-token' },
      headers: {},
      method: 'GET',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject({
      role: 'manager',
    });
  });
});
