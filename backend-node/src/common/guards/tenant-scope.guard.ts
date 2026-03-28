import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';

/**
 * TenantScopeGuard — Multi-tenant data isolation enforcement.
 *
 * This guard does NOT block requests; it enriches the request context
 * with a validated orgId and logs a warning when tenant-sensitive
 * endpoints are hit without an orgId.
 *
 * How it works:
 * 1. Extracts orgId from `request.user.orgId` (set by AuthGuard)
 *    or from the `x-organization-id` header as a fallback.
 * 2. Stores it on `request.tenantId` for downstream services.
 * 3. Logs a warning if requests to `/api/alm/*` or `/api/expenses/*`
 *    arrive without an orgId — this indicates a potential isolation gap.
 *
 * Usage:
 *   @UseGuards(AuthGuard, TenantScopeGuard)
 *   @Controller('api/expenses')
 *   export class ExpensesController { ... }
 *
 * Services can then read `request.tenantId` for scoped queries.
 */
@Injectable()
export class TenantScopeGuard implements CanActivate {
  private readonly logger = new Logger(TenantScopeGuard.name);

  /** Paths that MUST have an orgId for proper tenant isolation */
  private readonly TENANT_REQUIRED_PREFIXES = [
    '/api/alm',
    '/api/expenses',
  ];

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Extract orgId from the authenticated user context (set by AuthGuard)
    const orgId =
      request.user?.orgId ||
      request.headers?.['x-organization-id'] ||
      request.headers?.['x-klytics-org-id'] ||
      null;

    // Inject tenantId into request for downstream consumption
    request.tenantId = orgId;

    // Check if this is a tenant-sensitive route
    const url: string = request.url || request.path || '';
    const isTenantRoute = this.TENANT_REQUIRED_PREFIXES.some((prefix) =>
      url.startsWith(prefix),
    );

    if (isTenantRoute && !orgId) {
      this.logger.warn({
        event: 'tenant_scope.missing_org_id',
        url,
        userId: request.user?.userId,
        method: request.method,
        message:
          'Request to tenant-scoped endpoint without orgId. ' +
          'Data isolation may be compromised.',
      });
    }

    if (orgId) {
      this.logger.debug({
        event: 'tenant_scope.resolved',
        tenantId: orgId,
        userId: request.user?.userId,
        url,
      });
    }

    // This guard does not block — it enriches context and warns.
    // Blocking is handled by individual service-level membership checks.
    return true;
  }
}
