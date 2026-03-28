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
});
