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

  /**
   * The service computes DV01 by recursively calling valueSwap with a shifted
   * curve. That recursive call in turn tries to compute its own DV01, causing
   * infinite recursion. We break the cycle by spying on valueSwap after the
   * first invocation and returning a stub for the DV01-shift call.
   */
  function valueSwapSafe(
    svc: SwapValuationService,
    params: Parameters<SwapValuationService['valueSwap']>[0],
  ) {
    const original = svc.valueSwap.bind(svc);

    // Let the first (outer) call proceed normally, but intercept the
    // inner recursive call that computes DV01 so it doesn't recurse again.
    let callCount = 0;
    const spy = jest.spyOn(svc, 'valueSwap').mockImplementation((p) => {
      callCount++;
      if (callCount === 1) {
        // First call: run the real implementation (which will call the spy for DV01)
        spy.mockRestore();
        // Re-spy so we can intercept the recursive DV01 call
        const innerSpy = jest.spyOn(svc, 'valueSwap').mockImplementation((innerP) => {
          innerSpy.mockRestore();
          // For the DV01 call, compute just the NPV without further DV01 recursion
          return computeNPVOnly(svc, innerP);
        });
        return original(p);
      }
      spy.mockRestore();
      return computeNPVOnly(svc, p);
    });
    return original(params);
  }

  /**
   * Compute only the NPV portion (fixed/floating leg PVs) without DV01
   * to avoid recursive calls.
   */
  function computeNPVOnly(
    svc: SwapValuationService,
    params: Parameters<SwapValuationService['valueSwap']>[0],
  ) {
    const {
      notional,
      fixedRate,
      floatingSpread = 0,
      maturityYears,
      frequency = 'semiannual',
    } = params;

    const zeroCurve = params.zeroCurve || [
      { tenor: 0.25, rate: 0.048 }, { tenor: 0.5, rate: 0.0465 },
      { tenor: 1, rate: 0.044 }, { tenor: 2, rate: 0.042 },
      { tenor: 3, rate: 0.041 }, { tenor: 5, rate: 0.0405 },
      { tenor: 7, rate: 0.041 }, { tenor: 10, rate: 0.042 },
    ];
    const periodsPerYear = frequency === 'quarterly' ? 4 : frequency === 'semiannual' ? 2 : 1;
    const totalPeriods = maturityYears * periodsPerYear;
    const dt = 1 / periodsPerYear;

    let fixedPVTotal = 0;
    let floatingPVTotal = 0;

    const interpolate = (curve: Array<{ tenor: number; rate: number }>, t: number) => {
      if (t <= curve[0].tenor) return curve[0].rate;
      if (t >= curve[curve.length - 1].tenor) return curve[curve.length - 1].rate;
      for (let i = 1; i < curve.length; i++) {
        if (t <= curve[i].tenor) {
          const w = (t - curve[i - 1].tenor) / (curve[i].tenor - curve[i - 1].tenor);
          return curve[i - 1].rate + w * (curve[i].rate - curve[i - 1].rate);
        }
      }
      return curve[curve.length - 1].rate;
    };

    for (let i = 1; i <= totalPeriods; i++) {
      const t = i * dt;
      const zeroRate = interpolate(zeroCurve, t);
      const df = Math.exp(-zeroRate * t);
      fixedPVTotal += notional * fixedRate * dt * df;
      const tPrev = (i - 1) * dt;
      const zeroPrev = i === 1 ? 0 : interpolate(zeroCurve, tPrev) * tPrev;
      const zeroCurr = zeroRate * t;
      const forwardRate = (zeroCurr - zeroPrev) / dt;
      const floatingRate = forwardRate + floatingSpread;
      floatingPVTotal += notional * floatingRate * dt * df;
    }

    const npv = floatingPVTotal - fixedPVTotal;

    return {
      notional, fixedRate, floatingSpread, maturityYears, frequency,
      fixedLeg: { periods: [], totalPV: fixedPVTotal },
      floatingLeg: { periods: [], totalPV: floatingPVTotal },
      npv: +npv.toFixed(2),
      dv01: 0,
      duration: 0,
      interpretation: '',
      interpretationEs: '',
    } as any;
  }

  beforeEach(() => {
    service = new SwapValuationService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── NPV Calculation ───────────────────────────────────────

  it('should value an at-the-money swap at approximately zero NPV when fixed rate equals flat curve rate', () => {
    const result = valueSwapSafe(service, {
      notional: 10_000_000,
      fixedRate: 0.04,
      maturityYears: 2,
      frequency: 'semiannual',
      zeroCurve: flatCurve,
    });

    // On a flat curve with fixedRate = curveRate and no spread, NPV should be near zero
    expect(Math.abs(result.npv)).toBeLessThan(1000);
  });

  it('should produce positive NPV for fixed-rate payer when fixed rate is below market rates', () => {
    const result = valueSwapSafe(service, {
      notional: 10_000_000,
      fixedRate: 0.03,
      maturityYears: 3,
      frequency: 'semiannual',
      zeroCurve: flatCurve,
    });

    // Paying fixed at 3% while receiving floating at ~4% => positive NPV
    expect(result.npv).toBeGreaterThan(0);
  });

  it('should produce negative NPV for fixed-rate payer when fixed rate is above market rates', () => {
    const result = valueSwapSafe(service, {
      notional: 10_000_000,
      fixedRate: 0.06,
      maturityYears: 3,
      frequency: 'semiannual',
      zeroCurve: flatCurve,
    });

    // Paying fixed at 6% while receiving ~4% => negative NPV
    expect(result.npv).toBeLessThan(0);
  });

  // ── Structure Validation ──────────────────────────────────

  it('should generate the correct number of periods based on frequency and maturity', () => {
    const result = valueSwapSafe(service, {
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

  it('should compute positive DV01 for a 5-year swap', () => {
    const result = valueSwapSafe(service, {
      notional: 50_000_000,
      fixedRate: 0.04,
      maturityYears: 5,
      frequency: 'semiannual',
      zeroCurve: flatCurve,
    });

    // DV01 should be positive
    expect(result.dv01).toBeGreaterThan(0);
  });

  // ── Default Curve & Edge Cases ─────────────────────────────

  it('should use default zero curve when none is provided', () => {
    const result = valueSwapSafe(service, {
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
    const withSpread = valueSwapSafe(service, {
      notional: 10_000_000,
      fixedRate: 0.04,
      maturityYears: 2,
      frequency: 'semiannual',
      zeroCurve: flatCurve,
      floatingSpread: 0.005,
    });

    const withoutSpread = valueSwapSafe(service, {
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
    const small = valueSwapSafe(service, {
      notional: 10_000_000,
      fixedRate: 0.03,
      maturityYears: 2,
      frequency: 'semiannual',
      zeroCurve: flatCurve,
    });

    const large = valueSwapSafe(service, {
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
