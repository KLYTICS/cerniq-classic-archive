import { Injectable, Logger } from '@nestjs/common';

/**
 * Net Worth at Risk (NWaR) — Quant Model
 *
 * Measures the potential decline in equity (net worth) due to adverse
 * interest rate movements at a given confidence level.
 *
 * NWaR = Equity × DurationGap × RateVolatility × Z_confidence
 *
 * Where:
 *   Equity       = Assets - Liabilities
 *   DurationGap  = Duration_assets - (Liabilities/Assets) × Duration_liabilities
 *   RateVol      = Annual interest rate volatility (e.g. 0.01 = 100bps)
 *   Z_confidence = Standard normal quantile at confidence level
 *
 * NWaR as % of equity: NWaR_pct = DurationGap × RateVol × Z_confidence
 * Break-even shock: the rate change that would wipe out equity
 *   BreakEvenShock = Equity / (Assets × DurationGap)
 */

export interface NWaRResult {
  nwar: number;
  nwarPct: number;
  equityAtRisk: number;
  breakEvenShock: number;
  residualEquity: number;
  riskRating: string;
}

@Injectable()
export class NetWorthAtRiskService {
  private readonly logger = new Logger(NetWorthAtRiskService.name);

  /**
   * Calculate Net Worth at Risk.
   *
   * @param params.assets - Total asset value
   * @param params.liabilities - Total liability value
   * @param params.equity - Current equity (assets - liabilities)
   * @param params.durationGap - Duration gap (years)
   * @param params.rateVolatility - Interest rate volatility (annualized, in decimal)
   * @param params.confidence - Confidence level (default 0.99)
   * @returns NWaR, NWaR%, equity at risk, break-even shock
   */
  calculateNWaR(params: {
    assets: number;
    liabilities: number;
    equity: number;
    durationGap: number;
    rateVolatility: number;
    confidence?: number;
  }): NWaRResult {
    const {
      assets,
      equity,
      durationGap,
      rateVolatility,
      confidence = 0.99,
    } = params;

    this.logger.log(
      `Computing NWaR: equity=${equity}, durationGap=${durationGap}, rateVol=${rateVolatility}`,
    );

    const zAlpha = this.normInv(confidence);

    // NWaR = Equity × |DurationGap| × RateVol × Z_confidence
    // Using absolute value of duration gap for the loss measure
    const nwar = Math.abs(equity * durationGap * rateVolatility * zAlpha);

    // NWaR as percentage of equity
    const nwarPct = equity > 0 ? (nwar / equity) * 100 : 0;

    // Equity at risk = equity - NWaR
    const equityAtRisk = equity - nwar;

    // Break-even shock: rate change that would eliminate equity
    // ΔEquity ≈ -Assets × DurationGap × Δr => Δr = Equity / (Assets × |DurationGap|)
    const breakEvenShock =
      assets * Math.abs(durationGap) > 0
        ? equity / (assets * Math.abs(durationGap))
        : Infinity;

    const residualEquity = Math.max(0, equityAtRisk);

    // Risk rating based on NWaR as % of equity
    let riskRating: string;
    if (nwarPct < 5) {
      riskRating = 'Low';
    } else if (nwarPct < 15) {
      riskRating = 'Moderate';
    } else if (nwarPct < 30) {
      riskRating = 'High';
    } else {
      riskRating = 'Critical';
    }

    return {
      nwar: +nwar.toFixed(2),
      nwarPct: +nwarPct.toFixed(2),
      equityAtRisk: +equityAtRisk.toFixed(2),
      breakEvenShock:
        breakEvenShock === Infinity ? Infinity : +breakEvenShock.toFixed(6),
      residualEquity: +residualEquity.toFixed(2),
      riskRating,
    };
  }

  /**
   * Compute duration gap from asset and liability durations.
   *
   * DurationGap = D_assets - (L/A) × D_liabilities
   */
  computeDurationGap(params: {
    assetDuration: number;
    liabilityDuration: number;
    assets: number;
    liabilities: number;
  }): number {
    const { assetDuration, liabilityDuration, assets, liabilities } = params;
    const leverageRatio = assets > 0 ? liabilities / assets : 0;
    return +(assetDuration - leverageRatio * liabilityDuration).toFixed(4);
  }

  /**
   * Stress test NWaR under multiple rate shock scenarios.
   */
  stressTestNWaR(params: {
    assets: number;
    liabilities: number;
    equity: number;
    durationGap: number;
    rateShocks: number[];
  }): Array<{
    rateShock: number;
    equityImpact: number;
    residualEquity: number;
    solvent: boolean;
  }> {
    const { assets, equity, durationGap, rateShocks } = params;

    return rateShocks.map((shock) => {
      const equityImpact = -assets * durationGap * shock;
      const residualEquity = equity + equityImpact;
      return {
        rateShock: shock,
        equityImpact: +equityImpact.toFixed(2),
        residualEquity: +residualEquity.toFixed(2),
        solvent: residualEquity > 0,
      };
    });
  }

  // ─── Private Helpers ──────────────────────────────────────

  /** Inverse standard normal CDF */
  private normInv(p: number): number {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    if (p === 0.5) return 0;

    const a = [
      -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
      1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
    ];
    const b = [
      -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
      6.680131188771972e1, -1.328068155288572e1,
    ];
    const c = [
      -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
      -2.549732539343734, 4.374664141464968, 2.938163982698783,
    ];
    const d = [
      7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
      3.754408661907416,
    ];

    const pLow = 0.02425;
    const pHigh = 1 - pLow;
    let q: number, r: number;

    if (p < pLow) {
      q = Math.sqrt(-2 * Math.log(p));
      return (
        (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
      );
    } else if (p <= pHigh) {
      q = p - 0.5;
      r = q * q;
      return (
        ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
          q) /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
      );
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return (
        -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
      );
    }
  }
}
