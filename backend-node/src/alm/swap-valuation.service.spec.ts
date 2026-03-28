import { SwapValuationService } from './swap-valuation.service';

describe('SwapValuationService', () => {
  let service: SwapValuationService;

  // A flat zero curve at 4% for easy hand-calculation
  const flatCurve = [
    { tenor: 0.25, rate: 0.04 },
    { tenor: 0.5, rate: 0.04 },
    { tenor: 1, rate: 0.04 },
    { tenor: 2, rate: 0.04 },
    { tenor: 3, rate: 0.04 },
    { tenor: 5, rate: 0.04 },
    { tenor: 10, rate: 0.04 },
  ];

  beforeEach(() => {
    service = new SwapValuationService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── NPV Calculation ───────────────────────────────────────

  it('should value an at-the-money swap at approximately zero NPV when fixed rate equals flat curve rate', () => {
    const result = service.valueSwap({
      notional: 10_000_000,
      fixedRate: 0.04,
      maturityYears: 2,
      frequency: 'semiannual',
      zeroCurve: flatCurve,
    });

    // On a flat curve with fixedRate = curveRate and no spread, NPV should be near zero
    expect(Math.abs(result.npv)).toBeLessThan(1000); // within $1K tolerance
  });

  it('should produce positive NPV for fixed-rate payer when fixed rate is below market rates', () => {
    const result = service.valueSwap({
      notional: 10_000_000,
      fixedRate: 0.03, // paying below market
      maturityYears: 3,
      frequency: 'semiannual',
      zeroCurve: flatCurve,
    });

    // Paying fixed at 3% while receiving floating at ~4% => positive NPV
    expect(result.npv).toBeGreaterThan(0);
  });

  it('should produce negative NPV for fixed-rate payer when fixed rate is above market rates', () => {
    const result = service.valueSwap({
      notional: 10_000_000,
      fixedRate: 0.06, // paying above market
      maturityYears: 3,
      frequency: 'semiannual',
      zeroCurve: flatCurve,
    });

    // Paying fixed at 6% while receiving ~4% => negative NPV
    expect(result.npv).toBeLessThan(0);
  });

  // ── Structure Validation ──────────────────────────────────

  it('should generate the correct number of periods based on frequency and maturity', () => {
    const result = service.valueSwap({
      notional: 10_000_000,
      fixedRate: 0.04,
      maturityYears: 3,
      frequency: 'quarterly',
      zeroCurve: flatCurve,
    });

    expect(result.fixedLeg.periods).toHaveLength(12); // 3yr x 4 periods/yr
    expect(result.floatingLeg.periods).toHaveLength(12);
    expect(result.maturityYears).toBe(3);
    expect(result.frequency).toBe('quarterly');
  });

  it('should compute DV01 as sensitivity to a 1bp parallel shift in the zero curve', () => {
    const result = service.valueSwap({
      notional: 50_000_000,
      fixedRate: 0.04,
      maturityYears: 5,
      frequency: 'semiannual',
      zeroCurve: flatCurve,
    });

    // DV01 should be positive and proportional to notional/maturity
    expect(result.dv01).toBeGreaterThan(0);
    // For a 5yr 50M swap, DV01 is roughly ~25K (notional * maturity * 0.0001)
    expect(result.dv01).toBeGreaterThan(100);
    expect(result.dv01).toBeLessThan(500_000);
  });

  // ── Default Curve & Edge Cases ─────────────────────────────

  it('should use default zero curve when none is provided', () => {
    const result = service.valueSwap({
      notional: 10_000_000,
      fixedRate: 0.04,
      maturityYears: 2,
    });

    // Should not throw and should produce a valid result
    expect(result.fixedLeg.totalPV).toBeGreaterThan(0);
    expect(result.floatingLeg.totalPV).toBeGreaterThan(0);
    expect(typeof result.npv).toBe('number');
    expect(result.interpretation).toContain('Swap NPV');
    expect(result.interpretationEs).toContain('VPN del swap');
  });

  it('should include floating spread in floating leg rate calculations', () => {
    const withSpread = service.valueSwap({
      notional: 10_000_000,
      fixedRate: 0.04,
      maturityYears: 2,
      frequency: 'semiannual',
      zeroCurve: flatCurve,
      floatingSpread: 0.005,
    });

    const withoutSpread = service.valueSwap({
      notional: 10_000_000,
      fixedRate: 0.04,
      maturityYears: 2,
      frequency: 'semiannual',
      zeroCurve: flatCurve,
      floatingSpread: 0,
    });

    // Adding spread to floating leg increases floating PV => higher NPV for fixed payer
    expect(withSpread.npv).toBeGreaterThan(withoutSpread.npv);
  });

  it('should scale NPV proportionally with notional', () => {
    const small = service.valueSwap({
      notional: 10_000_000,
      fixedRate: 0.03,
      maturityYears: 2,
      frequency: 'semiannual',
      zeroCurve: flatCurve,
    });

    const large = service.valueSwap({
      notional: 100_000_000,
      fixedRate: 0.03,
      maturityYears: 2,
      frequency: 'semiannual',
      zeroCurve: flatCurve,
    });

    // NPV should scale 10x
    expect(large.npv / small.npv).toBeCloseTo(10, 0);
  });
});
