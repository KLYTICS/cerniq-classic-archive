import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserThrottleGuard } from './common/guards/user-throttle.guard';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { SlowRequestInterceptor } from './common/interceptors/slow-query.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { CorrelationInterceptor } from './common/interceptors/correlation.interceptor';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { ApiVersionMiddleware } from './common/middleware/api-version.middleware';
import { RequestLoggingMiddleware } from './common/middleware/request-logging.middleware';

describe('AppModule', () => {
  it('registers the expected controllers, imports, and enterprise providers', () => {
    const controllers = Reflect.getMetadata('controllers', AppModule);
    const imports = Reflect.getMetadata('imports', AppModule);
    const providers = Reflect.getMetadata('providers', AppModule);

    expect(controllers).toContain(AppController);
    expect(imports.length).toBeGreaterThanOrEqual(20);
    expect(providers).toEqual(
      expect.arrayContaining([
        AppService,
        expect.objectContaining({
          provide: APP_GUARD,
          useClass: UserThrottleGuard,
        }),
        expect.objectContaining({
          provide: APP_INTERCEPTOR,
          useClass: AuditLogInterceptor,
        }),
        expect.objectContaining({
          provide: APP_INTERCEPTOR,
          useClass: SlowRequestInterceptor,
        }),
        expect.objectContaining({
          provide: APP_INTERCEPTOR,
          useClass: TimeoutInterceptor,
        }),
        expect.objectContaining({
          provide: APP_INTERCEPTOR,
          useClass: CorrelationInterceptor,
        }),
      ]),
    );
  });

  it('applies request id, API version, and request logging middleware globally', () => {
    const apply = jest.fn().mockReturnThis();
    const forRoutes = jest.fn();
    const consumer = { apply, forRoutes } as any;
    const module = new AppModule();

    module.configure(consumer);

    expect(apply).toHaveBeenCalledWith(
      RequestIdMiddleware,
      ApiVersionMiddleware,
      RequestLoggingMiddleware,
    );
    expect(forRoutes).toHaveBeenCalledWith('*');
  });
});
