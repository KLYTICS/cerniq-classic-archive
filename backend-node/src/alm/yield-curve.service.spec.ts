import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { YieldCurveService, type TenorRate } from './yield-curve.service';

describe('YieldCurveService', () => {
  let service: YieldCurveService;
  let prisma: {
    balanceSheetItem: { findMany: ReturnType<typeof jest.fn> };
    yieldCurve: {
      findFirst: ReturnType<typeof jest.fn>;
      create: ReturnType<typeof jest.fn>;
      updateMany: ReturnType<typeof jest.fn>;
    };
  };

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
    service = new YieldCurveService(prisma as any);
  });

  it('fits Nelson-Siegel parameters that reproduce the base curve within tolerance', () => {
    const params = service.fitNelsonSiegel(sampleCurve);

    expect(params.lambda).toBeGreaterThan(0);
    expect(params.beta0).toBeDefined();
    expect(params.beta1).toBeDefined();
    expect(params.beta2).toBeDefined();

    for (const point of [sampleCurve[2], sampleCurve[5], sampleCurve[8]]) {
      const fittedRate = service.interpolateRate(params, point.tenor);
      expect(Math.abs(fittedRate - point.rate)).toBeLessThan(0.005);
    }
  });

  it('computes non-negative forward rates with the expected tenor count', () => {
    const forwards = service.calculateForwardRates(sampleCurve);

    expect(forwards).toHaveLength(sampleCurve.length - 1);
    expect(forwards[0]).toEqual(
      expect.objectContaining({
        tenor: 0.5,
      }),
    );
    for (const point of forwards) {
      expect(point.rate).toBeGreaterThanOrEqual(0);
    }
  });

  it('applies Basel shocks and falls back to parallel-up for unknown requests', () => {
    const parallelUp = service.applyShock(sampleCurve, 'parallel_up');
    const fallback = service.applyShock(sampleCurve, 'unknown-shock');

    expect(parallelUp.shockLabel).toBe('Parallel +200bps');
    expect(
      parallelUp.shockedCurve.every(
        (point, index) =>
          Math.abs(point.rate - sampleCurve[index].rate - 0.02) < 0.0005,
      ),
    ).toBe(true);
    expect(fallback.shockBps[0.25]).toBe(200);
    expect(fallback.shockedCurve[0].rate).toBeCloseTo(
      parallelUp.shockedCurve[0].rate,
      4,
    );
  });

  it('returns complete analysis using saved curves and institution balances', async () => {
    prisma.yieldCurve.findFirst.mockResolvedValue({
      tenors: sampleCurve,
    });
    prisma.balanceSheetItem.findMany.mockResolvedValue([
      {
        category: 'asset',
        balance: 100,
        duration: 2,
        rate: 0.05,
        rateType: 'fixed',
      },
      {
        category: 'liability',
        balance: 80,
        duration: 1,
        rate: 0.02,
        rateType: 'variable',
      },
    ]);

    const analysis = await service.getYieldCurveAnalysis('inst_123');

    expect(prisma.yieldCurve.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { institutionId: 'inst_123', isBase: true },
      }),
    );
    expect(analysis.baseCurve).toEqual(sampleCurve);
    expect(analysis.forwardRates.length).toBeGreaterThan(0);
    expect(analysis.shockedCurves).toHaveLength(6);
    expect(analysis.niiImpact).toHaveLength(6);
    expect(
      analysis.niiImpact.some(
        (scenario) => scenario.shockType === 'parallel_up',
      ),
    ).toBe(true);
  });

  it('computes forward NII schedules with repricing over time', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([
      {
        category: 'asset',
        balance: 100,
        duration: 1,
        rate: 0.05,
        rateType: 'fixed',
      },
      {
        category: 'liability',
        balance: 90,
        duration: 0.5,
        rate: 0.02,
        rateType: 'variable',
      },
    ]);
    prisma.yieldCurve.findFirst.mockResolvedValue({
      tenors: sampleCurve,
    });

    const schedule = await service.computeForwardNIISchedule(
      'inst_456',
      { '0.5': 50, '1': 100 },
      3,
    );

    expect(schedule).toHaveLength(3);
    expect(schedule[0].quarter).toMatch(/^Q[1-4] \d{4}$/);
    expect(schedule[0].baselineNII).not.toBe(0);
    expect(schedule[0].deltaPct).not.toBe(0);
    expect(schedule[2].shockedNII).toBeGreaterThanOrEqual(
      schedule[0].shockedNII,
    );
  });

  it('saves custom curves as the new base curve', async () => {
    const tenors = [
      { tenor: 1, rate: 0.04 },
      { tenor: 5, rate: 0.041 },
    ];

    const result = await service.saveCustomCurve({
      institutionId: 'inst_789',
      name: 'Quant -7% Defense Curve',
      tenors,
      source: 'quant-desk',
    });

    expect(prisma.yieldCurve.updateMany).toHaveBeenCalledWith({
      where: { institutionId: 'inst_789', isBase: true },
      data: { isBase: false },
    });
    expect(prisma.yieldCurve.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        institutionId: 'inst_789',
        name: 'Quant -7% Defense Curve',
        tenors,
        source: 'quant-desk',
        isBase: true,
      }),
    });
    expect(result).toEqual({ id: 'curve_1' });
  });
});
