import { Injectable } from '@nestjs/common';

/**
 * Z-Spread (Zero-Volatility Spread) Calculator — Quant Model #54
 *
 * The constant spread added to each spot rate on the zero curve
 * that makes the discounted cash flows equal the bond's market price.
 *
 * P = Σ CF_i / (1 + z_i + Z)^t_i
 * Solve for Z (z-spread) via Newton-Raphson.
 */
@Injectable()
export class ZSpreadService {
  calculate(params: {
    marketPrice: number;
    parValue: number;
    couponRate: number;
    maturityYears: number;
    frequency?: number;
    zeroCurve: Array<{ tenor: number; rate: number }>;
  }): { zSpread: number; zSpreadBps: number; iterations: number; interpretation: string; interpretationEs: string } {
    const { marketPrice, parValue, couponRate, maturityYears, frequency = 2, zeroCurve } = params;
    const n = maturityYears * frequency;
    const coupon = parValue * couponRate / frequency;

    let zSpread = 0.005; // initial guess 50bps
    for (let iter = 0; iter < 100; iter++) {
      let price = 0;
      let dPrice = 0;
      for (let i = 1; i <= n; i++) {
        const t = i / frequency;
        const cf = i < n ? coupon : coupon + parValue;
        const spotRate = this.interpolate(zeroCurve, t);
        const discount = Math.pow(1 + (spotRate + zSpread) / frequency, -i);
        price += cf * discount;
        dPrice -= cf * (i / frequency) * discount / (1 + (spotRate + zSpread) / frequency);
      }
      const error = price - marketPrice;
      if (Math.abs(error) < 0.0001) {
        return {
          zSpread: +zSpread.toFixed(6),
          zSpreadBps: +(zSpread * 10000).toFixed(1),
          iterations: iter + 1,
          interpretation: `Z-spread: ${(zSpread * 10000).toFixed(0)} bps over the zero curve. This represents the credit + liquidity premium embedded in the bond price.`,
          interpretationEs: `Z-spread: ${(zSpread * 10000).toFixed(0)} pbs sobre la curva cero. Representa la prima de credito + liquidez implícita en el precio del bono.`,
        };
      }
      zSpread -= error / dPrice;
    }
    return { zSpread: +zSpread.toFixed(6), zSpreadBps: +(zSpread * 10000).toFixed(1), iterations: 100, interpretation: 'Convergence not achieved', interpretationEs: 'Convergencia no alcanzada' };
  }

  private interpolate(curve: Array<{ tenor: number; rate: number }>, t: number): number {
    if (t <= curve[0].tenor) return curve[0].rate;
    if (t >= curve[curve.length - 1].tenor) return curve[curve.length - 1].rate;
    for (let i = 1; i < curve.length; i++) {
      if (t <= curve[i].tenor) {
        const w = (t - curve[i - 1].tenor) / (curve[i].tenor - curve[i - 1].tenor);
        return curve[i - 1].rate + w * (curve[i].rate - curve[i - 1].rate);
      }
    }
    return curve[curve.length - 1].rate;
  }
}
