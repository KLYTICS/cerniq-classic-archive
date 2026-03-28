import { Injectable, Logger } from '@nestjs/common';

/**
 * Credit Value-at-Risk (Credit VaR) — Quant Model
 *
 * Uses the Vasicek single-factor model to estimate portfolio credit losses
 * at a given confidence level over a specified horizon.
 *
 * Vasicek formula:
 *   ConditionalPD = N( (N⁻¹(PD) + √ρ × N⁻¹(confidence)) / √(1 - ρ) )
 *   CreditVaR = Σ(EAD_i × LGD_i × ConditionalPD_i) - ExpectedLoss
 *
 * Where:
 *   N()    = Standard normal CDF
 *   N⁻¹()  = Standard normal inverse CDF (quantile function)
 *   ρ      = Asset correlation (default 0.12 per Basel II)
 *   EAD    = Exposure at Default (balance)
 *   LGD    = Loss Given Default
 *   PD     = Probability of Default
 */

export interface CreditVaRExposure {
  name: string;
  balance: number;
  pd: number;
  lgd: number;
}

export interface CreditVaRResult {
  creditVaR: number;
  expectedLoss: number;
  unexpectedLoss: number;
  contributions: Array<{
    name: string;
    expectedLoss: number;
    conditionalLoss: number;
    contribution: number;
  }>;
}

@Injectable()
export class CreditVarService {
  private readonly logger = new Logger(CreditVarService.name);

  /**
   * Calculate Credit VaR using the Vasicek single-factor model.
   *
   * @param params.exposures - Array of credit exposures with balance, PD, LGD
   * @param params.confidence - Confidence level (e.g. 0.99 for 99%)
   * @param params.horizon - Time horizon in years (default 1)
   * @param params.assetCorrelation - Asset correlation rho (default 0.12)
   * @returns CreditVaR, expected loss, unexpected loss, and per-exposure contributions
   */
  calculateCreditVaR(params: {
    exposures: CreditVaRExposure[];
    confidence: number;
    horizon?: number;
    assetCorrelation?: number;
  }): CreditVaRResult {
    const { exposures, confidence, horizon = 1, assetCorrelation = 0.12 } = params;

    this.logger.log(`Computing Credit VaR for ${exposures.length} exposures at ${(confidence * 100).toFixed(1)}% confidence`);

    const rho = assetCorrelation;
    const sqrtRho = Math.sqrt(rho);
    const sqrt1MinusRho = Math.sqrt(1 - rho);
    const qConfidence = this.normInv(confidence);

    let totalExpectedLoss = 0;
    let totalConditionalLoss = 0;

    const contributions = exposures.map((exp) => {
      // Scale PD for horizon: PD_h = 1 - (1 - PD)^horizon
      const pdH = 1 - Math.pow(1 - exp.pd, horizon);

      // Expected loss
      const el = exp.balance * exp.lgd * pdH;
      totalExpectedLoss += el;

      // Conditional PD under Vasicek model
      const conditionalPD = this.normCdf(
        (this.normInv(pdH) + sqrtRho * qConfidence) / sqrt1MinusRho,
      );

      // Conditional loss
      const cl = exp.balance * exp.lgd * conditionalPD;
      totalConditionalLoss += cl;

      return {
        name: exp.name,
        expectedLoss: +el.toFixed(2),
        conditionalLoss: +cl.toFixed(2),
        contribution: +(cl - el).toFixed(2),
      };
    });

    const creditVaR = totalConditionalLoss - totalExpectedLoss;

    return {
      creditVaR: +creditVaR.toFixed(2),
      expectedLoss: +totalExpectedLoss.toFixed(2),
      unexpectedLoss: +creditVaR.toFixed(2),
      contributions,
    };
  }

  /**
   * Compute portfolio-level expected loss without VaR.
   */
  computeExpectedLoss(exposures: CreditVaRExposure[], horizon: number = 1): number {
    let total = 0;
    for (const exp of exposures) {
      const pdH = 1 - Math.pow(1 - exp.pd, horizon);
      total += exp.balance * exp.lgd * pdH;
    }
    return +total.toFixed(2);
  }

  // ─── Normal Distribution Utilities ────────────────────────

  /** Standard normal CDF (Abramowitz & Stegun approximation) */
  private normCdf(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    const absX = Math.abs(x);
    const t = 1 / (1 + p * absX);
    const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2);
    return 0.5 * (1 + sign * y);
  }

  /** Inverse standard normal CDF (Beasley-Springer-Moro approximation) */
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
