import { WeightedAverageCouponService } from './weighted-average-coupon.service';

describe('WeightedAverageCouponService', () => {
  let service: WeightedAverageCouponService;

  beforeEach(() => {
    service = new WeightedAverageCouponService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── WAC calculation with varying coupon rates ───────────────

  it('computes balance-weighted average coupon correctly', () => {
    const result = service.calculate([
      {
        name: 'High Rate Loan',
        balance: 500000,
        couponRate: 0.06,
        remainingTermMonths: 120,
        originalTermMonths: 360,
      },
      {
        name: 'Low Rate Loan',
        balance: 500000,
        couponRate: 0.04,
        remainingTermMonths: 60,
        originalTermMonths: 120,
      },
    ]);

    // Equal balances: WAC = (0.06 + 0.04) / 2 = 0.05
    expect(result.wac).toBeCloseTo(0.05, 4);
    expect(result.totalBalance).toBe(1000000);
  });

  // ── WAM weighted by balance ─────────────────────────────────

  it('computes WAM weighted by balance, not equal-weighted', () => {
    const result = service.calculate([
      {
        name: 'Short Loan',
        balance: 100000,
        couponRate: 0.05,
        remainingTermMonths: 12,
        originalTermMonths: 60,
      },
      {
        name: 'Long Loan',
        balance: 900000,
        couponRate: 0.05,
        remainingTermMonths: 240,
        originalTermMonths: 360,
      },
    ]);

    // WAM should be heavily weighted toward 240 months: (100k*12 + 900k*240) / 1M = 217.2
    expect(result.wam).toBeCloseTo(217.2, 0);
  });

  // ── Seasoning = WAOL - WAM ──────────────────────────────────

  it('computes seasoning as WAOL minus WAM', () => {
    const result = service.calculate([
      {
        name: 'Loan A',
        balance: 1000000,
        couponRate: 0.05,
        remainingTermMonths: 200,
        originalTermMonths: 360,
      },
    ]);

    // WAOL = 360, WAM = 200, seasoning = 160
    expect(result.waol).toBeCloseTo(360, 0);
    expect(result.wam).toBeCloseTo(200, 0);
    expect(result.seasoning).toBeCloseTo(160, 0);
  });

  // ── Segment weights sum to 100% ─────────────────────────────

  it('returns segments with weights summing to 100%', () => {
    const result = service.calculate([
      {
        name: 'Loan A',
        balance: 300000,
        couponRate: 0.055,
        remainingTermMonths: 120,
        originalTermMonths: 240,
      },
      {
        name: 'Loan B',
        balance: 500000,
        couponRate: 0.045,
        remainingTermMonths: 180,
        originalTermMonths: 300,
      },
      {
        name: 'Loan C',
        balance: 200000,
        couponRate: 0.065,
        remainingTermMonths: 60,
        originalTermMonths: 120,
      },
    ]);

    const totalWeight = result.segments.reduce((s, seg) => s + seg.weight, 0);
    expect(totalWeight).toBeCloseTo(100, 0);
    expect(result.segments).toHaveLength(3);
  });

  // ── Interpretation includes WAC in percent and WAM in years ──

  it('produces interpretation with WAC as percentage and WAM in years', () => {
    const result = service.calculate([
      {
        name: 'Mortgage',
        balance: 1000000,
        couponRate: 0.055,
        remainingTermMonths: 300,
        originalTermMonths: 360,
      },
    ]);

    // WAC: 5.50%, WAM: 25.0 years, seasoning: 5.0 years
    expect(result.interpretation).toContain('5.50%');
    expect(result.interpretation).toContain('25.0 years');
    expect(result.interpretationEs).toContain('5.50%');
    expect(result.interpretationEs).toContain('anos');
  });
});
