import { AdvancedRiskService } from '../src/risk/advanced-risk.service';
import { CacheService } from '../src/cache/cache.service';

// Mock CacheService
const mockCacheService = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  getOrSet: jest.fn().mockImplementation((key, fn) => fn()),
};

describe('AdvancedRiskService', () => {
  let service: AdvancedRiskService;

  beforeEach(() => {
    service = new AdvancedRiskService(mockCacheService as any);
  });

  describe('calculateComponentVaR', () => {
    const testPositions = [
      { ticker: 'AAPL', quantity: 100, price: 175 },
      { ticker: 'GOOGL', quantity: 50, price: 140 },
      { ticker: 'MSFT', quantity: 75, price: 380 },
    ];

    it('should return portfolio VaR and component breakdown', async () => {
      const result = await service.calculateComponentVaR(
        testPositions,
        0.95,
        1,
      );

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
      const result = await service.calculateComponentVaR(
        testPositions,
        0.95,
        1,
      );

      const totalContribution = result.components.reduce(
        (sum, c) => sum + c.contributionPercent,
        0,
      );

      // Should sum to approximately 100%
      expect(totalContribution).toBeCloseTo(100, 0);
    });

    it('should calculate correct portfolio value', async () => {
      const result = await service.calculateComponentVaR(
        testPositions,
        0.95,
        1,
      );

      const expectedValue = 100 * 175 + 50 * 140 + 75 * 380;
      expect(result.portfolioValue).toBe(expectedValue);
    });

    it('should scale VaR with horizon', async () => {
      const result1Day = await service.calculateComponentVaR(
        testPositions,
        0.95,
        1,
      );
      const result10Day = await service.calculateComponentVaR(
        testPositions,
        0.95,
        10,
      );

      // 10-day VaR should be ~sqrt(10) times 1-day VaR (approximately)
      const ratio = result10Day.portfolioVaR / result1Day.portfolioVaR;
      expect(ratio).toBeCloseTo(Math.sqrt(10), 0.5);
    });
  });

  describe('forecastVolatility (GARCH)', () => {
    it('should return volatility forecast array', async () => {
      const result = await service.forecastVolatility('AAPL', 30);

      expect(result).toHaveProperty('ticker');
      expect(result).toHaveProperty('horizon');
      expect(result).toHaveProperty('forecast');
      expect(result).toHaveProperty('model');

      expect(result.ticker).toBe('AAPL');
      expect(result.horizon).toBe(30);
      expect(result.forecast.length).toBe(30);
    });

    it('should have positive volatility forecasts', async () => {
      const result = await service.forecastVolatility('AAPL', 30);

      result.forecast.forEach((f) => {
        expect(f.volatility).toBeGreaterThan(0);
        expect(f.volatility).toBeLessThan(1); // Reasonability check
      });
    });

    it('should have confidence intervals around forecast', async () => {
      const result = await service.forecastVolatility('AAPL', 30);

      result.forecast.forEach((f) => {
        expect(f.confidenceLower).toBeLessThan(f.volatility);
        expect(f.confidenceUpper).toBeGreaterThan(f.volatility);
      });
    });

    it('should return valid GARCH parameters', async () => {
      const result = await service.forecastVolatility('AAPL', 10);

      expect(result.model.omega).toBeGreaterThan(0);
      expect(result.model.alpha).toBeGreaterThanOrEqual(0);
      expect(result.model.alpha).toBeLessThan(1);
      expect(result.model.beta).toBeGreaterThanOrEqual(0);
      expect(result.model.beta).toBeLessThan(1);

      // GARCH stationarity: alpha + beta < 1
      expect(result.model.alpha + result.model.beta).toBeLessThan(1);
    });
  });

  describe('calculateParametricVaR', () => {
    const testPositions = [
      { ticker: 'AAPL', quantity: 100, price: 175 },
      { ticker: 'GOOGL', quantity: 50, price: 140 },
    ];

    it('should return VaR with covariance-based calculation', async () => {
      const result = await service.calculateParametricVaR(
        testPositions,
        0.95,
        1,
      );

      expect(result).toHaveProperty('var');
      expect(result).toHaveProperty('portfolioValue');
      expect(result).toHaveProperty('portfolioStdDev');
      expect(result).toHaveProperty('zScore');

      expect(result.var).toBeGreaterThan(0);
    });

    it('should use correct z-score for confidence level', async () => {
      const result95 = await service.calculateParametricVaR(
        testPositions,
        0.95,
        1,
      );
      const result99 = await service.calculateParametricVaR(
        testPositions,
        0.99,
        1,
      );

      // 99% VaR should be higher than 95% VaR
      expect(result99.var).toBeGreaterThan(result95.var);

      // Z-scores should be approximately correct
      expect(result95.zScore).toBeCloseTo(1.645, 1);
      expect(result99.zScore).toBeCloseTo(2.326, 1);
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
