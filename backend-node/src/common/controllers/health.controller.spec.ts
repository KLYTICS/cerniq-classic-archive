import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../../prisma.service';
import { CacheService } from '../../cache/cache.service';

describe('HealthController', () => {
  let controller: HealthController;

  const mockPrisma = {
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    getPoolStats: jest.fn().mockReturnValue(null),
  };

  const mockCache = {
    ping: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('returns ok status when all dependencies are healthy', async () => {
    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(result.version).toBeDefined();
    expect(result.timestamp).toBeDefined();
    expect(result.uptime).toBeGreaterThanOrEqual(0);
    expect(result.dependencies).toHaveLength(2);
    expect(result.dependencies[0].status).toBe('healthy');
    expect(result.dependencies[1].status).toBe('healthy');
  });

  it('returns unhealthy status when database probe fails', async () => {
    mockPrisma.$queryRaw.mockRejectedValueOnce(new Error('connection refused'));

    const result = await controller.check();

    expect(result.status).toBe('unhealthy');
    const dbDep = result.dependencies.find((d) => d.name === 'database');
    expect(dbDep!.status).toBe('unhealthy');
  });

  it('includes latencyMs for each dependency', async () => {
    const result = await controller.check();

    for (const dep of result.dependencies) {
      expect(typeof dep.latencyMs).toBe('number');
      expect(dep.latencyMs).toBeGreaterThanOrEqual(0);
    }
  });
});
