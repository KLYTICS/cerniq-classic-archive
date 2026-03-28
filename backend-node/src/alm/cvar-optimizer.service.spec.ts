import { CVaROptimizerService } from './cvar-optimizer.service';

describe('CVaROptimizerService', () => {
  let svc: CVaROptimizerService;

  beforeEach(() => {
    const mockPrisma = {
      balanceSheetItem: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any;
    svc = new CVaROptimizerService(mockPrisma);
  });

  it('should return demo result with correct shape when no items', async () => {
    const result = await svc.optimize('inst-1');
    expect(result).toHaveProperty('weights');
    expect(result).toHaveProperty('assetNames');
    expect(result).toHaveProperty('cvar');
    expect(result).toHaveProperty('var');
    expect(result).toHaveProperty('expectedReturn');
    expect(result).toHaveProperty('alpha');
    expect(result).toHaveProperty('scenarioCount');
    expect(result).toHaveProperty('efficientFrontier');
  });

  it('should have weights summing to approximately 1', async () => {
    const result = await svc.optimize('inst-1');
    const wSum = result.weights.reduce((s, w) => s + w, 0);
    expect(wSum).toBeCloseTo(1.0, 1);
  });

  it('should have CVaR >= VaR (expected shortfall >= value at risk)', async () => {
    const result = await svc.optimize('inst-1');
    expect(result.cvar).toBeGreaterThanOrEqual(result.var);
  });

  it('should produce efficient frontier with multiple points', async () => {
    const result = await svc.optimize('inst-1');
    expect(result.efficientFrontier.length).toBe(5);
    for (const point of result.efficientFrontier) {
      expect(point).toHaveProperty('targetReturn');
      expect(point).toHaveProperty('cvar');
      expect(point).toHaveProperty('weights');
    }
  });

  it('should default alpha to 0.05', async () => {
    const result = await svc.optimize('inst-1');
    expect(result.alpha).toBeCloseTo(0.05, 2);
  });
});
