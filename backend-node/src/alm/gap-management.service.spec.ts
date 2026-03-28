import {
  GapManagementService,
  GapManagementParams,
} from './gap-management.service';

// ─── Test fixtures ──────────────────────────────────────────────────

const BUCKETS = ['0-30d', '31-90d', '91-180d', '181d-1y', '1-3y', '3-5y', '5y+'];

const BASE_PARAMS: GapManagementParams = {
  assets: [
    { name: 'Cash', balance: 10_000_000, repricingBucket: '0-30d' },
    { name: 'Fed Funds', balance: 5_000_000, repricingBucket: '0-30d' },
    { name: 'Commercial Loans', balance: 30_000_000, repricingBucket: '31-90d' },
    { name: 'Auto Loans', balance: 20_000_000, repricingBucket: '1-3y' },
    { name: 'Fixed Mortgages', balance: 50_000_000, repricingBucket: '5y+' },
  ],
  liabilities: [
    { name: 'Demand Deposits', balance: 40_000_000, repricingBucket: '0-30d' },
    { name: 'Money Market', balance: 20_000_000, repricingBucket: '31-90d' },
    { name: 'CDs 6mo', balance: 15_000_000, repricingBucket: '91-180d' },
    { name: 'CDs 1y', balance: 10_000_000, repricingBucket: '181d-1y' },
    { name: 'Borrowings', balance: 10_000_000, repricingBucket: '3-5y' },
  ],
  repricingBuckets: BUCKETS,
};

describe('GapManagementService', () => {
  let svc: GapManagementService;

  beforeEach(() => {
    svc = new GapManagementService();
  });

  // ─── Test 1: Returns correct number of buckets ───────────────────

  it('should return a result for each repricing bucket', () => {
    const result = svc.analyzeGap(BASE_PARAMS);
    expect(result.buckets).toHaveLength(7);
    expect(result.buckets.map((b) => b.period)).toEqual(BUCKETS);
  });

  // ─── Test 2: Total assets and liabilities correct ────────────────

  it('should compute total assets and liabilities correctly', () => {
    const result = svc.analyzeGap(BASE_PARAMS);
    expect(result.totalAssets).toBe(115_000_000);
    expect(result.totalLiabilities).toBe(95_000_000);
    expect(result.totalGap).toBe(20_000_000);
  });

  // ─── Test 3: Gap = asset - liability repricing per bucket ────────

  it('should compute gap as asset minus liability repricing per bucket', () => {
    const result = svc.analyzeGap(BASE_PARAMS);
    const firstBucket = result.buckets[0]; // 0-30d
    // Assets: 10M + 5M = 15M, Liabilities: 40M => gap = -25M
    expect(firstBucket.assetRepricing).toBe(15_000_000);
    expect(firstBucket.liabilityRepricing).toBe(40_000_000);
    expect(firstBucket.gap).toBe(-25_000_000);
  });

  // ─── Test 4: Cumulative gap is running total ─────────────────────

  it('should compute cumulative gap as running total across buckets', () => {
    const result = svc.analyzeGap(BASE_PARAMS);
    let running = 0;
    for (const bucket of result.buckets) {
      running += bucket.gap;
      expect(bucket.cumulativeGap).toBeCloseTo(running, 0);
    }
  });

  // ─── Test 5: Sensitivity is gap × shock ──────────────────────────

  it('should compute sensitivity as gap times rate shock', () => {
    const result = svc.analyzeGap({ ...BASE_PARAMS, shockBps: 100 });
    for (const bucket of result.buckets) {
      expect(bucket.sensitivity).toBeCloseTo(bucket.gap * 0.01, 0);
    }
  });

  // ─── Test 6: Custom shock propagates ─────────────────────────────

  it('should apply a custom shock of 200bps', () => {
    const result = svc.analyzeGap({ ...BASE_PARAMS, shockBps: 200 });
    const firstBucket = result.buckets[0];
    expect(firstBucket.sensitivity).toBeCloseTo(firstBucket.gap * 0.02, 0);
  });

  // ─── Test 7: Largest gap bucket is identified ────────────────────

  it('should identify the bucket with the largest absolute gap', () => {
    const result = svc.analyzeGap(BASE_PARAMS);
    expect(typeof result.largestGapBucket).toBe('string');
    const maxGap = Math.max(...result.buckets.map((b) => Math.abs(b.gap)));
    const maxBucket = result.buckets.find((b) => Math.abs(b.gap) === maxGap);
    expect(result.largestGapBucket).toBe(maxBucket!.period);
  });

  // ─── Test 8: Throws on empty buckets ─────────────────────────────

  it('should throw when repricing buckets list is empty', () => {
    const params: GapManagementParams = {
      ...BASE_PARAMS,
      repricingBuckets: [],
    };
    expect(() => svc.analyzeGap(params)).toThrow('At least one repricing bucket');
  });

  // ─── Test 9: Standard buckets returns 7 ──────────────────────────

  it('should return 7 standard regulatory buckets', () => {
    const buckets = svc.standardBuckets();
    expect(buckets).toHaveLength(7);
    expect(buckets[0]).toBe('0-30d');
    expect(buckets[6]).toBe('5y+');
  });

  // ─── Test 10: Zero activity buckets have zero gap ────────────────

  it('should show zero gap for buckets with no assets or liabilities', () => {
    const result = svc.analyzeGap(BASE_PARAMS);
    // '91-180d' has 0 assets, 15M liabilities
    const bucket180 = result.buckets.find((b) => b.period === '91-180d')!;
    expect(bucket180.assetRepricing).toBe(0);
    expect(bucket180.liabilityRepricing).toBe(15_000_000);
    expect(bucket180.gap).toBe(-15_000_000);
  });
});
