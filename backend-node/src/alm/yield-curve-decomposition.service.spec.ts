import { YieldCurveDecompositionService } from './yield-curve-decomposition.service';

describe('YieldCurveDecompositionService', () => {
  let service: YieldCurveDecompositionService;

  beforeEach(() => {
    service = new YieldCurveDecompositionService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── Pure parallel shift detected as level-dominant ──────────

  it('detects parallel shift as level-dominant factor', () => {
    const prevCurve = [
      { tenor: 1, rate: 0.04 },
      { tenor: 2, rate: 0.042 },
      { tenor: 5, rate: 0.045 },
      { tenor: 10, rate: 0.047 },
      { tenor: 30, rate: 0.05 },
    ];
    const currCurve = [
      { tenor: 1, rate: 0.045 },
      { tenor: 2, rate: 0.047 },
      { tenor: 5, rate: 0.05 },
      { tenor: 10, rate: 0.052 },
      { tenor: 30, rate: 0.055 },
    ];

    const result = service.decompose(prevCurve, currCurve);

    // All rates shifted up by ~50bps uniformly
    expect(result.levelShift).toBeCloseTo(50, 0);
    expect(result.dominantFactor).toBe('Parallel shift');
    expect(result.dominantFactorEs).toBe('Desplazamiento paralelo');
  });

  // ── Steepening detected as slope-dominant ───────────────────

  it('detects steepening as slope-dominant factor', () => {
    const prevCurve = [
      { tenor: 1, rate: 0.04 },
      { tenor: 2, rate: 0.042 },
      { tenor: 5, rate: 0.045 },
      { tenor: 10, rate: 0.047 },
      { tenor: 30, rate: 0.05 },
    ];
    const currCurve = [
      { tenor: 1, rate: 0.035 },   // short end falls 50bps
      { tenor: 2, rate: 0.038 },   // short end falls 40bps
      { tenor: 5, rate: 0.045 },   // mid stays flat
      { tenor: 10, rate: 0.052 },  // long end rises 50bps
      { tenor: 30, rate: 0.06 },   // long end rises 100bps
    ];

    const result = service.decompose(prevCurve, currCurve);

    // Long rates up, short rates down => steepening
    expect(result.slopeChange).toBeGreaterThan(0);
    expect(result.dominantFactor).toBe('Slope change');
    expect(result.interpretation).toContain('steepening');
  });

  // ── Tenor changes computed correctly in bps ─────────────────

  it('computes per-tenor changes in basis points', () => {
    const prevCurve = [
      { tenor: 1, rate: 0.03 },
      { tenor: 5, rate: 0.04 },
    ];
    const currCurve = [
      { tenor: 1, rate: 0.035 },
      { tenor: 5, rate: 0.042 },
    ];

    const result = service.decompose(prevCurve, currCurve);

    expect(result.tenorChanges).toHaveLength(2);
    expect(result.tenorChanges[0].changeBps).toBeCloseTo(50, 0);
    expect(result.tenorChanges[1].changeBps).toBeCloseTo(20, 0);
  });

  // ── No change produces zero decomposition ───────────────────

  it('returns zero shifts when curves are identical', () => {
    const curve = [
      { tenor: 1, rate: 0.04 },
      { tenor: 5, rate: 0.045 },
      { tenor: 10, rate: 0.047 },
      { tenor: 30, rate: 0.05 },
    ];

    const result = service.decompose(curve, curve);

    expect(result.levelShift).toBe(0);
    expect(result.slopeChange).toBe(0);
    expect(result.curvatureChange).toBe(0);
  });

  // ── Bilingual interpretation ────────────────────────────────

  it('produces bilingual interpretation with bps values', () => {
    const prevCurve = [
      { tenor: 1, rate: 0.04 },
      { tenor: 5, rate: 0.045 },
      { tenor: 10, rate: 0.047 },
    ];
    const currCurve = [
      { tenor: 1, rate: 0.045 },
      { tenor: 5, rate: 0.05 },
      { tenor: 10, rate: 0.052 },
    ];

    const result = service.decompose(prevCurve, currCurve);

    expect(result.interpretation).toContain('bps');
    expect(result.interpretation).toContain('Level');
    expect(result.interpretation).toContain('Slope');
    expect(result.interpretationEs).toContain('pbs');
    expect(result.interpretationEs).toContain('Nivel');
    expect(result.interpretationEs).toContain('Pendiente');
  });
});
