import { Injectable } from '@nestjs/common';

/**
 * Rate Lock / Pipeline Exposure — Quant Model #75
 *
 * Measures the interest rate risk from loan commitments (rate locks)
 * that haven't funded yet. Critical for mortgage-heavy cooperativas.
 */
@Injectable()
export class RateLockExposureService {
  analyze(params: {
    locks: Array<{
      type: string;
      amount: number;
      rate: number;
      daysToClose: number;
      pullThroughPct: number;
    }>;
    currentMarketRate: number;
  }): {
    totalPipeline: number;
    expectedFunding: number;
    rateExposure: number; // dollar risk from rate move
    locks: Array<{
      type: string;
      amount: number;
      rate: number;
      marketRate: number;
      gapBps: number;
      expectedAmount: number;
      exposure: number;
    }>;
    interpretation: string;
    interpretationEs: string;
  } {
    const enriched = params.locks.map((l) => {
      const gapBps = +((l.rate - params.currentMarketRate) * 10000).toFixed(0);
      const expectedAmount = +((l.amount * l.pullThroughPct) / 100).toFixed(0);
      const exposure = +(
        ((expectedAmount * Math.abs(gapBps)) / 10000) *
        (l.daysToClose / 365)
      ).toFixed(0);
      return {
        ...l,
        marketRate: params.currentMarketRate,
        gapBps,
        expectedAmount,
        exposure,
      };
    });
    const totalPipeline = enriched.reduce((s, l) => s + l.amount, 0);
    const expectedFunding = enriched.reduce((s, l) => s + l.expectedAmount, 0);
    const rateExposure = enriched.reduce((s, l) => s + l.exposure, 0);

    return {
      totalPipeline,
      expectedFunding,
      rateExposure,
      locks: enriched,
      interpretation: `Pipeline: $${(totalPipeline / 1e6).toFixed(0)}M. Expected funding: $${(expectedFunding / 1e6).toFixed(0)}M. Rate exposure: $${(rateExposure / 1e3).toFixed(0)}K.`,
      interpretationEs: `Pipeline: $${(totalPipeline / 1e6).toFixed(0)}M. Fondeo esperado: $${(expectedFunding / 1e6).toFixed(0)}M. Exposicion tasa: $${(rateExposure / 1e3).toFixed(0)}K.`,
    };
  }
}
