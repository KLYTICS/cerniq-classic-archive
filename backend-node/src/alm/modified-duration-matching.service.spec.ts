import { ModifiedDurationMatchingService } from './modified-duration-matching.service';

describe('ModifiedDurationMatchingService', () => {
  let service: ModifiedDurationMatchingService;

  beforeEach(() => {
    service = new ModifiedDurationMatchingService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── Positive duration gap (asset-sensitive) ─────────────────

  it('computes positive duration gap when assets have longer duration', () => {
    const result = service.immunize({
      assets: [
        { name: 'Fixed Loans', mv: 1000000, duration: 4.5, convexity: 25 },
      ],
      liabilities: [
        { name: 'Deposits', mv: 850000, duration: 1.2, convexity: 3 },
      ],
    });

    // Gap = 4.5 - (850k/1M) * 1.2 = 4.5 - 1.02 = 3.48
    expect(result.durationGap).toBeCloseTo(3.48, 1);
    expect(result.durationGap).toBeGreaterThan(0);
    expect(result.interpretation).toContain('rising');
    expect(result.interpretationEs).toContain('alza');
  });

  // ── Well-immunized portfolio (near-zero gap) ────────────────

  it('identifies well-immunized portfolio with gap below 0.5', () => {
    const result = service.immunize({
      assets: [
        { name: 'Investments', mv: 1000000, duration: 2.0, convexity: 8 },
      ],
      liabilities: [
        { name: 'Term Deposits', mv: 900000, duration: 2.1, convexity: 7 },
      ],
    });

    // Gap = 2.0 - (900k/1M) * 2.1 = 2.0 - 1.89 = 0.11
    expect(Math.abs(result.durationGap)).toBeLessThan(0.5);
    expect(result.interpretation).toContain('Well immunized');
    expect(result.interpretationEs).toContain('inmunizado');
  });

  // ── EVE impact array covers standard shocks ─────────────────

  it('generates EVE impact for standard shock scenarios', () => {
    const result = service.immunize({
      assets: [{ name: 'Bonds', mv: 500000, duration: 5.0, convexity: 30 }],
      liabilities: [
        { name: 'Deposits', mv: 400000, duration: 1.0, convexity: 2 },
      ],
    });

    expect(result.eveImpact).toHaveLength(6);
    const shocks = result.eveImpact.map((e) => e.shock);
    expect(shocks).toEqual([-200, -100, -50, 50, 100, 200]);

    // Positive duration gap => rising rates hurt EVE (negative pct change for positive shocks)
    const upShock = result.eveImpact.find((e) => e.shock === 200);
    expect(upShock!.evePctChange).toBeLessThan(0);
  });

  // ── Recommendations generated for large gaps ────────────────

  it('recommends reducing gap when duration gap exceeds 1 year', () => {
    const result = service.immunize({
      assets: [
        { name: 'Long Bonds', mv: 1000000, duration: 7.0, convexity: 60 },
      ],
      liabilities: [
        { name: 'Short Deposits', mv: 800000, duration: 0.5, convexity: 1 },
      ],
    });

    // Gap = 7.0 - 0.8*0.5 = 6.6 (very large)
    expect(result.durationGap).toBeGreaterThan(1);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations[0].action).toContain('Reduce asset duration');
    expect(result.recommendations[0].actionEs).toContain('Reducir duracion');
    expect(result.recommendations[0].impact).toBeGreaterThan(0);
  });

  // ── Dollar duration gap scales with portfolio size ──────────

  it('computes dollar duration gap proportional to total assets', () => {
    const smallResult = service.immunize({
      assets: [{ name: 'A', mv: 100000, duration: 3.0, convexity: 10 }],
      liabilities: [{ name: 'L', mv: 85000, duration: 1.0, convexity: 2 }],
    });

    const largeResult = service.immunize({
      assets: [{ name: 'A', mv: 10000000, duration: 3.0, convexity: 10 }],
      liabilities: [{ name: 'L', mv: 8500000, duration: 1.0, convexity: 2 }],
    });

    // Same duration gap but dollar gap scales by 100x
    expect(smallResult.durationGap).toBeCloseTo(largeResult.durationGap, 2);
    expect(largeResult.dollarDurationGap).toBeCloseTo(
      smallResult.dollarDurationGap * 100,
      -2,
    );
  });
});
