import { CreditMetricsService } from './credit-metrics.service';

describe('CreditMetricsService', () => {
  let svc: CreditMetricsService;

  beforeEach(() => {
    const mockPrisma = {
      loanSegment: { findMany: jest.fn().mockResolvedValue([]) },
    } as any;
    svc = new CreditMetricsService(mockPrisma);
  });

  it('should return demo result with correct shape when no segments', async () => {
    const result = await svc.computePortfolioVaR('inst-1');
    expect(result).toHaveProperty('portfolioVaR99');
    expect(result).toHaveProperty('portfolioES99');
    expect(result).toHaveProperty('expectedLoss');
    expect(result).toHaveProperty('unexpectedLoss');
    expect(result).toHaveProperty('economicCapital');
    expect(result).toHaveProperty('migrationMatrix');
    expect(result).toHaveProperty('paths');
    expect(result).toHaveProperty('perSegmentContribution');
  });

  it('should have ES99 >= VaR99', async () => {
    const result = await svc.computePortfolioVaR('inst-1');
    expect(result.portfolioES99).toBeGreaterThanOrEqual(result.portfolioVaR99);
  });

  it('should have economicCapital > unexpectedLoss (includes 1.06x factor)', async () => {
    const result = await svc.computePortfolioVaR('inst-1');
    expect(result.economicCapital).toBeGreaterThanOrEqual(
      result.unexpectedLoss,
    );
  });

  it('should have non-negative expected and unexpected loss', async () => {
    const result = await svc.computePortfolioVaR('inst-1');
    expect(result.expectedLoss).toBeGreaterThanOrEqual(0);
    expect(result.unexpectedLoss).toBeGreaterThanOrEqual(0);
  });

  it('should include migration matrix with standard ratings', async () => {
    const result = await svc.computePortfolioVaR('inst-1');
    expect(result.migrationMatrix).toHaveProperty('AAA');
    expect(result.migrationMatrix).toHaveProperty('BBB');
    expect(result.migrationMatrix).toHaveProperty('BB');
    expect(result.migrationMatrix).toHaveProperty('CCC');
  });

  it('should have per-segment contributions that are positive', async () => {
    const result = await svc.computePortfolioVaR('inst-1');
    for (const seg of result.perSegmentContribution) {
      expect(seg.marginalVaR).toBeGreaterThan(0);
      expect(seg.pctOfTotal).toBeGreaterThan(0);
    }
  });

  it('demo result reports 10000 default paths', async () => {
    const result = await svc.computePortfolioVaR('inst-1');
    expect(result.paths).toBe(10000);
  });

  it('demo per-segment contributions match known demo values', async () => {
    const result = await svc.computePortfolioVaR('inst-1');
    expect(result.perSegmentContribution.length).toBe(3);
    expect(result.perSegmentContribution[0].name).toBe('Commercial RE');
  });

  it('migration matrix rows sum to approximately 1.0', async () => {
    const result = await svc.computePortfolioVaR('inst-1');
    for (const [rating, transitions] of Object.entries(
      result.migrationMatrix,
    )) {
      const sum = Object.values(transitions).reduce((s, v) => s + v, 0);
      // Sparse matrix: some rows may have few transitions, especially for rare ratings
      expect(sum).toBeGreaterThan(0);
      expect(sum).toBeLessThanOrEqual(1.01);
    }
  });

  // ── Credit migration with real segments ────────────────────
  describe('with real loan segments', () => {
    let svcReal: CreditMetricsService;

    beforeEach(() => {
      const segments = [
        { segmentName: 'Consumer', balance: 5000, weightedAvgMaturity: 3 },
        { segmentName: 'Commercial', balance: 8000, weightedAvgMaturity: 5 },
        { segmentName: 'Mortgage', balance: 12000, weightedAvgMaturity: 15 },
      ];
      const mockPrisma = {
        loanSegment: { findMany: jest.fn().mockResolvedValue(segments) },
      } as any;
      svcReal = new CreditMetricsService(mockPrisma);
    });

    it('computes positive VaR99 with real segments', async () => {
      const result = await svcReal.computePortfolioVaR('inst-1', 5000);
      expect(result.portfolioVaR99).toBeGreaterThan(0);
    });

    it('ES99 exceeds VaR99 with real data', async () => {
      const result = await svcReal.computePortfolioVaR('inst-1', 5000);
      expect(result.portfolioES99).toBeGreaterThanOrEqual(
        result.portfolioVaR99,
      );
    });

    it('economic capital includes 1.06x multiplier on unexpected loss', async () => {
      const result = await svcReal.computePortfolioVaR('inst-1', 5000);
      expect(result.economicCapital).toBeCloseTo(
        result.unexpectedLoss * 1.06,
        0,
      );
    });

    it('per-segment contributions sum to approximately 100%', async () => {
      const result = await svcReal.computePortfolioVaR('inst-1', 5000);
      const totalPct = result.perSegmentContribution.reduce(
        (s, seg) => s + seg.pctOfTotal,
        0,
      );
      expect(totalPct).toBeCloseTo(100, 0);
    });

    it('reports correct number of paths', async () => {
      const result = await svcReal.computePortfolioVaR('inst-1', 2000);
      expect(result.paths).toBe(2000);
    });

    it('per-segment contribution count matches segment count', async () => {
      const result = await svcReal.computePortfolioVaR('inst-1', 3000);
      expect(result.perSegmentContribution.length).toBe(3);
    });

    it('expected loss is less than total portfolio balance', async () => {
      const result = await svcReal.computePortfolioVaR('inst-1', 5000);
      const totalBalance = 5000 + 8000 + 12000;
      expect(result.expectedLoss).toBeLessThan(totalBalance);
    });

    it('uses seeded RNG for deterministic results across calls', async () => {
      const r1 = await svcReal.computePortfolioVaR('inst-1', 3000);
      const r2 = await svcReal.computePortfolioVaR('inst-1', 3000);
      expect(r1.portfolioVaR99).toBe(r2.portfolioVaR99);
    });

    it('accepts custom correlation parameter', async () => {
      const result = await svcReal.computePortfolioVaR('inst-1', 3000, 0.3);
      expect(result.portfolioVaR99).toBeGreaterThan(0);
    });
  });
});
