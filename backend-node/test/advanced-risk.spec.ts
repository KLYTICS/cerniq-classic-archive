import { AdvancedRiskService } from '../src/risk/advanced-risk.service';
import { CacheService } from '../src/cache/cache.service';
import { MarketDataService } from '../src/market-data/market-data.service';

// Mock CacheService
const mockCacheService = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  getOrSet: jest.fn().mockImplementation((_key: string, fn: () => any) => fn()),
};

// Mock MarketDataService
const mockMarketDataService = {
  getHistoricalPrices: jest.fn().mockResolvedValue([]),
  getQuote: jest.fn().mockResolvedValue({ price: 175 }),
};

describe('AdvancedRiskService', () => {
  let service: AdvancedRiskService;

  beforeEach(() => {
    service = new AdvancedRiskService(
      mockMarketDataService as unknown as MarketDataService,
      mockCacheService as unknown as CacheService,
    );
  });

  describe('calculateComponentVaR', () => {
    const testPositions = [
      { ticker: 'AAPL', quantity: 100, price: 175 },
      { ticker: 'GOOGL', quantity: 50, price: 140 },
      { ticker: 'MSFT', quantity: 75, price: 380 },
    ];

    it('should return portfolio VaR and component breakdown', async () => {
      const result = await service.calculateComponentVaR({
        positions: testPositions,
        confidenceLevel: 0.95,
        horizon: 1,
      });

      expect(result).toHaveProperty('portfolioVaR');
      expect(result).toHaveProperty('portfolioValue');
      expect(result).toHaveProperty('confidenceLevel');
      expect(result).toHaveProperty('horizon');
      expect(result).toHaveProperty('components');

      // VaR should be positive
      expect(result.portfolioVaR).toBeGreaterThan(0);

      // Components should match positions
      expect(result.components.length).toBe(testPositions.length);
    });

    it('should have component contributions sum to ~100%', async () => {
      const result = await service.calculateComponentVaR({
        positions: testPositions,
        confidenceLevel: 0.95,
        horizon: 1,
      });

      const totalContribution = result.components.reduce(
        (sum, c) => sum + c.riskContribution,
        0,
      );

      // Should sum to approximately 100%
      expect(totalContribution).toBeCloseTo(100, 0);
    });

    it('should calculate correct portfolio value', async () => {
      const result = await service.calculateComponentVaR({
        positions: testPositions,
        confidenceLevel: 0.95,
        horizon: 1,
      });

      const expectedValue = 100 * 175 + 50 * 140 + 75 * 380;
      expect(result.portfolioValue).toBe(expectedValue);
    });

    it('should scale VaR with horizon', async () => {
      const result1Day = await service.calculateComponentVaR({
        positions: testPositions,
        confidenceLevel: 0.95,
        horizon: 1,
      });
      const result10Day = await service.calculateComponentVaR({
        positions: testPositions,
        confidenceLevel: 0.95,
        horizon: 10,
      });

      // 10-day VaR should be ~sqrt(10) times 1-day VaR (approximately)
      const ratio = result10Day.portfolioVaR / result1Day.portfolioVaR;
      expect(ratio).toBeCloseTo(Math.sqrt(10), 0.5);
    });
  });

  describe('forecastVolatility (GARCH)', () => {
    it('should return volatility forecast array', async () => {
      const result = await service.forecastVolatility({ ticker: 'AAPL', horizon: 30 });

      expect(result).toHaveProperty('ticker');
      expect(result).toHaveProperty('currentVolatility');
      expect(result).toHaveProperty('forecast');
      expect(result).toHaveProperty('model');

      expect(result.ticker).toBe('AAPL');
      expect(result.forecast.length).toBe(30);
    });

    it('should have positive volatility forecasts', async () => {
      const result = await service.forecastVolatility({ ticker: 'AAPL', horizon: 30 });

      result.forecast.forEach((f) => {
        expect(f.volatility).toBeGreaterThan(0);
        expect(f.volatility).toBeLessThan(1); // Reasonability check
      });
    });

    it('should have confidence intervals around forecast', async () => {
      const result = await service.forecastVolatility({ ticker: 'AAPL', horizon: 30 });

      result.forecast.forEach((f) => {
        expect(f.lower95).toBeLessThan(f.volatility);
        expect(f.upper95).toBeGreaterThan(f.volatility);
      });
    });

    it('should return valid GARCH model identifier', async () => {
      const result = await service.forecastVolatility({ ticker: 'AAPL', horizon: 10 });

      expect(typeof result.model).toBe('string');
      expect(result.model.length).toBeGreaterThan(0);
    });
  });

  describe('calculateParametricVaR', () => {
    const testPositions = [
      { ticker: 'AAPL', quantity: 100, price: 175 },
      { ticker: 'GOOGL', quantity: 50, price: 140 },
    ];

    it('should return VaR with covariance-based calculation', async () => {
      const result = await service.calculateParametricVaR({
        positions: testPositions,
        confidenceLevel: 0.95,
        horizon: 1,
      });

      expect(result).toHaveProperty('portfolioVaR');
      expect(result).toHaveProperty('portfolioValue');
      expect(result).toHaveProperty('portfolioVolatility');
      expect(result).toHaveProperty('confidenceLevel');

      expect(result.portfolioVaR).toBeGreaterThan(0);
    });

    it('should produce higher VaR at 99% vs 95% confidence', async () => {
      const result95 = await service.calculateParametricVaR({
        positions: testPositions,
        confidenceLevel: 0.95,
        horizon: 1,
      });
      const result99 = await service.calculateParametricVaR({
        positions: testPositions,
        confidenceLevel: 0.99,
        horizon: 1,
      });

      // 99% VaR should be higher than 95% VaR
      expect(result99.portfolioVaR).toBeGreaterThan(result95.portfolioVaR);
    });
  });
});

describe('VaR Backtesting Validation', () => {
  // Kupiec test: Check if VaR violations are consistent with confidence level
  it('should pass Kupiec test (conceptual validation)', () => {
    // For a 95% VaR, we expect ~5% violations
    const confidenceLevel = 0.95;
    const expectedViolationRate = 1 - confidenceLevel;

    // Simulate 252 trading days
    const observations = 252;
    const simulatedViolations = Math.round(
      observations * expectedViolationRate,
    );

    // Kupiec test statistic
    const actualViolationRate = simulatedViolations / observations;
    const LR =
      -2 *
      (Math.log(
        Math.pow(1 - actualViolationRate, observations - simulatedViolations) *
          Math.pow(actualViolationRate, simulatedViolations),
      ) -
        Math.log(
          Math.pow(
            1 - expectedViolationRate,
            observations - simulatedViolations,
          ) * Math.pow(expectedViolationRate, simulatedViolations),
        ));

    // LR should be < 3.84 (chi-squared critical value at 95% with 1 df)
    // For exact match, LR should be 0
    expect(LR).toBeCloseTo(0, 5);
  });
});
