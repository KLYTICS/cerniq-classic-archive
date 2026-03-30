import { CyclicalValuationEngine } from './cyclical.engine';

describe('CyclicalValuationEngine', () => {
  let engine: CyclicalValuationEngine;

  beforeEach(() => {
    engine = new CyclicalValuationEngine();
    jest.restoreAllMocks();
  });

  it('calculates a cyclical valuation with deterministic growth and margin signals', async () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(1).mockReturnValueOnce(0.1);

    const result = await engine.calculate('CLF', 50, { eps: 5 });

    expect(result).toMatchObject({
      ticker: 'CLF',
      currentPrice: 50,
      cycleStage: 'mid',
      revenueGrowth: 20,
      marginTrend: 'contracting',
      normalizedEarnings: 5,
      peMultiple: 12,
    });
    expect(result.fairValue).toBe(60);
    expect(result.fairValueLow).toBeCloseTo(48, 5);
    expect(result.fairValueHigh).toBeCloseTo(72, 5);
    expect(result.upside).toBe(20);
  });

  it('identifies all cycle stages from revenue growth thresholds', () => {
    expect((engine as any).identifyCycleStage(-11)).toBe('trough');
    expect((engine as any).identifyCycleStage(-1)).toBe('late');
    expect((engine as any).identifyCycleStage(5)).toBe('early');
    expect((engine as any).identifyCycleStage(20)).toBe('mid');
    expect((engine as any).identifyCycleStage(30)).toBe('peak');
  });

  it('normalizes earnings and multiples by cycle stage', () => {
    expect((engine as any).normalizeToCycle(10, 'trough')).toBe(15);
    expect((engine as any).normalizeToCycle(10, 'peak')).toBe(7);
    expect((engine as any).normalizeToCycle(10, 'unknown')).toBe(10);
    expect((engine as any).getMidCycleMultiple('CLF', 'trough')).toBeCloseTo(
      14.4,
      5,
    );
    expect((engine as any).getMidCycleMultiple('CLF', 'peak')).toBeCloseTo(9.6);
  });

  it('classifies margin trends from deterministic random values', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.9);
    expect((engine as any).analyzeMarginTrend({})).toBe('expanding');

    jest.spyOn(Math, 'random').mockReturnValueOnce(0.1);
    expect((engine as any).analyzeMarginTrend({})).toBe('contracting');

    jest.spyOn(Math, 'random').mockReturnValueOnce(0.5);
    expect((engine as any).analyzeMarginTrend({})).toBe('stable');
  });
});
