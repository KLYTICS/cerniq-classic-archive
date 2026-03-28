import { RepricingGapService } from './repricing-gap.service';

describe('RepricingGapService', () => {
  let service: RepricingGapService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      balanceSheetItem: { findMany: jest.fn() },
    };
    service = new RepricingGapService(prisma);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── Demo fallback when no items ───────────────────────────

  it('returns demo result when no balance sheet items exist', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([]);

    const result = await service.getRepricingGap('inst_123');

    expect(result.buckets).toHaveLength(7);
    expect(result.totalAssets).toBe(445);
    expect(result.totalLiabilities).toBe(385);
    expect(result.durationGap).toBe(2.1);
    expect(result.policyLimitPct).toBe(15);
  });

  // ── Real items bucketed correctly ──────────────────────────

  it('distributes fixed-rate items into correct buckets based on duration', async () => {
    const now = Date.now();
    prisma.balanceSheetItem.findMany.mockResolvedValue([
      {
        category: 'asset',
        subcategory: 'loans',
        name: '5yr Fixed Loan',
        balance: 100,
        rate: 0.06,
        duration: 5,
        rateType: 'fixed',
        maturityDate: null,
        repriceDate: null,
      },
      {
        category: 'liability',
        subcategory: 'deposits',
        name: '1yr CD',
        balance: 80,
        rate: 0.03,
        duration: 1,
        rateType: 'fixed',
        maturityDate: null,
        repriceDate: null,
      },
    ]);

    const result = await service.getRepricingGap('inst_123');

    expect(result.totalAssets).toBeCloseTo(100, 0);
    expect(result.totalLiabilities).toBeCloseTo(80, 0);
    expect(result.buckets).toHaveLength(7);

    // 5yr loan: duration * 365 = 1825 days => "3-5 Years" bucket (1096-1825)
    const bucket3to5 = result.buckets.find((b) => b.label === '3–5 Years');
    expect(bucket3to5).toBeDefined();
    expect(bucket3to5!.assets).toBeCloseTo(100, 0);

    // 1yr CD: duration * 365 = 365 days => "181d-1 Year" bucket (181-365)
    const bucket1y = result.buckets.find((b) => b.label === '181d–1 Year');
    expect(bucket1y).toBeDefined();
    expect(bucket1y!.liabilities).toBeCloseTo(80, 0);
  });

  // ── Variable-rate items reprice quickly ────────────────────

  it('places variable-rate demand deposits in the 0-30 day bucket', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([
      {
        category: 'liability',
        subcategory: 'demand_deposits',
        name: 'Checking Accounts',
        balance: 200,
        rate: 0.005,
        duration: 0.1,
        rateType: 'variable',
        maturityDate: null,
        repriceDate: null,
      },
    ]);

    const result = await service.getRepricingGap('inst_123');

    const shortBucket = result.buckets.find((b) => b.label === '0–30 Days');
    expect(shortBucket).toBeDefined();
    expect(shortBucket!.liabilities).toBeCloseTo(200, 0);
  });

  // ── Policy breach detection ───────────────────────────────

  it('flags policy breach when gap exceeds limit', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([
      {
        category: 'asset',
        subcategory: 'loans',
        name: 'Big Loan',
        balance: 500,
        rate: 0.06,
        duration: 2,
        rateType: 'fixed',
        maturityDate: null,
        repriceDate: null,
      },
      {
        category: 'liability',
        subcategory: 'deposits',
        name: 'Small Deposit',
        balance: 10,
        rate: 0.02,
        duration: 2,
        rateType: 'fixed',
        maturityDate: null,
        repriceDate: null,
      },
    ]);

    // Very tight policy limit of 5%
    const result = await service.getRepricingGap('inst_123', 5);

    // The bucket containing both items should have a massive gap/assets ratio
    const breachedBuckets = result.buckets.filter((b) => b.isPolicyBreach);
    expect(breachedBuckets.length).toBeGreaterThan(0);
  });

  // ── Duration gap computation ──────────────────────────────

  it('computes correct duration gap from weighted averages', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([
      {
        category: 'asset',
        subcategory: 'loans',
        name: 'Loan A',
        balance: 100,
        rate: 0.05,
        duration: 4,
        rateType: 'fixed',
        maturityDate: null,
        repriceDate: null,
      },
      {
        category: 'liability',
        subcategory: 'deposits',
        name: 'Deposit A',
        balance: 80,
        rate: 0.02,
        duration: 1,
        rateType: 'fixed',
        maturityDate: null,
        repriceDate: null,
      },
    ]);

    const result = await service.getRepricingGap('inst_123');

    // Duration gap = asset weighted dur (4) - liability weighted dur (1) = 3
    expect(result.durationGap).toBeCloseTo(3.0, 1);
  });
});
