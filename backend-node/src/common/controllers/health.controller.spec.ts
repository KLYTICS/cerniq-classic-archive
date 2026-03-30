import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns ok when database and cache checks succeed', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
      getPoolStats: jest.fn().mockReturnValue({
        total: 5,
        idle: 3,
        waiting: 0,
        max: 10,
      }),
    } as any;
    const cache = {
      ping: jest.fn().mockResolvedValue(true),
    } as any;
    const controller = new HealthController(prisma, cache);

    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(result.dependencies).toEqual([
      expect.objectContaining({ name: 'database', status: 'healthy' }),
      expect.objectContaining({ name: 'cache', status: 'healthy' }),
    ]);
    expect(result.pool).toEqual({
      total: 5,
      idle: 3,
      waiting: 0,
      max: 10,
    });
  });

  it('returns degraded when optional dependencies are absent', async () => {
    const controller = new HealthController();

    const result = await controller.check();

    expect(result.status).toBe('degraded');
    expect(result.dependencies).toEqual([
      expect.objectContaining({ name: 'database', status: 'degraded' }),
      expect.objectContaining({ name: 'cache', status: 'degraded' }),
    ]);
    expect(result.pool).toBeNull();
  });

  it('returns unhealthy when the database probe throws', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('db down')),
    } as any;
    const controller = new HealthController(prisma);

    const result = await controller.check();

    expect(result.status).toBe('unhealthy');
    expect(result.dependencies[0]).toEqual(
      expect.objectContaining({ name: 'database', status: 'unhealthy' }),
    );
  });
});
