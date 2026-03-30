import { Injectable, Logger } from '@nestjs/common';

/**
 * Term Premium Estimation Engine — Quant Model
 *
 * Estimates the term premium embedded in the yield curve using an
 * Adrian-Crump-Moench (ACM) inspired decomposition.
 *
 * For each maturity n:
 *   Expected Rate Component = average of 1-year forward rates up to n
 *   Term Premium = Observed Yield(n) - Expected Rate Component(n)
 *
 * The term premium compensates investors for bearing duration risk
 * beyond what is explained by expected future short rates.
 *
 * Designed for cooperativa investment committees evaluating bond
 * portfolio positioning.
 */

// ─── Input Types ────────────────────────────────────────────────────

export interface YieldPoint {
  maturity: number; // in years
  rate: number;
}

export interface TermPremiumParams {
  yields: YieldPoint[];
}

// ─── Output Types ───────────────────────────────────────────────────

export interface TermPremiumPoint {
  maturity: number;
  premium: number;
}

export interface ExpectedRatePoint {
  maturity: number;
  expectedRate: number;
}

export interface TermPremiumResult {
  termPremiums: TermPremiumPoint[];
  averagePremium: number;
  expectedRateComponent: ExpectedRatePoint[];
  curveSlope: number;
}

// ─── Service ────────────────────────────────────────────────────────

@Injectable()
export class TermPremiumService {
  private readonly logger = new Logger(TermPremiumService.name);

  /**
   * Estimate term premiums across the yield curve.
   *
   * Uses a simplified ACM-style decomposition: implied forward rates
   * from the observed curve define the "expected rate" component, and
   * the term premium is the residual.
   */
  estimateTermPremium(params: TermPremiumParams): TermPremiumResult {
    const { yields } = params;

    if (yields.length < 2) {
      throw new Error('At least two yield points are required');
    }

    const sorted = [...yields].sort((a, b) => a.maturity - b.maturity);
    const shortRate = sorted[0].rate;

    // Compute implied forward rates between consecutive maturities
    const forwardRates: number[] = [shortRate];
    for (let i = 1; i < sorted.length; i++) {
      // f(t1,t2) = [y(t2)*t2 - y(t1)*t1] / (t2 - t1)
      const y1 = sorted[i - 1].rate;
      const t1 = sorted[i - 1].maturity;
      const y2 = sorted[i].rate;
      const t2 = sorted[i].maturity;
      const fwd = (y2 * t2 - y1 * t1) / (t2 - t1);
      forwardRates.push(fwd);
    }

    // Expected rate component = average of forward rates up to each maturity
    const expectedRateComponent: ExpectedRatePoint[] = [];
    const termPremiums: TermPremiumPoint[] = [];

    for (let i = 0; i < sorted.length; i++) {
      // Average of forwards from 0 to i
      const avgForward =
        forwardRates.slice(0, i + 1).reduce((s, f) => s + f, 0) / (i + 1);

      expectedRateComponent.push({
        maturity: sorted[i].maturity,
        expectedRate: this.round6(avgForward),
      });

      const premium = sorted[i].rate - avgForward;
      termPremiums.push({
        maturity: sorted[i].maturity,
        premium: this.round6(premium),
      });
    }

    const averagePremium =
      termPremiums.reduce((s, tp) => s + tp.premium, 0) / termPremiums.length;

    const curveSlope = sorted[sorted.length - 1].rate - sorted[0].rate;

    this.logger.log(
      `Term premium estimation: ${sorted.length} maturities, avgPremium=${this.round6(averagePremium)}, slope=${this.round6(curveSlope)}`,
    );

    return {
      termPremiums,
      averagePremium: this.round6(averagePremium),
      expectedRateComponent,
      curveSlope: this.round6(curveSlope),
    };
  }

  /**
   * Check whether the term premium structure indicates curve inversion risk.
   */
  assessInversionRisk(params: TermPremiumParams): {
    inverted: boolean;
    inversionPoints: number[];
    flatteningZones: number[];
  } {
    this.estimateTermPremium(params);
    const sorted = [...params.yields].sort((a, b) => a.maturity - b.maturity);

    const inversionPoints: number[] = [];
    const flatteningZones: number[] = [];

    for (let i = 1; i < sorted.length; i++) {
      const slope = sorted[i].rate - sorted[i - 1].rate;
      if (slope < 0) {
        inversionPoints.push(sorted[i].maturity);
      } else if (Math.abs(slope) < 0.001) {
        flatteningZones.push(sorted[i].maturity);
      }
    }

    return {
      inverted: inversionPoints.length > 0,
      inversionPoints,
      flatteningZones,
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────

  private round6(n: number): number {
    return Math.round(n * 1_000_000) / 1_000_000;
  }
}
