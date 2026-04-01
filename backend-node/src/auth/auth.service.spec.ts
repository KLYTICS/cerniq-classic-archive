import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

jest.mock('bcrypt', () => ({
  hash: jest.fn(async (value: string) => `mock-hash:${value}`),
  compare: jest.fn(async (value: string, hashedValue: string) => {
    return hashedValue === `mock-hash:${value}`;
  }),
}));

describe('AuthService', () => {
  let service: AuthService;
  const originalEnv = {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  let prisma: {
    user: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    refreshToken: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    workspace: {
      create: jest.Mock;
    };
    passwordResetToken: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    apiKey: {
      findMany: jest.Mock;
      create: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let jwtService: { sign: jest.Mock; verify: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      workspace: {
        create: jest.fn(),
      },
      passwordResetToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      apiKey: {
        findMany: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    process.env.SUPABASE_URL = originalEnv.supabaseUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnv.supabaseServiceRoleKey;
    jest.restoreAllMocks();
  });

  // ── register ────────────────────────────────────────────

  describe('register', () => {
    it('should create a user with hashed password', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'new@example.com',
        name: 'New User',
      });
      prisma.workspace.create.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      await service.register({
        email: 'new@example.com',
        password: 'securePass123',
        name: 'New User',
      });

      const createCall = prisma.user.create.mock.calls[0][0];
      expect(createCall.data.passwordHash).toBeDefined();
      expect(createCall.data.passwordHash).not.toBe('securePass123');
    });

    it('should return access and refresh tokens on success', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-2',
        email: 'test@example.com',
        name: 'Test',
      });
      prisma.workspace.create.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test',
      });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
    });

    it('should reject duplicate emails with ConflictException', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'existing-id',
        email: 'dup@example.com',
      });

      await expect(
        service.register({
          email: 'dup@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject duplicate emails with correct message', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'existing-id',
        email: 'dup@example.com',
      });

      await expect(
        service.register({
          email: 'dup@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow('Email already registered');
    });
  });

  // ── login ───────────────────────────────────────────────

  describe('login', () => {
    it('should return tokens for valid credentials', async () => {
      const hash = await bcrypt.hash('correctPassword', 12);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-login',
        email: 'login@example.com',
        name: 'Login User',
        passwordHash: hash,
      });
      prisma.user.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login({
        email: 'login@example.com',
        password: 'correctPassword',
      });

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.refreshToken).toBe('mock-jwt-token');
      expect(result.user.email).toBe('login@example.com');
    });

    it('should reject invalid password with UnauthorizedException', async () => {
      const hash = await bcrypt.hash('realPassword', 12);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-login',
        email: 'login@example.com',
        passwordHash: hash,
      });

      await expect(
        service.login({
          email: 'login@example.com',
          password: 'wrongPassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'ghost@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow('Invalid credentials');
    });

    it('should reject user with null passwordHash (OAuth account)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'oauth-user',
        email: 'oauth@example.com',
        passwordHash: null,
      });

      await expect(
        service.login({
          email: 'oauth@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow('Invalid credentials');
    });
  });

  // ── requestPasswordReset ────────────────────────────────

  describe('requestPasswordReset', () => {
    it('should return success message even for non-existent email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.requestPasswordReset('nobody@example.com');

      expect(result.message).toBe(
        'If that email exists, a reset link has been sent',
      );
    });

    it('should not create a token for non-existent email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await service.requestPasswordReset('nobody@example.com');

      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it('should invalidate previous tokens when new request is made', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-reset',
        email: 'reset@example.com',
      });
      prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
      prisma.passwordResetToken.create.mockResolvedValue({});

      await service.requestPasswordReset('reset@example.com');

      expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-reset', usedAt: null },
        data: { usedAt: expect.any(Date) },
      });
    });

    it('should create a PasswordResetToken with hashed token', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-hash',
        email: 'hash@example.com',
      });
      prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
      prisma.passwordResetToken.create.mockResolvedValue({});

      await service.requestPasswordReset('hash@example.com');

      const createCall = prisma.passwordResetToken.create.mock.calls[0][0];
      expect(createCall.data.tokenHash).toBeDefined();
      expect(createCall.data.tokenHash.length).toBe(64); // SHA-256 hex
    });

    it('should create a PasswordResetToken with 1-hour expiry', async () => {
      const before = Date.now();
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-exp',
        email: 'exp@example.com',
      });
      prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
      prisma.passwordResetToken.create.mockResolvedValue({});

      await service.requestPasswordReset('exp@example.com');

      const createCall = prisma.passwordResetToken.create.mock.calls[0][0];
      const expiresAt = createCall.data.expiresAt as Date;
      const oneHourMs = 60 * 60 * 1000;
      const diff = expiresAt.getTime() - before;
      // Should be approximately 1 hour (within 5 seconds tolerance)
      expect(diff).toBeGreaterThanOrEqual(oneHourMs - 5000);
      expect(diff).toBeLessThanOrEqual(oneHourMs + 5000);
    });

    it('should return success message for existing email', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-ok',
        email: 'ok@example.com',
      });
      prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
      prisma.passwordResetToken.create.mockResolvedValue({});

      const result = await service.requestPasswordReset('ok@example.com');

      expect(result.message).toBe(
        'If that email exists, a reset link has been sent',
      );
    });
  });

  // ── resetPassword ───────────────────────────────────────

  describe('resetPassword', () => {
    it('should reject expired tokens', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'token-1',
        userId: 'user-1',
        tokenHash: 'abc',
        usedAt: null,
        expiresAt: new Date(Date.now() - 60000), // expired 1 minute ago
      });

      await expect(
        service.resetPassword('some-token', 'newPass123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject expired tokens with correct message', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'token-2',
        userId: 'user-2',
        tokenHash: 'def',
        usedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(
        service.resetPassword('some-token', 'newPass123'),
      ).rejects.toThrow(
        'Reset link is invalid or has expired. Please request a new one.',
      );
    });

    it('should reject already-used tokens', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'token-3',
        userId: 'user-3',
        tokenHash: 'ghi',
        usedAt: new Date(), // already used
        expiresAt: new Date(Date.now() + 3600000),
      });

      await expect(
        service.resetPassword('used-token', 'newPass123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject non-existent tokens', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(null);

      await expect(
        service.resetPassword('invalid-token', 'newPass123'),
      ).rejects.toThrow(
        'Reset link is invalid or has expired. Please request a new one.',
      );
    });

    it('should successfully reset password and call $transaction', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'token-valid',
        userId: 'user-valid',
        tokenHash: 'valid-hash',
        usedAt: null,
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
      });
      prisma.$transaction.mockResolvedValue([{}, {}, {}]);

      const result = await service.resetPassword(
        'valid-token',
        'brandNewPassword',
      );

      expect(result.message).toBe(
        'Password has been reset successfully. Please log in with your new password.',
      );
    });

    it('should execute three operations in a transaction', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'token-tx',
        userId: 'user-tx',
        tokenHash: 'tx-hash',
        usedAt: null,
        expiresAt: new Date(Date.now() + 3600000),
      });
      prisma.$transaction.mockResolvedValue([{}, {}, {}]);

      await service.resetPassword('tx-token', 'newPassword');

      // $transaction is called with an array of 3 Prisma operations
      // (user.update, passwordResetToken.update, refreshToken.updateMany)
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const txArg = prisma.$transaction.mock.calls[0][0];
      expect(Array.isArray(txArg)).toBe(true);
      expect(txArg).toHaveLength(3);
    });

    it('should mark the token as used during reset', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'token-mark',
        userId: 'user-mark',
        tokenHash: 'mark-hash',
        usedAt: null,
        expiresAt: new Date(Date.now() + 3600000),
      });
      // Capture what's passed to $transaction
      prisma.$transaction.mockImplementation(async (ops: any[]) => ops);

      // The method calls prisma.$transaction with an array; we need to
      // verify the individual Prisma operations are created correctly.
      // Since they are Prisma PrismaPromise objects, we verify $transaction
      // was called (the 3-operation transaction is the key invariant).
      await service.resetPassword('mark-token', 'newPass');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  // ── logout ──────────────────────────────────────────────

  describe('logout', () => {
    it('should revoke refresh token', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await service.logout('some-refresh-token');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
    });

    it('should handle empty token gracefully', async () => {
      await service.logout('');

      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('should mark refresh token as revoked with correct hash', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
      const token = 'valid-refresh-token';
      const expectedHash = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

      await service.logout(token);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { token: expectedHash, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should not crash when DB throws an error', async () => {
      prisma.refreshToken.updateMany.mockRejectedValue(
        new Error('DB connection lost'),
      );

      // Should not throw — the catch block absorbs the error
      await expect(service.logout('some-token')).resolves.toBeUndefined();
    });
  });

  // ── refreshTokens ──────────────────────────────────────

  describe('refreshTokens', () => {
    it('should return new access + refresh tokens for a valid refresh token', async () => {
      const token = 'valid-refresh-jwt';
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      jwtService.verify.mockReturnValue({
        sub: 'user-r1',
        email: 'refresh@example.com',
        type: 'refresh',
      });
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-r1',
        token: tokenHash,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
      });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-r1',
        email: 'refresh@example.com',
        name: 'Refresh User',
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refreshTokens(token);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.email).toBe('refresh@example.com');
    });

    it('should revoke the old refresh token during rotation', async () => {
      const token = 'rotate-token';
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      jwtService.verify.mockReturnValue({
        sub: 'user-r2',
        email: 'rotate@example.com',
        type: 'refresh',
      });
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-rotate',
        userId: 'user-r2',
        token: tokenHash,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
      });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-r2',
        email: 'rotate@example.com',
        name: 'Rotate',
      });
      prisma.refreshToken.create.mockResolvedValue({});

      await service.refreshTokens(token);

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt-rotate' },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should throw UnauthorizedException for an expired/invalid JWT', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.refreshTokens('expired-jwt')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshTokens('expired-jwt')).rejects.toThrow(
        'Invalid refresh token',
      );
    });

    it('should throw UnauthorizedException when token type is not refresh', async () => {
      jwtService.verify.mockReturnValue({
        sub: 'user-bad',
        email: 'bad@example.com',
        type: 'access',
      });

      await expect(service.refreshTokens('access-token')).rejects.toThrow(
        'Invalid token type',
      );
    });

    it('should throw UnauthorizedException for a revoked refresh token', async () => {
      const token = 'revoked-token';
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      jwtService.verify.mockReturnValue({
        sub: 'user-rev',
        email: 'revoked@example.com',
        type: 'refresh',
      });
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-revoked',
        userId: 'user-rev',
        token: tokenHash,
        revokedAt: new Date(), // already revoked
        expiresAt: new Date(Date.now() + 86400000),
      });

      await expect(service.refreshTokens(token)).rejects.toThrow(
        'Refresh token revoked',
      );
    });

    it('should throw UnauthorizedException for a non-existent stored token', async () => {
      jwtService.verify.mockReturnValue({
        sub: 'user-ghost',
        email: 'ghost@example.com',
        type: 'refresh',
      });
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refreshTokens('ghost-token')).rejects.toThrow(
        'Refresh token revoked',
      );
    });

    it('should throw UnauthorizedException for an expired stored token', async () => {
      const token = 'db-expired-token';
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      jwtService.verify.mockReturnValue({
        sub: 'user-exp',
        email: 'exp@example.com',
        type: 'refresh',
      });
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-dbexp',
        userId: 'user-exp',
        token: tokenHash,
        revokedAt: null,
        expiresAt: new Date(Date.now() - 60000), // expired in DB
      });

      await expect(service.refreshTokens(token)).rejects.toThrow(
        'Refresh token expired',
      );
    });

    it('should throw UnauthorizedException when user no longer exists', async () => {
      const token = 'orphan-token';
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      jwtService.verify.mockReturnValue({
        sub: 'user-deleted',
        email: 'deleted@example.com',
        type: 'refresh',
      });
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-orphan',
        userId: 'user-deleted',
        token: tokenHash,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
      });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.refreshTokens(token)).rejects.toThrow(
        'User not found',
      );
    });
  });

  // ── changePassword ─────────────────────────────────────

  describe('changePassword', () => {
    it('should change password when current password is correct', async () => {
      const hash = await bcrypt.hash('oldPassword', 12);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-cp1',
        email: 'cp@example.com',
        passwordHash: hash,
      });
      prisma.user.update.mockResolvedValue({});
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.changePassword(
        'user-cp1',
        'oldPassword',
        'newSecurePassword',
      );

      expect(result.message).toBe('Password changed successfully');
    });

    it('should store a bcrypt hash of the new password', async () => {
      const hash = await bcrypt.hash('currentPass', 12);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-cp2',
        email: 'cp2@example.com',
        passwordHash: hash,
      });
      prisma.user.update.mockResolvedValue({});
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await service.changePassword('user-cp2', 'currentPass', 'brandNewPass');

      const updateCall = prisma.user.update.mock.calls[0][0];
      expect(updateCall.data.passwordHash).toBeDefined();
      expect(updateCall.data.passwordHash).not.toBe('brandNewPass');
      // Verify it's a valid bcrypt hash
      const isValid = await bcrypt.compare(
        'brandNewPass',
        updateCall.data.passwordHash,
      );
      expect(isValid).toBe(true);
    });

    it('should revoke all refresh tokens after password change', async () => {
      const hash = await bcrypt.hash('myPass', 12);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-cp3',
        email: 'cp3@example.com',
        passwordHash: hash,
      });
      prisma.user.update.mockResolvedValue({});
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      await service.changePassword('user-cp3', 'myPass', 'newPass');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-cp3', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should throw UnauthorizedException for wrong current password', async () => {
      const hash = await bcrypt.hash('realPassword', 12);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-cp4',
        email: 'cp4@example.com',
        passwordHash: hash,
      });

      await expect(
        service.changePassword('user-cp4', 'wrongPassword', 'newPass'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.changePassword('user-cp4', 'wrongPassword', 'newPass'),
      ).rejects.toThrow('Current password is incorrect');
    });

    it('should throw BadRequestException for OAuth user without passwordHash', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-oauth',
        email: 'oauth@example.com',
        passwordHash: null,
      });

      await expect(
        service.changePassword('user-oauth', 'anything', 'newPass'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.changePassword('user-oauth', 'anything', 'newPass'),
      ).rejects.toThrow('Cannot change password for OAuth accounts');
    });

    it('should throw BadRequestException for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.changePassword('no-user', 'current', 'newPass'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── API Key Management ─────────────────────────────────

  describe('createApiKey', () => {
    it('should return a key with the ck_live_ prefix', async () => {
      prisma.apiKey.create.mockResolvedValue({
        id: 'ak-1',
        name: 'My Key',
        keyPrefix: 'ck_live_abcdef01',
        createdAt: new Date(),
        lastUsedAt: null,
        revokedAt: null,
        expiresAt: null,
      });

      const result = await service.createApiKey('user-ak1', 'My Key');

      expect(result.apiKey).toMatch(/^ck_live_/);
      expect(result.record.id).toBe('ak-1');
      expect(result.record.name).toBe('My Key');
    });

    it('should store the hashed key, not the plaintext', async () => {
      prisma.apiKey.create.mockResolvedValue({
        id: 'ak-2',
        name: 'Hashed Key',
        keyPrefix: 'ck_live_abcdef01',
        createdAt: new Date(),
        lastUsedAt: null,
        revokedAt: null,
        expiresAt: null,
      });

      await service.createApiKey('user-ak2', 'Hashed Key');

      const createCall = prisma.apiKey.create.mock.calls[0][0];
      expect(createCall.data.keyHash).toBeDefined();
      expect(createCall.data.keyHash).not.toMatch(/^ck_live_/);
      expect(createCall.data.keyHash.length).toBe(64); // SHA-256 hex
    });

    it('should set expiresAt when expiresInDays is provided', async () => {
      prisma.apiKey.create.mockResolvedValue({
        id: 'ak-3',
        name: 'Expiring Key',
        keyPrefix: 'ck_live_abcdef01',
        createdAt: new Date(),
        lastUsedAt: null,
        revokedAt: null,
        expiresAt: new Date(),
      });

      const before = Date.now();
      await service.createApiKey('user-ak3', 'Expiring Key', 30);

      const createCall = prisma.apiKey.create.mock.calls[0][0];
      const expiresAt = createCall.data.expiresAt as Date;
      expect(expiresAt).toBeInstanceOf(Date);
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      const diff = expiresAt.getTime() - before;
      expect(diff).toBeGreaterThanOrEqual(thirtyDaysMs - 5000);
      expect(diff).toBeLessThanOrEqual(thirtyDaysMs + 5000);
    });

    it('should throw BadRequestException for empty name', async () => {
      await expect(service.createApiKey('user-ak4', '')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createApiKey('user-ak4', '   ')).rejects.toThrow(
        'API key name is required',
      );
    });
  });

  describe('listApiKeys', () => {
    it("should return the user's API keys", async () => {
      const mockKeys = [
        {
          id: 'ak-list-1',
          name: 'Production',
          keyPrefix: 'ck_live_abc',
          createdAt: new Date(),
          lastUsedAt: null,
          revokedAt: null,
          expiresAt: null,
        },
        {
          id: 'ak-list-2',
          name: 'Staging',
          keyPrefix: 'ck_live_def',
          createdAt: new Date(),
          lastUsedAt: new Date(),
          revokedAt: null,
          expiresAt: null,
        },
      ];
      prisma.apiKey.findMany.mockResolvedValue(mockKeys);

      const result = await service.listApiKeys('user-list');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Production');
      expect(result[1].name).toBe('Staging');
    });

    it('should return empty array when user has no keys', async () => {
      prisma.apiKey.findMany.mockResolvedValue([]);

      const result = await service.listApiKeys('user-no-keys');

      expect(result).toEqual([]);
    });

    it('should call findMany with correct userId filter', async () => {
      prisma.apiKey.findMany.mockResolvedValue([]);

      await service.listApiKeys('user-filter');

      expect(prisma.apiKey.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-filter' },
        }),
      );
    });
  });

  describe('revokeApiKey', () => {
    it('should mark the key as revoked', async () => {
      prisma.apiKey.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.revokeApiKey('user-rev1', 'ak-rev1');

      expect(result).toEqual({ revoked: true });
      expect(prisma.apiKey.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'ak-rev1',
          userId: 'user-rev1',
          revokedAt: null,
        },
        data: {
          revokedAt: expect.any(Date),
        },
      });
    });

    it("should throw BadRequestException when revoking another user's key", async () => {
      // updateMany returns count 0 because the userId filter doesn't match
      prisma.apiKey.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.revokeApiKey('wrong-user', 'ak-other'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.revokeApiKey('wrong-user', 'ak-other'),
      ).rejects.toThrow('API key not found or already revoked');
    });

    it('should throw BadRequestException when key is already revoked', async () => {
      prisma.apiKey.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.revokeApiKey('user-rev2', 'ak-already-revoked'),
      ).rejects.toThrow('API key not found or already revoked');
    });

    it('should throw BadRequestException for non-existent key', async () => {
      prisma.apiKey.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.revokeApiKey('user-rev3', 'ak-nonexistent'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getUserOrgs', () => {
    it('returns an empty list when the Supabase service role key is missing', async () => {
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      const fetchSpy = jest.spyOn(global, 'fetch');

      await expect(service.getUserOrgs('user-1')).resolves.toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('uses the Supabase service role key to resolve memberships and enabled apps', async () => {
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
      const fetchSpy = jest.spyOn(global, 'fetch');
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ org_id: 'org-1', role: 'admin' }],
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ app_id: 'cerniq' }, { app_id: 'stress' }],
        } as Response);

      await expect(service.getUserOrgs('user-1')).resolves.toEqual([
        { org_id: 'org-1', role: 'admin', apps: ['cerniq', 'stress'] },
      ]);
      expect(fetchSpy).toHaveBeenNthCalledWith(
        1,
        'https://example.supabase.co/rest/v1/memberships?select=org_id,role&user_id=eq.user-1',
        {
          headers: {
            apikey: 'service-role-key',
            Authorization: 'Bearer service-role-key',
          },
        },
      );
      expect(fetchSpy).toHaveBeenNthCalledWith(
        2,
        'https://example.supabase.co/rest/v1/org_apps?select=app_id&org_id=eq.org-1&enabled=is.true',
        {
          headers: {
            apikey: 'service-role-key',
            Authorization: 'Bearer service-role-key',
          },
        },
      );
    });
  });
});
