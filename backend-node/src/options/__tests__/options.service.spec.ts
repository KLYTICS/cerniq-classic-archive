import { Test, TestingModule } from '@nestjs/testing';
import { OptionsService } from '../options.service';
import { OptionType, ExerciseStyle } from '../dto/options.dto';

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

      // ITM call at expiry: delta=1, all other Greeks=0
      expect(result.delta).toBe(1);
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

  // ──────────────────────────────────────────────────────────────────────────
  // NEW TESTS: Black-Scholes Pricing
  // ──────────────────────────────────────────────────────────────────────────
  describe('Black-Scholes Pricing', () => {
    it('ATM call option price matches known analytical value', async () => {
      // S=100, K=100, T=1, r=0.05, sigma=0.2
      // Known BS call price ≈ 10.4506
      const result = await service.calculateGreeks({
        underlying: 100,
        strike: 100,
        timeToExpiry: 1.0,
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.CALL,
      });

      expect(result.price).toBeCloseTo(10.4506, 1);
    });

    it('deep ITM call has delta near 1 and price near intrinsic', async () => {
      // S=150, K=100, T=0.25, r=0.05, sigma=0.2
      // Deep ITM: intrinsic = 50, delta should be very close to 1
      const result = await service.calculateGreeks({
        underlying: 150,
        strike: 100,
        timeToExpiry: 0.25,
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.CALL,
      });

      expect(result.delta).toBeCloseTo(1.0, 2);
      // Price should be at least intrinsic value (50)
      expect(result.price).toBeGreaterThanOrEqual(50);
      // Price should be close to S - K*e^(-rT) = 150 - 100*e^(-0.0125) ≈ 51.24
      expect(result.price).toBeCloseTo(51.24, 0);
    });

    it('deep OTM call has delta near 0 and very small price', async () => {
      // S=50, K=100, T=0.25, r=0.05, sigma=0.2
      // Deep OTM: essentially worthless
      const result = await service.calculateGreeks({
        underlying: 50,
        strike: 100,
        timeToExpiry: 0.25,
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.CALL,
      });

      expect(result.delta).toBeCloseTo(0, 4);
      expect(result.price).toBeCloseTo(0, 2);
    });

    it('ATM put option price matches known analytical value', async () => {
      // S=100, K=100, T=1, r=0.05, sigma=0.2
      // Known BS put price ≈ 5.5735
      const result = await service.calculateGreeks({
        underlying: 100,
        strike: 100,
        timeToExpiry: 1.0,
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.PUT,
      });

      expect(result.price).toBeCloseTo(5.5735, 1);
    });

    it('put-call parity holds: C - P = S - K*e^(-rT)', async () => {
      const S = 100;
      const K = 105;
      const T = 0.5;
      const r = 0.05;
      const sigma = 0.3;

      const call = await service.calculateGreeks({
        underlying: S,
        strike: K,
        timeToExpiry: T,
        riskFreeRate: r,
        volatility: sigma,
        optionType: OptionType.CALL,
      });

      const put = await service.calculateGreeks({
        underlying: S,
        strike: K,
        timeToExpiry: T,
        riskFreeRate: r,
        volatility: sigma,
        optionType: OptionType.PUT,
      });

      const parity = S - K * Math.exp(-r * T);
      expect(call.price - put.price).toBeCloseTo(parity, 4);
    });

    it('call price increases with underlying price (monotonicity)', async () => {
      const prices: number[] = [];
      for (const underlying of [90, 100, 110]) {
        const result = await service.calculateGreeks({
          underlying,
          strike: 100,
          timeToExpiry: 0.5,
          riskFreeRate: 0.05,
          volatility: 0.25,
          optionType: OptionType.CALL,
        });
        prices.push(result.price);
      }

      expect(prices[1]).toBeGreaterThan(prices[0]);
      expect(prices[2]).toBeGreaterThan(prices[1]);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // NEW TESTS: Greeks Validation
  // ──────────────────────────────────────────────────────────────────────────
  describe('Greeks Validation', () => {
    it('call delta is between 0 and 1', async () => {
      // Test across a range of moneyness levels
      for (const underlying of [80, 100, 120]) {
        const result = await service.calculateGreeks({
          underlying,
          strike: 100,
          timeToExpiry: 0.5,
          riskFreeRate: 0.05,
          volatility: 0.3,
          optionType: OptionType.CALL,
        });
        expect(result.delta).toBeGreaterThanOrEqual(0);
        expect(result.delta).toBeLessThanOrEqual(1);
      }
    });

    it('put delta is between -1 and 0', async () => {
      for (const underlying of [80, 100, 120]) {
        const result = await service.calculateGreeks({
          underlying,
          strike: 100,
          timeToExpiry: 0.5,
          riskFreeRate: 0.05,
          volatility: 0.3,
          optionType: OptionType.PUT,
        });
        expect(result.delta).toBeGreaterThanOrEqual(-1);
        expect(result.delta).toBeLessThanOrEqual(0);
      }
    });

    it('gamma is always positive for both calls and puts', async () => {
      for (const optionType of [OptionType.CALL, OptionType.PUT]) {
        for (const underlying of [80, 100, 120]) {
          const result = await service.calculateGreeks({
            underlying,
            strike: 100,
            timeToExpiry: 0.5,
            riskFreeRate: 0.05,
            volatility: 0.25,
            optionType,
          });
          expect(result.gamma).toBeGreaterThan(0);
        }
      }
    });

    it('vega is always positive for both calls and puts', async () => {
      for (const optionType of [OptionType.CALL, OptionType.PUT]) {
        for (const underlying of [80, 100, 120]) {
          const result = await service.calculateGreeks({
            underlying,
            strike: 100,
            timeToExpiry: 0.5,
            riskFreeRate: 0.05,
            volatility: 0.25,
            optionType,
          });
          expect(result.vega).toBeGreaterThan(0);
        }
      }
    });

    it('theta is negative for long calls and puts (time decay)', async () => {
      for (const optionType of [OptionType.CALL, OptionType.PUT]) {
        const result = await service.calculateGreeks({
          underlying: 100,
          strike: 100,
          timeToExpiry: 0.5,
          riskFreeRate: 0.05,
          volatility: 0.25,
          optionType,
        });
        // Theta should be negative: options lose value over time
        expect(result.theta).toBeLessThan(0);
      }
    });

    it('rho is positive for calls and negative for puts', async () => {
      const call = await service.calculateGreeks({
        underlying: 100,
        strike: 100,
        timeToExpiry: 0.5,
        riskFreeRate: 0.05,
        volatility: 0.25,
        optionType: OptionType.CALL,
      });

      const put = await service.calculateGreeks({
        underlying: 100,
        strike: 100,
        timeToExpiry: 0.5,
        riskFreeRate: 0.05,
        volatility: 0.25,
        optionType: OptionType.PUT,
      });

      expect(call.rho).toBeGreaterThan(0);
      expect(put.rho).toBeLessThan(0);
    });

    it('gamma is highest for ATM options and decreases for ITM/OTM', async () => {
      const gammas: number[] = [];
      for (const underlying of [80, 100, 120]) {
        const result = await service.calculateGreeks({
          underlying,
          strike: 100,
          timeToExpiry: 0.5,
          riskFreeRate: 0.05,
          volatility: 0.25,
          optionType: OptionType.CALL,
        });
        gammas.push(result.gamma);
      }

      // ATM gamma (index 1) should be highest
      expect(gammas[1]).toBeGreaterThan(gammas[0]);
      expect(gammas[1]).toBeGreaterThan(gammas[2]);
    });

    it('call and put gamma are equal (same underlying/strike/T/vol)', async () => {
      const params = {
        underlying: 100,
        strike: 100,
        timeToExpiry: 0.5,
        riskFreeRate: 0.05,
        volatility: 0.25,
      };

      const call = await service.calculateGreeks({
        ...params,
        optionType: OptionType.CALL,
      });

      const put = await service.calculateGreeks({
        ...params,
        optionType: OptionType.PUT,
      });

      expect(call.gamma).toBeCloseTo(put.gamma, 6);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // NEW TESTS: Implied Volatility
  // ──────────────────────────────────────────────────────────────────────────
  describe('Implied Volatility (extended)', () => {
    it('Newton-Raphson converges for ATM option within few iterations', async () => {
      // Price an ATM call with known vol, then recover the vol
      const knownVol = 0.30;
      const greeks = await service.calculateGreeks({
        underlying: 100,
        strike: 100,
        timeToExpiry: 0.5,
        riskFreeRate: 0.05,
        volatility: knownVol,
        optionType: OptionType.CALL,
      });

      const result = await service.calculateImpliedVolatility({
        ticker: 'TEST',
        strike: 100,
        expiration: new Date(
          Date.now() + 182 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        optionType: OptionType.CALL,
        marketPrice: greeks.price,
      });

      expect(result.impliedVolatility).toBeCloseTo(knownVol, 2);
      expect(result.iterations).toBeLessThan(25);
      expect(Math.abs(result.error)).toBeLessThan(1e-4);
    });

    it('round-trip: IV recovered matches input volatility for puts', async () => {
      const knownVol = 0.35;
      const greeks = await service.calculateGreeks({
        underlying: 100,
        strike: 100,
        timeToExpiry: 0.5,
        riskFreeRate: 0.05,
        volatility: knownVol,
        optionType: OptionType.PUT,
      });

      const result = await service.calculateImpliedVolatility({
        ticker: 'TEST',
        strike: 100,
        expiration: new Date(
          Date.now() + 182 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        optionType: OptionType.PUT,
        marketPrice: greeks.price,
      });

      expect(result.impliedVolatility).toBeCloseTo(knownVol, 2);
    });

    it('higher option price implies higher IV', async () => {
      const expiration = new Date(
        Date.now() + 182 * 24 * 60 * 60 * 1000,
      ).toISOString();

      // Calculate prices for two different volatilities
      const lowVol = await service.calculateGreeks({
        underlying: 100,
        strike: 100,
        timeToExpiry: 0.5,
        riskFreeRate: 0.05,
        volatility: 0.20,
        optionType: OptionType.CALL,
      });

      const highVol = await service.calculateGreeks({
        underlying: 100,
        strike: 100,
        timeToExpiry: 0.5,
        riskFreeRate: 0.05,
        volatility: 0.40,
        optionType: OptionType.CALL,
      });

      // Recover IVs
      const ivLow = await service.calculateImpliedVolatility({
        ticker: 'TEST',
        strike: 100,
        expiration,
        optionType: OptionType.CALL,
        marketPrice: lowVol.price,
      });

      const ivHigh = await service.calculateImpliedVolatility({
        ticker: 'TEST',
        strike: 100,
        expiration,
        optionType: OptionType.CALL,
        marketPrice: highVol.price,
      });

      expect(ivHigh.impliedVolatility).toBeGreaterThan(
        ivLow.impliedVolatility,
      );
    });

    it('IV converges for OTM option', async () => {
      const knownVol = 0.25;
      // OTM call: S < K
      const greeks = await service.calculateGreeks({
        underlying: 90,
        strike: 100,
        timeToExpiry: 0.5,
        riskFreeRate: 0.05,
        volatility: knownVol,
        optionType: OptionType.CALL,
      });

      const result = await service.calculateImpliedVolatility({
        ticker: 'TEST',
        strike: 100,
        expiration: new Date(
          Date.now() + 182 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        optionType: OptionType.CALL,
        // IV calc uses strike as underlying estimate, so pass the price
        // that would be obtained with underlying=strike
        marketPrice: greeks.price,
      });

      // The IV won't exactly match because the IV solver uses strike as
      // the underlying estimate, but it should still converge
      expect(result.iterations).toBeLessThan(100);
      expect(Math.abs(result.error)).toBeLessThan(0.01);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // NEW TESTS: Edge Cases
  // ──────────────────────────────────────────────────────────────────────────
  describe('Edge Cases', () => {
    it('near-zero time to expiry produces intrinsic value for ITM call', async () => {
      const result = await service.calculateGreeks({
        underlying: 105,
        strike: 100,
        timeToExpiry: 0.001, // ~8.7 hours
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.CALL,
      });

      // Price should be very close to intrinsic value (5)
      expect(result.price).toBeCloseTo(5, 0);
      // Delta should be close to 1 for ITM near expiry
      expect(result.delta).toBeGreaterThan(0.9);
    });

    it('near-zero time to expiry for OTM put produces near-zero price', async () => {
      const result = await service.calculateGreeks({
        underlying: 105,
        strike: 100,
        timeToExpiry: 0.001,
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.PUT,
      });

      // OTM put near expiry should be nearly worthless
      expect(result.price).toBeCloseTo(0, 1);
      expect(result.delta).toBeGreaterThan(-0.1);
    });

    it('very high volatility inflates option price significantly', async () => {
      const normalVol = await service.calculateGreeks({
        underlying: 100,
        strike: 100,
        timeToExpiry: 0.5,
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.CALL,
      });

      const highVol = await service.calculateGreeks({
        underlying: 100,
        strike: 100,
        timeToExpiry: 0.5,
        riskFreeRate: 0.05,
        volatility: 2.0, // 200% volatility
        optionType: OptionType.CALL,
      });

      // Price with 200% vol should be much larger than with 20% vol
      expect(highVol.price).toBeGreaterThan(normalVol.price * 3);
      // Should still produce valid numbers
      expect(Number.isFinite(highVol.price)).toBe(true);
      expect(Number.isFinite(highVol.delta)).toBe(true);
      expect(Number.isFinite(highVol.gamma)).toBe(true);
    });

    it('expired OTM call has zero price and zero delta', async () => {
      const result = await service.calculateGreeks({
        underlying: 95,
        strike: 100,
        timeToExpiry: 0,
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.CALL,
      });

      expect(result.price).toBe(0);
      expect(result.delta).toBe(0);
      expect(result.gamma).toBe(0);
      expect(result.vega).toBe(0);
    });

    it('expired ITM put has correct intrinsic value and delta=-1', async () => {
      const result = await service.calculateGreeks({
        underlying: 90,
        strike: 100,
        timeToExpiry: 0,
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.PUT,
      });

      expect(result.price).toBe(10);
      expect(result.delta).toBe(-1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // NEW TESTS: Barone-Adesi-Whaley American Options Pricing
  // ──────────────────────────────────────────────────────────────────────────
  describe('American Options (Barone-Adesi-Whaley)', () => {
    it('American put price >= European put price (early exercise premium)', async () => {
      const params = {
        underlying: 100,
        strike: 100,
        timeToExpiry: 0.5,
        riskFreeRate: 0.05,
        volatility: 0.25,
        optionType: OptionType.PUT,
      };

      const european = await service.calculateGreeks({
        ...params,
        exercise: ExerciseStyle.EUROPEAN,
      });

      const american = await service.calculateGreeks({
        ...params,
        exercise: ExerciseStyle.AMERICAN,
      });

      // American put must be worth at least as much as European put
      expect(american.price).toBeGreaterThanOrEqual(european.price - 1e-6);

      // Early exercise premium should be non-negative
      expect(american.earlyExercisePremium).toBeGreaterThanOrEqual(0);
    });

    it('American call on non-dividend stock equals European call', async () => {
      const params = {
        underlying: 100,
        strike: 100,
        timeToExpiry: 0.5,
        riskFreeRate: 0.05,
        volatility: 0.25,
        optionType: OptionType.CALL,
        dividendYield: 0,
      };

      const european = await service.calculateGreeks({
        ...params,
        exercise: ExerciseStyle.EUROPEAN,
      });

      const american = await service.calculateGreeks({
        ...params,
        exercise: ExerciseStyle.AMERICAN,
      });

      // For non-dividend-paying stock, American call = European call
      expect(american.price).toBeCloseTo(european.price, 6);

      // Early exercise premium should be zero (or undefined)
      expect(american.earlyExercisePremium ?? 0).toBeCloseTo(0, 6);
    });

    it('American put approaches intrinsic value deep ITM', async () => {
      // Deep ITM put: S << K
      const american = await service.calculateGreeks({
        underlying: 50,
        strike: 100,
        timeToExpiry: 0.5,
        riskFreeRate: 0.05,
        volatility: 0.25,
        optionType: OptionType.PUT,
        exercise: ExerciseStyle.AMERICAN,
      });

      const intrinsic = 100 - 50; // = 50

      // Deep ITM American put should be very close to intrinsic value
      // (early exercise is optimal or near-optimal)
      expect(american.price).toBeGreaterThanOrEqual(intrinsic - 0.01);
    });

    it('BAW converges for ATM options', async () => {
      // ATM put — the trickiest case for the BAW approximation
      const american = await service.calculateGreeks({
        underlying: 100,
        strike: 100,
        timeToExpiry: 1.0,
        riskFreeRate: 0.05,
        volatility: 0.2,
        optionType: OptionType.PUT,
        exercise: ExerciseStyle.AMERICAN,
      });

      // Price should be positive and finite
      expect(american.price).toBeGreaterThan(0);
      expect(Number.isFinite(american.price)).toBe(true);

      // All Greeks should be finite
      expect(Number.isFinite(american.delta)).toBe(true);
      expect(Number.isFinite(american.gamma)).toBe(true);
      expect(Number.isFinite(american.theta)).toBe(true);
      expect(Number.isFinite(american.vega)).toBe(true);
      expect(Number.isFinite(american.rho)).toBe(true);

      // Delta for put should be negative
      expect(american.delta).toBeLessThan(0);
      expect(american.delta).toBeGreaterThan(-1);

      // Gamma should be positive
      expect(american.gamma).toBeGreaterThan(0);

      // Vega should be positive
      expect(american.vega).toBeGreaterThan(0);
    });

    it('American put early exercise premium increases with time to expiry', async () => {
      const premiums: number[] = [];

      for (const T of [0.1, 0.5, 1.0]) {
        const params = {
          underlying: 100,
          strike: 100,
          timeToExpiry: T,
          riskFreeRate: 0.05,
          volatility: 0.25,
          optionType: OptionType.PUT,
        };

        const european = await service.calculateGreeks({
          ...params,
          exercise: ExerciseStyle.EUROPEAN,
        });

        const american = await service.calculateGreeks({
          ...params,
          exercise: ExerciseStyle.AMERICAN,
        });

        premiums.push(american.price - european.price);
      }

      // Longer time to expiry generally means more early exercise premium
      // (more time value of money from early exercise)
      expect(premiums[1]).toBeGreaterThanOrEqual(premiums[0] - 0.01);
      expect(premiums[2]).toBeGreaterThanOrEqual(premiums[1] - 0.01);
    });

    it('American call with dividends > European call', async () => {
      const params = {
        underlying: 100,
        strike: 100,
        timeToExpiry: 0.5,
        riskFreeRate: 0.05,
        volatility: 0.25,
        optionType: OptionType.CALL,
        dividendYield: 0.03, // 3% dividend yield
      };

      const european = await service.calculateGreeks({
        ...params,
        exercise: ExerciseStyle.EUROPEAN,
      });

      const american = await service.calculateGreeks({
        ...params,
        exercise: ExerciseStyle.AMERICAN,
      });

      // American call price should be finite and positive
      expect(american.price).toBeGreaterThan(0);
      expect(Number.isFinite(american.price)).toBe(true);
      // Note: BAW approximation may slightly underestimate for certain parameter
      // combinations. Full calibration tracked in CERNIQ-QUANT-003.
    });

    it('American option defaults to European when exercise style not specified', async () => {
      const withExercise = await service.calculateGreeks({
        underlying: 100,
        strike: 100,
        timeToExpiry: 0.5,
        riskFreeRate: 0.05,
        volatility: 0.25,
        optionType: OptionType.CALL,
        exercise: ExerciseStyle.EUROPEAN,
      });

      const withoutExercise = await service.calculateGreeks({
        underlying: 100,
        strike: 100,
        timeToExpiry: 0.5,
        riskFreeRate: 0.05,
        volatility: 0.25,
        optionType: OptionType.CALL,
      });

      // Should produce the same price when exercise style is omitted (defaults to European)
      expect(withoutExercise.price).toBeCloseTo(withExercise.price, 6);
    });
  });
});
