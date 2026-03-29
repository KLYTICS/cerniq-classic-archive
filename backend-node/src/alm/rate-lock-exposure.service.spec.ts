import { RateLockExposureService } from './rate-lock-exposure.service';

describe('RateLockExposureService', () => {
  let service: RateLockExposureService;

  beforeEach(() => {
    service = new RateLockExposureService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('computes pipeline and exposure from rate locks', () => {
    const result = service.analyze({
      locks: [
        { type: 'mortgage', amount: 500_000, rate: 0.065, daysToClose: 30, pullThroughPct: 80 },
        { type: 'auto', amount: 30_000, rate: 0.055, daysToClose: 15, pullThroughPct: 90 },
      ],
      currentMarketRate: 0.06,
    });

    expect(result.totalPipeline).toBe(530_000);
    expect(result.expectedFunding).toBe(400_000 + 27_000);
    expect(result.rateExposure).toBeGreaterThan(0);
    expect(result.locks).toHaveLength(2);
    expect(result.interpretation).toContain('Pipeline');
    expect(result.interpretationEs).toContain('Pipeline');
  });

  it('gap bps reflects rate vs market difference', () => {
    const result = service.analyze({
      locks: [
        { type: 'mortgage', amount: 100_000, rate: 0.07, daysToClose: 30, pullThroughPct: 100 },
      ],
      currentMarketRate: 0.06,
    });

    expect(result.locks[0].gapBps).toBe(100); // (0.07 - 0.06) * 10000 = 100 bps
    expect(result.locks[0].expectedAmount).toBe(100_000);
  });

  it('returns zero exposure when rate matches market', () => {
    const result = service.analyze({
      locks: [
        { type: 'mortgage', amount: 200_000, rate: 0.06, daysToClose: 30, pullThroughPct: 100 },
      ],
      currentMarketRate: 0.06,
    });

    expect(result.locks[0].gapBps).toBe(0);
    expect(result.locks[0].exposure).toBe(0);
    expect(result.rateExposure).toBe(0);
  });

  it('handles empty locks array', () => {
    const result = service.analyze({
      locks: [],
      currentMarketRate: 0.05,
    });

    expect(result.totalPipeline).toBe(0);
    expect(result.expectedFunding).toBe(0);
    expect(result.rateExposure).toBe(0);
    expect(result.locks).toHaveLength(0);
  });

  it('pull-through percentage reduces expected funding', () => {
    const result = service.analyze({
      locks: [
        { type: 'mortgage', amount: 1_000_000, rate: 0.065, daysToClose: 45, pullThroughPct: 50 },
      ],
      currentMarketRate: 0.06,
    });

    expect(result.locks[0].expectedAmount).toBe(500_000);
    expect(result.totalPipeline).toBe(1_000_000);
    expect(result.expectedFunding).toBe(500_000);
  });
});
