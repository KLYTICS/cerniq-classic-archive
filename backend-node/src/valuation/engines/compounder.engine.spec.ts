import { CompounderValuationEngine } from './compounder.engine';

describe('CompounderValuationEngine', () => {
  let engine: CompounderValuationEngine;

  beforeEach(() => {
    engine = new CompounderValuationEngine();
    jest.restoreAllMocks();
  });

  it('calculates a deterministic compounder valuation when randomness is controlled', async () => {
    jest
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.25);

    const result = await engine.calculate('AAPL', 150, {
      eps: 10,
      fcf: 20,
      revenue: 100,
    });

    expect(result).toMatchObject({
      ticker: 'AAPL',
      currentPrice: 150,
      qualityScore: expect.any(Number),
      roicSpread: expect.any(Number),
      revenueGrowth: 17.5,
      marginStability: 70,
      cashConversion: 2,
      peMultiple: expect.any(Number),
      pegRatio: expect.any(Number),
    });
    expect(result.fairValue).toBeCloseTo(232.86, 2);
    expect(result.upside).toBeCloseTo(55.24, 2);
    expect(result.qualityScore).toBeCloseTo(80.38, 2);
    expect(result.peMultiple).toBeCloseTo(23.29, 2);
  });

  it('clamps the quality score between zero and one hundred', () => {
    expect(
      (engine as any).calculateQualityScore({
        roicSpread: 10,
        revenueGrowth: 100,
        marginStability: 200,
        cashConversion: 20,
      }),
    ).toBe(100);

    expect(
      (engine as any).calculateQualityScore({
        roicSpread: -10,
        revenueGrowth: -100,
        marginStability: -50,
        cashConversion: -1,
      }),
    ).toBe(0);
  });

  it('computes a quality-adjusted multiple from quality and growth', () => {
    expect((engine as any).getQualityAdjustedMultiple(80, 20)).toBeCloseTo(
      23.4,
      5,
    );
  });
});
