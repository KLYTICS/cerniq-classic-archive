import { OptionsService } from './options.service';
import { OptionType, ExerciseStyle } from './dto/options.dto';

describe('OptionsService', () => {
  let service: OptionsService;

  beforeEach(() => {
    service = new OptionsService();
  });

  // ── European Call Greeks ──────────────────────────────────

  describe('calculateGreeks — European call', () => {
    it('returns positive price, delta, gamma, vega for ATM call', async () => {
      const result = await service.calculateGreeks({
        underlying: 100,
        strike: 100,
        timeToExpiry: 1,
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.CALL,
        exercise: ExerciseStyle.EUROPEAN,
      });

      expect(result.price).toBeGreaterThan(0);
      expect(result.delta).toBeGreaterThan(0);
      expect(result.delta).toBeLessThanOrEqual(1);
      expect(result.gamma).toBeGreaterThan(0);
      expect(result.vega).toBeGreaterThan(0);
      expect(result.exercise).toBe('european');
    });

    it('deep ITM call has delta close to 1', async () => {
      const result = await service.calculateGreeks({
        underlying: 200,
        strike: 100,
        timeToExpiry: 0.5,
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.CALL,
      });

      expect(result.delta).toBeGreaterThan(0.9);
    });

    it('deep OTM call has delta close to 0', async () => {
      const result = await service.calculateGreeks({
        underlying: 50,
        strike: 200,
        timeToExpiry: 0.1,
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.CALL,
      });

      expect(result.delta).toBeLessThan(0.01);
    });
  });

  // ── European Put Greeks ──────────────────────────────────

  describe('calculateGreeks — European put', () => {
    it('returns positive price for ATM put', async () => {
      const result = await service.calculateGreeks({
        underlying: 100,
        strike: 100,
        timeToExpiry: 1,
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.PUT,
        exercise: ExerciseStyle.EUROPEAN,
      });

      expect(result.price).toBeGreaterThan(0);
      expect(result.delta).toBeLessThan(0);
      expect(result.delta).toBeGreaterThanOrEqual(-1);
    });

    it('deep ITM put has delta close to -1', async () => {
      const result = await service.calculateGreeks({
        underlying: 50,
        strike: 200,
        timeToExpiry: 0.5,
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.PUT,
      });

      expect(result.delta).toBeLessThan(-0.9);
    });
  });

  // ── Edge cases: expiry, zero vol, zero underlying ────────

  describe('calculateGreeks — edge cases', () => {
    it('returns intrinsic value at expiry for ITM call', async () => {
      const result = await service.calculateGreeks({
        underlying: 110,
        strike: 100,
        timeToExpiry: 0,
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.CALL,
      });

      expect(result.price).toBeCloseTo(10, 1);
      expect(result.delta).toBe(1);
      expect(result.gamma).toBe(0);
    });

    it('returns 0 at expiry for OTM call', async () => {
      const result = await service.calculateGreeks({
        underlying: 90,
        strike: 100,
        timeToExpiry: 0,
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.CALL,
      });

      expect(result.price).toBe(0);
      expect(result.delta).toBe(0);
    });

    it('returns intrinsic for ITM put at expiry', async () => {
      const result = await service.calculateGreeks({
        underlying: 90,
        strike: 100,
        timeToExpiry: 0,
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.PUT,
      });

      expect(result.price).toBeCloseTo(10, 1);
      expect(result.delta).toBe(-1);
    });

    it('handles zero volatility call', async () => {
      const result = await service.calculateGreeks({
        underlying: 110,
        strike: 100,
        timeToExpiry: 1,
        riskFreeRate: 0.05,
        volatility: 0,
        optionType: OptionType.CALL,
      });

      expect(result.price).toBeGreaterThan(0);
      expect(result.gamma).toBe(0);
      expect(result.vega).toBe(0);
    });

    it('handles zero volatility put', async () => {
      const result = await service.calculateGreeks({
        underlying: 90,
        strike: 100,
        timeToExpiry: 1,
        riskFreeRate: 0.05,
        volatility: 0,
        optionType: OptionType.PUT,
      });

      expect(result.price).toBeGreaterThan(0);
    });

    it('handles zero underlying for call', async () => {
      const result = await service.calculateGreeks({
        underlying: 0,
        strike: 100,
        timeToExpiry: 1,
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.CALL,
      });

      expect(result.price).toBe(0);
    });

    it('handles zero underlying for put', async () => {
      const result = await service.calculateGreeks({
        underlying: 0,
        strike: 100,
        timeToExpiry: 1,
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.PUT,
      });

      expect(result.price).toBeGreaterThan(0);
    });

    it('handles zero strike for call', async () => {
      const result = await service.calculateGreeks({
        underlying: 100,
        strike: 0,
        timeToExpiry: 1,
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.CALL,
      });

      expect(result.price).toBe(100);
      expect(result.delta).toBe(1);
    });

    it('handles zero strike for put', async () => {
      const result = await service.calculateGreeks({
        underlying: 100,
        strike: 0,
        timeToExpiry: 1,
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.PUT,
      });

      expect(result.price).toBe(0);
    });

    it('handles dividend yield for European call', async () => {
      const result = await service.calculateGreeks({
        underlying: 100,
        strike: 100,
        timeToExpiry: 1,
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.CALL,
        dividendYield: 0.03,
      });

      expect(result.price).toBeGreaterThan(0);
      // Dividend yield should reduce call price
      const noDivResult = await service.calculateGreeks({
        underlying: 100,
        strike: 100,
        timeToExpiry: 1,
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.CALL,
        dividendYield: 0,
      });
      expect(result.price).toBeLessThan(noDivResult.price);
    });
  });

  // ── American Options (BAW) ────────────────────────────────

  describe('calculateGreeks — American options', () => {
    it('American call without dividends equals European call', async () => {
      const european = await service.calculateGreeks({
        underlying: 100,
        strike: 100,
        timeToExpiry: 1,
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.CALL,
        exercise: ExerciseStyle.EUROPEAN,
      });

      const american = await service.calculateGreeks({
        underlying: 100,
        strike: 100,
        timeToExpiry: 1,
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.CALL,
        exercise: ExerciseStyle.AMERICAN,
      });

      expect(american.price).toBeCloseTo(european.price, 2);
      expect(american.earlyExercisePremium).toBe(0);
    });

    it('American put >= European put', async () => {
      const european = await service.calculateGreeks({
        underlying: 100,
        strike: 100,
        timeToExpiry: 1,
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.PUT,
        exercise: ExerciseStyle.EUROPEAN,
      });

      const american = await service.calculateGreeks({
        underlying: 100,
        strike: 100,
        timeToExpiry: 1,
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.PUT,
        exercise: ExerciseStyle.AMERICAN,
      });

      expect(american.price).toBeGreaterThanOrEqual(european.price - 0.01);
      expect(american.exercise).toBe('american');
    });

    it('American call with dividends has early exercise premium', async () => {
      const result = await service.calculateGreeks({
        underlying: 100,
        strike: 100,
        timeToExpiry: 1,
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.CALL,
        exercise: ExerciseStyle.AMERICAN,
        dividendYield: 0.05,
      });

      expect(result.price).toBeGreaterThan(0);
      expect(result.earlyExercisePremium).toBeGreaterThanOrEqual(0);
    });

    it('deep ITM American put returns intrinsic when S <= S*', async () => {
      const result = await service.calculateGreeks({
        underlying: 30,
        strike: 200,
        timeToExpiry: 1,
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.PUT,
        exercise: ExerciseStyle.AMERICAN,
      });

      // For deep ITM put, price should be close to intrinsic
      expect(result.price).toBeGreaterThanOrEqual(169);
      expect(result.delta).toBeLessThanOrEqual(0);
    });

    it('deep ITM American call with dividends returns intrinsic when S >= S*', async () => {
      const result = await service.calculateGreeks({
        underlying: 500,
        strike: 100,
        timeToExpiry: 1,
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.CALL,
        exercise: ExerciseStyle.AMERICAN,
        dividendYield: 0.1,
      });

      expect(result.price).toBeGreaterThanOrEqual(399);
    });

    it('American option at expiry returns intrinsic', async () => {
      const result = await service.calculateGreeks({
        underlying: 110,
        strike: 100,
        timeToExpiry: 0,
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.CALL,
        exercise: ExerciseStyle.AMERICAN,
      });

      expect(result.price).toBeCloseTo(10, 1);
      expect(result.earlyExercisePremium).toBe(0);
    });
  });

  // ── Implied Volatility ────────────────────────────────────

  describe('calculateImpliedVolatility', () => {
    it('recovers IV from a known BS price', async () => {
      // Price a call at 20% vol, then recover IV
      const priced = await service.calculateGreeks({
        underlying: 100,
        strike: 100,
        timeToExpiry: 1,
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.CALL,
      });

      const ivResult = await service.calculateImpliedVolatility({
        ticker: 'TEST',
        strike: 100,
        expiration: new Date(Date.now() + 365.25 * 24 * 60 * 60 * 1000).toISOString(),
        optionType: OptionType.CALL,
        marketPrice: priced.price,
      });

      expect(ivResult.impliedVolatility).toBeCloseTo(0.2, 1);
      expect(ivResult.error).toBeLessThan(0.01);
    });

    it('returns 0 for zero market price', async () => {
      await expect(
        service.calculateImpliedVolatility({
          ticker: 'TEST',
          strike: 100,
          expiration: new Date(Date.now() + 365.25 * 24 * 60 * 60 * 1000).toISOString(),
          optionType: OptionType.CALL,
          marketPrice: 0,
        }),
      ).rejects.toThrow('Failed to calculate IV');
    });

    it('throws on arbitrage: call price below intrinsic', async () => {
      await expect(
        service.calculateImpliedVolatility({
          ticker: 'TEST',
          strike: 50,
          expiration: new Date(Date.now() + 365.25 * 24 * 60 * 60 * 1000).toISOString(),
          optionType: OptionType.CALL,
          marketPrice: 0.001,
        }),
      ).rejects.toThrow('IV calculation');
    });

    it('throws on arbitrage: call price exceeds underlying', async () => {
      await expect(
        service.calculateImpliedVolatility({
          ticker: 'TEST',
          strike: 100,
          expiration: new Date(Date.now() + 365.25 * 24 * 60 * 60 * 1000).toISOString(),
          optionType: OptionType.CALL,
          marketPrice: 200,
        }),
      ).rejects.toThrow('IV calculation');
    });

    it('throws on arbitrage: put price exceeds discounted strike', async () => {
      await expect(
        service.calculateImpliedVolatility({
          ticker: 'TEST',
          strike: 100,
          expiration: new Date(Date.now() + 365.25 * 24 * 60 * 60 * 1000).toISOString(),
          optionType: OptionType.PUT,
          marketPrice: 200,
        }),
      ).rejects.toThrow('IV calculation');
    });
  });

  // ── Options Chain ─────────────────────────────────────────

  describe('getOptionsChain', () => {
    it('throws NOT_IMPLEMENTED', async () => {
      await expect(
        service.getOptionsChain({ ticker: 'AAPL' } as any),
      ).rejects.toThrow();
    });
  });

  // ── Strategy Calculation ──────────────────────────────────

  describe('calculateStrategy', () => {
    it('calculates bull call spread payoff', async () => {
      const futureExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const result = await service.calculateStrategy({
        underlyingPrice: 100,
        riskFreeRate: 0.05,
        volatility: 0.2,
        legs: [
          {
            strike: 95,
            optionType: OptionType.CALL,
            buySell: 'buy' as any,
            quantity: 1,
            expiration: futureExpiry,
          },
          {
            strike: 105,
            optionType: OptionType.CALL,
            buySell: 'sell' as any,
            quantity: 1,
            expiration: futureExpiry,
          },
        ],
      });

      expect(result.payoff.length).toBeGreaterThan(0);
      expect(result.maxProfit).toBeGreaterThan(0);
      expect(result.maxLoss).toBeLessThan(0);
      expect(result.greeks.delta).toBeGreaterThan(0);
      expect(result.legs).toHaveLength(2);
      expect(result.breakEvens.length).toBeGreaterThanOrEqual(1);
    });

    it('calculates protective put payoff', async () => {
      const futureExpiry = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

      const result = await service.calculateStrategy({
        underlyingPrice: 100,
        riskFreeRate: 0.05,
        volatility: 0.25,
        legs: [
          {
            strike: 95,
            optionType: OptionType.PUT,
            buySell: 'buy' as any,
            quantity: 1,
            expiration: futureExpiry,
          },
        ],
      });

      expect(result.payoff.length).toBeGreaterThan(0);
      expect(result.greeks).toBeDefined();
      expect(result.initialCost).toBeGreaterThan(0);
    });
  });
});
