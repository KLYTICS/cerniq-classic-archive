import { InterestRateGapRatioService } from './interest-rate-gap-ratio.service';

describe('InterestRateGapRatioService', () => {
  let service: InterestRateGapRatioService;

  beforeEach(() => {
    service = new InterestRateGapRatioService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should calculate gap ratios for matching buckets', () => {
    const result = service.calculate({
      repricingAssets: [50, 30, 20],
      repricingLiabilities: [40, 35, 25],
      totalAssets: 100,
      bucketLabels: ['0-1Y', '1-3Y', '3-5Y'],
    });

    expect(result.buckets.length).toBe(3);
    expect(result.buckets[0].gap).toBe(10); // 50 - 40
    expect(result.buckets[0].gapRatio).toBe(10); // 10/100 * 100
  });

  it('should compute cumulative gap ratio correctly', () => {
    const result = service.calculate({
      repricingAssets: [60, 20],
      repricingLiabilities: [30, 50],
      totalAssets: 100,
      bucketLabels: ['0-1Y', '1-3Y'],
    });

    expect(result.buckets[0].cumGapRatio).toBe(30); // 30/100 * 100
    expect(result.buckets[1].cumGapRatio).toBe(0); // (30 + -30)/100 * 100
  });

  it('should identify well-managed gap when max ratio < 5%', () => {
    const result = service.calculate({
      repricingAssets: [51, 49],
      repricingLiabilities: [50, 50],
      totalAssets: 100,
      bucketLabels: ['0-1Y', '1-3Y'],
    });

    expect(result.interpretation).toContain('Well managed');
  });

  it('should flag significant mismatch when max ratio >= 5%', () => {
    const result = service.calculate({
      repricingAssets: [80, 20],
      repricingLiabilities: [20, 80],
      totalAssets: 100,
      bucketLabels: ['0-1Y', '1-3Y'],
    });

    expect(result.interpretation).toContain('Significant repricing mismatch');
  });

  it('should provide bilingual interpretations', () => {
    const result = service.calculate({
      repricingAssets: [50],
      repricingLiabilities: [50],
      totalAssets: 100,
      bucketLabels: ['0-1Y'],
    });

    expect(result.interpretationEs).toContain('Ratio gap acumulado');
  });
});
