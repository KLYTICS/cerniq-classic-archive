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
});
