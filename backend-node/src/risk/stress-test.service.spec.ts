import { StressTestService } from './stress-test.service';

describe('StressTestService', () => {
  let service: StressTestService;
  const mockMarketDataService = {
    getQuote: jest.fn().mockResolvedValue({ price: 150 }),
  };
  const mockCacheService = {} as any;

  beforeEach(() => {
    service = new StressTestService(mockMarketDataService as any, mockCacheService);
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
    const validSeverities = ['LOW', 'MODERATE', 'HIGH', 'SEVERE', 'CATASTROPHIC'];
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
});
