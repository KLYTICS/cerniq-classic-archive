import { RiskService } from './risk.service';

const mockPortfolioService = {
  getPortfolio: jest.fn(),
} as any;

const mockMarketDataService = {
  getHistoricalPrices: jest.fn(),
} as any;

describe('RiskService', () => {
  let service: RiskService;

  beforeEach(() => {
    service = new RiskService(mockPortfolioService, mockMarketDataService);
  });

  // ═══════════════════════════════════════════════════════════
  // Monte Carlo Simulation
  // ═══════════════════════════════════════════════════════════

  describe('runMonteCarloSimulation', () => {
    const baseRequest = {
      initialValue: 1_000_000,
      meanDailyReturn: 0.0003, // ~7.5% annual
      dailyVolatility: 0.015, // ~24% annual
      numSimulations: 1000,
      timeHorizon: 252, // 1 year
      confidenceLevel: 0.95,
    };

    it('should return all required fields', async () => {
      const result = await service.runMonteCarloSimulation(baseRequest);

      expect(result).toHaveProperty('var');
      expect(result).toHaveProperty('cvar');
      expect(result).toHaveProperty('worstCase');
      expect(result).toHaveProperty('bestCase');
      expect(result).toHaveProperty('median');
      expect(result).toHaveProperty('mean');
      expect(result).toHaveProperty('percentile5');
      expect(result).toHaveProperty('percentile95');
      expect(result).toHaveProperty('finalValues');
    });

    it('should produce positive VaR', async () => {
      const result = await service.runMonteCarloSimulation(baseRequest);
      expect(result.var).toBeGreaterThan(0);
    });

    it('should produce CVaR >= VaR (expected shortfall is worse than VaR)', async () => {
      const result = await service.runMonteCarloSimulation(baseRequest);
      expect(result.cvar).toBeGreaterThanOrEqual(result.var);
    });

    it('should produce percentile5 < median < percentile95', async () => {
      const result = await service.runMonteCarloSimulation(baseRequest);
      expect(result.percentile5).toBeLessThan(result.median);
      expect(result.median).toBeLessThan(result.percentile95);
    });

    it('should produce worstCase >= VaR', async () => {
      const result = await service.runMonteCarloSimulation(baseRequest);
      expect(result.worstCase).toBeGreaterThanOrEqual(result.var);
    });

    it('should return at most 100 final values for response size', async () => {
      const result = await service.runMonteCarloSimulation(baseRequest);
      expect(result.finalValues.length).toBeLessThanOrEqual(100);
    });

    it('should scale VaR with initial value', async () => {
      const small = await service.runMonteCarloSimulation({
        ...baseRequest,
        initialValue: 100_000,
        numSimulations: 500,
      });
      const large = await service.runMonteCarloSimulation({
        ...baseRequest,
        initialValue: 10_000_000,
        numSimulations: 500,
      });
      // VaR should scale roughly proportionally
      expect(large.var / small.var).toBeGreaterThan(10);
    });

    it('should produce higher VaR with higher volatility', async () => {
      const lowVol = await service.runMonteCarloSimulation({
        ...baseRequest,
        dailyVolatility: 0.005,
        numSimulations: 500,
      });
      const highVol = await service.runMonteCarloSimulation({
        ...baseRequest,
        dailyVolatility: 0.03,
        numSimulations: 500,
      });
      expect(highVol.var).toBeGreaterThan(lowVol.var);
    });

    it('should handle single simulation without error', async () => {
      const result = await service.runMonteCarloSimulation({
        ...baseRequest,
        numSimulations: 1,
      });
      expect(result.mean).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Value at Risk (Historical)
  // ═══════════════════════════════════════════════════════════

  describe('calculateVaR', () => {
    const baseReturns = [
      -0.03, -0.025, -0.02, -0.015, -0.01, -0.005, 0.0, 0.005, 0.01, 0.015,
      0.02, 0.025, 0.03, -0.008, 0.012, -0.018, 0.007, -0.004, 0.009, -0.011,
    ];

    it('should return VaR and CVaR at 95% confidence', async () => {
      const result = await service.calculateVaR({
        returns: baseReturns,
        confidenceLevel: 0.95,
        portfolioValue: 1_000_000,
      });

      expect(result.var).toBeGreaterThan(0);
      expect(result.cvar).toBeGreaterThan(0);
      expect(result.confidenceLevel).toBe(0.95);
    });

    it('should produce CVaR >= VaR', async () => {
      const result = await service.calculateVaR({
        returns: baseReturns,
        confidenceLevel: 0.95,
        portfolioValue: 1_000_000,
      });
      expect(result.cvar).toBeGreaterThanOrEqual(result.var);
    });

    it('should produce higher VaR at 99% vs 95% confidence', async () => {
      const var95 = await service.calculateVaR({
        returns: baseReturns,
        confidenceLevel: 0.95,
        portfolioValue: 1_000_000,
      });
      const var99 = await service.calculateVaR({
        returns: baseReturns,
        confidenceLevel: 0.99,
        portfolioValue: 1_000_000,
      });
      expect(var99.var).toBeGreaterThanOrEqual(var95.var);
    });

    it('should scale VaR with portfolio value', async () => {
      const small = await service.calculateVaR({
        returns: baseReturns,
        confidenceLevel: 0.95,
        portfolioValue: 100_000,
      });
      const large = await service.calculateVaR({
        returns: baseReturns,
        confidenceLevel: 0.95,
        portfolioValue: 1_000_000,
      });
      expect(large.var / small.var).toBeCloseTo(10, 0);
    });

    it('should throw on empty returns array', async () => {
      await expect(
        service.calculateVaR({
          returns: [],
          confidenceLevel: 0.95,
          portfolioValue: 1_000_000,
        }),
      ).rejects.toThrow('Returns array cannot be empty');
    });

    it('should handle all-negative returns (bear market)', async () => {
      const bearReturns = [
        -0.01, -0.02, -0.03, -0.015, -0.025, -0.005, -0.008, -0.012, -0.018,
        -0.022,
      ];
      const result = await service.calculateVaR({
        returns: bearReturns,
        confidenceLevel: 0.95,
        portfolioValue: 1_000_000,
      });
      expect(result.var).toBeGreaterThan(0);
      expect(result.cvar).toBeGreaterThan(0);
    });

    it('should reflect a same-day -7% shock in tail risk metrics', async () => {
      const shockReturns = [
        -0.07, -0.012, 0.004, -0.006, 0.008, -0.003, 0.005, -0.002, 0.006,
        -0.001, 0.004, -0.005,
      ];

      const result = await service.calculateVaR({
        returns: shockReturns,
        confidenceLevel: 0.95,
        portfolioValue: 1_000_000,
      });

      expect(result.var).toBeGreaterThanOrEqual(70_000);
      expect(result.cvar).toBeGreaterThanOrEqual(result.var);
    });

    it('should handle all-positive returns (bull market) — VaR is negative (gains)', async () => {
      const bullReturns = [
        0.01, 0.02, 0.03, 0.015, 0.025, 0.005, 0.008, 0.012, 0.018, 0.022,
      ];
      const result = await service.calculateVaR({
        returns: bullReturns,
        confidenceLevel: 0.95,
        portfolioValue: 1_000_000,
      });
      // In a bull market, VaR is negative (no loss scenario at 95% confidence)
      expect(result.var).toBeLessThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Correlation Matrix
  // ═══════════════════════════════════════════════════════════

  describe('calculateCorrelationMatrix', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return identity matrix for single ticker', async () => {
      mockMarketDataService.getHistoricalPrices.mockResolvedValue(
        [100, 102, 101, 103, 105].map((close: number) => ({ close })),
      );

      const result = await service.calculateCorrelationMatrix({
        tickers: ['AAPL'],
      });

      expect(result.tickers).toEqual(['AAPL']);
      expect(result.matrix[0][0]).toBe(1.0);
    });

    it('should produce symmetric matrix', async () => {
      mockMarketDataService.getHistoricalPrices
        .mockResolvedValueOnce(
          [100, 102, 104, 103, 106].map((c: number) => ({ close: c })),
        )
        .mockResolvedValueOnce(
          [50, 51, 52, 51, 53].map((c: number) => ({ close: c })),
        );

      const result = await service.calculateCorrelationMatrix({
        tickers: ['AAPL', 'GOOGL'],
      });

      expect(result.matrix[0][1]).toBeCloseTo(result.matrix[1][0], 10);
    });

    it('should produce correlation between -1 and 1', async () => {
      mockMarketDataService.getHistoricalPrices
        .mockResolvedValueOnce(
          [100, 105, 110, 108, 112].map((c: number) => ({ close: c })),
        )
        .mockResolvedValueOnce(
          [200, 195, 190, 192, 188].map((c: number) => ({ close: c })),
        );

      const result = await service.calculateCorrelationMatrix({
        tickers: ['AAPL', 'BONDS'],
      });

      expect(result.matrix[0][1]).toBeGreaterThanOrEqual(-1);
      expect(result.matrix[0][1]).toBeLessThanOrEqual(1);
    });

    it('should detect perfect positive correlation', async () => {
      const prices = [100, 110, 120, 130, 140].map((c: number) => ({
        close: c,
      }));
      mockMarketDataService.getHistoricalPrices
        .mockResolvedValueOnce(prices)
        .mockResolvedValueOnce(
          prices.map((p: any) => ({ close: p.close * 2 })),
        );

      const result = await service.calculateCorrelationMatrix({
        tickers: ['A', 'B'],
      });

      expect(result.matrix[0][1]).toBeCloseTo(1.0, 5);
    });

    it('should handle empty price data gracefully', async () => {
      mockMarketDataService.getHistoricalPrices.mockRejectedValue(
        new Error('No data'),
      );

      const result = await service.calculateCorrelationMatrix({
        tickers: ['FAKE1', 'FAKE2'],
      });

      expect(result.tickers).toEqual(['FAKE1', 'FAKE2']);
      expect(result.matrix[0][0]).toBe(1.0);
    });

    it('should have diagonal of 1.0 (self-correlation)', async () => {
      mockMarketDataService.getHistoricalPrices
        .mockResolvedValueOnce(
          [100, 102, 98, 105].map((c: number) => ({ close: c })),
        )
        .mockResolvedValueOnce(
          [50, 48, 52, 49].map((c: number) => ({ close: c })),
        )
        .mockResolvedValueOnce(
          [200, 205, 210, 208].map((c: number) => ({ close: c })),
        );

      const result = await service.calculateCorrelationMatrix({
        tickers: ['A', 'B', 'C'],
      });

      expect(result.matrix[0][0]).toBe(1.0);
      expect(result.matrix[1][1]).toBe(1.0);
      expect(result.matrix[2][2]).toBe(1.0);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Portfolio Risk
  // ═══════════════════════════════════════════════════════════

  describe('getPortfolioRisk', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return comprehensive risk metrics', async () => {
      mockPortfolioService.getPortfolio.mockResolvedValue({
        totalValue: 1_000_000,
        positions: [
          { ticker: 'AAPL', quantity: 100, marketValue: 500_000 },
          { ticker: 'GOOGL', quantity: 50, marketValue: 500_000 },
        ],
      });

      const result = await service.getPortfolioRisk('port-1', 'user-1');

      expect(result.portfolioId).toBe('port-1');
      expect(result.totalValue).toBe(1_000_000);
      expect(result.var95).toBeGreaterThan(0);
      expect(result.cvar95).toBeGreaterThanOrEqual(result.var95);
      expect(result.volatility).toBeGreaterThan(0);
      expect(typeof result.sharpeRatio).toBe('number');
    });

    it('should throw for empty portfolio', async () => {
      mockPortfolioService.getPortfolio.mockResolvedValue({
        totalValue: 0,
        positions: [],
      });

      await expect(
        service.getPortfolioRisk('port-1', 'user-1'),
      ).rejects.toThrow('Portfolio has no positions');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Stress Testing
  // ═══════════════════════════════════════════════════════════

  describe('runStressTest', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should calculate losses for each scenario', async () => {
      mockPortfolioService.getPortfolio.mockResolvedValue({
        totalValue: 1_000_000,
        positions: [
          { ticker: 'AAPL', marketValue: 600_000 },
          { ticker: 'GOOGL', marketValue: 400_000 },
        ],
      });

      const results = await service.runStressTest('port-1', 'user-1', [
        {
          name: '2008 Crisis',
          description: 'Severe downturn',
          marketShock: -0.4,
        },
        {
          name: 'Mild Correction',
          description: 'Minor pullback',
          marketShock: -0.1,
        },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].scenario).toBe('2008 Crisis');
      expect(results[0].portfolioLoss).toBeGreaterThan(
        results[1].portfolioLoss,
      );
      expect(results[0].portfolioLossPercent).toBeCloseTo(40, 0);
      expect(results[1].portfolioLossPercent).toBeCloseTo(10, 0);
    });

    it('should identify worst position per scenario', async () => {
      mockPortfolioService.getPortfolio.mockResolvedValue({
        totalValue: 1_000_000,
        positions: [
          { ticker: 'AAPL', marketValue: 700_000 },
          { ticker: 'BONDS', marketValue: 300_000 },
        ],
      });

      const results = await service.runStressTest('port-1', 'user-1', [
        {
          name: 'Crash',
          description: 'Market crash scenario',
          marketShock: -0.3,
        },
      ]);

      expect(results[0].worstPosition.ticker).toBe('AAPL');
      expect(results[0].worstPosition.loss).toBeGreaterThan(
        results[0].portfolioLoss * 0.5,
      );
    });

    it('should return zero loss for zero shock', async () => {
      mockPortfolioService.getPortfolio.mockResolvedValue({
        totalValue: 500_000,
        positions: [{ ticker: 'AAPL', marketValue: 500_000 }],
      });

      const results = await service.runStressTest('port-1', 'user-1', [
        { name: 'No Change', description: 'Baseline', marketShock: 0 },
      ]);

      expect(results[0].portfolioLoss).toBe(0);
      expect(results[0].portfolioValue).toBe(500_000);
    });

    it('should preserve exact same-day -7% portfolio loss correspondence', async () => {
      mockPortfolioService.getPortfolio.mockResolvedValue({
        totalValue: 1_000_000,
        positions: [
          { ticker: 'AAPL', marketValue: 550_000 },
          { ticker: 'MSFT', marketValue: 450_000 },
        ],
      });

      const results = await service.runStressTest('port-1', 'user-1', [
        {
          name: 'Same-Day -7%',
          description: 'Single-session equity shock',
          marketShock: -0.07,
        },
      ]);

      expect(results[0].scenario).toBe('Same-Day -7%');
      expect(results[0].portfolioLoss).toBeCloseTo(70_000, 2);
      expect(results[0].portfolioLossPercent).toBeCloseTo(7, 2);
      expect(results[0].portfolioValue).toBeCloseTo(930_000, 2);
      expect(results[0].worstPosition.ticker).toBe('AAPL');
      expect(results[0].worstPosition.loss).toBeCloseTo(38_500, 2);
    });
  });
});
