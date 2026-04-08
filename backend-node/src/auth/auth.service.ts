import {
  Injectable,
  Logger,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { apiKeyPrefix, generateApiKeyToken, hashApiKey } from './api-key.util';
import {
  MASTER_ACCOUNT_EMAIL,
  PlatformAccessService,
} from './platform-access.service';

const BCRYPT_SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '24h';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const MASTER_ACCOUNT_NAME = 'Erwin Kiess';
const DEV_MASTER_ACCOUNT_PASSWORD = 'ErwinKiess!CERNIQ2026';

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name?: string;
  };
}

interface OAuthUserProfile {
  email: string;
  name: string;
  provider: string;
  providerId: string;
  avatarUrl?: string;
}

type ResolvedApplicationUser = {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  provider?: string | null;
  providerId?: string | null;
  emailVerified?: boolean;
  role?: string | null;
  passwordHash?: string | null;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private platformAccess: PlatformAccessService,
  ) {}

  async register(dto: {
    email: string;
    password: string;
    name?: string;
  }): Promise<{
    user: AuthResponse['user'];
    accessToken: string;
    refreshToken: string;
  }> {
    const normalizedEmail = this.normalizeEmail(dto.email) || dto.email;

    if (this.platformAccess.isMasterAccountEmail(normalizedEmail)) {
      await this.ensureMasterAccountProvisioned();
      throw new ConflictException('Email already registered');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      this.logger.warn({ event: 'register_conflict', email: dto.email });
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        name: dto.name,
        passwordHash,
        provider: 'email',
        emailVerified: false,
      },
    });

    this.logger.log({
      event: 'user_registered',
      userId: user.id,
      email: normalizedEmail,
      provider: 'email',
    });

    // Auto-create a default workspace for the new user
    await this.prisma.workspace.create({
      data: {
        name: `${dto.name || dto.email.split('@')[0]}'s Workspace`,
        ownerId: user.id,
      },
    });

    return this.generateTokens(user);
  }

  async login(dto: { email: string; password: string }): Promise<{
    user: AuthResponse['user'];
    accessToken: string;
    refreshToken: string;
  }> {
    const normalizedEmail = this.normalizeEmail(dto.email) || dto.email;

    if (this.platformAccess.isMasterAccountEmail(normalizedEmail)) {
      await this.ensureMasterAccountProvisioned();
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      this.logger.warn({
        event: 'login_failed',
        email: normalizedEmail,
        reason: 'not_found',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.passwordHash) {
      this.logger.warn({
        event: 'login_failed',
        email: normalizedEmail,
        reason: 'no_password_hash',
        provider: user.provider,
      });
      throw new UnauthorizedException(
        this.buildNoPasswordLoginMessage(user.provider),
      );
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      this.logger.warn({
        event: 'login_failed',
        email: normalizedEmail,
        reason: 'bad_password',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update lastLoginAt timestamp
    await this.prisma.user
      .update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      })
      .catch(() => {
        /* best-effort */
      });

    this.logger.log({
      event: 'user_login',
      userId: user.id,
      email: normalizedEmail,
      provider: 'email',
    });
    return this.generateTokens(user);
  }

  private buildNoPasswordLoginMessage(provider?: string | null): string {
    switch ((provider || '').trim().toLowerCase()) {
      case 'google':
        return 'This account was created with Google sign-in. Use Google, or reset your password to create an email-password login.';
      case 'github':
        return 'This account was created with GitHub sign-in. Use GitHub, or reset your password to create an email-password login.';
      case 'magic_link':
        return 'This account uses secure email links and does not have a password yet. Use "Forgot password" to create one.';
      default:
        return 'This account does not have a password yet. Use "Forgot password" to create one.';
    }
  }

  async validateOAuthUser(profile: OAuthUserProfile) {
    let user = await this.prisma.user.findFirst({
      where: {
        provider: profile.provider,
        providerId: profile.providerId,
      },
    });

    if (!user) {
      // Check if email already exists (different provider)
      const existingByEmail = await this.prisma.user.findUnique({
        where: { email: profile.email },
      });

      if (existingByEmail) {
        // Link the OAuth provider to existing email account
        user = await this.prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            provider: profile.provider,
            providerId: profile.providerId,
            avatarUrl: profile.avatarUrl || existingByEmail.avatarUrl,
            emailVerified: true,
          },
        });
      } else {
        user = await this.prisma.user.create({
          data: {
            email: profile.email,
            name: profile.name,
            provider: profile.provider,
            providerId: profile.providerId,
            avatarUrl: profile.avatarUrl,
            emailVerified: true,
          },
        });

        // Auto-create workspace for OAuth users
        await this.prisma.workspace.create({
          data: {
            name: `${profile.name || profile.email.split('@')[0]}'s Workspace`,
            ownerId: user.id,
          },
        });
      }
    }

    // Update lastLoginAt timestamp for OAuth login
    await this.prisma.user
      .update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      })
      .catch(() => {
        /* best-effort */
      });

    this.logger.log({
      event: 'oauth_login',
      userId: user.id,
      provider: profile.provider,
    });
    return user;
  }

  async resolveApplicationUser(params: {
    authUserId: string;
    email?: string | null;
    name?: string | null;
    avatarUrl?: string | null;
    provider?: string | null;
    providerId?: string | null;
    emailVerified?: boolean;
  }): Promise<ResolvedApplicationUser> {
    const {
      authUserId,
      email,
      name,
      avatarUrl,
      provider,
      providerId,
      emailVerified = true,
    } = params;

    const normalizedEmail = this.normalizeEmail(email);

    if (this.platformAccess.isMasterAccountEmail(normalizedEmail)) {
      return this.ensureMasterAccountProvisioned({
        authUserId,
        provider,
        providerId,
      });
    }

    let user = await this.prisma.user.findUnique({
      where: { id: authUserId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        provider: true,
        providerId: true,
        emailVerified: true,
        role: true,
        passwordHash: true,
      },
    });

    if (!user && normalizedEmail) {
      user = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          provider: true,
          providerId: true,
          emailVerified: true,
          role: true,
          passwordHash: true,
        },
      });
    }

    if (!user) {
      if (!normalizedEmail) {
        throw new UnauthorizedException('Authenticated user email is required');
      }

      user = await this.prisma.user.create({
        data: {
          id: authUserId,
          email: normalizedEmail,
          name: name || null,
          avatarUrl: avatarUrl || null,
          provider: provider || 'supabase',
          providerId: providerId || authUserId,
          emailVerified,
        },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          provider: true,
          providerId: true,
          emailVerified: true,
          role: true,
          passwordHash: true,
        },
      });

      this.logger.log({
        event: 'auth_user_provisioned',
        userId: user.id,
        email: user.email,
        provider: user.provider,
      });
    } else {
      const updates: Record<string, unknown> = {};

      if (normalizedEmail && user.email !== normalizedEmail) {
        const existingByEmail = await this.prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: { id: true },
        });
        if (!existingByEmail || existingByEmail.id === user.id) {
          updates.email = normalizedEmail;
        }
      }

      if (name && !user.name) {
        updates.name = name;
      }
      if (avatarUrl && !user.avatarUrl) {
        updates.avatarUrl = avatarUrl;
      }
      if (provider && !user.provider) {
        updates.provider = provider;
      }
      if (providerId && !user.providerId) {
        updates.providerId = providerId;
      }
      if (emailVerified && !user.emailVerified) {
        updates.emailVerified = true;
      }

      if (Object.keys(updates).length > 0) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: updates,
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            provider: true,
            providerId: true,
            emailVerified: true,
            role: true,
            passwordHash: true,
          },
        });
      }
    }

    await this.ensureDefaultWorkspace(user.id, user.name, user.email);

    return user;
  }

  async generateTokens(user: {
    id: string;
    email: string;
    name?: string | null;
  }) {
    const accessPayload = {
      sub: user.id,
      email: user.email,
      type: 'access',
    };
    const refreshPayload = {
      sub: user.id,
      email: user.email,
      type: 'refresh',
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });

    const refreshTokenValue = this.jwtService.sign(refreshPayload, {
      expiresIn: `${REFRESH_TOKEN_EXPIRY_DAYS}d`,
    });

    // Store refresh token in DB for revocation
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: crypto
          .createHash('sha256')
          .update(refreshTokenValue)
          .digest('hex'),
        expiresAt,
      },
    });

    // Enforce concurrent session limit — evict oldest sessions beyond cap
    const MAX_SESSIONS = 5;
    const activeSessions = await this.prisma.refreshToken.findMany({
      where: {
        userId: user.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (activeSessions.length > MAX_SESSIONS) {
      const toRevoke = activeSessions.slice(
        0,
        activeSessions.length - MAX_SESSIONS,
      );
      await this.prisma.refreshToken.updateMany({
        where: { id: { in: toRevoke.map((s: { id: string }) => s.id) } },
        data: { revokedAt: new Date() },
      });
    }

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || undefined,
      },
    };
  }

  async refreshTokens(refreshToken: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: tokenHash },
    });

    if (!storedToken || storedToken.revokedAt) {
      this.logger.warn({
        event: 'token_refresh_failed',
        reason: 'revoked',
        userId: payload.sub,
      });
      throw new UnauthorizedException('Refresh token revoked');
    }

    if (storedToken.expiresAt < new Date()) {
      this.logger.warn({
        event: 'token_refresh_failed',
        reason: 'expired',
        userId: payload.sub,
      });
      throw new UnauthorizedException('Refresh token expired');
    }

    // Revoke old token
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.generateTokens(user);
  }

  async logout(refreshToken: string) {
    if (!refreshToken) return;
    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');
    try {
      await this.prisma.refreshToken.updateMany({
        where: { token: tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      // Token may not exist in DB — that's fine
    }
  }

  async revokeAllUserTokens(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getUserProfile(userId: string, email?: string | null) {
    let user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscription: {
          select: {
            tier: true,
            status: true,
          },
        },
        organizationMembers: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    if (!user && email) {
      const resolvedUser = await this.resolveApplicationUser({
        authUserId: userId,
        email,
      });
      user = await this.prisma.user.findUnique({
        where: { id: resolvedUser.id },
        include: {
          subscription: {
            select: {
              tier: true,
              status: true,
            },
          },
          organizationMembers: {
            include: {
              organization: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      });
    }

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const access = this.platformAccess.evaluateAccess(
      email || user.email,
      user.subscription,
    );

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      provider: user.provider,
      emailVerified: user.emailVerified,
      organizations: user.organizationMembers.map((m: any) => ({
        ...m.organization,
        role: m.role,
      })),
      access,
    };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.passwordHash) {
      throw new BadRequestException(
        'Cannot change password for OAuth accounts',
      );
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      this.logger.warn({
        event: 'password_change_failed',
        userId,
        reason: 'bad_current_password',
      });
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    // Revoke all refresh tokens on password change
    await this.revokeAllUserTokens(userId);

    this.logger.log({ event: 'password_changed', userId });
    return { message: 'Password changed successfully' };
  }

  async requestPasswordReset(email: string) {
    const successMsg = 'If that email exists, a reset link has been sent';
    const normalizedEmail = this.normalizeEmail(email) || email;

    if (this.platformAccess.isMasterAccountEmail(normalizedEmail)) {
      await this.ensureMasterAccountProvisioned();
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    // Always return success to prevent email enumeration
    if (!user) {
      return { message: successMsg };
    }

    // Invalidate any existing reset tokens for this user
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Generate a cryptographically random token (plaintext goes in email)
    const plainToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(plainToken)
      .digest('hex');

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    // Send reset email via Resend (fire-and-forget)
    this.sendPasswordResetEmail(user.email, user.name || '', plainToken).catch(
      () => {},
    );

    this.logger.log({ event: 'password_reset_requested', userId: user.id });
    return { message: successMsg };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const resetRecord = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (
      !resetRecord ||
      resetRecord.usedAt ||
      resetRecord.expiresAt < new Date()
    ) {
      throw new BadRequestException(
        'Reset link is invalid or has expired. Please request a new one.',
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      }),
      // Revoke all refresh tokens on password reset
      this.prisma.refreshToken.updateMany({
        where: { userId: resetRecord.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    this.logger.log({
      event: 'password_reset_completed',
      userId: resetRecord.userId,
    });
    return {
      message:
        'Password has been reset successfully. Please log in with your new password.',
    };
  }

  private async sendPasswordResetEmail(
    email: string,
    name: string,
    token: string,
  ): Promise<void> {
    const frontendUrl = (process.env.FRONTEND_URL || 'https://cerniq.io')
      .trim()
      .replace(/\/+$/, '');
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    try {
      const { Resend } = require('resend');
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        this.logger.warn(
          'RESEND_API_KEY not set — password reset email not sent',
        );
        return;
      }
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from: 'CERNIQ <onboarding@resend.dev>',
        replyTo: process.env.ERWIN_EMAIL || 'eskiessalfonso@gmail.com',
        to: email,
        subject: 'Restablecer contraseña — CERNIQ / Reset your password',
        html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#F8FAFC;font-family:Georgia,serif;">
          <div style="max-width:580px;margin:0 auto;">
            <div style="background:#1B3A6B;padding:24px 32px;border-radius:8px 8px 0 0;">
              <span style="color:#FFF;font-size:22px;font-weight:bold;">CERNIQ</span>
            </div>
            <div style="background:#FFF;padding:32px;border:1px solid #E2E8F0;border-top:none;line-height:1.7;color:#1E293B;font-size:15px;">
              <p>Hola ${name || ''},</p>
              <p>Recibimos una solicitud para restablecer su contraseña de CERNIQ. Haga clic en el botón de abajo para crear una nueva contraseña. Este enlace es válido por <strong>1 hora</strong>.</p>
              <div style="margin:28px 0;text-align:center;">
                <a href="${resetUrl}" style="background:#E8A020;color:#FFF;padding:16px 36px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block;">Restablecer contraseña / Reset password</a>
              </div>
              <p style="color:#64748B;font-size:13px;">Si usted no solicitó este cambio, puede ignorar este correo. Su contraseña actual no será modificada.</p>
              <hr style="border:none;border-top:2px solid #E2E8F0;margin:32px 0;">
              <p>Hi ${name || ''},</p>
              <p>We received a request to reset your CERNIQ password. Click the button above to create a new password. This link is valid for <strong>1 hour</strong>.</p>
              <p style="color:#64748B;font-size:13px;">If you didn't request this change, you can safely ignore this email. Your current password will not be modified.</p>
            </div>
            <div style="background:#F1F5F9;padding:16px 32px;border-radius:0 0 8px 8px;border:1px solid #E2E8F0;border-top:none;">
              <p style="margin:0;font-size:11px;color:#64748B;">CERNIQ &middot; KLYTICS LLC &middot; San Juan, Puerto Rico</p>
            </div>
          </div>
        </body></html>`,
      });
      this.logger.log({ event: 'password_reset_email_sent', email });
    } catch (err) {
      this.logger.error(`Failed to send password reset email: ${err}`);
    }
  }

  async getUserOrgs(
    userId: string,
  ): Promise<Array<{ org_id: string; role: string; apps: string[] }>> {
    const supabaseUrl = (process.env.SUPABASE_URL || '')
      .trim()
      .replace(/\/$/, '');
    const serviceRole = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!supabaseUrl || !serviceRole || !userId) {
      return [];
    }

    const headers = {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
    };

    try {
      const membershipsRes = await fetch(
        `${supabaseUrl}/rest/v1/memberships?select=org_id,role&user_id=eq.${encodeURIComponent(userId)}`,
        { headers },
      );
      if (!membershipsRes.ok) {
        return [];
      }
      const memberships = (await membershipsRes.json()) as Array<{
        org_id: string;
        role: string;
      }>;
      const out: Array<{ org_id: string; role: string; apps: string[] }> = [];

      for (const membership of memberships || []) {
        if (!membership?.org_id) {
          continue;
        }

        const appsRes = await fetch(
          `${supabaseUrl}/rest/v1/org_apps?select=app_id&org_id=eq.${encodeURIComponent(membership.org_id)}&enabled=is.true`,
          { headers },
        );
        const appsJson = appsRes.ok
          ? ((await appsRes.json()) as Array<{ app_id?: string }>)
          : [];
        out.push({
          org_id: membership.org_id,
          role: membership.role || 'viewer',
          apps: (appsJson || [])
            .map((a) => a.app_id)
            .filter((v): v is string => !!v),
        });
      }

      return out;
    } catch {
      return [];
    }
  }

  async listApiKeys(userId: string) {
    return this.prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
        expiresAt: true,
      },
      take: 100,
    });
  }

  async createApiKey(userId: string, name: string, expiresInDays?: number) {
    const normalizedName = (name || '').trim();
    if (!normalizedName) {
      throw new BadRequestException('API key name is required');
    }

    const token = generateApiKeyToken();
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const created = await this.prisma.apiKey.create({
      data: {
        userId,
        name: normalizedName,
        keyPrefix: apiKeyPrefix(token),
        keyHash: hashApiKey(token),
        expiresAt,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
        expiresAt: true,
      },
    });

    return {
      apiKey: token,
      record: created,
    };
  }

  async revokeApiKey(userId: string, keyId: string) {
    const revoked = await this.prisma.apiKey.updateMany({
      where: {
        id: keyId,
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    if (revoked.count === 0) {
      throw new BadRequestException('API key not found or already revoked');
    }

    return { revoked: true };
  }

  private normalizeEmail(email?: string | null) {
    return (email || '').trim().toLowerCase() || null;
  }

  private async ensureMasterAccountProvisioned(params?: {
    authUserId?: string | null;
    provider?: string | null;
    providerId?: string | null;
  }): Promise<ResolvedApplicationUser> {
    const password = this.getConfiguredMasterAccountPassword();
    const existing = await this.prisma.user.findUnique({
      where: { email: MASTER_ACCOUNT_EMAIL },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        provider: true,
        providerId: true,
        emailVerified: true,
        role: true,
        passwordHash: true,
      },
    });

    const passwordHash = await this.resolveMasterPasswordHash(
      password,
      existing?.passwordHash,
    );
    const effectiveProvider = (params?.provider || '').trim() || 'email';
    const effectiveProviderId =
      (params?.providerId || '').trim() ||
      (params?.authUserId || '').trim() ||
      null;

    let user = existing;

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          id: params?.authUserId || crypto.randomUUID(),
          email: MASTER_ACCOUNT_EMAIL,
          name: MASTER_ACCOUNT_NAME,
          passwordHash,
          provider: effectiveProvider,
          providerId: effectiveProviderId,
          emailVerified: true,
          role: 'OWNER',
        },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          provider: true,
          providerId: true,
          emailVerified: true,
          role: true,
          passwordHash: true,
        },
      });
    } else {
      const data: Record<string, unknown> = {};

      if (user.name !== MASTER_ACCOUNT_NAME) {
        data.name = MASTER_ACCOUNT_NAME;
      }
      if (user.role !== 'OWNER') {
        data.role = 'OWNER';
      }
      if (!user.emailVerified) {
        data.emailVerified = true;
      }
      if (passwordHash && passwordHash !== user.passwordHash) {
        data.passwordHash = passwordHash;
      }

      if (Object.keys(data).length > 0) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data,
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            provider: true,
            providerId: true,
            emailVerified: true,
            role: true,
            passwordHash: true,
          },
        });
      }
    }

    await this.ensureDefaultWorkspace(user.id, MASTER_ACCOUNT_NAME, user.email);
    return user;
  }

  private getConfiguredMasterAccountPassword() {
    const configured = (process.env.MASTER_ACCOUNT_PASSWORD || '').trim();
    if (configured) {
      return configured;
    }

    if ((process.env.NODE_ENV || '').trim().toLowerCase() !== 'production') {
      return DEV_MASTER_ACCOUNT_PASSWORD;
    }

    return null;
  }

  private async resolveMasterPasswordHash(
    password?: string | null,
    currentHash?: string | null,
  ) {
    if (!password) {
      return currentHash || null;
    }

    if (currentHash) {
      const matches = await bcrypt
        .compare(password, currentHash)
        .catch(() => false);
      if (matches) {
        return currentHash;
      }
    }

    return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  }

  private async ensureDefaultWorkspace(
    userId: string,
    name?: string | null,
    email?: string | null,
  ) {
    const existingWorkspace = await this.prisma.workspace.findFirst({
      where: { ownerId: userId },
      select: { id: true },
    });

    if (existingWorkspace) {
      return;
    }

    const workspaceLabel =
      (name || this.normalizeEmail(email)?.split('@')[0] || 'CERNIQ') +
      "'s Workspace";

    await this.prisma.workspace.create({
      data: {
        name: workspaceLabel,
        ownerId: userId,
      },
    });
  }
}
