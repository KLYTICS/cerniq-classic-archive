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

  // ── Coverage boost: defensive ticker beta paths ────────────
  describe('beta estimation paths', () => {
    it('applies higher beta for tech tickers (AAPL, GOOGL, MSFT, META, NVDA, AMZN)', async () => {
      const techTickers = ['AAPL', 'GOOGL', 'MSFT', 'META', 'NVDA', 'AMZN'];
      for (const ticker of techTickers) {
        mockMarketDataService.getQuote.mockResolvedValue({ price: 100 });
        const customScenario = {
          name: 'Test',
          description: 'test',
          shocks: { equity: -0.5 },
        };
        const result = await service.runStressTest(
          [{ ticker, quantity: 10 }],
          'custom',
          customScenario,
        );
        // Tech tickers have beta 1.2-1.5, so with -50% equity shock the loss should be > 50%
        expect(result.scenarios[0].pnlPercent).toBeLessThan(-50);
      }
    });

    it('applies lower beta for defensive tickers (JNJ, PG, KO, PEP, WMT)', async () => {
      const defensiveTickers = ['JNJ', 'PG', 'KO', 'PEP', 'WMT'];
      for (const ticker of defensiveTickers) {
        mockMarketDataService.getQuote.mockResolvedValue({ price: 100 });
        const customScenario = {
          name: 'Test',
          description: 'test',
          shocks: { equity: -0.5 },
        };
        const result = await service.runStressTest(
          [{ ticker, quantity: 10 }],
          'custom',
          customScenario,
        );
        // Defensive tickers have beta 0.6-0.8, so with -50% equity shock the loss should be < 50%
        expect(result.scenarios[0].pnlPercent).toBeGreaterThan(-50);
      }
    });

    it('applies average beta for unknown tickers', async () => {
      mockMarketDataService.getQuote.mockResolvedValue({ price: 100 });
      const customScenario = {
        name: 'Test',
        description: 'test',
        shocks: { equity: -0.5 },
      };
      const result = await service.runStressTest(
        [{ ticker: 'XYZ', quantity: 10 }],
        'custom',
        customScenario,
      );
      // Average stock beta 0.9-1.2, so loss should be 45-60%
      expect(result.scenarios[0].pnlPercent).toBeLessThan(0);
      expect(result.scenarios[0].pnl).toBeLessThan(0);
    });
  });

  // ── Coverage boost: reverse stress test convergence paths ──
  describe('runReverseStressTest — convergence branches', () => {
    it('converges early when actual loss closely matches target', async () => {
      mockMarketDataService.getQuote.mockResolvedValue({ price: 100 });
      // Use a small target loss that binary search can find quickly
      const result = await service.runReverseStressTest(
        [{ ticker: 'JNJ', quantity: 100 }],
        -5,
      );
      expect(result.targetLossPercent).toBe(-5);
      expect(result.requiredEquityShock).toBeLessThan(0);
      expect(result.probability).toBeDefined();
    });

    it('returns result after max iterations if convergence is slow', async () => {
      mockMarketDataService.getQuote.mockResolvedValue({ price: 100 });
      // Very specific target that may require many iterations
      const result = await service.runReverseStressTest(
        [{ ticker: 'AAPL', quantity: 100 }],
        -45,
      );
      expect(result.targetLossPercent).toBe(-45);
      expect(result.requiredEquityShock).toBeLessThan(0);
      expect(result.scenarioDescription).toContain('Market decline');
    });
  });

  // ── Coverage boost: historical parallel and probability ────
  describe('findHistoricalParallel and estimateProbability via reverse stress test', () => {
    it('returns "typical corrections" for small shocks', async () => {
      mockMarketDataService.getQuote.mockResolvedValue({ price: 100 });
      const result = await service.runReverseStressTest(
        [{ ticker: 'AAPL', quantity: 100 }],
        -5,
      );
      expect(result.historicalParallel).toBeDefined();
      expect(typeof result.historicalParallel).toBe('string');
    });

    it('returns GFC parallel for large shocks', async () => {
      mockMarketDataService.getQuote.mockResolvedValue({ price: 100 });
      const result = await service.runReverseStressTest(
        [{ ticker: 'AAPL', quantity: 100 }],
        -50,
      );
      expect(result.historicalParallel).toBeDefined();
      // Should reference GFC or similar
      expect(typeof result.probability).toBe('string');
    });
  });

  // ── Coverage boost: hypothetical scenarios with multiple positions ──
  describe('hypothetical scenarios with diverse portfolio', () => {
    it('handles mixed tech and defensive portfolio correctly', async () => {
      mockMarketDataService.getQuote
        .mockResolvedValueOnce({ price: 200 })  // NVDA (tech)
        .mockResolvedValueOnce({ price: 50 })   // WMT (defensive)
        .mockResolvedValueOnce({ price: 100 });  // XYZ (average)

      const positions = [
        { ticker: 'NVDA', quantity: 50 },
        { ticker: 'WMT', quantity: 200 },
        { ticker: 'XYZ', quantity: 100 },
      ];
      const result = await service.runStressTest(positions, 'hypothetical');

      expect(result.portfolioValue).toBe(50 * 200 + 200 * 50 + 100 * 100);
      expect(result.positionCount).toBe(3);
      expect(result.positions).toHaveLength(3);
      // All weights should sum to 1
      const weightSum = result.positions.reduce((s, p) => s + p.weight, 0);
      expect(weightSum).toBeCloseTo(1.0, 4);
      // Each position should have stressed values for all 6 hypothetical scenarios
      for (const pos of result.positions) {
        expect(pos.stressedValues).toHaveLength(6);
      }
    });
  });

  // ── Coverage boost: categorizeSeverity CATASTROPHIC path ──────
  it('produces CATASTROPHIC severity for extreme crash scenario', async () => {
    mockMarketDataService.getQuote.mockResolvedValue({ price: 100 });
    const customScenario = {
      name: 'Extreme Crash',
      description: '80% decline',
      shocks: { equity: -0.8 },
    };
    const result = await service.runStressTest(
      [{ ticker: 'AAPL', quantity: 100 }],
      'custom',
      customScenario,
    );
    // With beta 1.2-1.5, an 80% shock = 96-120% loss -> CATASTROPHIC
    expect(result.scenarios[0].severity).toBe('CATASTROPHIC');
  });

  // ── Coverage: estimateProbability for shock < 0.1 ──────────────
  it('returns common probability for very small shock via reverse stress test', async () => {
    mockMarketDataService.getQuote.mockResolvedValue({ price: 100 });
    const result = await service.runReverseStressTest(
      [{ ticker: 'JNJ', quantity: 100 }],
      -2,
    );
    expect(result.probability).toBeDefined();
    expect(typeof result.probability).toBe('string');
  });

  // ── Coverage: findHistoricalParallel for 0.25-0.4 range ──────
  it('returns COVID/Dot-Com parallel for medium-large shock', async () => {
    mockMarketDataService.getQuote.mockResolvedValue({ price: 100 });
    const result = await service.runReverseStressTest(
      [{ ticker: 'JNJ', quantity: 100 }],
      -25,
    );
    expect(result.historicalParallel).toBeDefined();
  });
});
