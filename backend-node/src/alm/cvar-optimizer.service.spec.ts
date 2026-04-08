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

  it('should produce efficient frontier with 5 points', async () => {
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

  it('demo result has 6 asset names', async () => {
    const result = await svc.optimize('inst-1');
    expect(result.assetNames).toHaveLength(6);
    expect(result.weights).toHaveLength(6);
  });

  it('demo scenarioCount is 500', async () => {
    const result = await svc.optimize('inst-1');
    expect(result.scenarioCount).toBe(500);
  });

  it('accepts custom alpha', async () => {
    const result = await svc.optimize('inst-1', 0.01);
    expect(result.alpha).toBeCloseTo(0.01, 2);
  });

  it('efficient frontier weights each sum to approximately 1', async () => {
    const result = await svc.optimize('inst-1');
    for (const point of result.efficientFrontier) {
      const wSum = point.weights.reduce((s, w) => s + w, 0);
      expect(wSum).toBeCloseTo(1.0, 1);
    }
  });

  // ── With real balance sheet items ──────────────────────────
  describe('with real balance sheet data', () => {
    let svcReal: CVaROptimizerService;

    beforeEach(() => {
      const items = [
        { category: 'asset', subcategory: 'cash', balance: 20, rate: 0.02 },
        {
          category: 'asset',
          subcategory: 'securities',
          balance: 40,
          rate: 0.045,
        },
        {
          category: 'asset',
          subcategory: 'consumer_loans',
          balance: 60,
          rate: 0.065,
        },
        {
          category: 'asset',
          subcategory: 'mortgage',
          balance: 30,
          rate: 0.055,
        },
      ];
      const mockPrisma = {
        balanceSheetItem: {
          findMany: jest.fn().mockResolvedValue(items),
        },
      } as any;
      svcReal = new CVaROptimizerService(mockPrisma);
    });

    it('returns weights matching the number of unique subcategories', async () => {
      const result = await svcReal.optimize('inst-1');
      expect(result.weights.length).toBe(4);
      expect(result.assetNames.length).toBe(4);
    });

    it('all weights are non-negative', async () => {
      const result = await svcReal.optimize('inst-1');
      for (const w of result.weights) {
        expect(w).toBeGreaterThanOrEqual(0);
      }
    });

    it('CVaR is a finite number', async () => {
      const result = await svcReal.optimize('inst-1');
      expect(Number.isFinite(result.cvar)).toBe(true);
    });

    it('expected return is positive for real data', async () => {
      const result = await svcReal.optimize('inst-1');
      expect(result.expectedReturn).toBeGreaterThan(0);
    });

    it('efficient frontier has increasing target returns', async () => {
      const result = await svcReal.optimize('inst-1');
      const targets = result.efficientFrontier.map((p) => p.targetReturn);
      for (let i = 1; i < targets.length; i++) {
        expect(targets[i]).toBeGreaterThanOrEqual(targets[i - 1]);
      }
    });

    it('computes 500 Monte Carlo scenarios', async () => {
      const result = await svcReal.optimize('inst-1');
      expect(result.scenarioCount).toBe(500);
    });
  });
});
