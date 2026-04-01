describe('main bootstrap', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function mockRuntime(options?: { loggerAvailable?: boolean }) {
    const loggerAvailable = options?.loggerAvailable ?? true;
    const app = {
      useLogger: jest.fn(),
      get: jest.fn().mockImplementation(() => {
        if (!loggerAvailable) {
          throw new Error('logger unavailable');
        }
        return {};
      }),
      set: jest.fn(),
      use: jest.fn(),
      useGlobalFilters: jest.fn(),
      useGlobalInterceptors: jest.fn(),
      useGlobalGuards: jest.fn(),
      useGlobalPipes: jest.fn(),
      enableCors: jest.fn(),
      enableShutdownHooks: jest.fn(),
      listen: jest.fn().mockResolvedValue(undefined),
    };

    const createDocument = jest.fn(() => ({ openapi: '3.0.0' }));
    const setup = jest.fn();
    const create = jest.fn().mockResolvedValue(app);
    const bootstrapWarn = jest.fn();
    const bootstrapLog = jest.fn();
    const corsOriginCallback = jest.fn();

    jest.doMock('./instrument', () => ({}));
    jest.doMock('@sentry/nestjs', () => ({
      captureException: jest.fn(),
      SentryGlobalFilter: class {},
    }));
    jest.doMock('@nestjs/common', () => ({
      ValidationPipe: class ValidationPipe {
        constructor(public readonly options?: unknown) {}
      },
      Logger: class Logger {
        warn = bootstrapWarn;
        log = bootstrapLog;
      },
    }));
    jest.doMock('@nestjs/core', () => ({
      NestFactory: { create },
    }));
    jest.doMock('@nestjs/swagger', () => {
      class DocumentBuilder {
        setTitle() {
          return this;
        }
        setDescription() {
          return this;
        }
        setVersion() {
          return this;
        }
        addBearerAuth() {
          return this;
        }
        addTag() {
          return this;
        }
        build() {
          return { built: true };
        }
      }

      return {
        SwaggerModule: { createDocument, setup },
        DocumentBuilder,
      };
    });
    jest.doMock('nestjs-pino', () => ({ Logger: class {} }));
    jest.doMock('./app.module', () => ({ AppModule: class {} }));
    jest.doMock('./common/interceptors/performance.interceptor', () => ({
      PerformanceInterceptor: class {},
    }));
    jest.doMock('./common/guards/maintenance-mode.guard', () => ({
      MaintenanceModeGuard: class {},
    }));
    jest.doMock('./security/origin-allowlist', () => ({
      corsOriginCallback,
    }));
    jest.doMock('./common/filters/http-exception.filter', () => ({
      GlobalExceptionFilter: class {},
    }));
    jest.doMock('./common/interceptors/response-envelope.interceptor', () => ({
      ResponseEnvelopeInterceptor: class {},
    }));
    jest.doMock(
      './common/interceptors/sensitive-field-redactor.interceptor',
      () => ({
        SensitiveFieldRedactorInterceptor: class {},
      }),
    );
    jest.doMock('./common/pipes/sanitize.pipe', () => ({
      SanitizePipe: class {},
    }));
    jest.doMock('cookie-parser', () => jest.fn(() => 'cookie-parser'));
    jest.doMock('helmet', () => jest.fn(() => 'helmet'));
    jest.doMock('compression', () => jest.fn(() => 'compression'));
    jest.doMock('express', () => ({
      json: jest.fn(() => 'json-middleware'),
      urlencoded: jest.fn(() => 'urlencoded-middleware'),
    }));

    return {
      app,
      bootstrapLog,
      bootstrapWarn,
      corsOriginCallback,
      create,
      createDocument,
      setup,
    };
  }

  it('validates required bootstrap env and returns production-only warnings', () => {
    mockRuntime();
    const { validateBootstrapEnv } = require('./main');

    expect(() =>
      validateBootstrapEnv({ JWT_SECRET: 'short', DATABASE_URL: 'db' }),
    ).toThrow('FATAL: JWT_SECRET must be set and at least 32 characters.');
    expect(() => validateBootstrapEnv({ JWT_SECRET: 'x'.repeat(32) })).toThrow(
      'FATAL: DATABASE_URL must be set.',
    );
    expect(
      validateBootstrapEnv({
        NODE_ENV: 'development',
        JWT_SECRET: 'x'.repeat(32),
        DATABASE_URL: 'postgres://cerniq',
      }),
    ).toEqual([]);
    expect(
      validateBootstrapEnv({
        NODE_ENV: 'production',
        JWT_SECRET: 'x'.repeat(32),
        DATABASE_URL: 'postgres://cerniq',
        ADMIN_KEY: 'admin',
        DATA_ENCRYPTION_KEY: 'enc',
      }),
    ).toEqual([
      'WARN: STRIPE_SECRET_KEY not set — billing disabled.',
      'WARN: RESEND_API_KEY not set — email delivery disabled.',
    ]);
  });

  it('registers global crash handlers that normalize failures and schedule exit', () => {
    mockRuntime();
    const listeners: Record<string, (value: unknown) => void> = {};
    const processRef: {
      on: jest.Mock;
      exit: jest.Mock;
    } = {
      on: jest.fn(),
      exit: jest.fn(),
    };
    processRef.on.mockImplementation(
      (event: string, handler: (value: unknown) => void) => {
        listeners[event] = handler;
        return processRef;
      },
    );
    const captureException = jest.fn();
    const errorLogger = jest.fn();
    const scheduleExit = jest.fn((callback: () => void, delay: number) => {
      expect(delay).toBe(2000);
      callback();
      return 0 as any;
    });

    const { registerGlobalCrashHandlers } = require('./main');
    registerGlobalCrashHandlers(
      processRef,
      { captureException },
      errorLogger,
      scheduleExit,
    );

    const failure = new Error('desk down');
    listeners.unhandledRejection('plain-string-failure');
    listeners.uncaughtException(failure);

    expect(processRef.on).toHaveBeenCalledWith(
      'unhandledRejection',
      expect.any(Function),
    );
    expect(processRef.on).toHaveBeenCalledWith(
      'uncaughtException',
      expect.any(Function),
    );
    expect(captureException).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ message: 'plain-string-failure' }),
    );
    expect(captureException).toHaveBeenNthCalledWith(2, failure);
    expect(processRef.exit).toHaveBeenCalledTimes(2);
    expect(errorLogger).toHaveBeenCalledTimes(2);
    expect(scheduleExit).toHaveBeenCalledTimes(2);
  });

  it('bridges SIGTERM into app health shutdown state', async () => {
    mockRuntime();
    const listeners: Record<string, () => void> = {};
    const processRef: {
      on: jest.Mock;
    } = {
      on: jest.fn(),
    };
    processRef.on.mockImplementation((event: string, handler: () => void) => {
      listeners[event] = handler;
      return processRef;
    });
    const markShuttingDown = jest.fn();

    const { bridgeShutdownToHealth } = require('./main');
    await bridgeShutdownToHealth(processRef, async () => ({
      AppController: { markShuttingDown },
    }));

    listeners.SIGTERM();
    await Promise.resolve();

    expect(markShuttingDown).toHaveBeenCalledTimes(1);
  });

  it('logs and swallows shutdown bridge loader failures', async () => {
    mockRuntime();
    const listeners: Record<string, () => void> = {};
    const processRef: {
      on: jest.Mock;
    } = {
      on: jest.fn(),
    };
    processRef.on.mockImplementation((event: string, handler: () => void) => {
      listeners[event] = handler;
      return processRef;
    });
    const warnLogger = jest.fn();

    const { bridgeShutdownToHealth } = require('./main');
    await bridgeShutdownToHealth(
      processRef,
      async () => {
        throw new Error('controller missing');
      },
      warnLogger,
    );

    listeners.SIGTERM();
    await Promise.resolve();
    await Promise.resolve();

    expect(warnLogger).toHaveBeenCalledWith(
      '[WARN] Failed to bridge SIGTERM into AppController shutdown state:',
      expect.any(Error),
    );
  });

  it('bootstraps the Nest app with enterprise middleware, cors, and swagger', async () => {
    process.env.JWT_SECRET = 'x'.repeat(32);
    process.env.DATABASE_URL = 'postgres://cerniq';
    process.env.PORT = '4100';
    process.env.SENTRY_DSN = 'https://dsn.test';

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { app, corsOriginCallback, create, createDocument, setup } =
      mockRuntime();
    const { bootstrap } = require('./main');

    await bootstrap();

    expect(create).toHaveBeenCalledWith(expect.any(Function), {
      rawBody: true,
      bufferLogs: true,
    });
    expect(app.useLogger).toHaveBeenCalled();
    expect(app.set).toHaveBeenCalledWith('trust proxy', 1);
    expect(app.use).toHaveBeenCalled();
    expect(app.useGlobalFilters).toHaveBeenCalledTimes(2);
    expect(app.useGlobalInterceptors).toHaveBeenCalledTimes(3);
    expect(app.useGlobalGuards).toHaveBeenCalledTimes(1);
    expect(app.useGlobalPipes).toHaveBeenCalledTimes(2);
    expect(app.enableCors).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: corsOriginCallback,
        credentials: true,
      }),
    );
    expect(app.enableShutdownHooks).toHaveBeenCalled();
    expect(createDocument).toHaveBeenCalledTimes(1);
    expect(setup).toHaveBeenCalledWith(
      'api/v1/docs',
      app,
      { openapi: '3.0.0' },
      expect.any(Object),
    );
    expect(app.listen).toHaveBeenCalledWith('4100', '0.0.0.0');

    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('falls back to the Nest logger when pino logger is unavailable', async () => {
    process.env.JWT_SECRET = 'x'.repeat(32);
    process.env.DATABASE_URL = 'postgres://cerniq';

    const { app, bootstrapWarn } = mockRuntime({ loggerAvailable: false });
    const { bootstrap } = require('./main');

    await bootstrap();

    expect(app.useLogger).not.toHaveBeenCalled();
    expect(bootstrapWarn).toHaveBeenCalledWith(
      'Pino logger not available, using default',
    );
  });

  it('prefers BACKEND_PORT and then 3000 when PORT is unset', async () => {
    process.env.JWT_SECRET = 'x'.repeat(32);
    process.env.DATABASE_URL = 'postgres://cerniq';
    process.env.BACKEND_PORT = '3200';

    let runtime = mockRuntime();
    let main = require('./main');
    await main.bootstrap();
    expect(runtime.app.listen).toHaveBeenCalledWith('3200', '0.0.0.0');

    jest.resetModules();
    process.env = {
      ...originalEnv,
      JWT_SECRET: 'x'.repeat(32),
      DATABASE_URL: 'postgres://cerniq',
    };
    runtime = mockRuntime();
    main = require('./main');
    await main.bootstrap();
    expect(runtime.app.listen).toHaveBeenCalledWith(3000, '0.0.0.0');
  });

  it('exits fast when required env is invalid', async () => {
    delete process.env.JWT_SECRET;
    process.env.DATABASE_URL = 'postgres://cerniq';

    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockRuntime();
    const { bootstrap } = require('./main');

    await bootstrap();

    expect(errorSpy).toHaveBeenCalledWith(
      'FATAL: JWT_SECRET must be set and at least 32 characters. Exiting.',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
