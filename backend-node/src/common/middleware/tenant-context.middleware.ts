import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

/**
 * Row-Level Security (RLS) Tenant Context Middleware
 *
 * Sets PostgreSQL session variables that RLS policies evaluate:
 *
 *   app.current_institution_id — scopes all institution-bearing tables to the
 *   authenticated user's institution. Uses SET LOCAL so the value is
 *   automatically cleared at transaction end (commit / rollback).
 *
 *   app.admin_mode — allows admin endpoints (identified by the x-admin-key
 *   header) to bypass tenant isolation for cross-tenant operations.
 *
 * SECURITY NOTES:
 *   - Uses parameterized $executeRaw (tagged template) to prevent SQL injection.
 *   - Unauthenticated requests pass through without setting any GUC variables,
 *     so RLS policies default to blocking all rows.
 *   - The middleware runs AFTER JWT verification (applied on authenticated routes).
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger('TenantContextMiddleware');

  constructor(private readonly prisma: PrismaService) {}

  async use(req: any, _res: any, next: () => void): Promise<void> {
    const adminKey = req.headers?.['x-admin-key'] as string | undefined;

    // Admin route: set admin_mode so RLS admin_bypass policies grant access
    if (adminKey) {
      try {
        await this.prisma.$executeRaw`SET LOCAL app.admin_mode = 'true'`;
        this.logger.debug('RLS admin_mode set for admin request');
      } catch (err) {
        this.logger.error('Failed to set RLS admin_mode', (err as Error).stack);
      }
      next();
      return;
    }

    // Authenticated request: set tenant context from JWT-decoded user
    const user = req.user as { institutionId?: string } | undefined;
    const institutionId = user?.institutionId;

    if (institutionId) {
      try {
        await this.prisma
          .$executeRaw`SET LOCAL app.current_institution_id = ${institutionId}`;
        this.logger.debug(
          { institutionId },
          'RLS tenant context set for request',
        );
      } catch (err) {
        this.logger.error(
          'Failed to set RLS tenant context',
          (err as Error).stack,
        );
      }
    }

    next();
  }
}
