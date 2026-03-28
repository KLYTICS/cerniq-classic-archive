import { Injectable, Logger } from '@nestjs/common';

/**
 * Jarrow-Turnbull Reduced-Form Credit Model — Quant Model #48
 *
 * Models default as a surprise event driven by a Poisson intensity λ(t).
 * No need to model the firm's asset value (unlike Merton structural).
 *
 * Key equations:
 * - Survival probability: Q(t) = exp(-∫₀ᵗ λ(s)ds)
 * - Risky bond price: P_risky = Σ CF_i × Q(t_i) × D(t_i) + Recovery × (1-Q(T)) × D(T)
 * - Credit spread: s(t) ≈ λ(t) × (1 - R) where R = recovery rate
 *
 * Use cases:
 * - Price credit risk on cooperativa loan portfolios
 * - Calculate fair credit spreads from default probabilities
 * - CVA (Credit Valuation Adjustment) calculation
 * - CECL complement: market-implied PDs vs. historical PDs
 */

export interface JarrowTurnbullResult {
  hazardRates: Array<{ tenor: number; hazardRate: number; survivalProb: number; defaultProb: number }>;
  riskyBondPrice: number;
  riskFreeBondPrice: number;
  creditSpread: number; // bps
  impliedPD: number; // cumulative probability of default
  recovery: number;
  cva: number; // Credit Valuation Adjustment
  interpretation: string;
  interpretationEs: string;
}

@Injectable()
export class JarrowTurnbullService {
  private readonly logger = new Logger(JarrowTurnbullService.name);

  analyze(params: {
    creditSpreads: Array<{ tenor: number; spread: number }>; // spread in decimal (0.01 = 100bps)
    recovery?: number; // recovery rate (0-1)
    riskFreeRates: Array<{ tenor: number; rate: number }>;
    notional?: number;
    couponRate?: number;
    maturity?: number;
  }): JarrowTurnbullResult {
    const { creditSpreads, recovery = 0.4, riskFreeRates, notional = 1_000_000, couponRate = 0.05, maturity = 5 } = params;

    // Bootstrap hazard rates from credit spreads
    // λ(t) ≈ s(t) / (1 - R)
    const hazardRates = creditSpreads.map(cs => {
      const lambda = cs.spread / (1 - recovery);
      const survivalProb = Math.exp(-lambda * cs.tenor);
      const defaultProb = 1 - survivalProb;
      return {
        tenor: cs.tenor,
        hazardRate: +lambda.toFixed(6),
        survivalProb: +survivalProb.toFixed(6),
        defaultProb: +defaultProb.toFixed(6),
      };
    });

    // Price risky bond
    const dt = 0.5; // semiannual
    const periods = Math.round(maturity / dt);
    let riskyPV = 0;
    let riskFreePV = 0;

    for (let i = 1; i <= periods; i++) {
      const t = i * dt;
      const cf = i < periods ? notional * couponRate * dt : notional * (1 + couponRate * dt);
      const rfRate = this.interpolate(riskFreeRates, t);
      const df = Math.exp(-rfRate * t);

      // Survival probability at time t (use closest hazard rate)
      const lambda = this.interpolateSpread(creditSpreads, t) / (1 - recovery);
      const survProb = Math.exp(-lambda * t);

      riskFreePV += cf * df;
      riskyPV += cf * df * survProb;
    }

    // Add recovery value for default scenario
    const lambdaT = this.interpolateSpread(creditSpreads, maturity) / (1 - recovery);
    const defaultProbT = 1 - Math.exp(-lambdaT * maturity);
    const rfRateT = this.interpolate(riskFreeRates, maturity);
    const dfT = Math.exp(-rfRateT * maturity);
    riskyPV += recovery * notional * defaultProbT * dfT;

    const creditSpreadBps = ((riskFreePV - riskyPV) / (notional * maturity)) * 10000;
    const cva = riskFreePV - riskyPV;
    const impliedPD = defaultProbT;

    return {
      hazardRates,
      riskyBondPrice: +riskyPV.toFixed(2),
      riskFreeBondPrice: +riskFreePV.toFixed(2),
      creditSpread: +creditSpreadBps.toFixed(1),
      impliedPD: +impliedPD.toFixed(4),
      recovery,
      cva: +cva.toFixed(2),
      interpretation: `Implied ${maturity}Y PD: ${(impliedPD * 100).toFixed(2)}%. Credit spread: ${creditSpreadBps.toFixed(0)} bps. CVA: $${(cva / 1000).toFixed(1)}K on $${(notional / 1e6).toFixed(1)}M notional.`,
      interpretationEs: `PD implicita ${maturity}A: ${(impliedPD * 100).toFixed(2)}%. Spread crediticio: ${creditSpreadBps.toFixed(0)} pbs. CVA: $${(cva / 1000).toFixed(1)}K sobre $${(notional / 1e6).toFixed(1)}M nocional.`,
    };
  }

  private interpolate(curve: Array<{ tenor: number; rate: number }>, t: number): number {
    if (t <= curve[0].tenor) return curve[0].rate;
    if (t >= curve[curve.length - 1].tenor) return curve[curve.length - 1].rate;
    for (let i = 1; i < curve.length; i++) {
      if (t <= curve[i].tenor) {
        const w = (t - curve[i-1].tenor) / (curve[i].tenor - curve[i-1].tenor);
        return curve[i-1].rate + w * (curve[i].rate - curve[i-1].rate);
      }
    }
    return curve[curve.length - 1].rate;
  }

  private interpolateSpread(spreads: Array<{ tenor: number; spread: number }>, t: number): number {
    if (t <= spreads[0].tenor) return spreads[0].spread;
    if (t >= spreads[spreads.length - 1].tenor) return spreads[spreads.length - 1].spread;
    for (let i = 1; i < spreads.length; i++) {
      if (t <= spreads[i].tenor) {
        const w = (t - spreads[i-1].tenor) / (spreads[i].tenor - spreads[i-1].tenor);
        return spreads[i-1].spread + w * (spreads[i].spread - spreads[i-1].spread);
      }
    }
    return spreads[spreads.length - 1].spread;
  }
}
