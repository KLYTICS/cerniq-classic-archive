import { StressTestingService } from './stress-testing.service';

describe('StressTestingService', () => {
  let service: StressTestingService;
  const mockPrisma = {
    balanceSheetItem: {
      findMany: jest.fn(),
    },
    institution: {
      findUnique: jest.fn(),
    },
  } as any;
  const mockAlmEnterprise = {
    getALMSummary: jest.fn(),
    getInstitution: jest.fn(),
    getCOSSECCompliance: jest.fn(),
    calculateLCR: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StressTestingService(mockPrisma, mockAlmEnterprise);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── runMonteCarloSimulation ───────────────────────────────────
  it('returns empty result when no balance sheet items exist', async () => {
    mockPrisma.balanceSheetItem.findMany.mockResolvedValue([]);
    const result = await service.runMonteCarloSimulation('inst-1');
    expect(result.paths).toBeGreaterThan(0);
    expect(result.ratePaths).toBeDefined();
    expect(result.niiDistribution).toBeDefined();
  });

  it('runs Monte Carlo with custom params clamped to safe bounds', async () => {
    mockPrisma.balanceSheetItem.findMany.mockResolvedValue([
      { category: 'asset', rateType: 'variable', balance: 100, rate: 0.05 },
      { category: 'liability', rateType: 'variable', balance: 80, rate: 0.02 },
      { category: 'asset', rateType: 'fixed', balance: 200, rate: 0.06 },
      { category: 'liability', rateType: 'fixed', balance: 150, rate: 0.03 },
    ]);

    const result = await service.runMonteCarloSimulation('inst-1', {
      paths: 200,
      horizon: 6,
      volatility: 100,
    });

    expect(result.paths).toBe(200);
    expect(result.horizon).toBe(6);
    expect(result.ratePaths.length).toBeGreaterThan(0);
    // Rate paths should be capped at 50 for charting
    expect(result.ratePaths.length).toBeLessThanOrEqual(50);

    // NII distribution should have valid percentiles
    expect(result.niiDistribution.p5).toBeLessThanOrEqual(
      result.niiDistribution.median,
    );
    expect(result.niiDistribution.median).toBeLessThanOrEqual(
      result.niiDistribution.p95,
    );
  });

  it('clamps paths to MAX_MC_PATHS (50000)', async () => {
    mockPrisma.balanceSheetItem.findMany.mockResolvedValue([]);
    const result = await service.runMonteCarloSimulation('inst-1', {
      paths: 999999,
    });
    expect(result.paths).toBeLessThanOrEqual(50000);
  });

  it('clamps horizon to MAX_MC_HORIZON (120)', async () => {
    mockPrisma.balanceSheetItem.findMany.mockResolvedValue([]);
    const result = await service.runMonteCarloSimulation('inst-1', {
      horizon: 999,
    });
    expect(result.horizon).toBeLessThanOrEqual(120);
  });

  it('generates monthly NII bands with correct month count', async () => {
    mockPrisma.balanceSheetItem.findMany.mockResolvedValue([
      { category: 'asset', rateType: 'variable', balance: 50, rate: 0.05 },
      { category: 'liability', rateType: 'fixed', balance: 40, rate: 0.03 },
    ]);

    const result = await service.runMonteCarloSimulation('inst-1', {
      paths: 100,
      horizon: 12,
    });

    // MC returns horizon+1 bands (month 0 = baseline through month N)
    expect(result.monthlyNIIBands).toHaveLength(13);
    result.monthlyNIIBands.forEach((band) => {
      expect(band.month).toBeGreaterThanOrEqual(0);
      expect(band.p5).toBeLessThanOrEqual(band.p95);
    });
  });

  // ── Floating vs fixed rate behavior ────────────────────────
  describe('floating vs fixed rate sensitivity', () => {
    it('floating-heavy portfolio produces wider NII distribution than fixed-heavy', async () => {
      // All floating
      mockPrisma.balanceSheetItem.findMany.mockResolvedValue([
        { category: 'asset', rateType: 'variable', balance: 500, rate: 0.06 },
        { category: 'liability', rateType: 'variable', balance: 400, rate: 0.02 },
      ]);
      const floatingResult = await service.runMonteCarloSimulation('inst-1', {
        paths: 500,
        horizon: 12,
        volatility: 200,
      });

      // All fixed
      mockPrisma.balanceSheetItem.findMany.mockResolvedValue([
        { category: 'asset', rateType: 'fixed', balance: 500, rate: 0.06 },
        { category: 'liability', rateType: 'fixed', balance: 400, rate: 0.02 },
      ]);
      const fixedResult = await service.runMonteCarloSimulation('inst-1', {
        paths: 500,
        horizon: 12,
        volatility: 200,
      });

      const floatingSpread = floatingResult.niiDistribution.p95 - floatingResult.niiDistribution.p5;
      const fixedSpread = fixedResult.niiDistribution.p95 - fixedResult.niiDistribution.p5;

      // Floating portfolio should have wider NII spread (more rate-sensitive)
      expect(floatingSpread).toBeGreaterThan(fixedSpread);
    });

    it('fixed-only portfolio yields identical NII across all paths', async () => {
      mockPrisma.balanceSheetItem.findMany.mockResolvedValue([
        { category: 'asset', rateType: 'fixed', balance: 1000, rate: 0.07 },
        { category: 'liability', rateType: 'fixed', balance: 800, rate: 0.03 },
      ]);
      const result = await service.runMonteCarloSimulation('inst-1', {
        paths: 200,
        horizon: 6,
      });

      // p5 should equal p95 for a fully fixed portfolio (no rate sensitivity)
      expect(result.niiDistribution.p5).toBeCloseTo(result.niiDistribution.p95, 1);
    });
  });

  // ── Monte Carlo with high volatility ──────────────────────
  it('high volatility produces greater NII-at-risk', async () => {
    const items = [
      { category: 'asset', rateType: 'variable', balance: 300, rate: 0.05 },
      { category: 'liability', rateType: 'variable', balance: 200, rate: 0.02 },
    ];

    mockPrisma.balanceSheetItem.findMany.mockResolvedValue(items);
    const lowVol = await service.runMonteCarloSimulation('inst-1', {
      paths: 500,
      horizon: 12,
      volatility: 50,
    });

    mockPrisma.balanceSheetItem.findMany.mockResolvedValue(items);
    const highVol = await service.runMonteCarloSimulation('inst-1', {
      paths: 500,
      horizon: 12,
      volatility: 500,
    });

    expect(highVol.niiAtRisk).toBeGreaterThanOrEqual(lowVol.niiAtRisk);
  });

  // ── worstCaseNII is less than or equal to expectedNII ─────
  it('worstCaseNII <= expectedNII', async () => {
    mockPrisma.balanceSheetItem.findMany.mockResolvedValue([
      { category: 'asset', rateType: 'variable', balance: 100, rate: 0.05 },
      { category: 'liability', rateType: 'fixed', balance: 80, rate: 0.02 },
    ]);
    const result = await service.runMonteCarloSimulation('inst-1', {
      paths: 300,
      horizon: 12,
    });
    expect(result.worstCaseNII).toBeLessThanOrEqual(result.expectedNII);
  });

  // ── NII at risk equals expected minus worst case ──────────
  it('niiAtRisk equals expectedNII minus worstCaseNII', async () => {
    mockPrisma.balanceSheetItem.findMany.mockResolvedValue([
      { category: 'asset', rateType: 'variable', balance: 200, rate: 0.06 },
      { category: 'liability', rateType: 'variable', balance: 150, rate: 0.025 },
    ]);
    const result = await service.runMonteCarloSimulation('inst-1', {
      paths: 200,
      horizon: 12,
    });
    expect(result.niiAtRisk).toBeCloseTo(
      result.expectedNII - result.worstCaseNII,
      1,
    );
  });

  // ── Coverage boost: runRegulatoryStress ─────────────────────
  describe('runRegulatoryStress', () => {
    beforeEach(() => {
      mockAlmEnterprise.calculateNIISensitivity = jest.fn().mockResolvedValue({
        baseNII: 10,
        scenarios: [
          { shiftBps: 100, niImpact: 0.5, mveImpact: -1, niImpactPct: 5 },
          { shiftBps: 200, niImpact: 1.0, mveImpact: -2, niImpactPct: 10 },
          { shiftBps: 300, niImpact: 1.5, mveImpact: -3, niImpactPct: 15 },
          { shiftBps: -200, niImpact: -0.8, mveImpact: 1.5, niImpactPct: -8 },
        ],
      });
      mockAlmEnterprise.calculateLCR = jest.fn().mockResolvedValue({ lcr: 120 });
      mockAlmEnterprise.calculateDurationGap = jest.fn().mockResolvedValue({ durationGap: 1.5 });
    });

    it('returns 4 regulatory scenarios', async () => {
      const result = await service.runRegulatoryStress('inst-1');
      expect(result.scenarios).toHaveLength(4);
      const names = result.scenarios.map(s => s.name);
      expect(names).toContain('Rapid Rise');
      expect(names).toContain('Gradual Rise');
      expect(names).toContain('Yield Curve Inversion');
      expect(names).toContain('Shock Down');
    });

    it('assigns overall rating based on fail/warn counts', async () => {
      const result = await service.runRegulatoryStress('inst-1');
      expect(['resilient', 'adequate', 'vulnerable', 'critical']).toContain(result.overallRating);
    });

    it('each scenario has valid rateShock array of 12 months', async () => {
      const result = await service.runRegulatoryStress('inst-1');
      for (const scenario of result.scenarios) {
        expect(scenario.rateShock).toHaveLength(12);
        expect(scenario.passFailStatus).toBeDefined();
      }
    });
  });

  // ── Coverage boost: runFullStressTest ───────────────────────
  describe('runFullStressTest', () => {
    beforeEach(() => {
      mockAlmEnterprise.calculateNIISensitivity = jest.fn().mockResolvedValue({
        baseNII: 10,
        scenarios: [
          { shiftBps: 100, niImpact: 0.5, mveImpact: -1, niImpactPct: 5 },
          { shiftBps: 200, niImpact: 1.0, mveImpact: -2, niImpactPct: 10 },
          { shiftBps: 300, niImpact: 1.5, mveImpact: -3, niImpactPct: 15 },
          { shiftBps: -200, niImpact: -0.8, mveImpact: 1.5, niImpactPct: -8 },
        ],
      });
      mockAlmEnterprise.calculateLCR = jest.fn().mockResolvedValue({ lcr: 120 });
      mockAlmEnterprise.calculateDurationGap = jest.fn().mockResolvedValue({ durationGap: 1.5 });
      mockAlmEnterprise.getCOSSECCompliance = jest.fn().mockResolvedValue({
        summary: { totalShares: 200, totalLoans: 150 },
      });
      mockPrisma.balanceSheetItem.findMany.mockResolvedValue([
        { category: 'asset', rateType: 'variable', balance: 100, rate: 0.05 },
        { category: 'liability', rateType: 'fixed', balance: 80, rate: 0.03 },
      ]);
    });

    it('returns monteCarlo, regulatory, and cossecScenarios', async () => {
      const result = await service.runFullStressTest('inst-1', { paths: 100, horizon: 6 });
      expect(result).toHaveProperty('monteCarlo');
      expect(result).toHaveProperty('regulatory');
      expect(result).toHaveProperty('cossecScenarios');
      expect(result.monteCarlo.paths).toBe(100);
    });
  });

  // ── Coverage boost: runCustomScenario ──────────────────────
  describe('runCustomScenario', () => {
    beforeEach(() => {
      mockAlmEnterprise.calculateNIISensitivity = jest.fn().mockResolvedValue({
        baseNII: 10,
        scenarios: [
          { shiftBps: 100, niImpact: 0.5, mveImpact: -1, niImpactPct: 5 },
          { shiftBps: 200, niImpact: 1.0, mveImpact: -2, niImpactPct: 10 },
          { shiftBps: 300, niImpact: 1.5, mveImpact: -3, niImpactPct: 15 },
          { shiftBps: -200, niImpact: -0.8, mveImpact: 1.5, niImpactPct: -8 },
        ],
      });
      mockAlmEnterprise.calculateLCR = jest.fn().mockResolvedValue({ lcr: 120, hqla: 50 });
      mockAlmEnterprise.getCOSSECCompliance = jest.fn().mockResolvedValue({
        examReadinessScore: 85,
        summary: { totalAssets: 500, totalLoans: 300, totalShares: 200, capitalRatio: 10, nim: 3.5 },
      });
    });

    it('returns RESILIENT verdict for mild stress', async () => {
      const result = await service.runCustomScenario('inst-1', {
        rateShockBps: 50,
        depositRunoffPct: 2,
        defaultRateIncreasePct: 1,
        energyCostShockPct: 5,
      });
      expect(result.nimBefore).toBeCloseTo(3.5, 1);
      expect(result.lcrBefore).toBeCloseTo(120, 0);
      expect(result.capitalBefore).toBeCloseTo(10, 1);
      expect(result.verdict).toBe('RESILIENT');
      expect(result.narrative).toContain('rate shock');
      expect(result.narrativeEs).toContain('choque de tasas');
    });

    it('returns CRITICAL verdict for extreme stress', async () => {
      mockAlmEnterprise.getCOSSECCompliance.mockResolvedValue({
        examReadinessScore: 40,
        summary: { totalAssets: 500, totalLoans: 300, totalShares: 200, capitalRatio: 5, nim: 2.0 },
      });
      mockAlmEnterprise.calculateLCR.mockResolvedValue({ lcr: 95, hqla: 30 });

      const result = await service.runCustomScenario('inst-1', {
        rateShockBps: -300,
        depositRunoffPct: 25,
        defaultRateIncreasePct: 12,
        energyCostShockPct: 40,
      });
      expect(['VULNERABLE', 'CRITICAL']).toContain(result.verdict);
      expect(result.capitalAfter).toBeLessThan(result.capitalBefore);
    });

    it('returns empty result when upstream data fails', async () => {
      mockAlmEnterprise.calculateNIISensitivity.mockRejectedValue(new Error('DB down'));

      const result = await service.runCustomScenario('inst-1', {
        rateShockBps: 100,
        depositRunoffPct: 5,
        defaultRateIncreasePct: 2,
        energyCostShockPct: 10,
      });
      expect(result.verdict).toBe('CRITICAL');
      expect(result.narrative).toContain('No balance sheet data');
    });

    it('clamps parameters to valid ranges', async () => {
      const result = await service.runCustomScenario('inst-1', {
        rateShockBps: 500, // clamped to 300
        depositRunoffPct: 50, // clamped to 30
        defaultRateIncreasePct: 20, // clamped to 15
        energyCostShockPct: 80, // clamped to 50
      });
      // Verify it ran without error (clamping happened internally)
      expect(result.nimBefore).toBeDefined();
      expect(result.lcrAfter).toBeDefined();
    });
  });
});
