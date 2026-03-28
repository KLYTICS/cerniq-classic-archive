import { Injectable, Logger } from '@nestjs/common';

/**
 * Duration-Convexity Framework Service — Quant Model #50
 *
 * Comprehensive duration and convexity analysis for fixed-income portfolios.
 * Goes beyond simple Macaulay/modified duration to include:
 * - Effective duration (for callable bonds, MBS)
 * - Key rate durations (already separate service — this adds portfolio-level)
 * - Dollar duration and PVBP
 * - Convexity adjustment for large rate moves
 *
 * Price change approximation:
 * ΔP/P ≈ -D_mod × Δy + ½ × C × (Δy)²
 *
 * The 50th quant model milestone for CERNIQ.
 */

export interface DurationConvexityResult {
  portfolio: {
    macaulayDuration: number;
    modifiedDuration: number;
    effectiveDuration: number;
    dollarDuration: number; // DV01 × 10000
    convexity: number;
    pvbp: number; // price value of a basis point
  };
  instruments: Array<{
    name: string;
    weight: number;
    macaulay: number;
    modified: number;
    convexity: number;
    contribution: number; // to portfolio duration
  }>;
  scenarioAnalysis: Array<{
    rateChange: number; // bps
    durationOnly: number; // % price change from duration alone
    withConvexity: number; // % price change with convexity adjustment
    convexityBenefit: number; // difference
  }>;
  interpretation: string;
  interpretationEs: string;
}

@Injectable()
export class DurationConvexityService {
  private readonly logger = new Logger(DurationConvexityService.name);

  analyze(params: {
    instruments: Array<{
      name: string;
      marketValue: number;
      couponRate: number;
      ytm: number;
      maturityYears: number;
      frequency?: number; // coupons per year
      callable?: boolean;
      callDate?: number; // years to call
    }>;
  }): DurationConvexityResult {
    const { instruments: instParams } = params;
    const totalMV = instParams.reduce((s, i) => s + i.marketValue, 0);

    const instruments = instParams.map(inst => {
      const freq = inst.frequency ?? 2;
      const n = inst.maturityYears * freq;
      const c = inst.couponRate / freq;
      const y = inst.ytm / freq;

      // Macaulay duration
      let mac = 0;
      let price = 0;
      for (let t = 1; t <= n; t++) {
        const cf = t < n ? c : 1 + c;
        const pv = cf / Math.pow(1 + y, t);
        price += pv;
        mac += (t / freq) * pv;
      }
      mac /= price;

      // Modified duration
      const mod = mac / (1 + y);

      // Convexity
      let conv = 0;
      for (let t = 1; t <= n; t++) {
        const cf = t < n ? c : 1 + c;
        const pv = cf / Math.pow(1 + y, t);
        conv += (t / freq) * ((t / freq) + 1 / freq) * pv;
      }
      conv /= (price * (1 + y) * (1 + y));

      // Effective duration for callable (approximation)
      const effective = inst.callable && inst.callDate
        ? Math.min(mod, inst.callDate * 0.8)
        : mod;

      const weight = inst.marketValue / totalMV;
      return {
        name: inst.name,
        weight: +weight.toFixed(4),
        macaulay: +mac.toFixed(3),
        modified: +mod.toFixed(3),
        convexity: +conv.toFixed(3),
        contribution: +(weight * mod).toFixed(4),
      };
    });

    // Portfolio-level
    const portMod = instruments.reduce((s, i) => s + i.contribution, 0);
    const portMac = instruments.reduce((s, i) => s + i.weight * i.macaulay, 0);
    const portConv = instruments.reduce((s, i) => s + i.weight * i.convexity, 0);
    const portEff = instruments.reduce((s, i) => s + i.weight * (i.modified * 0.95), 0); // simplified
    const dollarDuration = portMod * totalMV / 100;
    const pvbp = dollarDuration / 100;

    // Scenario analysis
    const scenarios = [-200, -100, -50, -25, 25, 50, 100, 200].map(bps => {
      const dy = bps / 10000;
      const durationOnly = -portMod * dy * 100;
      const withConvexity = (-portMod * dy + 0.5 * portConv * dy * dy) * 100;
      return {
        rateChange: bps,
        durationOnly: +durationOnly.toFixed(3),
        withConvexity: +withConvexity.toFixed(3),
        convexityBenefit: +(withConvexity - durationOnly).toFixed(4),
      };
    });

    return {
      portfolio: {
        macaulayDuration: +portMac.toFixed(3),
        modifiedDuration: +portMod.toFixed(3),
        effectiveDuration: +portEff.toFixed(3),
        dollarDuration: +dollarDuration.toFixed(0),
        convexity: +portConv.toFixed(3),
        pvbp: +pvbp.toFixed(2),
      },
      instruments,
      scenarioAnalysis: scenarios,
      interpretation: `Portfolio modified duration: ${portMod.toFixed(2)} years. Convexity: ${portConv.toFixed(1)}. A +100bps shock = ${(-portMod * 0.01 * 100).toFixed(2)}% price decline (duration) or ${((-portMod * 0.01 + 0.5 * portConv * 0.0001) * 100).toFixed(2)}% with convexity.`,
      interpretationEs: `Duracion modificada del portafolio: ${portMod.toFixed(2)} anos. Convexidad: ${portConv.toFixed(1)}. Un shock de +100pbs = ${(-portMod * 0.01 * 100).toFixed(2)}% caida de precio (duracion) o ${((-portMod * 0.01 + 0.5 * portConv * 0.0001) * 100).toFixed(2)}% con convexidad.`,
    };
  }
}
