import { Test, TestingModule } from '@nestjs/testing';
import { OptionsService } from '../options.service';
import { OptionType } from '../dto/options.dto';

describe('OptionsService', () => {
  let service: OptionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OptionsService],
    }).compile();

    service = module.get<OptionsService>(OptionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateGreeks', () => {
    it('should calculate call option Greeks correctly', async () => {
      const result = await service.calculateGreeks({
        underlying: 100,
        strike: 100,
        timeToExpiry: 1.0, // 1 year
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.CALL,
      });

      // ATM call option delta should be around 0.5
      expect(result.delta).toBeGreaterThan(0.45);
      expect(result.delta).toBeLessThan(0.65);

      // Gamma should be positive
      expect(result.gamma).toBeGreaterThan(0);

      // Vega should be positive
      expect(result.vega).toBeGreaterThan(0);

      // Price should be positive and reasonable
      expect(result.price).toBeGreaterThan(5);
      expect(result.price).toBeLessThan(15);
    });

    it('should calculate put option Greeks correctly', async () => {
      const result = await service.calculateGreeks({
        underlying: 100,
        strike: 100,
        timeToExpiry: 1.0,
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.PUT,
      });

      // ATM put option delta should be around -0.5
      expect(result.delta).toBeLessThan(-0.35);
      expect(result.delta).toBeGreaterThan(-0.65);

      // Gamma should be positive (same as call)
      expect(result.gamma).toBeGreaterThan(0);

      // Vega should be positive (same as call)
      expect(result.vega).toBeGreaterThan(0);

      // Price should be positive
      expect(result.price).toBeGreaterThan(0);
    });

    it('should handle ITM call option', async () => {
      const result = await service.calculateGreeks({
        underlying: 110,
        strike: 100,
        timeToExpiry: 1.0,
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.CALL,
      });

      // ITM call should have higher delta
      expect(result.delta).toBeGreaterThan(0.6);

      // Price should be at least intrinsic value
      expect(result.price).toBeGreaterThan(10);
    });

    it('should handle OTM put option', async () => {
      const result = await service.calculateGreeks({
        underlying: 110,
        strike: 100,
        timeToExpiry: 1.0,
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.PUT,
      });

      // OTM put should have delta closer to 0
      expect(Math.abs(result.delta)).toBeLessThan(0.4);

      // Price should be less than ATM
      expect(result.price).toBeLessThan(8);
    });

    it('should handle expired option (T=0)', async () => {
      const result = await service.calculateGreeks({
        underlying: 105,
        strike: 100,
        timeToExpiry: 0,
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.CALL,
      });

      // Expired call should equal intrinsic value
      expect(result.price).toBe(5);

      // All Greeks should be zero
      expect(result.delta).toBe(0);
      expect(result.gamma).toBe(0);
      expect(result.theta).toBe(0);
      expect(result.vega).toBe(0);
    });

    it('should validate against known Black-Scholes values', async () => {
      // Reference values from financial calculator
      const result = await service.calculateGreeks({
        underlying: 100,
        strike: 95,
        timeToExpiry: 0.25, // 3 months
        riskFreeRate: 0.05,
        volatility: 0.3,
        optionType: OptionType.CALL,
      });

      // Known result: Price should be around $8.70
      expect(result.price).toBeGreaterThan(7.5);
      expect(result.price).toBeLessThan(9.5);

      // Delta should be around 0.68
      expect(result.delta).toBeGreaterThan(0.6);
      expect(result.delta).toBeLessThan(0.75);
    });
  });

  describe('calculateStrategy', () => {
    it('should calculate bull call spread correctly', async () => {
      const result = await service.calculateStrategy({
        legs: [
          {
            strike: 100,
            expiration: new Date(
              Date.now() + 90 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            optionType: OptionType.CALL,
            quantity: 1,
            buySell: 'buy' as any,
          },
          {
            strike: 110,
            expiration: new Date(
              Date.now() + 90 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            optionType: OptionType.CALL,
            quantity: 1,
            buySell: 'sell' as any,
          },
        ],
        underlyingPrice: 105,
        volatility: 0.25,
        riskFreeRate: 0.05,
      });

      // Should detect strategy name
      expect(result.strategyName).toBe('Bull Call Spread');

      // Max profit should be limited (strike width - net debit)
      expect(result.maxProfit).toBeGreaterThan(0);
      expect(result.maxProfit).toBeLessThan(1000); // $10 width * 100 shares

      // Max loss should be limited to initial debit
      expect(result.maxLoss).toBeLessThan(0);

      // Should have payoff points
      expect(result.payoff.length).toBeGreaterThan(50);

      // Should have at least one break-even
      expect(result.breakEvens.length).toBeGreaterThan(0);
    });

    it('should calculate long straddle correctly', async () => {
      const expiration = new Date(
        Date.now() + 90 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const result = await service.calculateStrategy({
        legs: [
          {
            strike: 100,
            expiration,
            optionType: OptionType.CALL,
            quantity: 1,
            buySell: 'buy' as any,
          },
          {
            strike: 100,
            expiration,
            optionType: OptionType.PUT,
            quantity: 1,
            buySell: 'buy' as any,
          },
        ],
        underlyingPrice: 100,
        volatility: 0.25,
        riskFreeRate: 0.05,
      });

      // Should detect straddle
      expect(result.strategyName).toBe('Long Straddle');

      // Max profit is limited by price range (we only simulate ±30%)
      // For straddle, max profit occurs at price extremes
      expect(result.maxProfit).toBeGreaterThan(1000);

      // Max loss should be limited to premium paid
      expect(result.maxLoss).toBeLessThan(0);

      // Should have 2 break-evens (above and below strike)
      expect(result.breakEvens.length).toBe(2);

      // Delta should be near zero (delta-neutral)
      expect(Math.abs(result.greeks.delta)).toBeLessThan(50); // Allow some tolerance
    });

    it('should aggregate Greeks correctly for multi-leg', async () => {
      const expiration = new Date(
        Date.now() + 90 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const result = await service.calculateStrategy({
        legs: [
          {
            strike: 100,
            expiration,
            optionType: OptionType.CALL,
            quantity: 2,
            buySell: 'buy' as any,
          },
        ],
        underlyingPrice: 100,
        volatility: 0.25,
        riskFreeRate: 0.05,
      });

      // 2 contracts = 200 shares worth of delta
      expect(result.greeks.delta).toBeGreaterThan(50); // ~100 delta per contract

      // Gamma should be positive
      expect(result.greeks.gamma).toBeGreaterThan(0);
    });
  });

  describe('calculateImpliedVolatility', () => {
    it('should calculate IV using Newton-Raphson', async () => {
      // First calculate a price with known volatility
      const knownVol = 0.25;
      const greeks = await service.calculateGreeks({
        underlying: 100,
        strike: 100,
        timeToExpiry: 0.5,
        riskFreeRate: 0.05,
        volatility: knownVol,
        optionType: OptionType.CALL,
      });

      // Now solve for IV given that price
      const result = await service.calculateImpliedVolatility({
        ticker: 'TEST',
        strike: 100,
        expiration: new Date(
          Date.now() + 182 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        optionType: OptionType.CALL,
        marketPrice: greeks.price,
      });

      // Should converge to the known volatility
      expect(result.impliedVolatility).toBeCloseTo(knownVol, 2);

      // Should converge quickly
      expect(result.iterations).toBeLessThan(20);

      // Error should be small
      expect(Math.abs(result.error)).toBeLessThan(0.01);
    });
  });
});
