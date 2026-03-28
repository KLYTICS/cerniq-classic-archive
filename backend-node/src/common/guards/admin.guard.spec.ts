import { AdminGuard } from './admin.guard';
import { UnauthorizedException, ExecutionContext } from '@nestjs/common';

describe('AdminGuard', () => {
  let guard: AdminGuard;

  const createMockContext = (
    headers: Record<string, string> = {},
  ): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
        }),
      }),
    }) as any;

  beforeEach(() => {
    guard = new AdminGuard();
  });

  afterEach(() => {
    delete process.env.ADMIN_KEY;
  });

  it('throws when ADMIN_KEY env is not configured', () => {
    delete process.env.ADMIN_KEY;
    const ctx = createMockContext({ 'x-admin-key': 'some-key' });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(ctx)).toThrow('Admin access not configured');
  });

  it('throws when x-admin-key header is missing', () => {
    process.env.ADMIN_KEY = 'valid-key';
    const ctx = createMockContext({});
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(ctx)).toThrow('Invalid admin key');
  });

  it('throws when x-admin-key header is wrong', () => {
    process.env.ADMIN_KEY = 'valid-key';
    const ctx = createMockContext({ 'x-admin-key': 'wrong-key' });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(ctx)).toThrow('Invalid admin key');
  });

  it('returns true when x-admin-key matches', () => {
    process.env.ADMIN_KEY = 'valid-key';
    const ctx = createMockContext({ 'x-admin-key': 'valid-key' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('is case-sensitive for key comparison', () => {
    process.env.ADMIN_KEY = 'Valid-Key';
    const ctx = createMockContext({ 'x-admin-key': 'valid-key' });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });
});
