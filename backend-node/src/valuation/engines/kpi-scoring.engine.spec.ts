import { KPIScoringEngine } from './kpi-scoring.engine';

describe('KPIScoringEngine', () => {
  let engine: KPIScoringEngine;

  beforeEach(() => {
    engine = new KPIScoringEngine();
    jest.restoreAllMocks();
  });

  it('calculates a rounded KPI score with deterministic momentum and margin randomness', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.25);

    const result = await engine.calculate(
      'AAPL',
      { peRatio: 18 },
      { price: 150 },
    );

    expect(result).toEqual({
      ticker: 'AAPL',
      overallScore: 64,
      fundamentalScore: 62,
      momentumScore: 63,
      valuationScore: 68,
      qualityScore: 62,
      breakdown: {
        revenueGrowth: 50,
        marginTrend: 70,
        roic: 66.66666666666667,
        debtToEquity: 50,
        fcfYield: 50,
        peRatio: 85,
        priceToSales: 70,
      },
    });
  });

  it('scores valuation and quality components from their helper methods', () => {
    expect((engine as any).scorePE({ peRatio: 15 })).toBe(100);
    expect((engine as any).scorePE({ peRatio: 40 })).toBe(0);
    expect((engine as any).scorePriceToSales({})).toBe(70);
    expect((engine as any).scoreDebtLevel({})).toBe(50);
    expect((engine as any).scoreFCFYield({})).toBe(50);
    expect((engine as any).scoreROIC({})).toBeCloseTo(66.66666666666667, 5);
  });
});
