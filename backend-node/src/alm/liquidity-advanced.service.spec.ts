import { LiquidityAdvancedService } from './liquidity-advanced.service';

describe('LiquidityAdvancedService', () => {
  let service: LiquidityAdvancedService;

  const mockPrisma = {
    balanceSheetItem: { findMany: jest.fn() },
    liquidityPosition: { findFirst: jest.fn() },
    depositTier: { findMany: jest.fn() },
  };

  beforeEach(() => {
    service = new LiquidityAdvancedService(mockPrisma as any);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── NSFR Calculation ──────────────────────────────────────

  it('should compute NSFR as (ASF / RSF) x 100', () => {
    const items = [
      {
        category: 'liability',
        subcategory: 'savings',
        balance: 500_000,
        name: 'Savings',
      },
      {
        category: 'asset',
        subcategory: 'cash',
        balance: 100_000,
        name: 'Cash',
      },
      {
        category: 'asset',
        subcategory: 'consumer_loans',
        balance: 300_000,
        name: 'Consumer Loans',
        duration: 2,
      },
    ];

    const result = service.calculateNSFR(items);

    // ASF = 500K * 0.95 (savings factor) + equity (100K+300K-500K=0, clamped) = 475K
    // Actually equity = max(totalAssets - totalLiabilities, 0) = max(400K - 500K, 0) = 0
    // ASF = 475K
    // RSF = 100K * 0.0 (cash) + 300K * 0.65 (consumer loans >1yr) = 195K
    // NSFR = (475K / 195K) * 100 = ~243.6
    expect(result.nsfr).toBeGreaterThan(100);
    expect(result.asf).toBeGreaterThan(0);
    expect(result.rsf).toBeGreaterThan(0);
    expect(result.nsfr).toBeCloseTo((result.asf / result.rsf) * 100, 2);
  });

  it('should classify NSFR status as compliant (>=100), warning (90-100), or breach (<90)', () => {
    // Compliant case: more ASF than RSF
    const compliantItems = [
      {
        category: 'liability',
        subcategory: 'savings',
        balance: 1_000_000,
        name: 'Savings',
      },
      {
        category: 'asset',
        subcategory: 'cash',
        balance: 500_000,
        name: 'Cash',
      },
    ];
    expect(service.calculateNSFR(compliantItems).status).toBe('compliant');

    // Breach case: very little ASF vs RSF
    const breachItems = [
      {
        category: 'liability',
        subcategory: 'short_term_stuff',
        balance: 1_000_000,
        name: 'ST Borr',
      },
      {
        category: 'asset',
        subcategory: 'other_assets',
        balance: 900_000,
        name: 'Illiquid',
      },
    ];
    const breachResult = service.calculateNSFR(breachItems);
    // other_assets RSF factor = 1.0, so RSF = 900K
    // short_term_stuff gets default 0.5, so ASF = 500K + equity max(900K-1M, 0) = 500K
    // NSFR = (500K / 900K) * 100 = 55.6 => breach
    expect(breachResult.status).toBe('breach');
  });

  it('should assign ASF factor of 0.95 for demand/savings deposits and 1.0 for equity', () => {
    const items = [
      {
        category: 'liability',
        subcategory: 'demand_deposits',
        balance: 100_000,
        name: 'Demand',
      },
      {
        category: 'asset',
        subcategory: 'cash',
        balance: 200_000,
        name: 'Cash',
      },
    ];

    const result = service.calculateNSFR(items);

    const demandEntry = result.asfBreakdown.find(
      (a) => a.category === 'Demand',
    );
    expect(demandEntry).toBeDefined();
    expect(demandEntry!.factor).toBe(0.95);

    const equityEntry = result.asfBreakdown.find(
      (a) => a.category === 'Equity',
    );
    expect(equityEntry).toBeDefined();
    expect(equityEntry!.factor).toBe(1.0);
    // Equity = totalAssets - totalLiabilities = 200K - 100K = 100K
    expect(equityEntry!.balance).toBeCloseTo(100_000, 0);
  });

  it('should assign RSF factor of 0.0 for cash and 0.05 for treasuries', () => {
    const items = [
      { category: 'asset', subcategory: 'cash', balance: 50_000, name: 'Cash' },
      {
        category: 'asset',
        subcategory: 'treasury_securities',
        balance: 200_000,
        name: 'Treasuries',
      },
    ];

    const result = service.calculateNSFR(items);

    const cashEntry = result.rsfBreakdown.find((r) => r.category === 'Cash');
    expect(cashEntry!.factor).toBe(0.0);
    expect(cashEntry!.weighted).toBe(0);

    const treasuryEntry = result.rsfBreakdown.find(
      (r) => r.category === 'Treasuries',
    );
    expect(treasuryEntry!.factor).toBe(0.05);
    expect(treasuryEntry!.weighted).toBeCloseTo(10_000, 0);
  });

  // ── Deposit Flight Simulation ─────────────────────────────

  it('should simulate 12-month deposit flight with monotonically decreasing total deposits', () => {
    const tiers = [
      {
        tierName: 'Core',
        balance: 1_000_000,
        insuredPct: 0.9,
        flightRate: 0.03,
      },
      {
        tierName: 'Uninsured',
        balance: 500_000,
        insuredPct: 0.1,
        flightRate: 0.1,
      },
    ];

    const result = service.simulateDepositFlight(tiers, 200_000);

    expect(result.monthlyProjections).toHaveLength(12);
    // Total deposits should decrease over time
    for (let i = 1; i < result.monthlyProjections.length; i++) {
      expect(result.monthlyProjections[i].totalDeposits).toBeLessThanOrEqual(
        result.monthlyProjections[i - 1].totalDeposits,
      );
    }
  });

  it('should compute tier-level 6-month and 12-month losses using compound flight rate', () => {
    const tiers = [
      {
        tierName: 'Test Tier',
        balance: 1_000_000,
        insuredPct: 0.5,
        flightRate: 0.05,
      },
    ];

    const result = service.simulateDepositFlight(tiers, 150_000);

    const tier = result.tiers[0];
    // month6Loss = balance * (1 - (1 - flightRate)^6) = 1M * (1 - 0.95^6)
    const expected6 = 1_000_000 * (1 - Math.pow(0.95, 6));
    expect(tier.month6Loss).toBeCloseTo(expected6, 0);

    // month12Loss = balance * (1 - (1 - flightRate)^12) = 1M * (1 - 0.95^12)
    const expected12 = 1_000_000 * (1 - Math.pow(0.95, 12));
    expect(tier.month12Loss).toBeCloseTo(expected12, 0);
  });

  it('should compute worst-case loss as sum of all 12-month tier losses', () => {
    const tiers = [
      { tierName: 'A', balance: 500_000, insuredPct: 0.8, flightRate: 0.02 },
      { tierName: 'B', balance: 300_000, insuredPct: 0.2, flightRate: 0.1 },
    ];

    const result = service.simulateDepositFlight(tiers, 100_000);

    const totalMonth12Loss = result.tiers.reduce(
      (s, t) => s + t.month12Loss,
      0,
    );
    expect(result.worstCaseLoss).toBeCloseTo(totalMonth12Loss, 0);
  });
});
