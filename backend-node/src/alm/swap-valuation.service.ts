import { Injectable, Logger } from '@nestjs/common';

/**
 * Interest Rate Swap (IRS) Valuation Service — Quant Model #43
 *
 * Values plain-vanilla fixed-for-floating interest rate swaps
 * using the bootstrapped zero curve and forward rates.
 *
 * V_swap = Σ(Fixed_CF - Floating_CF) × DF(t_i)
 *
 * Use cases for cooperativas:
 * - Hedge interest rate risk on fixed-rate loan portfolios
 * - Convert floating-rate borrowings to fixed
 * - COSSEC exam: "What is the mark-to-market of your derivatives?"
 */

export interface SwapLeg {
  periods: Array<{
    period: number;
    startDate: string;
    endDate: string;
    rate: number;
    cashFlow: number;
    discountFactor: number;
    presentValue: number;
  }>;
  totalPV: number;
}

export interface SwapValuationResult {
  notional: number;
  fixedRate: number;
  floatingSpread: number;
  maturityYears: number;
  frequency: 'quarterly' | 'semiannual' | 'annual';
  fixedLeg: SwapLeg;
  floatingLeg: SwapLeg;
  npv: number; // positive = asset to fixed-rate payer
  dv01: number; // dollar value of 1bp move
  duration: number; // modified duration of the swap
  interpretation: string;
  interpretationEs: string;
}

@Injectable()
export class SwapValuationService {
  private readonly logger = new Logger(SwapValuationService.name);

  valueSwap(params: {
    notional: number;
    fixedRate: number;
    floatingSpread?: number;
    maturityYears: number;
    frequency?: 'quarterly' | 'semiannual' | 'annual';
    zeroCurve?: Array<{ tenor: number; rate: number }>;
  }): SwapValuationResult {
    const {
      notional,
      fixedRate,
      floatingSpread = 0,
      maturityYears,
      frequency = 'semiannual',
    } = params;

    const zeroCurve = params.zeroCurve || this.getDefaultZeroCurve();
    const periodsPerYear =
      frequency === 'quarterly' ? 4 : frequency === 'semiannual' ? 2 : 1;
    const totalPeriods = maturityYears * periodsPerYear;
    const dt = 1 / periodsPerYear;

    // Build fixed leg
    const fixedLeg: SwapLeg = { periods: [], totalPV: 0 };
    const floatingLeg: SwapLeg = { periods: [], totalPV: 0 };

    for (let i = 1; i <= totalPeriods; i++) {
      const t = i * dt;

      // Discount factor from zero curve (linear interpolation)
      const zeroRate = this.interpolateRate(zeroCurve, t);
      const df = Math.exp(-zeroRate * t);

      // Fixed leg cash flow
      const fixedCF = notional * fixedRate * dt;
      const fixedPV = fixedCF * df;
      fixedLeg.periods.push({
        period: i,
        startDate: `T+${((i - 1) * dt).toFixed(2)}`,
        endDate: `T+${(i * dt).toFixed(2)}`,
        rate: fixedRate,
        cashFlow: fixedCF,
        discountFactor: +df.toFixed(6),
        presentValue: fixedPV,
      });
      fixedLeg.totalPV += fixedPV;

      // Floating leg: forward rate from zero curve
      const tPrev = (i - 1) * dt;
      const zeroPrev =
        i === 1 ? 0 : this.interpolateRate(zeroCurve, tPrev) * tPrev;
      const zeroCurr = zeroRate * t;
      const forwardRate = (zeroCurr - zeroPrev) / dt;
      const floatingRate = forwardRate + floatingSpread;
      const floatCF = notional * floatingRate * dt;
      const floatPV = floatCF * df;
      floatingLeg.periods.push({
        period: i,
        startDate: `T+${((i - 1) * dt).toFixed(2)}`,
        endDate: `T+${(i * dt).toFixed(2)}`,
        rate: +floatingRate.toFixed(6),
        cashFlow: floatCF,
        discountFactor: +df.toFixed(6),
        presentValue: floatPV,
      });
      floatingLeg.totalPV += floatPV;
    }

    const npv = floatingLeg.totalPV - fixedLeg.totalPV;

    // DV01: shift curve by 1bp and revalue
    const shiftedCurve = zeroCurve.map((p) => ({
      tenor: p.tenor,
      rate: p.rate + 0.0001,
    }));
    const shiftedResult = this.valueSwap({
      ...params,
      zeroCurve: shiftedCurve,
    });
    const dv01 = Math.abs(shiftedResult.npv - npv);
    const duration = (dv01 / Math.abs(npv || 1)) * 10000;

    return {
      notional,
      fixedRate,
      floatingSpread,
      maturityYears,
      frequency,
      fixedLeg,
      floatingLeg,
      npv: +npv.toFixed(2),
      dv01: +dv01.toFixed(2),
      duration: +duration.toFixed(2),
      interpretation: `Swap NPV: $${(npv / 1_000_000).toFixed(2)}M (${npv > 0 ? 'asset' : 'liability'} to fixed-rate payer). DV01: $${(dv01 / 1000).toFixed(1)}K per basis point.`,
      interpretationEs: `VPN del swap: $${(npv / 1_000_000).toFixed(2)}M (${npv > 0 ? 'activo' : 'pasivo'} para pagador de tasa fija). DV01: $${(dv01 / 1000).toFixed(1)}K por punto basico.`,
    };
  }

  private interpolateRate(
    curve: Array<{ tenor: number; rate: number }>,
    t: number,
  ): number {
    if (t <= curve[0].tenor) return curve[0].rate;
    if (t >= curve[curve.length - 1].tenor) return curve[curve.length - 1].rate;
    for (let i = 1; i < curve.length; i++) {
      if (t <= curve[i].tenor) {
        const w =
          (t - curve[i - 1].tenor) / (curve[i].tenor - curve[i - 1].tenor);
        return curve[i - 1].rate + w * (curve[i].rate - curve[i - 1].rate);
      }
    }
    return curve[curve.length - 1].rate;
  }

  private getDefaultZeroCurve(): Array<{ tenor: number; rate: number }> {
    return [
      { tenor: 0.25, rate: 0.048 },
      { tenor: 0.5, rate: 0.0465 },
      { tenor: 1, rate: 0.044 },
      { tenor: 2, rate: 0.042 },
      { tenor: 3, rate: 0.041 },
      { tenor: 5, rate: 0.0405 },
      { tenor: 7, rate: 0.041 },
      { tenor: 10, rate: 0.042 },
    ];
  }
}
