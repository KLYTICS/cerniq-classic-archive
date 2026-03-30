import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuditService } from '../audit/audit.service';
import { AuthGuard } from './auth.guard';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: Record<string, jest.Mock>;
  let auditService: { log: jest.Mock };
  const originalEnv = { ...process.env };

  const mockRes = () => ({
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    redirect: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  });

  const loadIsolatedController = (env: Record<string, string | undefined>) => {
    jest.resetModules();
    process.env = { ...originalEnv };
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    const {
      AuthController: FreshAuthController,
    } = require('./auth.controller');
    const freshAuthService: Record<string, jest.Mock> = {
      register: jest.fn(),
      login: jest.fn(),
      refreshTokens: jest.fn(),
      logout: jest.fn(),
      getUserProfile: jest.fn(),
      getUserOrgs: jest.fn(),
      changePassword: jest.fn(),
      listApiKeys: jest.fn(),
      createApiKey: jest.fn(),
      revokeApiKey: jest.fn(),
      requestPasswordReset: jest.fn(),
      resetPassword: jest.fn(),
      generateTokens: jest.fn(),
    };
    const freshAuditService = { log: jest.fn() };

    return {
      controller: new FreshAuthController(
        freshAuthService as any,
        freshAuditService as any,
      ),
      authService: freshAuthService,
      auditService: freshAuditService,
      restore: () => {
        jest.resetModules();
        process.env = { ...originalEnv };
      },
    };
  };

  beforeEach(async () => {
    process.env = { ...originalEnv };
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      refreshTokens: jest.fn(),
      logout: jest.fn(),
      getUserProfile: jest.fn(),
      getUserOrgs: jest.fn(),
      changePassword: jest.fn(),
      listApiKeys: jest.fn(),
      createApiKey: jest.fn(),
      revokeApiKey: jest.fn(),
      requestPasswordReset: jest.fn(),
      resetPassword: jest.fn(),
      generateTokens: jest.fn(),
    };

    auditService = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: AuditService, useValue: auditService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('POST /api/auth/register', () => {
    it('should register a user and set auth cookies', async () => {
      const dto = {
        email: 'new@test.com',
        password: 'Secure123!',
        name: 'Test',
      };
      const result = {
        user: { id: 'u1', email: 'new@test.com', name: 'Test' },
        accessToken: 'at_123',
        refreshToken: 'rt_123',
      };
      authService.register.mockResolvedValue(result);
      const res = mockRes();

      const response = await controller.register(dto as any, res);

      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(res.cookie).toHaveBeenCalledWith(
        'access_token',
        'at_123',
        expect.any(Object),
      );
      expect(response).toEqual({ user: result.user });
    });

    it('should propagate duplicate email errors', async () => {
      authService.register.mockRejectedValue(new Error('Email already exists'));
      const res = mockRes();

      await expect(
        controller.register(
          { email: 'dup@test.com', password: 'x' } as any,
          res,
        ),
      ).rejects.toThrow('Email already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login a user, set cookies, and fire audit log', async () => {
      const dto = { email: 'user@test.com', password: 'pass' };
      const result = {
        user: { id: 'u2', email: 'user@test.com' },
        accessToken: 'at_login',
        refreshToken: 'rt_login',
      };
      authService.login.mockResolvedValue(result);
      const req = { ip: '10.0.0.1', headers: { 'user-agent': 'jest' } };
      const res = mockRes();

      const response = await controller.login(dto as any, req, res);

      expect(response).toEqual({ user: result.user });
      expect(res.cookie).toHaveBeenCalledWith(
        'access_token',
        'at_login',
        expect.any(Object),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'rt_login',
        expect.any(Object),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u2',
          action: 'login',
          resource: 'user',
          outcome: 'success',
        }),
      );
    });

    it('should propagate invalid credentials error', async () => {
      authService.login.mockRejectedValue(new Error('Invalid credentials'));
      const req = { ip: '', headers: {} };
      const res = mockRes();

      await expect(
        controller.login({ email: 'x', password: 'y' } as any, req, res),
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh tokens from body', async () => {
      const result = {
        user: { id: 'u3' },
        accessToken: 'at_new',
        refreshToken: 'rt_new',
      };
      authService.refreshTokens.mockResolvedValue(result);
      const req = { cookies: {} };
      const res = mockRes();

      const response = await controller.refresh(
        { refreshToken: 'rt_old' } as any,
        req,
        res,
      );

      expect(authService.refreshTokens).toHaveBeenCalledWith('rt_old');
      expect(response).toEqual({ user: result.user });
    });

    it('should refresh tokens from cookie when body is empty', async () => {
      const result = {
        user: { id: 'u4' },
        accessToken: 'at_cookie',
        refreshToken: 'rt_cookie',
      };
      authService.refreshTokens.mockResolvedValue(result);
      const req = { cookies: { refresh_token: 'rt_from_cookie' } };
      const res = mockRes();

      await controller.refresh({} as any, req, res);

      expect(authService.refreshTokens).toHaveBeenCalledWith('rt_from_cookie');
      expect(res.cookie).toHaveBeenCalledWith(
        'access_token',
        'at_cookie',
        expect.any(Object),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'rt_cookie',
        expect.any(Object),
      );
    });

    it('should return 401 when no refresh token provided', async () => {
      const req = { cookies: {} };
      const res = mockRes();

      await controller.refresh({} as any, req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'No refresh token provided',
      });
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout and clear cookies', async () => {
      authService.logout.mockResolvedValue(undefined);
      const req = { cookies: { refresh_token: 'rt_to_revoke' } };
      const res = mockRes();

      const response = await controller.logout(req, res);

      expect(authService.logout).toHaveBeenCalledWith('rt_to_revoke');
      expect(res.clearCookie).toHaveBeenCalledWith(
        'access_token',
        expect.any(Object),
      );
      expect(res.clearCookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.any(Object),
      );
      expect(response).toEqual({ message: 'Logged out' });
    });

    it('should logout gracefully when no cookie present', async () => {
      const req = { cookies: {} };
      const res = mockRes();

      const response = await controller.logout(req, res);

      expect(authService.logout).not.toHaveBeenCalled();
      expect(response).toEqual({ message: 'Logged out' });
    });
  });

  describe('GET /api/auth/profile', () => {
    it('should return user profile', async () => {
      const profile = { id: 'u5', email: 'user@test.com', name: 'Test' };
      authService.getUserProfile.mockResolvedValue(profile);

      const req = { user: { userId: 'u5' } };
      const result = await controller.getProfile(req);

      expect(authService.getUserProfile).toHaveBeenCalledWith('u5');
      expect(result).toEqual(profile);
    });
  });

  describe('POST /api/auth/password-reset', () => {
    it('should request password reset', async () => {
      const serviceResult = {
        message: 'If the email exists, a reset link has been sent',
      };
      authService.requestPasswordReset.mockResolvedValue(serviceResult);

      const result = await controller.requestPasswordReset({
        email: 'reset@test.com',
      } as any);

      expect(authService.requestPasswordReset).toHaveBeenCalledWith(
        'reset@test.com',
      );
      expect(result).toEqual(serviceResult);
    });

    it('should not leak whether email exists (constant response)', async () => {
      authService.requestPasswordReset.mockResolvedValue({
        message: 'If the email exists, a reset link has been sent',
      });

      const result = await controller.requestPasswordReset({
        email: 'nonexistent@test.com',
      } as any);

      // Should always return the same message regardless of email existence
      expect(result.message).toContain('If the email exists');
    });
  });

  describe('POST /api/auth/password-reset/confirm', () => {
    it('should reset password using token confirmation', async () => {
      authService.resetPassword.mockResolvedValue({
        message: 'Password reset successful',
      });

      const result = await controller.resetPassword({
        token: 'reset-token',
        newPassword: 'StrongerP@ss1',
      } as any);

      expect(authService.resetPassword).toHaveBeenCalledWith(
        'reset-token',
        'StrongerP@ss1',
      );
      expect(result).toEqual({ message: 'Password reset successful' });
    });
  });

  describe('GET /api/auth/whoami', () => {
    it('should return normalized auth context with issuer and audience checks', async () => {
      process.env.SUPABASE_JWT_ISSUER = 'https://issuer.example';
      process.env.SUPABASE_JWT_AUDIENCE = 'authenticated';
      process.env.KLYTICS_APP_ID = 'cerniq-enterprise';
      authService.getUserOrgs.mockResolvedValue([{ id: 'org-1' }]);

      const result = await controller.whoami({
        user: {
          userId: 'u9',
          email: 'desk@cerniq.io',
          claims: {
            iss: 'https://issuer.example',
            aud: ['authenticated', 'other'],
          },
        },
      });

      expect(authService.getUserOrgs).toHaveBeenCalledWith('u9');
      expect(result).toEqual({
        user_id: 'u9',
        email: 'desk@cerniq.io',
        orgs: [{ id: 'org-1' }],
        app: 'cerniq-enterprise',
        issuer_ok: true,
        aud_ok: true,
      });
    });

    it('should report issuer and audience mismatches using fallback env names', async () => {
      delete process.env.SUPABASE_JWT_ISSUER;
      delete process.env.SUPABASE_JWT_AUDIENCE;
      process.env.SUPABASE_ISSUER = 'https://issuer.example';
      process.env.SUPABASE_AUDIENCE = 'authenticated';
      delete process.env.KLYTICS_APP_ID;
      authService.getUserOrgs.mockResolvedValue([]);

      const result = await controller.whoami({
        user: {
          userId: 'u11',
          email: 'desk@cerniq.io',
          claims: {
            iss: 'https://wrong-issuer.example',
            aud: 'other-audience',
          },
        },
      });

      expect(result).toEqual({
        user_id: 'u11',
        email: 'desk@cerniq.io',
        orgs: [],
        app: 'cerniq',
        issuer_ok: false,
        aud_ok: false,
      });
    });
  });

  describe('PUT /api/auth/password', () => {
    it('should change password for the authenticated user', async () => {
      authService.changePassword.mockResolvedValue({
        message: 'Password updated',
      });

      const result = await controller.changePassword(
        { user: { userId: 'u10' } },
        {
          currentPassword: 'OldPass1!',
          newPassword: 'NewPass2!',
        } as any,
      );

      expect(authService.changePassword).toHaveBeenCalledWith(
        'u10',
        'OldPass1!',
        'NewPass2!',
      );
      expect(result).toEqual({ message: 'Password updated' });
    });
  });

  describe('API key management', () => {
    it('should list API keys for authenticated user', async () => {
      const keys = [{ id: 'k1', name: 'test-key', prefix: 'ck_live_abc' }];
      authService.listApiKeys.mockResolvedValue(keys);

      const req = { user: { userId: 'u6' } };
      const result = await controller.listApiKeys(req);

      expect(result).toEqual({ keys });
    });

    it('should create a new API key', async () => {
      const newKey = {
        id: 'k2',
        name: 'production',
        key: 'ck_live_full_key_shown_once',
      };
      authService.createApiKey.mockResolvedValue(newKey);

      const req = { user: { userId: 'u7' } };
      const result = await controller.createApiKey(req, {
        name: 'production',
      } as any);

      expect(authService.createApiKey).toHaveBeenCalledWith(
        'u7',
        'production',
        undefined,
      );
      expect(result).toEqual(newKey);
    });

    it('should pass through an explicit API key expiry', async () => {
      authService.createApiKey.mockResolvedValue({
        id: 'k9',
        name: 'expiring-key',
        key: 'ck_expiring',
      });

      await controller.createApiKey({ user: { userId: 'u7' } }, {
        name: 'expiring-key',
        expiresInDays: 30,
      } as any);

      expect(authService.createApiKey).toHaveBeenCalledWith(
        'u7',
        'expiring-key',
        30,
      );
    });

    it('should revoke an API key', async () => {
      authService.revokeApiKey.mockResolvedValue({ message: 'Key revoked' });

      const req = { user: { userId: 'u8' } };
      const result = await controller.revokeApiKey(req, 'k3');

      expect(authService.revokeApiKey).toHaveBeenCalledWith('u8', 'k3');
      expect(result).toEqual({ message: 'Key revoked' });
    });
  });

  describe('OAuth callbacks', () => {
    it('googleAuth and githubAuth should be no-op redirect starters', () => {
      expect(controller.googleAuth()).toBeUndefined();
      expect(controller.githubAuth()).toBeUndefined();
    });

    it('should set cookies and redirect after Google callback', async () => {
      authService.generateTokens.mockResolvedValue({
        accessToken: 'google-access',
        refreshToken: 'google-refresh',
      });
      const req = { user: { id: 'oauth-google' } };
      const res = { cookie: jest.fn(), redirect: jest.fn() };

      await controller.googleCallback(req, res);

      expect(authService.generateTokens).toHaveBeenCalledWith(req.user);
      expect(res.cookie).toHaveBeenCalledWith(
        'access_token',
        'google-access',
        expect.any(Object),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'google-refresh',
        expect.any(Object),
      );
      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/dashboard'),
      );
    });

    it('should set cookies and redirect after GitHub callback', async () => {
      authService.generateTokens.mockResolvedValue({
        accessToken: 'github-access',
        refreshToken: 'github-refresh',
      });
      const req = { user: { id: 'oauth-github' } };
      const res = { cookie: jest.fn(), redirect: jest.fn() };

      await controller.githubCallback(req, res);

      expect(authService.generateTokens).toHaveBeenCalledWith(req.user);
      expect(res.cookie).toHaveBeenCalledWith(
        'access_token',
        'github-access',
        expect.any(Object),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'github-refresh',
        expect.any(Object),
      );
      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/dashboard'),
      );
    });
  });

  describe('runtime auth cookie configuration', () => {
    it('applies configured secure cookie, same-site, and domain settings', async () => {
      const isolated = loadIsolatedController({
        NODE_ENV: 'production',
        AUTH_COOKIE_SAMESITE: 'strict',
        AUTH_COOKIE_SECURE: 'yes',
        AUTH_COOKIE_DOMAIN: '.cerniq.io',
        FRONTEND_URL: 'https://portal.cerniq.io/',
      });
      isolated.authService.register.mockResolvedValue({
        user: { id: 'u12' },
        accessToken: 'strict-access',
        refreshToken: 'strict-refresh',
      });
      const res = mockRes();

      await isolated.controller.register(
        { email: 'strict@cerniq.io', password: 'Password1!' } as any,
        res,
      );

      expect(res.cookie).toHaveBeenCalledWith(
        'access_token',
        'strict-access',
        expect.objectContaining({
          secure: true,
          sameSite: 'strict',
          domain: '.cerniq.io',
        }),
      );
      isolated.authService.generateTokens.mockResolvedValue({
        accessToken: 'oauth-access',
        refreshToken: 'oauth-refresh',
      });

      await isolated.controller.googleCallback({ user: { id: 'u12' } }, res);

      expect(res.redirect).toHaveBeenCalledWith(
        'https://portal.cerniq.io/dashboard',
      );
      isolated.restore();
    });

    it('falls back to lax cookies and localhost redirect in development', async () => {
      const isolated = loadIsolatedController({
        NODE_ENV: 'development',
        AUTH_COOKIE_SAMESITE: 'unexpected',
        AUTH_COOKIE_SECURE: '',
        AUTH_COOKIE_DOMAIN: '',
        FRONTEND_URL: '',
      });
      isolated.authService.generateTokens.mockResolvedValue({
        accessToken: 'dev-access',
        refreshToken: 'dev-refresh',
      });
      const res = mockRes();

      await isolated.controller.googleCallback({ user: { id: 'u13' } }, res);

      expect(res.cookie).toHaveBeenCalledWith(
        'access_token',
        'dev-access',
        expect.objectContaining({
          secure: false,
          sameSite: 'lax',
        }),
      );
      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:3001/dashboard',
      );
      isolated.restore();
    });

    it('falls back to the production marketing site when no frontend url is configured', async () => {
      const isolated = loadIsolatedController({
        NODE_ENV: 'production',
        AUTH_COOKIE_SAMESITE: undefined,
        AUTH_COOKIE_SECURE: undefined,
        AUTH_COOKIE_DOMAIN: undefined,
        FRONTEND_URL: undefined,
      });
      isolated.authService.generateTokens.mockResolvedValue({
        accessToken: 'prod-access',
        refreshToken: 'prod-refresh',
      });
      const res = mockRes();

      await isolated.controller.githubCallback({ user: { id: 'u14' } }, res);

      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'prod-refresh',
        expect.objectContaining({
          secure: true,
          sameSite: 'lax',
        }),
      );
      expect(res.redirect).toHaveBeenCalledWith('https://cerniq.io/dashboard');
      isolated.restore();
    });
  });
});
