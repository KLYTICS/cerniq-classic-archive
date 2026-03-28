import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuditService } from '../audit/audit.service';
import { AuthGuard } from './auth.guard';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: Record<string, jest.Mock>;
  let auditService: { log: jest.Mock };

  const mockRes = () => ({
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  });

  beforeEach(async () => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      refreshTokens: jest.fn(),
      logout: jest.fn(),
      getUserProfile: jest.fn(),
      changePassword: jest.fn(),
      listApiKeys: jest.fn(),
      createApiKey: jest.fn(),
      revokeApiKey: jest.fn(),
      requestPasswordReset: jest.fn(),
      confirmPasswordReset: jest.fn(),
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

  describe('POST /api/auth/register', () => {
    it('should register a user and set auth cookies', async () => {
      const dto = { email: 'new@test.com', password: 'Secure123!', name: 'Test' };
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
        controller.register({ email: 'dup@test.com', password: 'x' } as any, res),
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
      const result = await controller.createApiKey(
        req,
        { name: 'production' } as any,
      );

      expect(authService.createApiKey).toHaveBeenCalledWith(
        'u7',
        'production',
        undefined,
      );
      expect(result).toEqual(newKey);
    });

    it('should revoke an API key', async () => {
      authService.revokeApiKey.mockResolvedValue({ message: 'Key revoked' });

      const req = { user: { userId: 'u8' } };
      const result = await controller.revokeApiKey(req, 'k3');

      expect(authService.revokeApiKey).toHaveBeenCalledWith('u8', 'k3');
    });
  });
});
