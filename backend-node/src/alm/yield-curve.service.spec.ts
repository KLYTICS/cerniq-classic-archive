import { YieldCurveService, TenorRate } from './yield-curve.service';

describe('YieldCurveService', () => {
  let service: YieldCurveService;
  let prisma: any;

  const sampleCurve: TenorRate[] = [
    { tenor: 0.25, rate: 0.048 },
    { tenor: 0.5, rate: 0.0465 },
    { tenor: 1, rate: 0.044 },
    { tenor: 2, rate: 0.042 },
    { tenor: 3, rate: 0.041 },
    { tenor: 5, rate: 0.0405 },
    { tenor: 7, rate: 0.041 },
    { tenor: 10, rate: 0.042 },
    { tenor: 20, rate: 0.0455 },
    { tenor: 30, rate: 0.0465 },
  ];

  beforeEach(() => {
    prisma = {
      balanceSheetItem: { findMany: jest.fn().mockResolvedValue([]) },
      yieldCurve: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'curve_1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    service = new YieldCurveService(prisma);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── Nelson-Siegel fit ──────────────────────────────────────

  it('fits Nelson-Siegel parameters that reproduce the original curve', () => {
    const params = service.fitNelsonSiegel(sampleCurve);

    expect(params.beta0).toBeDefined();
    expect(params.beta1).toBeDefined();
    expect(params.beta2).toBeDefined();
    expect(params.lambda).toBeGreaterThan(0);

    // Check that the fitted curve approximates the original at a few tenors
    for (const point of [sampleCurve[2], sampleCurve[5], sampleCurve[8]]) {
      const fittedRate = service.interpolateRate(params, point.tenor);
      expect(Math.abs(fittedRate - point.rate)).toBeLessThan(0.005); // within 50bps
    }
  });

  // ── Forward rates ─────────────────────────────────────────

  it('computes forward rates with correct number of points', () => {
    const forwards = service.calculateForwardRates(sampleCurve);

    // n-1 forward rates from n spot rates
    expect(forwards).toHaveLength(sampleCurve.length - 1);
    // All forward rates should be non-negative
    for (const f of forwards) {
      expect(f.rate).toBeGreaterThanOrEqual(0);
    }
  });

  it('computes correct forward rate between two tenors', () => {
    const twoPointCurve: TenorRate[] = [
      { tenor: 1, rate: 0.04 },
      { tenor: 2, rate: 0.045 },
    ];

    const forwards = service.calculateForwardRates(twoPointCurve);

    // f(1,2) = (0.045*2 - 0.04*1) / (2-1) = 0.05
    expect(forwards[0].rate).toBeCloseTo(0.05, 4);
    expect(forwards[0].tenor).toBe(2);
  });

  // ── Shock application ─────────────────────────────────────

  it('applies parallel up shock of +200bps to all tenors', () => {
    const shocked = service.applyShock(sampleCurve, 'parallel_up');

    expect(shocked.shockType).toBe('parallel_up');
    expect(shocked.shockedCurve).toHaveLength(sampleCurve.length);

    // Each shocked rate should be ~200bps above base
    for (let i = 0; i < sampleCurve.length; i++) {
      const diff = shocked.shockedCurve[i].rate - sampleCurve[i].rate;
      expect(diff).toBeCloseTo(0.02, 3); // 200bps = 0.02
    }
  });

  it('applies steepener shock with short rates down and long rates up', () => {
    const shocked = service.applyShock(sampleCurve, 'steepener');

    // Short end (3M) should be lower
    expect(shocked.shockedCurve[0].rate).toBeLessThan(sampleCurve[0].rate);
    // Long end (30Y) should be higher
    const lastIdx = sampleCurve.length - 1;
    expect(shocked.shockedCurve[lastIdx].rate).toBeGreaterThan(
      sampleCurve[lastIdx].rate,
    );
  });

  // ── Full analysis (with empty balance sheet) ──────────────

  it('returns complete analysis structure using default curve', async () => {
    const analysis = await service.getYieldCurveAnalysis('inst_123');

    expect(analysis.baseCurve).toBeDefined();
    expect(analysis.baseCurve.length).toBeGreaterThan(0);
    expect(analysis.nelsonSiegelParams).toBeDefined();
    expect(analysis.forwardRates.length).toBeGreaterThan(0);
    // 6 Basel shock scenarios
    expect(analysis.shockedCurves).toHaveLength(6);
    expect(analysis.niiImpact).toHaveLength(6);
  });
});
