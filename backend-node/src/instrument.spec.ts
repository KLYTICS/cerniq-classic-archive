describe('instrument bootstrap', () => {
  const sentryInitMock = jest.fn();
  const profilingIntegrationMock = jest.fn(() => 'profiling-integration');

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.SENTRY_DSN;
    delete process.env.NODE_ENV;
    delete process.env.RAILWAY_GIT_COMMIT_SHA;
  });

  it('initializes Sentry and scrubs sensitive headers when a DSN is present', () => {
    process.env.SENTRY_DSN = 'https://sentry.example/project';
    process.env.NODE_ENV = 'production';
    process.env.RAILWAY_GIT_COMMIT_SHA = 'git-sha';

    jest.doMock('@sentry/nestjs', () => ({
      init: sentryInitMock,
    }));
    jest.doMock('@sentry/profiling-node', () => ({
      nodeProfilingIntegration: profilingIntegrationMock,
    }));

    jest.isolateModules(() => {
      require('./instrument');
    });

    expect(profilingIntegrationMock).toHaveBeenCalledTimes(1);
    expect(sentryInitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://sentry.example/project',
        environment: 'production',
        release: 'git-sha',
        integrations: ['profiling-integration'],
        tracesSampleRate: 0.2,
        profilesSampleRate: 0.1,
        beforeSend: expect.any(Function),
      }),
    );

    const beforeSend = sentryInitMock.mock.calls[0][0].beforeSend as (
      event: Record<string, any>,
    ) => Record<string, any>;
    const event = {
      request: {
        headers: {
          authorization: 'Bearer secret',
          cookie: 'session=secret',
          'x-admin-key': 'desk-secret',
          'x-request-id': 'req-1',
        },
      },
    };

    expect(beforeSend(event)).toEqual({
      request: {
        headers: {
          'x-request-id': 'req-1',
        },
      },
    });
  });

  it('does not initialize Sentry when no DSN is configured', () => {
    jest.doMock('@sentry/nestjs', () => ({
      init: sentryInitMock,
    }));
    jest.doMock('@sentry/profiling-node', () => ({
      nodeProfilingIntegration: profilingIntegrationMock,
    }));

    jest.isolateModules(() => {
      require('./instrument');
    });

    expect(profilingIntegrationMock).not.toHaveBeenCalled();
    expect(sentryInitMock).not.toHaveBeenCalled();
  });

  it('degrades safely when profiling bindings are unavailable', () => {
    process.env.SENTRY_DSN = 'https://sentry.example/project';

    jest.doMock('@sentry/nestjs', () => ({
      init: sentryInitMock,
    }));
    jest.doMock('@sentry/profiling-node', () => {
      throw new Error('native binding missing');
    });

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    jest.isolateModules(() => {
      require('./instrument');
    });

    expect(warnSpy).toHaveBeenCalledWith(
      '[WARN] Sentry profiling disabled because native bindings are unavailable:',
      expect.any(Error),
    );
    expect(sentryInitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        integrations: [],
        profilesSampleRate: 0,
      }),
    );
  });
});
