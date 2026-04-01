import { StressTestService } from './stress-test.service';

describe('StressTestService', () => {
  let service: StressTestService;
  const mockMarketDataService = {
    getQuote: jest.fn().mockResolvedValue({ price: 150 }),
  };
  const mockCacheService = {} as any;

  beforeEach(() => {
    service = new StressTestService(
      mockMarketDataService as any,
      mockCacheService,
    );
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('runStressTest with historical scenarios returns results sorted by severity', async () => {
    const positions = [{ ticker: 'AAPL', quantity: 100 }];
    const result = await service.runStressTest(positions, 'historical');
    expect(result.portfolioValue).toBe(15000);
    expect(result.positionCount).toBe(1);
    expect(result.scenarios.length).toBeGreaterThanOrEqual(7);
    // Sorted by PnL ascending (worst first)
    for (let i = 1; i < result.scenarios.length; i++) {
      expect(result.scenarios[i].pnl).toBeGreaterThanOrEqual(
        result.scenarios[i - 1].pnl,
      );
    }
    expect(result.worstCase).toBe(result.scenarios[0]);
  });

  it('runStressTest with hypothetical scenarios returns 6 scenarios', async () => {
    const positions = [{ ticker: 'MSFT', quantity: 50 }];
    const result = await service.runStressTest(positions, 'hypothetical');
    expect(result.scenarios).toHaveLength(6);
    expect(result.scenarios[0]).toHaveProperty('severity');
  });

  it('scenario severity is categorized correctly', async () => {
    const positions = [{ ticker: 'AAPL', quantity: 100 }];
    const result = await service.runStressTest(positions, 'historical');
    const severities = new Set(result.scenarios.map((s) => s.severity));
    const validSeverities = [
      'LOW',
      'MODERATE',
      'HIGH',
      'SEVERE',
      'CATASTROPHIC',
    ];
    for (const sev of severities) {
      expect(validSeverities).toContain(sev);
    }
  });

  it('custom scenario applies provided shocks', async () => {
    const positions = [{ ticker: 'AAPL', quantity: 100 }];
    const customScenario = {
      name: 'Test Crash',
      description: '50% decline',
      shocks: { equity: -0.5 },
    };
    const result = await service.runStressTest(
      positions,
      'custom',
      customScenario,
    );
    expect(result.scenarios).toHaveLength(1);
    expect(result.scenarios[0].scenario).toBe('Test Crash');
    expect(result.scenarios[0].pnl).toBeLessThan(0);
  });

  it('averageLoss is calculated from all scenarios', async () => {
    const positions = [{ ticker: 'AAPL', quantity: 100 }];
    const result = await service.runStressTest(positions, 'hypothetical');
    const manualAvg =
      result.scenarios.reduce((sum, s) => sum + s.pnl, 0) /
      result.scenarios.length;
    expect(result.averageLoss).toBeCloseTo(manualAvg, 2);
  });

  // ── position weights sum to 1 ──────────────────────────────
  it('position weights sum to approximately 1', async () => {
    const positions = [
      { ticker: 'AAPL', quantity: 100 },
      { ticker: 'MSFT', quantity: 50 },
    ];
    const result = await service.runStressTest(positions, 'historical');
    const weightSum = result.positions.reduce((s, p) => s + p.weight, 0);
    expect(weightSum).toBeCloseTo(1.0, 4);
  });

  // ── position stressed values ───────────────────────────────
  it('each position has stressedValues for every scenario', async () => {
    const positions = [{ ticker: 'AAPL', quantity: 100 }];
    const result = await service.runStressTest(positions, 'hypothetical');
    for (const pos of result.positions) {
      expect(pos.stressedValues).toHaveLength(result.scenarios.length);
      for (const sv of pos.stressedValues) {
        expect(sv.pnl).toBeDefined();
        expect(sv.pnlPercent).toBeDefined();
      }
    }
  });

  // ── portfolio PnL check ────────────────────────────────────
  it('portfolio PnL equals portfolioValueAfter minus portfolioValueBefore', async () => {
    const positions = [{ ticker: 'AAPL', quantity: 100 }];
    const result = await service.runStressTest(positions, 'historical');
    for (const scenario of result.scenarios) {
      expect(scenario.pnl).toBeCloseTo(
        scenario.portfolioValueAfter - scenario.portfolioValueBefore,
        2,
      );
    }
  });

  // ── severity categories ────────────────────────────────────
  it('correctly categorizes severity for each threshold', async () => {
    const positions = [{ ticker: 'AAPL', quantity: 100 }];
    const result = await service.runStressTest(positions, 'historical');
    for (const scenario of result.scenarios) {
      if (scenario.pnlPercent > -5) expect(scenario.severity).toBe('LOW');
      else if (scenario.pnlPercent > -15) expect(scenario.severity).toBe('MODERATE');
      else if (scenario.pnlPercent > -30) expect(scenario.severity).toBe('HIGH');
      else if (scenario.pnlPercent > -50) expect(scenario.severity).toBe('SEVERE');
      else expect(scenario.severity).toBe('CATASTROPHIC');
    }
  });

  // ── runReverseStressTest ───────────────────────────────────
  describe('runReverseStressTest', () => {
    it('finds equity shock that causes target loss percentage', async () => {
      const positions = [{ ticker: 'AAPL', quantity: 100 }];
      const result = await service.runReverseStressTest(positions, -20);
      expect(result.targetLossPercent).toBe(-20);
      expect(result.requiredEquityShock).toBeLessThan(0);
      expect(result.scenarioDescription).toContain('Market decline');
    });

    it('returns historical parallel description', async () => {
      const positions = [{ ticker: 'AAPL', quantity: 100 }];
      const result = await service.runReverseStressTest(positions, -10);
      expect(result.historicalParallel).toBeDefined();
      expect(typeof result.historicalParallel).toBe('string');
    });

    it('returns probability estimate', async () => {
      const positions = [{ ticker: 'AAPL', quantity: 100 }];
      const result = await service.runReverseStressTest(positions, -30);
      expect(result.probability).toBeDefined();
      expect(typeof result.probability).toBe('string');
    });
  });

  // ── multiple positions ─────────────────────────────────────
  describe('multiple positions', () => {
    it('calculates portfolio value as sum of all position values', async () => {
      mockMarketDataService.getQuote
        .mockResolvedValueOnce({ price: 150 })
        .mockResolvedValueOnce({ price: 300 });

      const positions = [
        { ticker: 'AAPL', quantity: 100 },
        { ticker: 'MSFT', quantity: 50 },
      ];
      const result = await service.runStressTest(positions, 'hypothetical');
      expect(result.portfolioValue).toBe(100 * 150 + 50 * 300);
      expect(result.positionCount).toBe(2);
    });
  });

  // ── timestamp ──────────────────────────────────────────────
  it('result includes a timestamp', async () => {
    const positions = [{ ticker: 'AAPL', quantity: 100 }];
    const result = await service.runStressTest(positions, 'historical');
    expect(result.timestamp).toBeInstanceOf(Date);
  });

  // ── worstCase is first scenario (lowest PnL) ──────────────
  it('worstCase is the scenario with lowest PnL', async () => {
    const positions = [{ ticker: 'AAPL', quantity: 100 }];
    const result = await service.runStressTest(positions, 'historical');
    for (const scenario of result.scenarios) {
      expect(result.worstCase.pnl).toBeLessThanOrEqual(scenario.pnl);
    }
  });

  // ── custom scenario with zero equity shock ─────────────────
  it('custom scenario with zero equity shock produces near-zero PnL', async () => {
    const positions = [{ ticker: 'AAPL', quantity: 100 }];
    const customScenario = {
      name: 'Flat',
      description: 'No change',
      shocks: { equity: 0 },
    };
    const result = await service.runStressTest(
      positions,
      'custom',
      customScenario,
    );
    // PnL should be near zero (beta randomization may cause small deviation)
    expect(Math.abs(result.scenarios[0].pnlPercent)).toBeLessThan(5);
  });

  // ── historical scenarios contain named crises ──────────────
  it('historical scenarios include known crisis names', async () => {
    const positions = [{ ticker: 'AAPL', quantity: 100 }];
    const result = await service.runStressTest(positions, 'historical');
    const names = result.scenarios.map((s) => s.scenario);
    expect(names).toContain('Global Financial Crisis (2008)');
    expect(names).toContain('COVID-19 Crash (2020)');
  });
});
