import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { hashApiKey } from '../../auth/api-key.util';

export type ApiKeyUser = {
  userId: string;
  email: string;
  apiKeyId: string;
  keyPrefix: string;
  tier: 'standard' | 'partner';
};

/**
 * Guard for Public API v1 endpoints.
 * Reads `Authorization: Bearer <api-key>` header, hashes the key,
 * looks it up in the ApiKey table, validates it is active, and
 * updates lastUsedAt.
 *
 * Unlike the main AuthGuard, this guard:
 *  - Only supports API key auth (no JWT/cookie)
 *  - Allows POST/PUT/DELETE (the main guard restricts API keys to read-only)
 *  - Attaches a minimal `ApiKeyUser` to req.apiUser
 */
@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyAuthGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const rawToken = this.extractBearerToken(request);

    if (!rawToken) {
      throw new UnauthorizedException(
        'Missing API key. Provide Authorization: Bearer <api-key>',
      );
    }

    const keyHash = hashApiKey(rawToken);

    const key = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            subscription: { select: { tier: true } },
          },
        },
      },
    });

    if (!key || !key.user) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (key.revokedAt) {
      throw new ForbiddenException('API key has been revoked');
    }

    if (key.expiresAt && key.expiresAt < new Date()) {
      throw new ForbiddenException('API key has expired');
    }

    // Update lastUsedAt (best-effort)
    this.prisma.apiKey
      .update({
        where: { id: key.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {
        /* best-effort */
      });

    // Determine tier from subscription
    const subTier = key.user.subscription?.tier;
    const tier: 'standard' | 'partner' =
      subTier === 'partner' || subTier === 'annual' ? 'partner' : 'standard';

    const apiUser: ApiKeyUser = {
      userId: key.user.id,
      email: key.user.email,
      apiKeyId: key.id,
      keyPrefix: key.keyPrefix,
      tier,
    };

    request.apiUser = apiUser;

    // Also attach as request.user for compatibility with response envelope
    request.user = {
      userId: key.user.id,
      email: key.user.email,
      role: 'api_key',
      claims: { auth_method: 'api_key', api_key_id: key.id },
      orgId: null,
      authMethod: 'api_key',
    };

    return true;
  }

  private extractBearerToken(request: any): string | null {
    const authHeader = request.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7).trim() || null;
  }
}
