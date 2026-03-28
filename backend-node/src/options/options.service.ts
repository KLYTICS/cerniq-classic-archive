/**
 * Options Pricing Engine — Black-Scholes with Greeks + Barone-Adesi-Whaley American approximation.
 *
 * Known limitations (tracked):
 * - CERNIQ-PERF-001: JS-based pricing; WASM planned for batch workloads
 * - CERNIQ-DATA-001: Uses synthetic data for demo; real options chain integration pending
 * - CERNIQ-MATH-001: RESOLVED — American options approximation via Barone-Adesi-Whaley implemented
 */

import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import {
  CalculateGreeksDto,
  GreeksResponseDto,
  OptionChainRequestDto,
  OptionsChainResponseDto,
  OptionQuoteDto,
  ImpliedVolatilityRequestDto,
  ImpliedVolatilityResponseDto,
  OptionType,
  ExerciseStyle,
} from './dto/options.dto';
import {
  CalculateStrategyDto,
  StrategyResponseDto,
  PayoffPoint,
} from './dto/strategy.dto';
import { Greeks, OptionParams } from './interfaces/options.interface';

@Injectable()
export class OptionsService {
  /**
   * Calculate Black-Scholes Greeks for a single option
   * Uses TypeScript fallback - will integrate WASM in next step
   */
  async calculateGreeks(dto: CalculateGreeksDto): Promise<GreeksResponseDto> {
    try {
      // PERF: WASM integration planned — see CERNIQ-PERF-001

      const exercise = dto.exercise ?? ExerciseStyle.EUROPEAN;
      const dividendYield = dto.dividendYield ?? 0;

      if (exercise === ExerciseStyle.AMERICAN) {
        // Barone-Adesi-Whaley approximation for American options
        const result = this.calculateAmericanPrice({
          underlying: dto.underlying,
          strike: dto.strike,
          timeToExpiry: dto.timeToExpiry,
          riskFreeRate: dto.riskFreeRate,
          volatility: dto.volatility,
          optionType: dto.optionType,
          dividendYield,
        });

        return {
          ...result.greeks,
          underlying: dto.underlying,
          strike: dto.strike,
          timeToExpiry: dto.timeToExpiry,
          volatility: dto.volatility,
          optionType: dto.optionType,
          exercise: ExerciseStyle.AMERICAN,
          earlyExercisePremium: result.earlyExercisePremium,
        };
      }

      // European: standard Black-Scholes
      const greeks = this.calculateBlackScholesGreeks({
        underlying: dto.underlying,
        strike: dto.strike,
        timeToExpiry: dto.timeToExpiry,
        riskFreeRate: dto.riskFreeRate,
        volatility: dto.volatility,
        optionType: dto.optionType,
        dividendYield,
      });

      return {
        ...greeks,
        underlying: dto.underlying,
        strike: dto.strike,
        timeToExpiry: dto.timeToExpiry,
        volatility: dto.volatility,
        optionType: dto.optionType,
        exercise: ExerciseStyle.EUROPEAN,
      };
    } catch (error: any) {
      throw new HttpException(
        `Failed to calculate Greeks: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get options chain for a ticker
   * Will integrate with data provider in next phase
   */
  async getOptionsChain(
    dto: OptionChainRequestDto,
  ): Promise<OptionsChainResponseDto> {
    try {
      // DATA: Options chain provider integration pending — see CERNIQ-DATA-001

      // Mock response for now
      throw new HttpException(
        'Options chain data provider not yet integrated. Add yfinance or paid provider.',
        HttpStatus.NOT_IMPLEMENTED,
      );
    } catch (error: any) {
      throw new HttpException(
        `Failed to fetch options chain: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Calculate implied volatility using Newton-Raphson method
   */
  async calculateImpliedVolatility(
    dto: ImpliedVolatilityRequestDto,
  ): Promise<ImpliedVolatilityResponseDto> {
    try {
      const timeToExpiry = this.calculateTimeToExpiry(new Date(dto.expiration));

      // For IV calculation, we need an underlying price estimate
      // Using strike as proxy if not provided (should fetch from market data)
      const underlyingEstimate = dto.strike;

      const result = this.newtonRaphsonIV({
        underlying: underlyingEstimate,
        strike: dto.strike,
        timeToExpiry,
        riskFreeRate: 0.05, // Default 5% - should fetch from FRED
        marketPrice: dto.marketPrice,
        optionType: dto.optionType,
      });

      return result;
    } catch (error: any) {
      throw new HttpException(
        `Failed to calculate IV: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Calculate multi-leg strategy payoff and Greeks
   */
  async calculateStrategy(
    dto: CalculateStrategyDto,
  ): Promise<StrategyResponseDto> {
    try {
      // First calculate initial cost
      let initialCost = 0;

      for (const leg of dto.legs) {
        const timeToExpiry = this.calculateTimeToExpiry(
          new Date(leg.expiration),
        );

        const greeks = this.calculateBlackScholesGreeks({
          underlying: dto.underlyingPrice,
          strike: leg.strike,
          timeToExpiry,
          riskFreeRate: dto.riskFreeRate,
          volatility: dto.volatility,
          optionType: leg.optionType,
        });

        const legCost = greeks.price * leg.quantity * 100;
        initialCost += leg.buySell === 'buy' ? legCost : -legCost;
      }

      // Calculate payoff across price range (at expiration)
      const priceRange = this.generatePriceRange(dto.underlyingPrice);
      const payoff: PayoffPoint[] = [];

      for (const price of priceRange) {
        let totalPL = 0;

        for (const leg of dto.legs) {
          // At expiration (T=0), option value is just intrinsic value
          const intrinsicValue =
            leg.optionType === 'call'
              ? Math.max(price - leg.strike, 0)
              : Math.max(leg.strike - price, 0);

          const legValue = intrinsicValue * leg.quantity * 100;
          const multiplier = leg.buySell === 'buy' ? 1 : -1;

          totalPL += legValue * multiplier;
        }

        // Subtract initial cost to get profit/loss
        payoff.push({
          underlyingPrice: price,
          profitLoss: totalPL - initialCost,
        });
      }

      // Calculate aggregated Greeks at current price
      const aggregatedGreeks = {
        delta: 0,
        gamma: 0,
        theta: 0,
        vega: 0,
        rho: 0,
      };

      for (const leg of dto.legs) {
        const timeToExpiry = this.calculateTimeToExpiry(
          new Date(leg.expiration),
        );

        const greeks = this.calculateBlackScholesGreeks({
          underlying: dto.underlyingPrice,
          strike: leg.strike,
          timeToExpiry,
          riskFreeRate: dto.riskFreeRate,
          volatility: dto.volatility,
          optionType: leg.optionType,
        });

        const multiplier = leg.buySell === 'buy' ? 1 : -1;
        const contractMultiplier = leg.quantity * 100;

        aggregatedGreeks.delta +=
          greeks.delta * multiplier * contractMultiplier;
        aggregatedGreeks.gamma +=
          greeks.gamma * multiplier * contractMultiplier;
        aggregatedGreeks.theta +=
          greeks.theta * multiplier * contractMultiplier;
        aggregatedGreeks.vega += greeks.vega * multiplier * contractMultiplier;
        aggregatedGreeks.rho += greeks.rho * multiplier * contractMultiplier;
      }

      // Find break-evens and max profit/loss
      const breakEvens = this.findBreakEvens(payoff);
      const maxProfit = Math.max(...payoff.map((p) => p.profitLoss));
      const maxLoss = Math.min(...payoff.map((p) => p.profitLoss));

      return {
        strategyName: this.detectStrategyName(dto.legs),
        payoff,
        breakEvens,
        maxProfit,
        maxLoss,
        greeks: aggregatedGreeks,
        initialCost,
        legs: dto.legs,
      };
    } catch (error: any) {
      throw new HttpException(
        `Failed to calculate strategy: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Black-Scholes pricing formula (TypeScript implementation)
   * PERF: Newton-Raphson in JS is adequate for <1000 options. WASM planned for batch pricing — see CERNIQ-PERF-001
   *
   * Edge cases handled:
   * - T <= 0: returns intrinsic value with correct delta (0 or +/-1)
   * - sigma ~= 0: returns discounted intrinsic value (deterministic limit)
   * - S ~= 0 or K ~= 0: degenerate cases
   * - Deep ITM/OTM: d1/d2 clamped to prevent CDF overflow
   */
  /** American option pricing — falls back to European (lower bound) until BAW is implemented. */
  private calculateAmericanPrice(params: OptionParams): Greeks {
    return this.calculateBlackScholesGreeks(params);
  }

  private calculateBlackScholesGreeks(params: OptionParams): Greeks {
    const {
      underlying: S,
      strike: K,
      timeToExpiry: T,
      riskFreeRate: r,
      volatility: sigma,
      optionType,
    } = params;

    // ── Edge case: at or past expiry ──
    if (T <= 0) {
      const intrinsic =
        optionType === 'call' ? Math.max(S - K, 0) : Math.max(K - S, 0);
      // At expiry, delta is 1 (ITM) or 0 (OTM) — not uniformly 0
      const isITM = optionType === 'call' ? S > K : K > S;
      return {
        delta: isITM ? (optionType === 'call' ? 1 : -1) : 0,
        gamma: 0,
        theta: 0,
        vega: 0,
        rho: 0,
        price: intrinsic,
      };
    }

    // ── Edge case: zero or near-zero volatility (deterministic limit) ──
    if (sigma < 1e-10) {
      const df = Math.exp(-r * T);
      if (optionType === 'call') {
        const price = Math.max(S - K * df, 0);
        const isITM = S > K * df;
        return {
          delta: isITM ? 1 : 0,
          gamma: 0,
          theta: isITM ? (-r * K * df) / 365 : 0,
          vega: 0,
          rho: isITM ? (K * T * df) / 100 : 0,
          price,
        };
      } else {
        const price = Math.max(K * df - S, 0);
        const isITM = K * df > S;
        return {
          delta: isITM ? -1 : 0,
          gamma: 0,
          theta: isITM ? (r * K * df) / 365 : 0,
          vega: 0,
          rho: isITM ? (-K * T * df) / 100 : 0,
          price,
        };
      }
    }

    // ── Edge case: zero underlying ──
    if (S <= 0) {
      const df = Math.exp(-r * T);
      if (optionType === 'call') {
        return { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0, price: 0 };
      } else {
        return {
          delta: 0,
          gamma: 0,
          theta: 0,
          vega: 0,
          rho: 0,
          price: K * df,
        };
      }
    }

    // ── Edge case: zero strike ──
    if (K <= 0) {
      if (optionType === 'call') {
        return { delta: 1, gamma: 0, theta: 0, vega: 0, rho: 0, price: S };
      } else {
        return { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0, price: 0 };
      }
    }

    const sqrtT = Math.sqrt(T);
    const d1 =
      (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
    const d2 = d1 - sigma * sqrtT;

    // Clamp d1/d2 to avoid numerical issues in CDF for extreme ITM/OTM
    const d1c = Math.max(-30, Math.min(30, d1));
    const d2c = Math.max(-30, Math.min(30, d2));

    const Nd1 = this.normalCDF(d1c);
    const Nd2 = this.normalCDF(d2c);
    const npd1 = this.normalPDF(d1c);
    const df = Math.exp(-r * T);

    let price: number, delta: number, theta: number, rho: number;

    if (optionType === 'call') {
      price = S * Nd1 - K * df * Nd2;
      delta = Nd1;
      theta =
        ((-S * npd1 * sigma) / (2 * sqrtT) - r * K * df * Nd2) / 365;
      rho = (K * T * df * Nd2) / 100;
    } else {
      const Nmd1 = this.normalCDF(-d1c);
      const Nmd2 = this.normalCDF(-d2c);
      price = K * df * Nmd2 - S * Nmd1;
      delta = Nd1 - 1;
      theta =
        ((-S * npd1 * sigma) / (2 * sqrtT) + r * K * df * Nmd2) / 365;
      rho = (-K * T * df * Nmd2) / 100;
    }

    const gamma = npd1 / (S * sigma * sqrtT);
    const vega = (S * sqrtT * npd1) / 100;

    // Final NaN guard — should never trigger but protects downstream consumers
    const safeNum = (v: number) => (Number.isFinite(v) ? v : 0);

    return {
      delta: safeNum(delta),
      gamma: safeNum(gamma),
      theta: safeNum(theta),
      vega: safeNum(vega),
      rho: safeNum(rho),
      price: safeNum(Math.max(price, 0)),
    };
  }

  /**
   * Barone-Adesi-Whaley (1987) quadratic approximation for American options.
   *
   * Key insight: The American option price can be decomposed as
   *   C_am = C_eu + epsilon_c  (for calls)
   *   P_am = P_eu + epsilon_p  (for puts)
   * where epsilon is the early exercise premium.
   *
   * For American calls on non-dividend-paying assets, early exercise is never
   * optimal, so C_am = C_eu. For American puts (and calls on dividend-paying
   * assets), the method solves for the critical stock price S* at which
   * early exercise becomes optimal, then computes the premium using a
   * quadratic approximation.
   *
   * Returns both the Greeks and the early exercise premium.
   */
  private calculateAmericanPrice(params: OptionParams): {
    greeks: Greeks;
    earlyExercisePremium: number;
  } {
    const {
      underlying: S,
      strike: K,
      timeToExpiry: T,
      riskFreeRate: r,
      volatility: sigma,
      optionType,
      dividendYield: q = 0,
    } = params;

    // European price as the baseline
    const euroGreeks = this.calculateBlackScholesGreeks(params);

    // Edge cases: at or past expiry, zero vol, zero S, zero K — European = American
    if (T <= 0 || sigma < 1e-10 || S <= 0 || K <= 0) {
      return { greeks: euroGreeks, earlyExercisePremium: 0 };
    }

    // For American calls on non-dividend-paying stock, early exercise is never optimal
    if (optionType === 'call' && q <= 0) {
      return { greeks: euroGreeks, earlyExercisePremium: 0 };
    }

    // ── BAW core computation ──
    const sigSq = sigma * sigma;
    const M = (2 * r) / sigSq;
    const N = (2 * (r - q)) / sigSq;
    const k = 1 - Math.exp(-r * T);

    if (optionType === 'put') {
      // q2 for puts: q2 = (-(N-1) - sqrt((N-1)^2 + 4*M/k)) / 2
      const Nm1 = N - 1;
      const discriminant = Nm1 * Nm1 + (4 * M) / k;
      const q2 = (-Nm1 - Math.sqrt(discriminant)) / 2;

      // Find critical price S* by Newton-Raphson iteration
      // At S*, the put value equals the exercise value: K - S* = P_eu(S*) + A2*(S*/S*)^q2
      // which simplifies to: K - S* = P_eu(S*) - (S*/q2)*(1 - e^(-qT)*N(-d1(S*)))
      const SStar = this.findCriticalPricePut(S, K, T, r, q, sigma, q2);

      // If S <= S* (deep ITM), early exercise is optimal: value = K - S
      if (S <= SStar) {
        const intrinsic = K - S;
        return {
          greeks: {
            price: intrinsic,
            delta: -1,
            gamma: 0,
            theta: 0,
            vega: 0,
            rho: 0,
          },
          earlyExercisePremium: intrinsic - euroGreeks.price,
        };
      }

      // Compute A2: the early exercise premium coefficient
      const d1Star = this.bsD1(SStar, K, T, r, q, sigma);
      const A2 =
        -(SStar / q2) * (1 - Math.exp(-q * T) * this.normalCDF(-d1Star));

      // American put price = European put price + A2 * (S/S*)^q2
      const earlyExercisePremium = A2 * Math.pow(S / SStar, q2);
      const americanPrice = euroGreeks.price + earlyExercisePremium;

      // Compute American Greeks via finite differences
      const americanGreeks = this.computeAmericanGreeks(
        params,
        americanPrice,
      );

      return {
        greeks: americanGreeks,
        earlyExercisePremium: Math.max(earlyExercisePremium, 0),
      };
    } else {
      // American call with dividends (q > 0)
      // q1 for calls: q1 = (-(N-1) + sqrt((N-1)^2 + 4*M/k)) / 2
      const Nm1 = N - 1;
      const discriminant = Nm1 * Nm1 + (4 * M) / k;
      const q1 = (-Nm1 + Math.sqrt(discriminant)) / 2;

      // Find critical price S* for call
      const SStar = this.findCriticalPriceCall(S, K, T, r, q, sigma, q1);

      // If S >= S* (deep ITM), early exercise is optimal: value = S - K
      if (S >= SStar) {
        const intrinsic = S - K;
        return {
          greeks: {
            price: intrinsic,
            delta: 1,
            gamma: 0,
            theta: 0,
            vega: 0,
            rho: 0,
          },
          earlyExercisePremium: intrinsic - euroGreeks.price,
        };
      }

      // Compute A1
      const d1Star = this.bsD1(SStar, K, T, r, q, sigma);
      const A1 =
        (SStar / q1) * (1 - Math.exp(-q * T) * this.normalCDF(d1Star));

      // American call price = European call price + A1 * (S/S*)^q1
      const earlyExercisePremium = A1 * Math.pow(S / SStar, q1);
      const americanPrice = euroGreeks.price + earlyExercisePremium;

      const americanGreeks = this.computeAmericanGreeks(
        params,
        americanPrice,
      );

      return {
        greeks: americanGreeks,
        earlyExercisePremium: Math.max(earlyExercisePremium, 0),
      };
    }
  }

  /**
   * Compute d1 for the generalized Black-Scholes formula (with dividends).
   */
  private bsD1(
    S: number,
    K: number,
    T: number,
    r: number,
    q: number,
    sigma: number,
  ): number {
    const sqrtT = Math.sqrt(T);
    return (
      (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) /
      (sigma * sqrtT)
    );
  }

  /**
   * Compute the European option price with continuous dividend yield q.
   * Uses the generalized Black-Scholes (Merton) formula.
   */
  private bsPrice(
    S: number,
    K: number,
    T: number,
    r: number,
    q: number,
    sigma: number,
    optionType: OptionType,
  ): number {
    if (T <= 0) {
      return optionType === 'call'
        ? Math.max(S - K, 0)
        : Math.max(K - S, 0);
    }
    if (sigma < 1e-10) {
      const fwd = S * Math.exp((r - q) * T);
      const df = Math.exp(-r * T);
      return optionType === 'call'
        ? Math.max(fwd - K, 0) * df
        : Math.max(K - fwd, 0) * df;
    }

    const d1 = this.bsD1(S, K, T, r, q, sigma);
    const d2 = d1 - sigma * Math.sqrt(T);
    const d1c = Math.max(-30, Math.min(30, d1));
    const d2c = Math.max(-30, Math.min(30, d2));
    const dfq = Math.exp(-q * T);
    const dfr = Math.exp(-r * T);

    if (optionType === 'call') {
      return S * dfq * this.normalCDF(d1c) - K * dfr * this.normalCDF(d2c);
    } else {
      return K * dfr * this.normalCDF(-d2c) - S * dfq * this.normalCDF(-d1c);
    }
  }

  /**
   * Find the critical stock price S* for American put using Newton-Raphson.
   *
   * At S*, the condition is:
   *   K - S* = P_eu(S*) + A2(S*)
   * where A2(S*) = -(S*/q2) * (1 - e^{-qT} * N(-d1(S*)))
   *
   * Rearranging: f(S*) = K - S* - P_eu(S*) + (S*/q2)*(1 - e^{-qT}*N(-d1(S*))) = 0
   */
  private findCriticalPricePut(
    _S: number,
    K: number,
    T: number,
    r: number,
    q: number,
    sigma: number,
    q2: number,
  ): number {
    // Initial guess: start near K (put is at-the-money)
    const dfr = Math.exp(-r * T);
    const dfq = Math.exp(-q * T);

    // Initial estimate: between 0 and K
    let Si = K * (1 - 1 / q2); // BAW seed
    // Clamp to a reasonable range
    Si = Math.max(K * 0.01, Math.min(Si, K * 0.999));

    const MAX_ITER = 100;
    const TOL = 1e-6;

    for (let i = 0; i < MAX_ITER; i++) {
      const pEu = this.bsPrice(Si, K, T, r, q, sigma, OptionType.PUT);
      const d1 = this.bsD1(Si, K, T, r, q, sigma);
      const d1c = Math.max(-30, Math.min(30, d1));
      const Nmd1 = this.normalCDF(-d1c);

      // The exercise boundary condition:
      // LHS = K - Si (exercise value)
      // RHS = P_eu(Si) - (Si/q2)*(1 - e^{-qT}*Nmd1) (continuation value)
      const LHS = K - Si;
      const A2_at_star = -(Si / q2) * (1 - dfq * Nmd1);
      const RHS = pEu + A2_at_star;

      const diff = RHS - LHS;

      if (Math.abs(diff) < TOL) {
        return Si;
      }

      // Derivative of the difference w.r.t. Si (approximated)
      // Use central finite difference for robustness
      const h = Si * 1e-5;
      const pEuUp = this.bsPrice(Si + h, K, T, r, q, sigma, OptionType.PUT);
      const d1Up = this.bsD1(Si + h, K, T, r, q, sigma);
      const d1Upc = Math.max(-30, Math.min(30, d1Up));
      const NmD1Up = this.normalCDF(-d1Upc);
      const A2Up = -((Si + h) / q2) * (1 - dfq * NmD1Up);
      const RHSUp = pEuUp + A2Up;
      const LHSUp = K - (Si + h);
      const diffUp = RHSUp - LHSUp;

      const dDiff = (diffUp - diff) / h;

      if (Math.abs(dDiff) < 1e-14) {
        // Gradient too small; nudge Si
        Si = Si * 0.95;
        continue;
      }

      let step = diff / dDiff;
      // Dampen large steps
      step = Math.max(-Si * 0.3, Math.min(step, Si * 0.3));
      Si = Si - step;

      // Keep Si positive and below K
      Si = Math.max(K * 0.001, Math.min(Si, K * 0.999));
    }

    return Si;
  }

  /**
   * Find the critical stock price S* for American call using Newton-Raphson.
   *
   * At S*, the condition is:
   *   S* - K = C_eu(S*) + A1(S*)
   * where A1(S*) = (S*/q1) * (1 - e^{-qT} * N(d1(S*)))
   */
  private findCriticalPriceCall(
    _S: number,
    K: number,
    T: number,
    r: number,
    q: number,
    sigma: number,
    q1: number,
  ): number {
    const dfq = Math.exp(-q * T);

    // Initial guess: start above K
    let Si = K / (1 - 1 / q1);
    Si = Math.max(K * 1.001, Math.min(Si, K * 10));

    const MAX_ITER = 100;
    const TOL = 1e-6;

    for (let i = 0; i < MAX_ITER; i++) {
      const cEu = this.bsPrice(Si, K, T, r, q, sigma, OptionType.CALL);
      const d1 = this.bsD1(Si, K, T, r, q, sigma);
      const d1c = Math.max(-30, Math.min(30, d1));
      const Nd1 = this.normalCDF(d1c);

      const LHS = Si - K;
      const A1_at_star = (Si / q1) * (1 - dfq * Nd1);
      const RHS = cEu + A1_at_star;

      const diff = RHS - LHS;

      if (Math.abs(diff) < TOL) {
        return Si;
      }

      // Central finite difference for derivative
      const h = Si * 1e-5;
      const cEuUp = this.bsPrice(Si + h, K, T, r, q, sigma, OptionType.CALL);
      const d1Up = this.bsD1(Si + h, K, T, r, q, sigma);
      const d1Upc = Math.max(-30, Math.min(30, d1Up));
      const Nd1Up = this.normalCDF(d1Upc);
      const A1Up = ((Si + h) / q1) * (1 - dfq * Nd1Up);
      const RHSUp = cEuUp + A1Up;
      const LHSUp = Si + h - K;
      const diffUp = RHSUp - LHSUp;

      const dDiff = (diffUp - diff) / h;

      if (Math.abs(dDiff) < 1e-14) {
        Si = Si * 1.05;
        continue;
      }

      let step = diff / dDiff;
      step = Math.max(-Si * 0.3, Math.min(step, Si * 0.3));
      Si = Si - step;

      Si = Math.max(K * 1.001, Math.min(Si, K * 10));
    }

    return Si;
  }

  /**
   * Compute American option Greeks via central finite differences.
   *
   * Since the BAW approximation does not have clean analytical Greeks,
   * we bump each input by a small epsilon and re-price to get numerical
   * derivatives. This is standard practice for approximate models.
   */
  private computeAmericanGreeks(
    params: OptionParams,
    _price: number,
  ): Greeks {
    const { underlying: S, strike: K, timeToExpiry: T, riskFreeRate: r, volatility: sigma, optionType, dividendYield: q = 0 } = params;

    // Helper to get the full BAW price for a given parameter set
    const bawPrice = (p: OptionParams): number => {
      const result = this.calculateAmericanPrice(p);
      return result.greeks.price;
    };

    // Use the analytical price as the center (avoid infinite recursion by
    // computing the price directly here instead of calling calculateAmericanPrice)
    const price = this.americanPriceDirect(S, K, T, r, q, sigma, optionType);

    // Delta: dP/dS
    const dS = S * 0.001;
    const priceUp = this.americanPriceDirect(S + dS, K, T, r, q, sigma, optionType);
    const priceDown = this.americanPriceDirect(S - dS, K, T, r, q, sigma, optionType);
    const delta = (priceUp - priceDown) / (2 * dS);

    // Gamma: d2P/dS2
    const gamma = (priceUp - 2 * price + priceDown) / (dS * dS);

    // Theta: dP/dT (per day, divide by 365)
    const dT = T > 0.002 ? 0.001 : T * 0.1;
    const priceTDown = this.americanPriceDirect(S, K, T - dT, r, q, sigma, optionType);
    const theta = (dT > 0 ? -(price - priceTDown) / dT : 0) / 365;

    // Vega: dP/dSigma (per 1% move, divide by 100)
    const dSigma = 0.001;
    const priceSigmaUp = this.americanPriceDirect(S, K, T, r, q, sigma + dSigma, optionType);
    const priceSigmaDown = this.americanPriceDirect(S, K, T, r, q, sigma - dSigma, optionType);
    const vega = (priceSigmaUp - priceSigmaDown) / (2 * dSigma) / 100;

    // Rho: dP/dR (per 1% move, divide by 100)
    const dR = 0.001;
    const priceRUp = this.americanPriceDirect(S, K, T, r + dR, q, sigma, optionType);
    const priceRDown = this.americanPriceDirect(S, K, T, r - dR, q, sigma, optionType);
    const rho = (priceRUp - priceRDown) / (2 * dR) / 100;

    const safeNum = (v: number) => (Number.isFinite(v) ? v : 0);

    return {
      price: safeNum(Math.max(price, 0)),
      delta: safeNum(delta),
      gamma: safeNum(gamma),
      theta: safeNum(theta),
      vega: safeNum(vega),
      rho: safeNum(rho),
    };
  }

  /**
   * Direct BAW price computation (no Greeks, no recursion).
   * Used internally by computeAmericanGreeks for finite-difference bumping.
   */
  private americanPriceDirect(
    S: number,
    K: number,
    T: number,
    r: number,
    q: number,
    sigma: number,
    optionType: OptionType,
  ): number {
    // Edge cases
    if (T <= 0) {
      return optionType === 'call'
        ? Math.max(S - K, 0)
        : Math.max(K - S, 0);
    }
    if (sigma < 1e-10 || S <= 0 || K <= 0) {
      return this.bsPrice(S, K, T, r, q, sigma, optionType);
    }

    // For calls with no dividends, American = European
    if (optionType === 'call' && q <= 0) {
      return this.bsPrice(S, K, T, r, q, sigma, optionType);
    }

    const sigSq = sigma * sigma;
    const M = (2 * r) / sigSq;
    const N_val = (2 * (r - q)) / sigSq;
    const k = 1 - Math.exp(-r * T);

    const euroPrice = this.bsPrice(S, K, T, r, q, sigma, optionType);

    if (optionType === 'put') {
      const Nm1 = N_val - 1;
      const discriminant = Nm1 * Nm1 + (4 * M) / k;
      const q2 = (-Nm1 - Math.sqrt(discriminant)) / 2;

      const SStar = this.findCriticalPricePut(S, K, T, r, q, sigma, q2);

      if (S <= SStar) {
        return K - S;
      }

      const d1Star = this.bsD1(SStar, K, T, r, q, sigma);
      const d1Starc = Math.max(-30, Math.min(30, d1Star));
      const A2 =
        -(SStar / q2) *
        (1 - Math.exp(-q * T) * this.normalCDF(-d1Starc));

      const premium = A2 * Math.pow(S / SStar, q2);
      return Math.max(euroPrice + premium, Math.max(K - S, 0));
    } else {
      // Call with dividends
      const Nm1 = N_val - 1;
      const discriminant = Nm1 * Nm1 + (4 * M) / k;
      const q1 = (-Nm1 + Math.sqrt(discriminant)) / 2;

      const SStar = this.findCriticalPriceCall(S, K, T, r, q, sigma, q1);

      if (S >= SStar) {
        return S - K;
      }

      const d1Star = this.bsD1(SStar, K, T, r, q, sigma);
      const d1Starc = Math.max(-30, Math.min(30, d1Star));
      const A1 =
        (SStar / q1) *
        (1 - Math.exp(-q * T) * this.normalCDF(d1Starc));

      const premium = A1 * Math.pow(S / SStar, q1);
      return Math.max(euroPrice + premium, Math.max(S - K, 0));
    }
  }

  /**
   * Implied volatility solver using Newton-Raphson with bisection fallback.
   *
   * Improvements over naive Newton-Raphson:
   * 1. Validates market price against arbitrage bounds before iterating
   * 2. Falls back to bisection when vega is too small (deep ITM/OTM)
   * 3. Tracks bracket [lo, hi] to guarantee convergence
   * 4. Limits step size to prevent oscillation
   */
  private newtonRaphsonIV(params: {
    underlying: number;
    strike: number;
    timeToExpiry: number;
    riskFreeRate: number;
    marketPrice: number;
    optionType: OptionType;
  }): ImpliedVolatilityResponseDto {
    const {
      underlying: S,
      strike: K,
      timeToExpiry: T,
      riskFreeRate: r,
      marketPrice,
      optionType,
    } = params;

    // ── Validate market price against no-arbitrage bounds ──
    const df = Math.exp(-r * T);
    if (optionType === 'call') {
      const intrinsic = Math.max(S - K * df, 0);
      if (marketPrice < intrinsic - 0.001) {
        throw new Error(
          'IV calculation: market price below intrinsic value (arbitrage)',
        );
      }
      if (marketPrice > S + 0.001) {
        throw new Error(
          'IV calculation: market price exceeds underlying (arbitrage)',
        );
      }
    } else {
      const intrinsic = Math.max(K * df - S, 0);
      if (marketPrice < intrinsic - 0.001) {
        throw new Error(
          'IV calculation: market price below intrinsic value (arbitrage)',
        );
      }
      if (marketPrice > K * df + 0.001) {
        throw new Error(
          'IV calculation: market price exceeds discounted strike (arbitrage)',
        );
      }
    }

    if (marketPrice <= 0) {
      return { impliedVolatility: 0, iterations: 0, error: 0 };
    }

    let sigma = 0.25; // Initial guess: 25% volatility
    const maxIterations = 100;
    const tolerance = 1e-6;
    let iterations = 0;

    // Maintain bracket for bisection fallback
    let lo = 0.001;
    let hi = 5.0;
    // Maximum relative step size per iteration to prevent oscillation
    const MAX_STEP_RATIO = 0.5;

    for (let i = 0; i < maxIterations; i++) {
      iterations++;

      const greeks = this.calculateBlackScholesGreeks({
        underlying: S,
        strike: K,
        timeToExpiry: T,
        riskFreeRate: r,
        volatility: sigma,
        optionType,
      });

      const priceDiff = greeks.price - marketPrice;

      if (Math.abs(priceDiff) < tolerance) {
        return { impliedVolatility: sigma, iterations, error: priceDiff };
      }

      // Update bracket bounds
      if (priceDiff > 0) {
        hi = sigma;
      } else {
        lo = sigma;
      }

      // Newton-Raphson update: sigma_new = sigma_old - f(sigma) / f'(sigma)
      // f(sigma) = BS_price(sigma) - market_price
      // f'(sigma) = vega (converted from percentage)
      const vegaValue = greeks.vega * 100;

      if (vegaValue > 1e-8) {
        // Newton-Raphson step with damping
        let step = priceDiff / vegaValue;
        // Clamp step size to prevent wild jumps
        const maxStep = sigma * MAX_STEP_RATIO;
        step = Math.max(-maxStep, Math.min(step, maxStep));
        const candidate = sigma - step;

        // Accept Newton step only if it stays within bracket
        if (candidate > lo && candidate < hi) {
          sigma = candidate;
        } else {
          // Bisection fallback
          sigma = (lo + hi) / 2;
        }
      } else {
        // Vega too small: pure bisection fallback
        sigma = (lo + hi) / 2;
      }

      // Safety: ensure sigma stays in bounds
      sigma = Math.max(lo, Math.min(sigma, hi));

      // Check if bracket has collapsed
      if (hi - lo < tolerance) {
        return { impliedVolatility: sigma, iterations, error: priceDiff };
      }
    }

    // Return best estimate instead of throwing — more robust for API consumers
    const finalGreeks = this.calculateBlackScholesGreeks({
      underlying: S,
      strike: K,
      timeToExpiry: T,
      riskFreeRate: r,
      volatility: sigma,
      optionType,
    });
    return {
      impliedVolatility: sigma,
      iterations,
      error: finalGreeks.price - marketPrice,
    };
  }

  /**
   * Helper: Normal cumulative distribution function
   * Hart approximation (max error ~1.5e-7)
   */
  private normalCDF(x: number): number {
    // Guard extreme inputs
    if (x > 30) return 1;
    if (x < -30) return 0;
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp((-x * x) / 2);
    const prob =
      d *
      t *
      (0.3193815 +
        t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - prob : prob;
  }

  /**
   * Helper: Normal probability density function
   */
  private normalPDF(x: number): number {
    // Guard extreme inputs to avoid underflow
    if (Math.abs(x) > 30) return 0;
    return Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI);
  }

  /**
   * Helper: Calculate time to expiry in years
   */
  private calculateTimeToExpiry(expiration: Date): number {
    const now = new Date();
    const diffMs = expiration.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return Math.max(diffDays / 365, 0);
  }

  /**
   * Helper: Generate price range for payoff diagram
   */
  private generatePriceRange(currentPrice: number): number[] {
    const range: number[] = [];
    const minPrice = currentPrice * 0.7; // -30%
    const maxPrice = currentPrice * 1.3; // +30%
    const step = (maxPrice - minPrice) / 100;

    for (let price = minPrice; price <= maxPrice; price += step) {
      range.push(price);
    }

    return range;
  }

  /**
   * Helper: Find break-even points in payoff
   */
  private findBreakEvens(payoff: PayoffPoint[]): number[] {
    const breakEvens: number[] = [];

    for (let i = 0; i < payoff.length - 1; i++) {
      const current = payoff[i];
      const next = payoff[i + 1];

      // Check if sign changes (crosses zero)
      if (current.profitLoss * next.profitLoss < 0) {
        // Linear interpolation to find exact break-even
        const slope =
          (next.profitLoss - current.profitLoss) /
          (next.underlyingPrice - current.underlyingPrice);
        const breakEven = current.underlyingPrice - current.profitLoss / slope;
        breakEvens.push(breakEven);
      }
    }

    return breakEvens;
  }

  /**
   * Helper: Detect strategy name from legs
   */
  private detectStrategyName(legs: any[]): string {
    if (legs.length === 1) {
      const leg = legs[0];
      return leg.buySell === 'buy'
        ? `Long ${leg.optionType === 'call' ? 'Call' : 'Put'}`
        : `Short ${leg.optionType === 'call' ? 'Call' : 'Put'}`;
    }

    if (legs.length === 2) {
      const calls = legs.filter((l) => l.optionType === 'call');
      const puts = legs.filter((l) => l.optionType === 'put');

      if (calls.length === 2) {
        return legs[0].buySell === 'buy'
          ? 'Bull Call Spread'
          : 'Bear Call Spread';
      }
      if (puts.length === 2) {
        return legs[0].buySell === 'buy'
          ? 'Bear Put Spread'
          : 'Bull Put Spread';
      }
      if (
        calls.length === 1 &&
        puts.length === 1 &&
        legs.every((l) => l.strike === legs[0].strike)
      ) {
        return legs[0].buySell === 'buy' ? 'Long Straddle' : 'Short Straddle';
      }
    }

    if (legs.length === 4) {
      const calls = legs.filter((l) => l.optionType === 'call').length;
      const puts = legs.filter((l) => l.optionType === 'put').length;
      if (calls === 2 && puts === 2) {
        return 'Iron Condor';
      }
    }

    return 'Custom Strategy';
  }

  /**
   * Generate mock volatility surface data
   * DATA: Uses synthetic data for demo; real options chain integration pending — see CERNIQ-DATA-001
   */
  async getVolatilitySurface(ticker: string): Promise<any> {
    // Generate mock IV surface data
    const strikes = Array.from({ length: 11 }, (_, i) => 80 + i * 5); // 80, 85, 90, ..., 130
    const maturities = [7, 14, 30, 60, 90, 180]; // Days to expiration

    const surface: any[] = [];

    for (const maturity of maturities) {
      for (const strike of strikes) {
        // Generate realistic IV smile pattern
        // IV tends to be higher for OTM options (volatility smile)
        const atmStrike = 105;
        const moneyness = Math.abs(strike - atmStrike) / atmStrike;

        // Base IV increases with time (term structure)
        const baseIV = 0.2 + (maturity / 365) * 0.1;

        // Smile effect: higher IV for OTM options
        const smileEffect = moneyness * 0.5;

        // Add some noise
        const noise = (Math.random() - 0.5) * 0.02;

        const iv = Math.max(0.1, Math.min(0.6, baseIV + smileEffect + noise));

        surface.push({
          strike,
          maturity,
          maturityLabel: `${maturity}d`,
          impliedVolatility: iv,
          moneyness: strike / atmStrike,
        });
      }
    }

    return {
      ticker,
      underlyingPrice: 105,
      strikes,
      maturities,
      surface,
      timestamp: new Date(),
    };
  }
}
