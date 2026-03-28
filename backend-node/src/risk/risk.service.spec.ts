import { RiskService } from './risk.service';

const mockPortfolioService = {} as any;
const mockMarketDataService = {} as any;

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
      -0.03, -0.025, -0.02, -0.015, -0.01, -0.005,
      0.0, 0.005, 0.01, 0.015, 0.02, 0.025, 0.03,
      -0.008, 0.012, -0.018, 0.007, -0.004, 0.009, -0.011,
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
      const bearReturns = [-0.01, -0.02, -0.03, -0.015, -0.025, -0.005, -0.008, -0.012, -0.018, -0.022];
      const result = await service.calculateVaR({
        returns: bearReturns,
        confidenceLevel: 0.95,
        portfolioValue: 1_000_000,
      });
      expect(result.var).toBeGreaterThan(0);
      expect(result.cvar).toBeGreaterThan(0);
    });

    it('should handle all-positive returns (bull market)', async () => {
      const bullReturns = [0.01, 0.02, 0.03, 0.015, 0.025, 0.005, 0.008, 0.012, 0.018, 0.022];
      const result = await service.calculateVaR({
        returns: bullReturns,
        confidenceLevel: 0.95,
        portfolioValue: 1_000_000,
      });
      // VaR should be small or negative (gains scenario)
      expect(result.var).toBeLessThan(50_000); // Less than 5% loss
    });
  });
});
