import { CreditConcentrationVaRService } from './credit-conc-var.service';

describe('CreditConcentrationVaRService', () => {
  let svc: CreditConcentrationVaRService;

  beforeEach(() => {
    const mockPrisma = {
      loanSegment: { findMany: jest.fn().mockResolvedValue([]) },
    } as any;
    svc = new CreditConcentrationVaRService(mockPrisma);
  });

  it('should return demo result with correct shape when no segments', async () => {
    const result = await svc.compute('inst-1');
    expect(result).toHaveProperty('herfindahlIndex');
    expect(result).toHaveProperty('granularityAdjustment');
    expect(result).toHaveProperty('diversifiedVaR');
    expect(result).toHaveProperty('concentrationVaR');
    expect(result).toHaveProperty('concentrationPremium');
    expect(result).toHaveProperty('topConcentrations');
    expect(result).toHaveProperty('narrativeEn');
    expect(result).toHaveProperty('narrativeEs');
  });

  it('should have concentrationVaR >= diversifiedVaR', async () => {
    const result = await svc.compute('inst-1');
    expect(result.concentrationVaR).toBeGreaterThanOrEqual(
      result.diversifiedVaR,
    );
  });

  it('should have premium equal to concentrationVaR minus diversifiedVaR', async () => {
    const result = await svc.compute('inst-1');
    expect(result.concentrationPremium).toBeCloseTo(
      result.concentrationVaR - result.diversifiedVaR,
      1,
    );
  });

  it('should have HHI between 0 and 1', async () => {
    const result = await svc.compute('inst-1');
    expect(result.herfindahlIndex).toBeGreaterThanOrEqual(0);
    expect(result.herfindahlIndex).toBeLessThanOrEqual(1);
  });

  it('should sort topConcentrations by share descending', async () => {
    const result = await svc.compute('inst-1');
    for (let i = 0; i < result.topConcentrations.length - 1; i++) {
      expect(
        result.topConcentrations[i].shareOfPortfolio,
      ).toBeGreaterThanOrEqual(
        result.topConcentrations[i + 1].shareOfPortfolio,
      );
    }
  });

  // ── Concentration VaR with real segment data ───────────────
  describe('with real loan segments', () => {
    let svcReal: CreditConcentrationVaRService;

    beforeEach(() => {
      const segments = [
        { segmentName: 'Commercial RE', balance: 5000, historicalLossRate: 0.03, lgd: 0.45 },
        { segmentName: 'Consumer', balance: 3000, historicalLossRate: 0.04, lgd: 0.5 },
        { segmentName: 'Mortgage', balance: 2000, historicalLossRate: 0.01, lgd: 0.35 },
      ];
      const mockPrisma = {
        loanSegment: { findMany: jest.fn().mockResolvedValue(segments) },
      } as any;
      svcReal = new CreditConcentrationVaRService(mockPrisma);
    });

    it('computes HHI reflecting real segment concentration', async () => {
      const result = await svcReal.compute('inst-1');
      // HHI = (5000/10000)^2 + (3000/10000)^2 + (2000/10000)^2 = 0.25 + 0.09 + 0.04 = 0.38
      expect(result.herfindahlIndex).toBeCloseTo(0.38, 1);
      expect(result.herfindahlIndex).toBeGreaterThan(0.15); // concentrated
    });

    it('granularity adjustment is positive for concentrated portfolio', async () => {
      const result = await svcReal.compute('inst-1');
      expect(result.granularityAdjustment).toBeGreaterThan(0);
    });

    it('concentration premium percentage is positive', async () => {
      const result = await svcReal.compute('inst-1');
      expect(result.concentrationPremiumPct).toBeGreaterThan(0);
    });

    it('narrativeEn mentions elevated concentration for HHI > 0.15', async () => {
      const result = await svcReal.compute('inst-1');
      expect(result.narrativeEn).toContain('Elevated concentration risk');
    });

    it('returns at most 5 top concentrations', async () => {
      const result = await svcReal.compute('inst-1');
      expect(result.topConcentrations.length).toBeLessThanOrEqual(5);
      expect(result.topConcentrations.length).toBe(3); // we have 3 segments
    });
  });

  // ── Edge case: zero-balance segments ───────────────────────
  it('returns demo result when all segments have zero balance', async () => {
    const mockPrisma = {
      loanSegment: { findMany: jest.fn().mockResolvedValue([
        { segmentName: 'Empty', balance: 0, historicalLossRate: 0, lgd: 0 },
      ]) },
    } as any;
    const svcZero = new CreditConcentrationVaRService(mockPrisma);
    const result = await svcZero.compute('inst-1');
    // Should return demo result since totalLoans === 0
    expect(result.herfindahlIndex).toBe(0.185);
  });
});
