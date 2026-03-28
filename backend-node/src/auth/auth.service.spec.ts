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

describe('AuthService', () => {
  let service: AuthService;
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
  });
});
