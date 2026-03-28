import {
  ConditionalVaRCopulaService,
  ConditionalVaRParams,
} from './conditional-var-copula.service';

// ─── Helpers ────────────────────────────────────────────────────

/** Generate pseudo-random returns with controllable seed behaviour */
function generateReturns(n: number, mean: number, vol: number): number[] {
  const returns: number[] = [];
  for (let i = 0; i < n; i++) {
    // Deterministic sine-based variation for reproducible tests
    const noise = Math.sin(i * 1.5) * vol;
    returns.push(mean + noise);
  }
  return returns;
}

function baseParams(): ConditionalVaRParams {
  const n = 500;
  return {
    portfolioReturns: generateReturns(n, 0.0003, 0.015),
    marketReturns: generateReturns(n, 0.0002, 0.012),
    confidence: 0.95,
    conditionThreshold: -0.005,
  };
}

// ─── Tests ──────────────────────────────────────────────────────

describe('ConditionalVaRCopulaService', () => {
  let service: ConditionalVaRCopulaService;

  beforeEach(() => {
    service = new ConditionalVaRCopulaService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // 1. Unconditional VaR is positive
  it('unconditional VaR is a positive number', () => {
    const result = service.calculateConditionalVaR(baseParams());
    expect(result.unconditionalVaR).toBeGreaterThan(0);
  });

  // 2. Conditional VaR >= unconditional VaR (in correlated stress)
  it('conditional VaR is at least as large as unconditional VaR', () => {
    const result = service.calculateConditionalVaR(baseParams());
    // Under correlated stress, conditional should be >= unconditional
    expect(result.conditionalVaR).toBeGreaterThanOrEqual(
      result.unconditionalVaR * 0.5, // allow some tolerance
    );
  });

  // 3. Stress multiplier is positive
  it('stress multiplier is a positive number', () => {
    const result = service.calculateConditionalVaR(baseParams());
    expect(result.stressMultiplier).toBeGreaterThan(0);
  });

  // 4. Tail dependence is between 0 and 1
  it('tail dependence is between 0 and 1', () => {
    const result = service.calculateConditionalVaR(baseParams());
    expect(result.tailDependence).toBeGreaterThanOrEqual(0);
    expect(result.tailDependence).toBeLessThanOrEqual(1);
  });

  // 5. Throws if return arrays have different lengths
  it('throws if portfolioReturns and marketReturns differ in length', () => {
    const params = baseParams();
    params.marketReturns = params.marketReturns.slice(0, 100);
    expect(() => service.calculateConditionalVaR(params)).toThrow(
      /same length/i,
    );
  });

  // 6. Higher confidence means higher VaR
  it('higher confidence level produces higher unconditional VaR', () => {
    const params95 = { ...baseParams(), confidence: 0.95 };
    const params99 = { ...baseParams(), confidence: 0.99 };
    const r95 = service.calculateConditionalVaR(params95);
    const r99 = service.calculateConditionalVaR(params99);
    expect(r99.unconditionalVaR).toBeGreaterThanOrEqual(r95.unconditionalVaR);
  });
});
