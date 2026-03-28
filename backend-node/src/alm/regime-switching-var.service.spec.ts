import {
  RegimeSwitchingVaRService,
  RegimeVaRParams,
} from './regime-switching-var.service';

// ─── Helpers ────────────────────────────────────────────────────

/** Generate returns with two distinct volatility regimes */
function twoRegimeReturns(): number[] {
  const calm: number[] = [];
  const volatile: number[] = [];
  for (let i = 0; i < 200; i++) {
    calm.push(0.0003 + Math.sin(i) * 0.005);
  }
  for (let i = 0; i < 100; i++) {
    volatile.push(-0.001 + Math.sin(i * 2) * 0.03);
  }
  return [...calm, ...volatile];
}

function baseParams(): RegimeVaRParams {
  return {
    returns: twoRegimeReturns(),
    confidence: 0.95,
  };
}

// ─── Tests ──────────────────────────────────────────────────────

describe('RegimeSwitchingVaRService', () => {
  let service: RegimeSwitchingVaRService;

  beforeEach(() => {
    service = new RegimeSwitchingVaRService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // 1. Returns two regimes
  it('identifies exactly two regimes', () => {
    const result = service.calculateRegimeVaR(baseParams());
    expect(result.regimes).toHaveLength(2);
    expect(result.regimes.map((r) => r.name)).toEqual(
      expect.arrayContaining(['CALM', 'VOLATILE']),
    );
  });

  // 2. Regime probabilities sum to 1
  it('regime probabilities sum to 1', () => {
    const result = service.calculateRegimeVaR(baseParams());
    const totalProb = result.regimes.reduce((s, r) => s + r.probability, 0);
    expect(totalProb).toBeCloseTo(1, 2);
  });

  // 3. Volatile regime has higher volatility
  it('volatile regime has higher volatility than calm regime', () => {
    const result = service.calculateRegimeVaR(baseParams());
    const calm = result.regimes.find((r) => r.name === 'CALM')!;
    const vol = result.regimes.find((r) => r.name === 'VOLATILE')!;
    expect(vol.volatility).toBeGreaterThan(calm.volatility);
  });

  // 4. Volatile regime has higher VaR
  it('volatile regime has higher VaR than calm regime', () => {
    const result = service.calculateRegimeVaR(baseParams());
    const calm = result.regimes.find((r) => r.name === 'CALM')!;
    const vol = result.regimes.find((r) => r.name === 'VOLATILE')!;
    expect(vol.var).toBeGreaterThan(calm.var);
  });

  // 5. Blended VaR is between calm and volatile VaR
  it('blended VaR is between calm and volatile regime VaRs', () => {
    const result = service.calculateRegimeVaR(baseParams());
    const calm = result.regimes.find((r) => r.name === 'CALM')!;
    const vol = result.regimes.find((r) => r.name === 'VOLATILE')!;
    expect(result.blendedVaR).toBeGreaterThanOrEqual(calm.var * 0.99);
    expect(result.blendedVaR).toBeLessThanOrEqual(vol.var * 1.01);
  });

  // 6. Throws with too few observations
  it('throws if fewer than 10 observations provided', () => {
    expect(() =>
      service.calculateRegimeVaR({ returns: [0.01, -0.01, 0.005], confidence: 0.95 }),
    ).toThrow(/at least 10/i);
  });

  // 7. Current regime is a valid string
  it('current regime is CALM or VOLATILE', () => {
    const result = service.calculateRegimeVaR(baseParams());
    expect(['CALM', 'VOLATILE']).toContain(result.currentRegime);
  });
});
