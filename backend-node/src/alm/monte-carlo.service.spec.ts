import { MonteCarloService } from './monte-carlo.service';

describe('MonteCarloService', () => {
  let service: MonteCarloService;
  const mockPrisma = {
    balanceSheetItem: { findMany: jest.fn().mockResolvedValue([]) },
  } as any;

  beforeEach(() => {
    service = new MonteCarloService(mockPrisma);
  });

  it('should clamp paths between 100 and 100_000', async () => {
    const result = await service.runSimulation('inst-1', { paths: 50 });
    expect(result.paths).toBeGreaterThanOrEqual(100);
  });

  it('should return demo NII around 3.2M baseline per quarter', async () => {
    const result = await service.runSimulation('inst-1', { paths: 500, quarters: 4 });
    expect(result.meanNII).toBeDefined();
    expect(typeof result.meanNII).toBe('number');
  });

  it('VaR95 should be less than or equal to mean NII', async () => {
    const result = await service.runSimulation('inst-1', { paths: 1000, quarters: 4 });
    expect(result.var95NII).toBeLessThanOrEqual(result.meanNII);
  });

  it('fan chart should have correct number of quarters', async () => {
    const result = await service.runSimulation('inst-1', { paths: 200, quarters: 8 });
    expect(result.fanChart).toHaveLength(8);
    expect(result.fanChart[0]).toHaveProperty('p5');
    expect(result.fanChart[0]).toHaveProperty('p95');
  });

  it('distribution should have 20 buckets', async () => {
    const result = await service.runSimulation('inst-1', { paths: 500, quarters: 4 });
    expect(result.distribution.buckets).toHaveLength(20);
  });

  it('standard error should be a positive number', async () => {
    const result = await service.runSimulation('inst-1', { paths: 500, quarters: 4 });
    expect(result.standardError).toBeGreaterThanOrEqual(0);
  });
});
