import {
  LiabilityDrivenInvestmentService,
  LDIParams,
} from './liability-driven-investment.service';

// ─── Helpers ────────────────────────────────────────────────────

function baseParams(): LDIParams {
  return {
    liabilities: [
      { amount: 10_000_000, maturityYears: 5, rate: 0.04 },
      { amount: 15_000_000, maturityYears: 10, rate: 0.045 },
      { amount: 8_000_000, maturityYears: 3, rate: 0.035 },
    ],
    availableAssets: [
      { name: '3Y Treasury', duration: 2.9, yield: 0.04, convexity: 10 },
      { name: '5Y Corporate', duration: 4.5, yield: 0.055, convexity: 25 },
      { name: '10Y Treasury', duration: 8.5, yield: 0.042, convexity: 80 },
      { name: '7Y MBS', duration: 5.5, yield: 0.048, convexity: 40 },
    ],
  };
}

// ─── Tests ──────────────────────────────────────────────────────

describe('LiabilityDrivenInvestmentService', () => {
  let service: LiabilityDrivenInvestmentService;

  beforeEach(() => {
    service = new LiabilityDrivenInvestmentService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // 1. Allocation weights sum to 1
  it('allocation weights sum to 1', () => {
    const result = service.constructLDIPortfolio(baseParams());
    const totalWeight = result.allocation.reduce((s, a) => s + a.weight, 0);
    expect(totalWeight).toBeCloseTo(1, 2);
  });

  // 2. Each allocation has a valid structure
  it('each allocation has asset name, weight, and amount', () => {
    const result = service.constructLDIPortfolio(baseParams());
    for (const a of result.allocation) {
      expect(a.asset).toBeTruthy();
      expect(a.weight).toBeGreaterThan(0);
      expect(a.amount).toBeGreaterThan(0);
    }
  });

  // 3. Funding ratio is approximately 1 (assets match liabilities PV)
  it('funding ratio is approximately 1', () => {
    const result = service.constructLDIPortfolio(baseParams());
    expect(result.fundingRatio).toBeCloseTo(1, 1);
  });

  // 4. Duration match is between 0 and 1
  it('duration match is between 0 and 1', () => {
    const result = service.constructLDIPortfolio(baseParams());
    expect(result.durationMatch).toBeGreaterThanOrEqual(0);
    expect(result.durationMatch).toBeLessThanOrEqual(1);
  });

  // 5. Cash flow match is between 0 and 1
  it('cash flow match is between 0 and 1', () => {
    const result = service.constructLDIPortfolio(baseParams());
    expect(result.cashFlowMatch).toBeGreaterThanOrEqual(0);
    expect(result.cashFlowMatch).toBeLessThanOrEqual(1);
  });

  // 6. Surplus risk is non-negative
  it('surplus risk is non-negative', () => {
    const result = service.constructLDIPortfolio(baseParams());
    expect(result.surplusRisk).toBeGreaterThanOrEqual(0);
  });

  // 7. Allocates to assets with durations closest to liability duration
  it('favours assets with duration close to liability average', () => {
    const result = service.constructLDIPortfolio(baseParams());
    // Liability-weighted avg duration is roughly 6-7 years
    // 7Y MBS (dur 5.5) and 10Y Treasury (dur 8.5) should get meaningful weight
    const mbsAlloc = result.allocation.find((a) => a.asset === '7Y MBS');
    expect(mbsAlloc).toBeDefined();
    expect(mbsAlloc!.weight).toBeGreaterThan(0.1);
  });
});
