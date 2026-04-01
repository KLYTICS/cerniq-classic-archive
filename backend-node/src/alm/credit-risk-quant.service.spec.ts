import { CreditRiskQuantService } from './credit-risk-quant.service';

describe('CreditRiskQuantService', () => {
  let svc: CreditRiskQuantService;

  beforeEach(() => {
    const mockPrisma = {
      loanSegment: { findMany: jest.fn().mockResolvedValue([]) },
      institution: { findUnique: jest.fn().mockResolvedValue(null) },
    } as any;
    svc = new CreditRiskQuantService(mockPrisma);
  });

  it('should return portfolio with correct shape using demo data', async () => {
    const result = await svc.analyzePortfolio('inst-1');
    expect(result).toHaveProperty('segments');
    expect(result).toHaveProperty('totalEAD');
    expect(result).toHaveProperty('totalEL');
    expect(result).toHaveProperty('totalUL');
    expect(result).toHaveProperty('totalEC');
    expect(result).toHaveProperty('portfolioElPct');
    expect(result).toHaveProperty('portfolioEcPct');
    expect(result).toHaveProperty('capitalAdequacy');
    expect(result.segments.length).toBe(6);
  });

  it('should have economic capital >= unexpected loss per segment', async () => {
    const result = await svc.analyzePortfolio('inst-1');
    for (const seg of result.segments) {
      expect(seg.economicCapital).toBeGreaterThanOrEqual(seg.unexpectedLoss);
    }
  });

  it('should compute totalEAD as sum of segment balances', async () => {
    const result = await svc.analyzePortfolio('inst-1');
    const sumBalances = result.segments.reduce((s, seg) => s + seg.balance, 0);
    expect(result.totalEAD).toBeCloseTo(sumBalances, 0);
  });

  it('should have annual PD between 0 and 1 for all segments', async () => {
    const result = await svc.analyzePortfolio('inst-1');
    for (const seg of result.segments) {
      expect(seg.annualPD).toBeGreaterThan(0);
      expect(seg.annualPD).toBeLessThanOrEqual(1);
    }
  });

  it('should have lifetime PD >= annual PD for all segments', async () => {
    const result = await svc.analyzePortfolio('inst-1');
    for (const seg of result.segments) {
      expect(seg.lifetimePD).toBeGreaterThanOrEqual(seg.annualPD);
    }
  });

  it('should assess capital adequacy', async () => {
    const result = await svc.analyzePortfolio('inst-1');
    expect(result.capitalAdequacy).toHaveProperty('actualCapital');
    expect(result.capitalAdequacy).toHaveProperty('requiredEconomicCapital');
    expect(result.capitalAdequacy).toHaveProperty('capitalSurplus');
    expect(result.capitalAdequacy).toHaveProperty('isAdequate');
  });

  // ── Coverage: with real loan segments ──────────────────────────
  it('uses real loan segments when available', async () => {
    const mockPrismaReal = {
      loanSegment: {
        findMany: jest.fn().mockResolvedValue([
          { segmentName: 'residential_mortgage', balance: 5000, historicalLossRate: 0.01, avgLTV: 0.75, avgDSCR: 1.3, avgAge: 3 },
          { segmentName: 'auto_loans', balance: 3000, historicalLossRate: 0.02, avgLTV: 0, avgDSCR: 0, avgAge: 2 },
        ]),
      },
      institution: { findUnique: jest.fn().mockResolvedValue({ id: 'inst-real', totalAssets: 10000 }) },
    } as any;
    const realSvc = new CreditRiskQuantService(mockPrismaReal);
    const result = await realSvc.analyzePortfolio('inst-real');
    expect(result.totalEAD).toBeGreaterThan(0);
    expect(result.segments.length).toBeGreaterThanOrEqual(2);
  });

  // ── Coverage: LGD and correlation for each segment type ──────
  it('computes different PD/LGD for each segment type', async () => {
    const result = await svc.analyzePortfolio('inst-1');
    const names = result.segments.map(s => s.segmentName);
    expect(names).toContain('residential_mortgage');
    expect(names).toContain('auto_loans');
    expect(names).toContain('consumer_loans');
    // LGDs should differ by segment
    const lgds = result.segments.map(s => s.lgd);
    expect(new Set(lgds).size).toBeGreaterThan(1);
  });

  // ── Coverage: portfolioElPct and portfolioEcPct ──────────────
  it('computes portfolio-level EL and EC percentages', async () => {
    const result = await svc.analyzePortfolio('inst-1');
    expect(result.portfolioElPct).toBeGreaterThan(0);
    expect(result.portfolioElPct).toBeLessThan(100);
    expect(result.portfolioEcPct).toBeGreaterThan(0);
  });
});
