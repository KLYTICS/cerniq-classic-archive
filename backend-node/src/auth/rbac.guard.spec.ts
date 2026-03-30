import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AuditAction,
  AUDIT_ACTION_KEY,
} from '../common/decorators/audit-action.decorator';
import {
  CerniqRole,
  getAllRoles,
  getRolePermissions,
  hasPermission,
  RBACGuard,
  REQUIRED_PERMISSIONS_KEY,
  RequirePermissions,
} from './rbac.guard';

describe('RBACGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  const makeContext = (role?: string) =>
    ({
      getHandler: () => 'handler',
      getClass: () => 'controller',
      switchToHttp: () => ({
        getRequest: () => ({
          user: role ? { role } : undefined,
        }),
      }),
    }) as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows access when no permissions metadata is present', () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(undefined);
    const guard = new RBACGuard(reflector);

    expect(guard.canActivate(makeContext(CerniqRole.VIEWER))).toBe(true);
  });

  it('allows access when the role satisfies all required permissions', () => {
    reflector.getAllAndOverride = jest
      .fn()
      .mockReturnValue(['read:alm', 'run:analysis']);
    const guard = new RBACGuard(reflector);

    expect(guard.canActivate(makeContext(CerniqRole.OPERATOR))).toBe(true);
  });

  it('allows wildcard breakglass access', () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(['manage:users']);
    const guard = new RBACGuard(reflector);

    expect(guard.canActivate(makeContext(CerniqRole.BREAKGLASS))).toBe(true);
  });

  it('throws when the role lacks a required permission', () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(['manage:users']);
    const guard = new RBACGuard(reflector);

    expect(() => guard.canActivate(makeContext(CerniqRole.VIEWER))).toThrow(
      ForbiddenException,
    );
  });

  it('falls back to viewer permissions for unknown roles', () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(['read:reports']);
    const guard = new RBACGuard(reflector);

    expect(guard.canActivate(makeContext('mystery-role'))).toBe(true);
  });

  it('exposes helper functions and metadata decorators for programmatic RBAC use', () => {
    class TestController {
      test() {}
    }

    const descriptor = Object.getOwnPropertyDescriptor(
      TestController.prototype,
      'test',
    )!;
    RequirePermissions('read:alm', 'run:analysis')(
      TestController.prototype,
      'test',
      descriptor,
    );
    AuditAction('GENERATE_REPORT')(
      TestController.prototype,
      'test',
      descriptor,
    );

    expect(
      Reflect.getMetadata(
        REQUIRED_PERMISSIONS_KEY,
        TestController.prototype.test,
      ),
    ).toEqual(['read:alm', 'run:analysis']);
    expect(
      Reflect.getMetadata(AUDIT_ACTION_KEY, TestController.prototype.test),
    ).toBe('GENERATE_REPORT');
    expect(hasPermission(CerniqRole.BREAKGLASS, 'anything')).toBe(true);
    expect(hasPermission(CerniqRole.CFO, 'read:ftp')).toBe(true);
    expect(getRolePermissions(CerniqRole.VIEWER)).toEqual([
      'read:alm',
      'read:reports',
    ]);
    expect(getAllRoles().some((entry) => entry.role === CerniqRole.CRO)).toBe(
      true,
    );
  });
});
