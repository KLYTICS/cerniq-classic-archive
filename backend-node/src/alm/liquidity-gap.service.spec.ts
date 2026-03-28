import { LiquidityGapService } from './liquidity-gap.service';

describe('LiquidityGapService', () => {
  let service: LiquidityGapService;

  beforeEach(() => {
    service = new LiquidityGapService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns 13 time buckets for maturity gap analysis', () => {
    const result = service.analyze(1_000_000_000);
    expect(result.buckets).toHaveLength(13);
    expect(result.buckets[0].period).toBe('O/N');
    expect(result.buckets[12].period).toBe('>5Y');
  });

  it('cumulative gap builds correctly across buckets', () => {
    const result = service.analyze(1_000_000_000);
    let runningGap = 0;
    for (const bucket of result.buckets) {
      runningGap += bucket.netGap;
      expect(bucket.cumulativeGap).toBeCloseTo(runningGap, 0);
    }
  });

  it('cumulative gap pct is relative to total assets', () => {
    const totalAssets = 2_000_000_000;
    const result = service.analyze(totalAssets);

    for (const bucket of result.buckets) {
      const expectedPct = (bucket.cumulativeGap / totalAssets) * 100;
      expect(bucket.cumulativeGapPct).toBeCloseTo(expectedPct, 1);
    }
  });

  it('classifies status based on short-term gap severity', () => {
    const result = service.analyze(18_900_000_000);
    expect(['adequate', 'tight', 'critical']).toContain(result.status);
    expect(result.totalAssets).toBe(18_900_000_000);
    expect(result.totalLiabilities).toBeCloseTo(18_900_000_000 * 0.91, 0);
  });

  it('generates bilingual interpretation strings', () => {
    const result = service.analyze(1_000_000_000);
    expect(result.interpretation).toContain('Short-term');
    expect(result.interpretationEs).toContain('Brecha acumulada');
  });

  it('scales proportionally with total assets', () => {
    const result1 = service.analyze(1_000_000_000);
    const result2 = service.analyze(2_000_000_000);

    // Net gaps should scale by 2x
    expect(result2.buckets[0].netGap).toBeCloseTo(result1.buckets[0].netGap * 2, 0);
    expect(result2.shortTermGap).toBeCloseTo(result1.shortTermGap * 2, 0);
  });
});
