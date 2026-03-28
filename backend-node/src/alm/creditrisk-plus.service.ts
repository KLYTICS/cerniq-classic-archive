import { Injectable, Logger } from '@nestjs/common';

/**
 * CreditRisk+ (Poisson) Model — Quant Model #44
 *
 * Credit Suisse's actuarial approach to credit portfolio risk.
 * Models number of defaults as a Poisson process, loss severity
 * as a fixed percentage (LGD), and aggregates via Panjer recursion.
 *
 * Key advantage over CreditMetrics: no correlation matrix needed.
 * Defaults are driven by a common systematic factor (sector risk).
 *
 * Use case: CECL loss distribution, economic capital calculation,
 * COSSEC exam stress testing of loan portfolios.
 */

export interface CreditRiskPlusResult {
  expectedLoss: number;
  unexpectedLoss: number;
  economicCapital: number; // at 99.9% confidence
  lossDistribution: Array<{
    lossAmount: number;
    probability: number;
    cumulative: number;
  }>;
  sectorContributions: Array<{
    sector: string;
    sectorEs: string;
    exposure: number;
    expectedDefault: number;
    contribution: number;
  }>;
  var99: number;
  var999: number;
  interpretation: string;
  interpretationEs: string;
}

@Injectable()
export class CreditRiskPlusService {
  private readonly logger = new Logger(CreditRiskPlusService.name);

  analyze(params: {
    segments: Array<{
      name: string;
      nameEs: string;
      exposure: number;
      pd: number; // probability of default
      lgd: number; // loss given default (0-1)
      count: number; // number of obligors
    }>;
    confidenceLevel?: number;
  }): CreditRiskPlusResult {
    const { segments, confidenceLevel = 0.999 } = params;

    // Expected loss per segment
    const segmentResults = segments.map((seg) => {
      const el = seg.exposure * seg.pd * seg.lgd;
      const lambda = seg.count * seg.pd; // expected number of defaults
      return { ...seg, expectedLoss: el, lambda };
    });

    const totalEL = segmentResults.reduce((s, r) => s + r.expectedLoss, 0);
    const totalLambda = segmentResults.reduce((s, r) => s + r.lambda, 0);

    // Poisson loss distribution via Panjer recursion
    const maxLossBuckets = 200;
    const bucketSize = (totalEL * 5) / maxLossBuckets; // cover up to 5x EL
    const distribution: Array<{
      lossAmount: number;
      probability: number;
      cumulative: number;
    }> = [];

    // Compound Poisson approximation
    const probs = new Array(maxLossBuckets).fill(0);
    probs[0] = Math.exp(-totalLambda); // P(0 defaults)

    for (let k = 1; k < maxLossBuckets; k++) {
      // Panjer recursion: P(k) = (λ/k) * Σ j*f(j)*P(k-j)
      let sum = 0;
      for (let j = 1; j <= Math.min(k, 20); j++) {
        const severity = j * bucketSize;
        const severityProb =
          Math.exp(-severity / (totalEL || 1)) / (totalEL || 1);
        sum += j * severityProb * probs[k - j];
      }
      probs[k] = (totalLambda / k) * sum;
      if (isNaN(probs[k]) || !isFinite(probs[k])) probs[k] = 0;
    }

    // Normalize
    const totalProb = probs.reduce((s, p) => s + p, 0);
    if (totalProb > 0) probs.forEach((_, i) => (probs[i] /= totalProb));

    let cumulative = 0;
    for (let i = 0; i < maxLossBuckets; i++) {
      cumulative += probs[i];
      distribution.push({
        lossAmount: +(i * bucketSize),
        probability: +probs[i].toFixed(8),
        cumulative: +Math.min(cumulative, 1).toFixed(6),
      });
    }

    // VaR at confidence levels
    const var99 = this.findVaR(distribution, 0.99);
    const var999 = this.findVaR(distribution, confidenceLevel);
    const unexpectedLoss = var999 - totalEL;
    const economicCapital = unexpectedLoss;

    const sectorContributions = segmentResults.map((s) => ({
      sector: s.name,
      sectorEs: s.nameEs,
      exposure: s.exposure,
      expectedDefault: s.lambda,
      contribution: s.expectedLoss / (totalEL || 1),
    }));

    return {
      expectedLoss: +totalEL.toFixed(2),
      unexpectedLoss: +unexpectedLoss.toFixed(2),
      economicCapital: +economicCapital.toFixed(2),
      lossDistribution: distribution.slice(0, 50),
      sectorContributions,
      var99: +var99.toFixed(2),
      var999: +var999.toFixed(2),
      interpretation: `Expected loss: $${(totalEL / 1e6).toFixed(1)}M. VaR(99.9%): $${(var999 / 1e6).toFixed(1)}M. Economic capital required: $${(economicCapital / 1e6).toFixed(1)}M.`,
      interpretationEs: `Perdida esperada: $${(totalEL / 1e6).toFixed(1)}M. VaR(99.9%): $${(var999 / 1e6).toFixed(1)}M. Capital economico requerido: $${(economicCapital / 1e6).toFixed(1)}M.`,
    };
  }

  private findVaR(
    dist: Array<{ lossAmount: number; cumulative: number }>,
    level: number,
  ): number {
    for (const d of dist) {
      if (d.cumulative >= level) return d.lossAmount;
    }
    return dist[dist.length - 1]?.lossAmount ?? 0;
  }
}
