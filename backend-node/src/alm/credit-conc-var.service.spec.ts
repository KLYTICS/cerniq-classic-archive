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
});
