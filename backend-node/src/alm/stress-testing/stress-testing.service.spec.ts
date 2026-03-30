import { StressTestingService } from './stress-testing.service';

function makeNIISensitivity(overrides: Record<string, unknown> = {}) {
  return {
    baseNII: 100,
    riskRating: 'moderate',
    scenarios: [
      { name: 'Parallel +100bps', shiftBps: 100, niImpact: 10, mveImpact: -8 },
      { name: 'Parallel +200bps', shiftBps: 200, niImpact: 20, mveImpact: -16 },
      { name: 'Parallel +300bps', shiftBps: 300, niImpact: 30, mveImpact: -24 },
      {
        name: 'Same-Day -7%',
        shiftBps: -200,
        niImpact: -6,
        mveImpact: 8,
      },
    ],
    ...overrides,
  };
}

function makeCOSSEC(overrides: Record<string, unknown> = {}) {
  return {
    examReadinessScore: 90,
    summary: {
      totalAssets: 1000,
      totalLoans: 500,
      totalShares: 400,
      capitalRatio: 12,
      nim: 4,
    },
    ...overrides,
  };
}

describe('StressTestingService', () => {
  let service: StressTestingService;
  const mockPrisma = {
    balanceSheetItem: {
      findMany: jest.fn(),
    },
  } as any;
  const mockAlmEnterprise = {
    getCOSSECCompliance: jest.fn(),
    calculateLCR: jest.fn(),
    calculateDurationGap: jest.fn(),
    calculateNIISensitivity: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    service = new StressTestingService(mockPrisma, mockAlmEnterprise);

    mockPrisma.balanceSheetItem.findMany.mockResolvedValue([]);
    mockAlmEnterprise.calculateNIISensitivity.mockResolvedValue(
      makeNIISensitivity(),
    );
    mockAlmEnterprise.calculateLCR.mockResolvedValue({
      lcr: 140,
      hqla: 100,
      status: 'compliant',
      buffer: 40,
    });
    mockAlmEnterprise.calculateDurationGap.mockResolvedValue({
      durationGap: 2.1,
    });
    mockAlmEnterprise.getCOSSECCompliance.mockResolvedValue(makeCOSSEC());
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('runMonteCarloSimulation', () => {
    it('returns an empty result when no balance sheet items exist', async () => {
      mockPrisma.balanceSheetItem.findMany.mockResolvedValue([]);

      const result = await service.runMonteCarloSimulation('inst-1');

      expect(result.paths).toBeGreaterThan(0);
      expect(result.ratePaths).toEqual([]);
      expect(result.monthlyNIIBands).toHaveLength(result.horizon + 1);
      expect(result.niiAtRisk).toBe(0);
    });

    it('runs Monte Carlo with a mixed balance sheet and bounded chart output', async () => {
      mockPrisma.balanceSheetItem.findMany.mockResolvedValue([
        { category: 'asset', rateType: 'variable', balance: 100, rate: 4.8 },
        { category: 'asset', rateType: 'fixed', balance: 140, rate: 5.7 },
        {
          category: 'liability',
          rateType: 'variable',
          balance: 120,
          rate: 2.1,
        },
        { category: 'liability', rateType: 'fixed', balance: 90, rate: 1.8 },
      ]);

      const result = await service.runMonteCarloSimulation('inst-1', {
        paths: 200,
        horizon: 6,
        volatility: 100,
        meanReversion: 0.35,
      });

      expect(result.paths).toBe(200);
      expect(result.horizon).toBe(6);
      expect(result.ratePaths.length).toBeLessThanOrEqual(50);
      expect(result.monthlyNIIBands).toHaveLength(7);
      expect(result.niiDistribution.p5).toBeLessThanOrEqual(
        result.niiDistribution.median,
      );
      expect(result.niiDistribution.median).toBeLessThanOrEqual(
        result.niiDistribution.p95,
      );
      expect(result.niiAtRisk).toBeGreaterThanOrEqual(0);
    });

    it('clamps path count and horizon to enterprise-safe bounds', async () => {
      const result = await service.runMonteCarloSimulation('inst-1', {
        paths: 999999,
        horizon: 999,
      });

      expect(result.paths).toBe(50000);
      expect(result.horizon).toBe(120);
    });
  });

  describe('runRegulatoryStress', () => {
    it('returns a resilient rating when all scenario outcomes remain inside limits', async () => {
      mockAlmEnterprise.calculateNIISensitivity.mockResolvedValue(
        makeNIISensitivity({
          scenarios: [
            { shiftBps: 300, niImpact: 6, mveImpact: -10 },
            { shiftBps: 200, niImpact: 4, mveImpact: -6 },
            { shiftBps: -200, niImpact: -3, mveImpact: 5 },
          ],
        }),
      );

      const result = await service.runRegulatoryStress('inst-1');

      expect(result.overallRating).toBe('resilient');
      expect(result.scenarios.map((scenario) => scenario.name)).toEqual([
        'Rapid Rise',
        'Gradual Rise',
        'Yield Curve Inversion',
        'Shock Down',
      ]);
      expect(result.scenarios[0].rateShock.slice(0, 6)).toEqual([
        50, 100, 150, 200, 250, 300,
      ]);
      expect(result.scenarios[1].rateShock.slice(0, 6)).toEqual([
        25, 25, 25, 50, 50, 50,
      ]);
      expect(
        result.scenarios.every(
          (scenario) => scenario.passFailStatus === 'pass',
        ),
      ).toBe(true);
    });

    it('returns an adequate rating when two scenarios warn but none fail', async () => {
      mockAlmEnterprise.calculateNIISensitivity.mockResolvedValue(
        makeNIISensitivity({
          scenarios: [
            { shiftBps: 300, niImpact: -9, mveImpact: -10 },
            { shiftBps: 200, niImpact: -10, mveImpact: -6 },
            { shiftBps: -200, niImpact: -6, mveImpact: 5 },
          ],
        }),
      );

      const result = await service.runRegulatoryStress('inst-1');

      expect(result.overallRating).toBe('adequate');
      expect(
        result.scenarios.filter(
          (scenario) => scenario.passFailStatus === 'warn',
        ),
      ).toHaveLength(2);
      expect(
        result.scenarios.filter(
          (scenario) => scenario.passFailStatus === 'fail',
        ),
      ).toHaveLength(0);
    });

    it('returns a vulnerable rating when exactly one scenario fails', async () => {
      mockAlmEnterprise.calculateNIISensitivity.mockResolvedValue(
        makeNIISensitivity({
          scenarios: [
            { shiftBps: 300, niImpact: -20, mveImpact: -18 },
            { shiftBps: 200, niImpact: -5, mveImpact: -6 },
            { shiftBps: -200, niImpact: -5, mveImpact: 5 },
          ],
        }),
      );

      const result = await service.runRegulatoryStress('inst-1');

      expect(result.overallRating).toBe('vulnerable');
      expect(
        result.scenarios.filter(
          (scenario) => scenario.passFailStatus === 'fail',
        ),
      ).toHaveLength(1);
    });

    it('returns a critical rating from fallback math when multiple hard failures occur', async () => {
      mockAlmEnterprise.calculateNIISensitivity.mockResolvedValue(
        makeNIISensitivity({ scenarios: [] }),
      );
      mockAlmEnterprise.calculateLCR.mockResolvedValue({
        lcr: 108,
        hqla: 90,
        status: 'warning',
        buffer: 8,
      });

      const result = await service.runRegulatoryStress('inst-1');

      expect(result.overallRating).toBe('critical');
      expect(
        result.scenarios.filter(
          (scenario) => scenario.passFailStatus === 'fail',
        ).length,
      ).toBeGreaterThanOrEqual(2);
      expect(result.scenarios[0].niImpact).toBeCloseTo(8, 2);
      expect(result.scenarios[1].niImpact).toBeCloseTo(4, 2);
      expect(result.scenarios[3].niImpact).toBeCloseTo(-6, 2);
    });
  });

  describe('runCOSSECScenarios', () => {
    it('preserves steepening adjustments and PR-specific deposit and credit losses', async () => {
      mockAlmEnterprise.calculateNIISensitivity.mockResolvedValue(
        makeNIISensitivity(),
      );
      mockAlmEnterprise.getCOSSECCompliance.mockResolvedValue(
        makeCOSSEC({
          summary: {
            totalAssets: 1000,
            totalLoans: 500,
            totalShares: 1000,
            capitalRatio: 12,
            nim: 4,
          },
        }),
      );

      const result = await service.runCOSSECScenarios('inst-1');
      const steepening = result.find(
        (scenario) => scenario.scenario.id === 'steepening',
      );
      const prSpecific = result.find(
        (scenario) => scenario.scenario.id === 'pr_hurricane_stress',
      );

      expect(steepening).toMatchObject({
        niiImpact: 12,
        depositImpact: 0.3,
        creditLoss: 0,
        totalImpact: 11.7,
        totalImpactPct: 11.7,
        passFailStatus: 'pass',
      });
      expect(prSpecific).toMatchObject({
        niiImpact: 15,
        depositImpact: 0.75,
        creditLoss: 10,
        totalImpact: 4.25,
        totalImpactPct: 4.25,
        passFailStatus: 'pass',
      });
    });

    it('marks severe combined downside as warn or fail based on total impact thresholds', async () => {
      mockAlmEnterprise.calculateNIISensitivity.mockResolvedValue(
        makeNIISensitivity({
          scenarios: [
            { shiftBps: 100, niImpact: -12, mveImpact: -6 },
            { shiftBps: 200, niImpact: -25, mveImpact: -16 },
            { shiftBps: 300, niImpact: -40, mveImpact: -24 },
            { shiftBps: -100, niImpact: -8, mveImpact: 8 },
          ],
        }),
      );
      mockAlmEnterprise.getCOSSECCompliance.mockResolvedValue(
        makeCOSSEC({
          summary: {
            totalAssets: 1000,
            totalLoans: 1200,
            totalShares: 2000,
            capitalRatio: 12,
            nim: 4,
          },
        }),
      );

      const result = await service.runCOSSECScenarios('inst-1');
      const steepening = result.find(
        (scenario) => scenario.scenario.id === 'steepening',
      );
      const prSpecific = result.find(
        (scenario) => scenario.scenario.id === 'pr_hurricane_stress',
      );

      expect(steepening?.passFailStatus).toBe('fail');
      expect(prSpecific?.passFailStatus).toBe('fail');
      expect(prSpecific?.totalImpactPct).toBeLessThan(-20);
    });
  });

  describe('runCustomScenario', () => {
    it('returns the empty-result fallback when institution data cannot be loaded', async () => {
      mockAlmEnterprise.calculateNIISensitivity.mockRejectedValue(
        new Error('db unavailable'),
      );

      const result = await service.runCustomScenario('inst-1', {
        rateShockBps: -50,
        depositRunoffPct: 2,
        defaultRateIncreasePct: 1,
        energyCostShockPct: 4,
      });

      expect(result).toMatchObject({
        verdict: 'CRITICAL',
        narrative: expect.stringContaining('No balance sheet data available'),
        narrativeEs: expect.stringContaining('No hay datos de balance'),
      });
    });

    it('clamps scenario inputs and preserves bilingual stress narratives', async () => {
      mockAlmEnterprise.calculateNIISensitivity.mockResolvedValue(
        makeNIISensitivity({
          scenarios: [{ shiftBps: 300, niImpact: -30, mveImpact: -20 }],
        }),
      );
      mockAlmEnterprise.calculateLCR.mockResolvedValue({
        lcr: 120,
        hqla: 20,
        status: 'warning',
        buffer: 20,
      });
      mockAlmEnterprise.getCOSSECCompliance.mockResolvedValue(
        makeCOSSEC({
          examReadinessScore: 88,
          summary: {
            totalAssets: 1000,
            totalLoans: 900,
            totalShares: 500,
            capitalRatio: 10,
            nim: 4.2,
          },
        }),
      );

      const result = await service.runCustomScenario('inst-1', {
        rateShockBps: -999,
        depositRunoffPct: 80,
        defaultRateIncreasePct: 20,
        energyCostShockPct: 80,
      });

      expect(result.verdict).toBe('CRITICAL');
      expect(result.narrative).toContain('-300bps');
      expect(result.narrative).toContain('30%');
      expect(result.narrative).toContain('15%');
      expect(result.narrative).toContain('50%');
      expect(result.narrativeEs).toContain('-300bps');
      expect(result.narrativeEs).toContain('30%');
      expect(result.narrativeEs).toContain('15%');
      expect(result.narrativeEs).toContain('50%');
    });

    it.each([
      [
        'RESILIENT',
        {
          lcr: { lcr: 140, hqla: 100, status: 'compliant', buffer: 40 },
          cossec: makeCOSSEC(),
          nii: makeNIISensitivity({
            scenarios: [{ shiftBps: 100, niImpact: 5, mveImpact: -3 }],
          }),
          params: {
            rateShockBps: 100,
            depositRunoffPct: 0,
            defaultRateIncreasePct: 0,
            energyCostShockPct: 0,
          },
        },
      ],
      [
        'ADEQUATE',
        {
          lcr: { lcr: 140, hqla: 100, status: 'compliant', buffer: 40 },
          cossec: makeCOSSEC(),
          nii: makeNIISensitivity({
            scenarios: [{ shiftBps: -100, niImpact: -2, mveImpact: 3 }],
          }),
          params: {
            rateShockBps: -100,
            depositRunoffPct: 25,
            defaultRateIncreasePct: 0,
            energyCostShockPct: 0,
          },
        },
      ],
      [
        'VULNERABLE',
        {
          lcr: { lcr: 140, hqla: 100, status: 'compliant', buffer: 40 },
          cossec: makeCOSSEC(),
          nii: makeNIISensitivity({
            scenarios: [{ shiftBps: -100, niImpact: -4, mveImpact: 3 }],
          }),
          params: {
            rateShockBps: -100,
            depositRunoffPct: 0,
            defaultRateIncreasePct: 14,
            energyCostShockPct: 0,
          },
        },
      ],
      [
        'CRITICAL',
        {
          lcr: { lcr: 120, hqla: 20, status: 'warning', buffer: 20 },
          cossec: makeCOSSEC({
            summary: {
              totalAssets: 1000,
              totalLoans: 900,
              totalShares: 500,
              capitalRatio: 10,
              nim: 4.2,
            },
          }),
          nii: makeNIISensitivity({
            scenarios: [{ shiftBps: -300, niImpact: -30, mveImpact: -18 }],
          }),
          params: {
            rateShockBps: -300,
            depositRunoffPct: 30,
            defaultRateIncreasePct: 15,
            energyCostShockPct: 20,
          },
        },
      ],
    ])(
      'classifies %s custom scenario verdicts consistently',
      async (_label, fixture) => {
        mockAlmEnterprise.calculateLCR.mockResolvedValue(fixture.lcr);
        mockAlmEnterprise.getCOSSECCompliance.mockResolvedValue(fixture.cossec);
        mockAlmEnterprise.calculateNIISensitivity.mockResolvedValue(
          fixture.nii,
        );

        const result = await service.runCustomScenario(
          'inst-1',
          fixture.params,
        );

        expect(result.verdict).toBe(_label);
        expect(result.narrative).toContain('Verdict');
        expect(result.narrativeEs).toContain('Veredicto');
      },
    );
  });

  describe('runFullStressTest', () => {
    it('composes monte carlo, regulatory, and COSSEC results without changing shape', async () => {
      jest
        .spyOn(service, 'runMonteCarloSimulation')
        .mockResolvedValue({ paths: 500, horizon: 12 } as any);
      jest.spyOn(service, 'runRegulatoryStress').mockResolvedValue({
        overallRating: 'adequate',
        scenarios: [],
      });
      jest
        .spyOn(service, 'runCOSSECScenarios')
        .mockResolvedValue([{ scenario: { id: 'parallel_up_100' } } as any]);

      const result = await service.runFullStressTest('inst-1', { paths: 500 });

      expect(service.runMonteCarloSimulation).toHaveBeenCalledWith('inst-1', {
        paths: 500,
      });
      expect(service.runRegulatoryStress).toHaveBeenCalledWith('inst-1');
      expect(service.runCOSSECScenarios).toHaveBeenCalledWith('inst-1');
      expect(result).toEqual({
        monteCarlo: { paths: 500, horizon: 12 },
        regulatory: { overallRating: 'adequate', scenarios: [] },
        cossecScenarios: [{ scenario: { id: 'parallel_up_100' } }],
      });
    });
  });
});
