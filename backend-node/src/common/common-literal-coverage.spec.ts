import { Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import * as CommonExports from './index';
import {
  API_VERSION_KEY,
  ApiVersion,
  DEPRECATED_VERSION_KEY,
  DeprecatedInVersion,
} from './decorators/api-version.decorator';
import {
  ApiErrorResponse,
  GlobalExceptionFilter,
} from './filters/http-exception.filter';
import {
  AUDIT_ACTION_KEY,
  AuditAction,
} from './decorators/audit-action.decorator';
import {
  CACHE_KEY_METADATA,
  CACHE_TTL_METADATA,
  CacheKey,
  CacheTtl,
} from './decorators/cache-key.decorator';
import {
  CACHE_TTL_KEY,
  CacheTTL,
  NoCache,
} from './decorators/cache-ttl.decorator';
import {
  DEPRECATION_KEY,
  Deprecated,
  DeprecationInterceptor,
} from './decorators/deprecated.decorator';
import { LogExecution } from './decorators/log-execution.decorator';
import { IS_PUBLIC_KEY, Public } from './decorators/public.decorator';
import {
  RATE_LIMIT_TIER_KEY,
  RateLimitTier,
} from './decorators/rate-limit-tier.decorator';
import {
  PERMISSIONS_KEY,
  Permissions,
  RequiredPermissions,
} from './decorators/required-permissions.decorator';
import { ROLES_KEY, Roles } from './decorators/roles.decorator';
import {
  THROTTLE_KEY,
  ThrottleBy,
  ThrottleModerate,
  ThrottleRelaxed,
  ThrottleStrict,
} from './decorators/throttle-by.decorator';
import {
  API_VERSION,
  DEFAULT_PAGE_SIZE,
  MAX_FILE_UPLOAD_MB,
  MAX_PAGE_SIZE,
  SESSION_COOKIE_NAME,
  SUPPORTED_LOCALES,
} from './constants';
import { ERROR_CODES } from './errors/error-codes';

describe('common literal coverage helpers', () => {
  it('re-exports common entrypoints and publishes constants and error codes', () => {
    expect(CommonExports.GlobalExceptionFilter).toBe(GlobalExceptionFilter);
    expect(CommonExports.AuditLogInterceptor).toBeDefined();
    expect(CommonExports.ResponseEnvelopeInterceptor).toBeDefined();
    expect(CommonExports.paginate).toBeDefined();

    expect(MAX_PAGE_SIZE).toBe(100);
    expect(DEFAULT_PAGE_SIZE).toBe(20);
    expect(MAX_FILE_UPLOAD_MB).toBe(10);
    expect(SESSION_COOKIE_NAME).toBe('cerniq_session');
    expect(API_VERSION).toBe('1.0');
    expect(SUPPORTED_LOCALES).toEqual(['en', 'es']);

    expect(ERROR_CODES.AUTH_TOKEN_EXPIRED.status).toBe(401);
    expect(ERROR_CODES.ALM_REPORT_NOT_FOUND.code).toBe('ALM_REPORT_NOT_FOUND');
    expect(ERROR_CODES.SYSTEM_IDEMPOTENCY_CONFLICT.status).toBe(409);
  });

  it('writes metadata for versioning, audit, cache, auth, role, and throttle decorators', () => {
    class TestController {
      route() {}
      strict() {}
      moderate() {}
      relaxed() {}
    }

    const routeDescriptor = Object.getOwnPropertyDescriptor(
      TestController.prototype,
      'route',
    )!;
    const strictDescriptor = Object.getOwnPropertyDescriptor(
      TestController.prototype,
      'strict',
    )!;
    const moderateDescriptor = Object.getOwnPropertyDescriptor(
      TestController.prototype,
      'moderate',
    )!;
    const relaxedDescriptor = Object.getOwnPropertyDescriptor(
      TestController.prototype,
      'relaxed',
    )!;

    ApiVersion('1', '2')(TestController);
    DeprecatedInVersion('3', '2026-12-31')(TestController);
    AuditAction('EXPORT')(TestController.prototype, 'route', routeDescriptor);
    CacheKey('portfolio:summary')(
      TestController.prototype,
      'route',
      routeDescriptor,
    );
    CacheTtl(300)(TestController.prototype, 'route', routeDescriptor);
    CacheTTL(60)(TestController.prototype, 'route', routeDescriptor);
    NoCache()(TestController.prototype, 'route', routeDescriptor);
    Public()(TestController.prototype, 'route', routeDescriptor);
    RateLimitTier('compute')(
      TestController.prototype,
      'route',
      routeDescriptor,
    );
    RequiredPermissions('portfolio:read', 'portfolio:write')(
      TestController.prototype,
      'route',
      routeDescriptor,
    );
    Roles('admin', 'analyst')(
      TestController.prototype,
      'route',
      routeDescriptor,
    );
    ThrottleBy({ key: 'test', limit: 9, windowSec: 30, by: 'user' })(
      TestController.prototype,
      'route',
      routeDescriptor,
    );
    ThrottleStrict('strict')(
      TestController.prototype,
      'strict',
      strictDescriptor,
    );
    ThrottleModerate('moderate')(
      TestController.prototype,
      'moderate',
      moderateDescriptor,
    );
    ThrottleRelaxed('relaxed')(
      TestController.prototype,
      'relaxed',
      relaxedDescriptor,
    );

    expect(Reflect.getMetadata(API_VERSION_KEY, TestController)).toEqual([
      '1',
      '2',
    ]);
    expect(Reflect.getMetadata(DEPRECATED_VERSION_KEY, TestController)).toEqual(
      {
        version: '3',
        sunset: '2026-12-31',
      },
    );
    expect(
      Reflect.getMetadata(AUDIT_ACTION_KEY, TestController.prototype.route),
    ).toBe('EXPORT');
    expect(
      Reflect.getMetadata(CACHE_KEY_METADATA, TestController.prototype.route),
    ).toBe('portfolio:summary');
    expect(
      Reflect.getMetadata(CACHE_TTL_METADATA, TestController.prototype.route),
    ).toBe(300);
    expect(
      Reflect.getMetadata(CACHE_TTL_KEY, TestController.prototype.route),
    ).toBe(0);
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, TestController.prototype.route),
    ).toBe(true);
    expect(
      Reflect.getMetadata(RATE_LIMIT_TIER_KEY, TestController.prototype.route),
    ).toBe('compute');
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, TestController.prototype.route),
    ).toEqual(['portfolio:read', 'portfolio:write']);
    expect(
      Reflect.getMetadata(ROLES_KEY, TestController.prototype.route),
    ).toEqual(['admin', 'analyst']);
    expect(
      Reflect.getMetadata(THROTTLE_KEY, TestController.prototype.route),
    ).toEqual({
      key: 'test',
      limit: 9,
      windowSec: 30,
      by: 'user',
    });
    expect(
      Reflect.getMetadata(THROTTLE_KEY, TestController.prototype.strict),
    ).toEqual({
      key: 'strict',
      limit: 5,
      windowSec: 3600,
      by: 'user',
    });
    expect(
      Reflect.getMetadata(THROTTLE_KEY, TestController.prototype.moderate),
    ).toEqual({
      key: 'moderate',
      limit: 30,
      windowSec: 60,
      by: 'user',
    });
    expect(
      Reflect.getMetadata(THROTTLE_KEY, TestController.prototype.relaxed),
    ).toEqual({
      key: 'relaxed',
      limit: 200,
      windowSec: 60,
      by: 'ip',
    });
    expect(Permissions.ADMIN_BILLING).toBe('admin:billing');
  });

  it('sets deprecation headers only when metadata is present', (done) => {
    const setHeader = jest.fn();
    const context = {
      getHandler: () => 'handler',
      switchToHttp: () => ({
        getResponse: () => ({ setHeader }),
      }),
    } as any;
    const reflector = {
      get: jest.fn().mockReturnValue({
        sunsetDate: '2026-06-01',
        alternative: '/api/v2/reports',
      }),
    } as unknown as Reflector;
    const interceptor = new DeprecationInterceptor(reflector);

    interceptor
      .intercept(context, { handle: () => of('ok') } as any)
      .subscribe({
        complete: () => {
          expect(setHeader).toHaveBeenNthCalledWith(
            1,
            'Sunset',
            new Date('2026-06-01').toUTCString(),
          );
          expect(setHeader).toHaveBeenNthCalledWith(2, 'Deprecation', 'true');
          expect(setHeader).toHaveBeenNthCalledWith(
            3,
            'Link',
            '</api/v2/reports>; rel="successor-version"',
          );
          done();
        },
      });
  });

  it('passes through when no deprecation metadata exists', (done) => {
    const setHeader = jest.fn();
    const context = {
      getHandler: () => 'handler',
      switchToHttp: () => ({
        getResponse: () => ({ setHeader }),
      }),
    } as any;
    const reflector = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const interceptor = new DeprecationInterceptor(reflector);

    interceptor
      .intercept(context, { handle: () => of('ok') } as any)
      .subscribe({
        complete: () => {
          expect(setHeader).not.toHaveBeenCalled();
          done();
        },
      });
  });

  it('decorates methods with execution logging on success and failure', async () => {
    const debugSpy = jest
      .spyOn(Logger.prototype, 'debug')
      .mockImplementation(() => undefined);
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    class SuccessService {
      async run(value: string) {
        return value.toUpperCase();
      }
    }

    class FailureService {
      async run() {
        throw new Error('boom');
      }
    }

    let successDescriptor = Object.getOwnPropertyDescriptor(
      SuccessService.prototype,
      'run',
    )!;
    successDescriptor = LogExecution('QuantOps')(
      SuccessService.prototype,
      'run',
      successDescriptor,
    ) as PropertyDescriptor;
    Object.defineProperty(SuccessService.prototype, 'run', successDescriptor);

    let failureDescriptor = Object.getOwnPropertyDescriptor(
      FailureService.prototype,
      'run',
    )!;
    failureDescriptor = LogExecution()(
      FailureService.prototype,
      'run',
      failureDescriptor,
    ) as PropertyDescriptor;
    Object.defineProperty(FailureService.prototype, 'run', failureDescriptor);

    await expect(new SuccessService().run('ok')).resolves.toBe('OK');
    await expect(new FailureService().run()).rejects.toThrow('boom');

    expect(debugSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('FailureService.run failed'),
    );
  });

  it('stores deprecation metadata through the Deprecated decorator', () => {
    class LegacyController {
      route() {}
    }

    const descriptor = Object.getOwnPropertyDescriptor(
      LegacyController.prototype,
      'route',
    )!;

    Deprecated('2026-07-01', '/api/v2/analysis')(
      LegacyController.prototype,
      'route',
      descriptor,
    );

    expect(
      Reflect.getMetadata(DEPRECATION_KEY, LegacyController.prototype.route),
    ).toEqual({
      sunsetDate: '2026-07-01',
      alternative: '/api/v2/analysis',
    });
  });
});
