import { EarningsAtRiskService } from './earnings-at-risk.service';

describe('EarningsAtRiskService', () => {
  let svc: EarningsAtRiskService;

  beforeEach(() => {
    const mockPrisma = {
      institution: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    svc = new EarningsAtRiskService(mockPrisma);
  });

  it('should return correct output shape from demo data', async () => {
    const result = await svc.calculateEaR('inst-1');
    expect(result).toHaveProperty('baseNII');
    expect(result).toHaveProperty('horizonQuarters');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('earAmount');
    expect(result).toHaveProperty('earPct');
    expect(result).toHaveProperty('scenarios');
    expect(result).toHaveProperty('distribution');
    expect(result).toHaveProperty('interpretation');
    expect(result).toHaveProperty('interpretationEs');
  });

  it('should have positive EaR amount', async () => {
    const result = await svc.calculateEaR('inst-1');
    expect(result.earAmount).toBeGreaterThan(0);
  });

  it('should have EaR percentage between 0 and 100', async () => {
    const result = await svc.calculateEaR('inst-1');
    expect(result.earPct).toBeGreaterThan(0);
    expect(result.earPct).toBeLessThan(100);
  });

  it('should default to 95% confidence and 4 quarters', async () => {
    const result = await svc.calculateEaR('inst-1');
    expect(result.confidence).toBeCloseTo(0.95, 2);
    expect(result.horizonQuarters).toBe(4);
  });

  it('should filter scenarios to +/- 200bps', async () => {
    const result = await svc.calculateEaR('inst-1');
    for (const scenario of result.scenarios) {
      expect(Math.abs(scenario.shockBps)).toBeLessThanOrEqual(200);
    }
  });

  it('should produce distribution with cumulative approaching 1', async () => {
    const result = await svc.calculateEaR('inst-1');
    expect(result.distribution.length).toBeGreaterThan(0);
    const lastCum =
      result.distribution[result.distribution.length - 1].cumulative;
    expect(lastCum).toBeCloseTo(1, 0);
  });
});
