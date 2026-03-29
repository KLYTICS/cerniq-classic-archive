import { TenantScopeGuard } from './tenant-scope.guard';
import { ExecutionContext } from '@nestjs/common';

describe('TenantScopeGuard', () => {
  let guard: TenantScopeGuard;

  beforeEach(() => {
    guard = new TenantScopeGuard();
  });

  const createMockContext = (
    url: string,
    user: any = undefined,
    headers: Record<string, string> = {},
    method: string = 'GET',
  ): { ctx: ExecutionContext; request: any } => {
    const request = { url, path: url, user, headers, method } as any;
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
    return { ctx, request };
  };

  it('should always return true (non-blocking guard)', () => {
    const { ctx } = createMockContext('/api/users');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should set tenantId from user.orgId', () => {
    const { ctx, request } = createMockContext('/api/data', {
      orgId: 'org-123',
      userId: 'u1',
    });
    guard.canActivate(ctx);
    expect(request.tenantId).toBe('org-123');
  });

  it('should fall back to x-organization-id header', () => {
    const { ctx, request } = createMockContext('/api/data', undefined, {
      'x-organization-id': 'org-header',
    });
    guard.canActivate(ctx);
    expect(request.tenantId).toBe('org-header');
  });

  it('should fall back to x-klytics-org-id header', () => {
    const { ctx, request } = createMockContext('/api/data', undefined, {
      'x-klytics-org-id': 'klytics-org',
    });
    guard.canActivate(ctx);
    expect(request.tenantId).toBe('klytics-org');
  });

  it('should set tenantId to null when no orgId source is available', () => {
    const { ctx, request } = createMockContext('/api/data');
    guard.canActivate(ctx);
    expect(request.tenantId).toBeNull();
  });

  it('should log warning for /api/alm routes without orgId', () => {
    const warnSpy = jest.spyOn(guard['logger'], 'warn');
    const { ctx } = createMockContext('/api/alm/report');
    guard.canActivate(ctx);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'tenant_scope.missing_org_id',
      }),
    );
  });

  it('should log warning for /api/expenses routes without orgId', () => {
    const warnSpy = jest.spyOn(guard['logger'], 'warn');
    const { ctx } = createMockContext('/api/expenses/list');
    guard.canActivate(ctx);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'tenant_scope.missing_org_id',
      }),
    );
  });

  it('should not log warning for non-tenant routes without orgId', () => {
    const warnSpy = jest.spyOn(guard['logger'], 'warn');
    const { ctx } = createMockContext('/api/users/me');
    guard.canActivate(ctx);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('should not log warning for tenant routes with orgId', () => {
    const warnSpy = jest.spyOn(guard['logger'], 'warn');
    const { ctx } = createMockContext('/api/alm/report', { orgId: 'org-1' });
    guard.canActivate(ctx);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('should prefer user.orgId over headers', () => {
    const { ctx, request } = createMockContext(
      '/api/data',
      { orgId: 'from-user' },
      { 'x-organization-id': 'from-header' },
    );
    guard.canActivate(ctx);
    expect(request.tenantId).toBe('from-user');
  });
});
