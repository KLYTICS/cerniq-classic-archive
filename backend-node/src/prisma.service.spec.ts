describe('PrismaService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function loadModule(
    options: {
      withPrismaClient?: boolean;
      poolMax?: number | undefined;
    } = {},
  ) {
    const { withPrismaClient = true, poolMax } = options;
    const resolvedPoolMax = Object.prototype.hasOwnProperty.call(
      options,
      'poolMax',
    )
      ? poolMax
      : 11;
    const pool = {
      totalCount: 3,
      idleCount: 1,
      waitingCount: 2,
      options: { max: resolvedPoolMax },
    };
    const Pool = jest.fn(() => pool);
    const PrismaPg = jest.fn((pgPool) => ({ pgPool }));
    const captureMessage = jest.fn();
    const PrismaClient = jest.fn(function (this: any, options?: unknown) {
      this.options = options;
      this.$connect = jest.fn().mockResolvedValue(undefined);
      this.$disconnect = jest.fn().mockResolvedValue(undefined);
      this._request = jest.fn().mockResolvedValue('ok');
    });

    jest.doMock('@prisma/client', () =>
      withPrismaClient ? { PrismaClient } : {},
    );
    jest.doMock('@prisma/adapter-pg', () => ({ PrismaPg }));
    jest.doMock('@sentry/nestjs', () => ({ captureMessage }));
    jest.doMock('pg', () => ({
      __esModule: true,
      default: { Pool },
      Pool,
    }));

    const mod = require('./prisma.service');
    return { ...mod, PrismaClient, PrismaPg, Pool, pool, captureMessage };
  }

  it('constructs without a database URL and skips connection lifecycle calls', async () => {
    delete process.env.DATABASE_URL;

    const { PrismaService, PrismaClient } = loadModule();
    const service = new PrismaService();

    expect(PrismaClient).toHaveBeenCalledWith();
    expect(service.getPoolStats()).toBeNull();

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(service.$connect).not.toHaveBeenCalled();
    expect(service.$disconnect).not.toHaveBeenCalled();
  });

  it('constructs with a pg adapter and reports pool metrics', () => {
    process.env.DATABASE_URL = 'postgres://cerniq';
    process.env.DATABASE_POOL_SIZE = '11';

    const { PrismaService, PrismaClient, PrismaPg, Pool, pool } = loadModule();
    const service = new PrismaService();

    expect(Pool).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionString: 'postgres://cerniq',
        max: 11,
      }),
    );
    expect(PrismaPg).toHaveBeenCalledWith(pool);
    expect(PrismaClient).toHaveBeenCalledWith({
      adapter: { pgPool: pool },
    });
    expect(service.getPoolStats()).toEqual({
      totalCount: 3,
      idleCount: 1,
      waitingCount: 2,
      maxSize: 11,
    });
  });

  it('falls back to the default pool size when DATABASE_POOL_SIZE is invalid or missing', () => {
    process.env.DATABASE_URL = 'postgres://cerniq';
    process.env.DATABASE_POOL_SIZE = 'invalid';

    let loaded = loadModule();
    let service = new loaded.PrismaService();
    expect(loaded.Pool).toHaveBeenCalledWith(
      expect.objectContaining({ max: 20 }),
    );

    jest.resetModules();
    process.env = { ...originalEnv, DATABASE_URL: 'postgres://cerniq' };
    loaded = loadModule();
    service = new loaded.PrismaService();
    expect(loaded.Pool).toHaveBeenCalledWith(
      expect.objectContaining({ max: 20 }),
    );
    expect(service.getPoolStats()).toEqual({
      totalCount: 3,
      idleCount: 1,
      waitingCount: 2,
      maxSize: 11,
    });
  });

  it('falls back to a max pool size of 10 when pg does not expose one', () => {
    process.env.DATABASE_URL = 'postgres://cerniq';

    const { PrismaService } = loadModule({ poolMax: undefined });
    const service = new PrismaService();

    expect(service.getPoolStats()).toEqual({
      totalCount: 3,
      idleCount: 1,
      waitingCount: 2,
      maxSize: 10,
    });
  });

  it('installs query logging and connects when a database URL is present', async () => {
    process.env.DATABASE_URL = 'postgres://cerniq';
    process.env.SLOW_QUERY_WARN_MS = '500';
    process.env.SLOW_QUERY_ERROR_MS = '2000';

    const { PrismaService, captureMessage } = loadModule();
    const service = new PrismaService();
    const warnSpy = jest
      .spyOn(service.logger, 'warn')
      .mockImplementation(() => undefined);
    const errorSpy = jest
      .spyOn(service.logger, 'error')
      .mockImplementation(() => undefined);

    await service.onModuleInit();
    expect(service.$connect).toHaveBeenCalledTimes(1);

    const nowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(500)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(2000)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(2001);

    await service._request({ model: 'User', action: 'findMany' });
    await service._request({ model: 'Portfolio', action: 'findMany' });
    await service._request({ model: 'Position', action: 'findMany' });

    expect(warnSpy).toHaveBeenCalledWith(
      'Slow query: User.findMany took 500ms',
    );
    expect(errorSpy).toHaveBeenCalledWith(
      'Slow query: Portfolio.findMany took 2000ms',
    );
    expect(errorSpy).toHaveBeenCalledWith(
      'Slow query: Position.findMany took 2001ms',
    );
    expect(captureMessage).toHaveBeenCalledTimes(2);

    nowSpy.mockRestore();
  });

  it('uses an unknown label when model or action is missing', async () => {
    process.env.DATABASE_URL = 'postgres://cerniq';
    process.env.SLOW_QUERY_WARN_MS = '500';
    process.env.SLOW_QUERY_ERROR_MS = '2000';

    const { PrismaService, captureMessage } = loadModule();
    const service = new PrismaService();
    const warnSpy = jest
      .spyOn(service.logger, 'warn')
      .mockImplementation(() => undefined);

    await service.onModuleInit();

    const nowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(750);

    await service._request({ model: 'User' });

    expect(warnSpy).toHaveBeenCalledWith('Slow query: unknown took 750ms');
    expect(captureMessage).not.toHaveBeenCalled();

    nowSpy.mockRestore();
  });

  it('does not log fast queries and still logs thrown slow queries from finally', async () => {
    process.env.DATABASE_URL = 'postgres://cerniq';
    process.env.SLOW_QUERY_WARN_MS = '500';
    process.env.SLOW_QUERY_ERROR_MS = '2000';

    const { PrismaService, captureMessage } = loadModule();
    const service = new PrismaService();
    service._request = jest
      .fn()
      .mockResolvedValueOnce('fast')
      .mockRejectedValueOnce(new Error('db timeout'));
    const warnSpy = jest
      .spyOn(service.logger, 'warn')
      .mockImplementation(() => undefined);
    const errorSpy = jest
      .spyOn(service.logger, 'error')
      .mockImplementation(() => undefined);

    await service.onModuleInit();

    const nowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(2501);

    await expect(
      service._request({ model: 'User', action: 'findUnique' }),
    ).resolves.toBe('fast');
    await expect(service._request({ action: 'aggregate' })).rejects.toThrow(
      'db timeout',
    );

    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith('Slow query: unknown took 2501ms');
    expect(captureMessage).toHaveBeenCalledWith(
      'Slow DB query: unknown (2501ms)',
      expect.objectContaining({
        level: 'warning',
        tags: expect.objectContaining({
          model: 'n/a',
          action: 'aggregate',
        }),
      }),
    );

    nowSpy.mockRestore();
  });

  it('disconnects when destroying a connected service', async () => {
    process.env.DATABASE_URL = 'postgres://cerniq';

    const { PrismaService } = loadModule();
    const service = new PrismaService();

    await service.onModuleDestroy();

    expect(service.$disconnect).toHaveBeenCalledTimes(1);
  });

  it('falls back to a local base class when PrismaClient is unavailable', () => {
    delete process.env.DATABASE_URL;

    const { PrismaService } = loadModule({ withPrismaClient: false });
    const service = new PrismaService();

    expect(service).toBeInstanceOf(PrismaService);
    expect(service.getPoolStats()).toBeNull();
  });
});
