import { Injectable, Logger } from '@nestjs/common';

/**
 * Cash Flow at Risk (CFaR) — Quant Model
 *
 * Measures the maximum shortfall in cash flows relative to expected values
 * at a given confidence level over a specified horizon.
 *
 * For each period i:
 *   CF_worst_i = Expected_i - Z_α × Volatility_i
 *
 * Aggregate CFaR (assumes independent periods):
 *   CFaR = Z_α × √(Σ Volatility_i²)
 *
 * Total expected CF = Σ Expected_i
 * Worst-case CF = Total expected CF - CFaR
 */

export interface CashFlowPeriod {
  period: number;
  expected: number;
  volatility: number;
}

export interface CFaRPeriodResult {
  period: number;
  expected: number;
  volatility: number;
  worstCase: number;
  cfar: number;
}

export interface CFaRResult {
  cfar: number;
  expectedCF: number;
  worstCaseCF: number;
  periods: CFaRPeriodResult[];
}

@Injectable()
export class CashFlowAtRiskService {
  private readonly logger = new Logger(CashFlowAtRiskService.name);

  /**
   * Calculate Cash Flow at Risk for a series of periodic cash flows.
   *
   * @param params.cashFlows - Array of cash flow periods with expected value and volatility
   * @param params.confidence - Confidence level (default 0.95)
   * @param params.horizon - Number of periods to include (default: all)
   * @returns CFaR, expected total CF, worst-case CF, and per-period breakdown
   */
  calculateCFaR(params: {
    cashFlows: CashFlowPeriod[];
    confidence?: number;
    horizon?: number;
  }): CFaRResult {
    const { cashFlows, confidence = 0.95 } = params;
    const horizon = params.horizon ?? cashFlows.length;

    this.logger.log(`Computing CFaR for ${horizon} periods at ${(confidence * 100).toFixed(1)}% confidence`);

    const zAlpha = this.normInv(confidence);
    const activePeriods = cashFlows.slice(0, horizon);

    let totalExpected = 0;
    let totalVariance = 0;

    const periods: CFaRPeriodResult[] = activePeriods.map((cf) => {
      totalExpected += cf.expected;
      totalVariance += cf.volatility * cf.volatility;
      const periodCFaR = zAlpha * cf.volatility;
      const worstCase = cf.expected - periodCFaR;

      return {
        period: cf.period,
        expected: +cf.expected.toFixed(2),
        volatility: +cf.volatility.toFixed(2),
        worstCase: +worstCase.toFixed(2),
        cfar: +periodCFaR.toFixed(2),
      };
    });

    const aggregateCFaR = zAlpha * Math.sqrt(totalVariance);
    const worstCaseCF = totalExpected - aggregateCFaR;

    return {
      cfar: +aggregateCFaR.toFixed(2),
      expectedCF: +totalExpected.toFixed(2),
      worstCaseCF: +worstCaseCF.toFixed(2),
      periods,
    };
  }

  /**
   * Compute correlated CFaR when periods have known correlations.
   *
   * CFaR = Z_α × √(σ' × Ρ × σ)
   *
   * @param params.cashFlows - Cash flow periods
   * @param params.correlationMatrix - Correlation matrix between periods
   * @param params.confidence - Confidence level
   * @returns Correlated CFaR value
   */
  calculateCorrelatedCFaR(params: {
    cashFlows: CashFlowPeriod[];
    correlationMatrix: number[][];
    confidence?: number;
  }): { correlatedCFaR: number; independentCFaR: number; diversificationBenefit: number } {
    const { cashFlows, correlationMatrix, confidence = 0.95 } = params;
    const n = cashFlows.length;
    const zAlpha = this.normInv(confidence);

    // Correlated variance: σ' × Ρ × σ
    let correlatedVariance = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        correlatedVariance += cashFlows[i].volatility * cashFlows[j].volatility * correlationMatrix[i][j];
      }
    }

    // Independent variance
    const independentVariance = cashFlows.reduce((s, cf) => s + cf.volatility * cf.volatility, 0);

    const correlatedCFaR = zAlpha * Math.sqrt(Math.max(0, correlatedVariance));
    const independentCFaR = zAlpha * Math.sqrt(independentVariance);
    const diversificationBenefit = independentCFaR > 0
      ? +((1 - correlatedCFaR / independentCFaR) * 100).toFixed(2)
      : 0;

    return {
      correlatedCFaR: +correlatedCFaR.toFixed(2),
      independentCFaR: +independentCFaR.toFixed(2),
      diversificationBenefit,
    };
  }

  // ─── Private Helpers ──────────────────────────────────────

  /** Inverse standard normal CDF */
  private normInv(p: number): number {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    if (p === 0.5) return 0;

    const a = [
      -3.969683028665376e1, 2.209460984245205e2,
      -2.759285104469687e2, 1.383577518672690e2,
      -3.066479806614716e1, 2.506628277459239e0,
    ];
    const b = [
      -5.447609879822406e1, 1.615858368580409e2,
      -1.556989798598866e2, 6.680131188771972e1,
      -1.328068155288572e1,
    ];
    const c = [
      -7.784894002430293e-3, -3.223964580411365e-1,
      -2.400758277161838e0, -2.549732539343734e0,
      4.374664141464968e0, 2.938163982698783e0,
    ];
    const d = [
      7.784695709041462e-3, 3.224671290700398e-1,
      2.445134137142996e0, 3.754408661907416e0,
    ];

    const pLow = 0.02425;
    const pHigh = 1 - pLow;
    let q: number, r: number;

    if (p < pLow) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p <= pHigh) {
      q = p - 0.5;
      r = q * q;
      return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1));
    }
  }
}
