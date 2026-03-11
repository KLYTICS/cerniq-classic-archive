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

const BCRYPT_SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '24h';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

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

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: { email: string; password: string; name?: string }): Promise<{
    user: AuthResponse['user'];
    accessToken: string;
    refreshToken: string;
  }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      this.logger.warn({ event: 'register_conflict', email: dto.email });
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash,
        provider: 'email',
        emailVerified: false,
      },
    });

    this.logger.log({ event: 'user_registered', userId: user.id, email: dto.email, provider: 'email' });

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
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.passwordHash) {
      this.logger.warn({ event: 'login_failed', email: dto.email, reason: 'not_found' });
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      this.logger.warn({ event: 'login_failed', email: dto.email, reason: 'bad_password' });
      throw new UnauthorizedException('Invalid credentials');
    }

    this.logger.log({ event: 'user_login', userId: user.id, email: dto.email, provider: 'email' });
    return this.generateTokens(user);
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

    this.logger.log({ event: 'oauth_login', userId: user.id, provider: profile.provider });
    return user;
  }

  async generateTokens(user: { id: string; email: string; name?: string | null }) {
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
        token: crypto.createHash('sha256').update(refreshTokenValue).digest('hex'),
        expiresAt,
      },
    });

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

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: tokenHash },
    });

    if (!storedToken || storedToken.revokedAt) {
      this.logger.warn({ event: 'token_refresh_failed', reason: 'revoked', userId: payload.sub });
      throw new UnauthorizedException('Refresh token revoked');
    }

    if (storedToken.expiresAt < new Date()) {
      this.logger.warn({ event: 'token_refresh_failed', reason: 'expired', userId: payload.sub });
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
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
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

  async getUserProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
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

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      provider: user.provider,
      emailVerified: user.emailVerified,
      organizations: user.organizationMembers.map((m) => ({
        ...m.organization,
        role: m.role,
      })),
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.passwordHash) {
      throw new BadRequestException('Cannot change password for OAuth accounts');
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      this.logger.warn({ event: 'password_change_failed', userId, reason: 'bad_current_password' });
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
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always return success to prevent email enumeration
    if (!user) {
      return { message: 'If that email exists, a reset link has been sent' };
    }

    // In production: generate a time-limited token and send email
    // For now, log the reset request (token NOT logged — security)
    const resetToken = crypto.randomBytes(32).toString('hex');
    this.logger.log({ event: 'password_reset_requested', email });

    return { message: 'If that email exists, a reset link has been sent' };
  }

  async resetPassword(token: string, newPassword: string) {
    // In production: validate the reset token from DB/cache
    // For now, this is a placeholder
    throw new BadRequestException('Password reset via email not yet configured. Contact support.');
  }

  async getUserOrgs(userId: string): Promise<Array<{ org_id: string; role: string; apps: string[] }>> {
    const supabaseUrl = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
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
      const memberships = (await membershipsRes.json()) as Array<{ org_id: string; role: string }>;
      const out: Array<{ org_id: string; role: string; apps: string[] }> = [];

      for (const membership of memberships || []) {
        if (!membership?.org_id) {
          continue;
        }

        const appsRes = await fetch(
          `${supabaseUrl}/rest/v1/org_apps?select=app_id&org_id=eq.${encodeURIComponent(membership.org_id)}&enabled=is.true`,
          { headers },
        );
        const appsJson = appsRes.ok ? ((await appsRes.json()) as Array<{ app_id?: string }>) : [];
        out.push({
          org_id: membership.org_id,
          role: membership.role || 'viewer',
          apps: (appsJson || []).map((a) => a.app_id).filter((v): v is string => !!v),
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
}
