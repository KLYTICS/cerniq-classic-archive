import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { hashApiKey, isReadOnlyMethod } from './api-key.util';

// Re-export for backward compatibility
export { ROLES_KEY, Roles } from './roles.decorator';
export { RolesGuard } from './roles.guard';

type AuthenticatedRequestUser = {
  userId: string;
  email?: string;
  role?: string;
  claims: Record<string, any>;
  orgId?: string | null;
  authMethod?: 'token' | 'api_key';
};

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    let user: AuthenticatedRequestUser | null = null;

    if (token) {
      const claims = this.decodeClaims(token);
      const preferLegacy = this.shouldPreferLegacyToken(claims);

      if (preferLegacy) {
        user = this.verifyLegacyToken(token);
      }

      if (!user) {
        user = await this.verifySupabaseToken(token);
      }

      if (!user && (preferLegacy || this.allowLegacy())) {
        user = this.verifyLegacyToken(token);
      }
    } else {
      const apiKey = this.extractApiKey(request);
      if (apiKey) {
        user = await this.verifyApiKey(apiKey);
      }
    }

    if (!user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (user.authMethod === 'api_key' && !isReadOnlyMethod(request.method)) {
      throw new ForbiddenException('API keys are read-only');
    }

    let orgId = user.orgId || null;
    if (user.authMethod !== 'api_key') {
      const orgHeader =
        this.getHeader(request, 'x-organization-id') ||
        this.getHeader(request, 'x-klytics-org-id');
      orgId = orgId || orgHeader || null;
      const orgAllowed = await this.enforceOrgAccess(user.userId, orgId);
      if (!orgAllowed) {
        throw new ForbiddenException(
          'Org membership or entitlement check failed',
        );
      }
    }

    // Resolve the user's InstitutionRole from the database for RBAC enforcement.
    // The JWT may not carry the InstitutionRole, so we fetch it from the DB.
    let resolvedRole = user.role;
    if (user.authMethod === 'api_key') {
      resolvedRole = 'api_key';
    } else if (user.userId) {
      try {
        const dbUser = await this.prisma.user.findUnique({
          where: { id: user.userId },
          select: { role: true },
        });
        if (dbUser?.role) {
          resolvedRole = dbUser.role;
        }
      } catch (dbError) {
        // Fall back to token-based role on DB error — but log it
        this.logger.warn(`DB role lookup failed for user ${user.userId}, using token role`, dbError);
      }
    }

    request.user = {
      ...user,
      orgId,
      role: resolvedRole || 'authenticated',
    };
    return true;
  }

  private extractToken(request: any): string | null {
    // Try HttpOnly cookie first
    if (request.cookies?.access_token) {
      return request.cookies.access_token;
    }
    // Fall back to Authorization header
    const authHeader = request.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return null;
  }

  private extractApiKey(request: any): string | null {
    const key = this.getHeader(request, 'x-api-key');
    if (!key) return null;
    return key.trim() || null;
  }

  private getHeader(request: any, name: string): string | null {
    const value = request?.headers?.[name];
    if (!value) return null;
    if (Array.isArray(value)) return value[0] || null;
    return String(value);
  }

  private allowLegacy(): boolean {
    const raw = (process.env.AUTH_ALLOW_LEGACY || '').trim().toLowerCase();
    return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
  }

  private shouldPreferLegacyToken(claims: Record<string, any>): boolean {
    const tokenType = claims?.type;
    return tokenType === 'access' || tokenType === 'refresh';
  }

  private decodeClaims(token: string): Record<string, any> {
    const claims = this.jwtService.decode(token);
    if (!claims || typeof claims !== 'object') {
      return {};
    }
    return claims as Record<string, any>;
  }

  private verifyLegacyToken(token: string): AuthenticatedRequestUser | null {
    try {
      const payload = this.jwtService.verify(token);
      return {
        userId: payload.sub,
        email: payload.email,
        role: payload.role || 'authenticated',
        claims: payload,
        orgId: payload.org_id || payload.tenant_id || null,
        authMethod: 'token',
      };
    } catch {
      return null;
    }
  }

  private async verifySupabaseToken(
    token: string,
  ): Promise<AuthenticatedRequestUser | null> {
    const supabaseUrl = (process.env.SUPABASE_URL || '')
      .trim()
      .replace(/\/$/, '');
    const anonKey =
      (process.env.SUPABASE_ANON_KEY || '').trim() ||
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

    if (!supabaseUrl || !anonKey) {
      return null;
    }

    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        return null;
      }
      const user = (await response.json()) as { id?: string; email?: string };
      if (!user?.id) {
        return null;
      }
      const claims = this.decodeClaims(token);
      return {
        userId: user.id,
        email: user.email || claims.email,
        role:
          claims.role ||
          (Array.isArray(claims.roles) ? claims.roles[0] : 'authenticated'),
        claims,
        orgId: claims.org_id || claims.tenant_id || null,
        authMethod: 'token',
      };
    } catch {
      return null;
    }
  }

  private async verifyApiKey(
    apiKey: string,
  ): Promise<AuthenticatedRequestUser | null> {
    const keyHash = hashApiKey(apiKey);
    const key = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!key || !key.user) {
      return null;
    }
    if (key.revokedAt) {
      return null;
    }
    if (key.expiresAt && key.expiresAt < new Date()) {
      return null;
    }

    try {
      await this.prisma.apiKey.update({
        where: { id: key.id },
        data: { lastUsedAt: new Date() },
      });
    } catch {
      // Best-effort usage timestamp update.
    }

    return {
      userId: key.user.id,
      email: key.user.email,
      role: 'api_key',
      claims: {
        auth_method: 'api_key',
        api_key_id: key.id,
        api_key_prefix: key.keyPrefix,
      },
      orgId: null,
      authMethod: 'api_key',
    };
  }

  private async enforceOrgAccess(
    userId: string,
    orgId: string | null,
  ): Promise<boolean> {
    const requireOrg =
      (process.env.KLYTICS_REQUIRE_ORG || '').toLowerCase() === 'true';
    const requireEntitlement =
      (process.env.KLYTICS_REQUIRE_ENTITLEMENT || '').toLowerCase() === 'true';
    if (!requireOrg && !requireEntitlement) {
      return true;
    }
    if (requireOrg && !orgId) {
      return false;
    }
    if (!orgId) {
      return true;
    }

    const supabaseUrl = (process.env.SUPABASE_URL || '')
      .trim()
      .replace(/\/$/, '');
    const serviceRole = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!supabaseUrl || !serviceRole) {
      return false;
    }

    const headers = {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
    };

    try {
      const membershipsRes = await fetch(
        `${supabaseUrl}/rest/v1/memberships?select=org_id,role&org_id=eq.${encodeURIComponent(orgId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
        { headers },
      );
      if (!membershipsRes.ok) {
        return false;
      }
      const memberships = (await membershipsRes.json()) as any[];
      if (!memberships?.length) {
        return false;
      }

      if (requireEntitlement) {
        const appId = (process.env.KLYTICS_APP_ID || 'cerniq').trim();
        const entitlementRes = await fetch(
          `${supabaseUrl}/rest/v1/org_apps?select=app_id&org_id=eq.${encodeURIComponent(orgId)}&app_id=eq.${encodeURIComponent(appId)}&enabled=is.true&limit=1`,
          { headers },
        );
        if (!entitlementRes.ok) {
          return false;
        }
        const entitlements = (await entitlementRes.json()) as any[];
        if (!entitlements?.length) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }
}
