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
  });

  it('should have per-segment contributions that are positive', async () => {
    const result = await svc.computePortfolioVaR('inst-1');
    for (const seg of result.perSegmentContribution) {
      expect(seg.marginalVaR).toBeGreaterThan(0);
      expect(seg.pctOfTotal).toBeGreaterThan(0);
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
      expect(result.portfolioES99).toBeGreaterThanOrEqual(result.portfolioVaR99);
    });

    it('economic capital includes 1.06x multiplier on unexpected loss', async () => {
      const result = await svcReal.computePortfolioVaR('inst-1', 5000);
      expect(result.economicCapital).toBeCloseTo(result.unexpectedLoss * 1.06, 0);
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
  });
});
