import { Injectable, Logger } from '@nestjs/common';

/**
 * Vasicek-Fong Yield Curve Model — Quant Model #46
 *
 * Cubic spline interpolation of the discount function with
 * smoothness penalty. More flexible than Nelson-Siegel for
 * fitting complex/kinked yield curves.
 *
 * Used by central banks and large dealers for curve construction.
 * Fits through observed points exactly while minimizing curvature.
 *
 * D(t) = discount function fitted via natural cubic spline
 * y(t) = -ln(D(t))/t = zero rate
 */

export interface VasicekFongResult {
  knots: Array<{ tenor: number; rate: number; discountFactor: number }>;
  interpolatedCurve: Array<{
    tenor: number;
    rate: number;
    forwardRate: number;
  }>;
  smoothnessMetric: number;
  maxError: number;
  interpretation: string;
  interpretationEs: string;
}

@Injectable()
export class VasicekFongService {
  private readonly logger = new Logger(VasicekFongService.name);

  fitCurve(
    observedRates: Array<{ tenor: number; rate: number }>,
  ): VasicekFongResult {
    if (observedRates.length < 3) return this.getDemoResult();

    const sorted = [...observedRates].sort((a, b) => a.tenor - b.tenor);
    const n = sorted.length;

    // Convert to discount factors
    const knots = sorted.map((p) => ({
      tenor: p.tenor,
      rate: p.rate,
      discountFactor: Math.exp(-p.rate * p.tenor),
    }));

    // Natural cubic spline on discount factors
    const x = sorted.map((p) => p.tenor);
    const y = knots.map((k) => k.discountFactor);
    const spline = this.naturalCubicSpline(x, y);

    // Interpolate at fine grid
    const maxT = x[x.length - 1];
    const interpolatedCurve: VasicekFongResult['interpolatedCurve'] = [];
    const step = maxT / 120;

    for (let t = step; t <= maxT; t += step) {
      const df = this.evaluateSpline(spline, x, t);
      const rate = -Math.log(Math.max(df, 1e-10)) / t;
      // Forward rate: f(t) = -d/dt ln(D(t))
      const dfPlus = this.evaluateSpline(spline, x, t + 0.001);
      const forwardRate = -Math.log(dfPlus / df) / 0.001;

      interpolatedCurve.push({
        tenor: +t.toFixed(3),
        rate: +rate.toFixed(6),
        forwardRate: +forwardRate.toFixed(6),
      });
    }

    // Compute smoothness (integral of second derivative squared)
    let smoothness = 0;
    for (let i = 0; i < interpolatedCurve.length - 2; i++) {
      const d2 =
        interpolatedCurve[i + 2].rate -
        2 * interpolatedCurve[i + 1].rate +
        interpolatedCurve[i].rate;
      smoothness += d2 * d2;
    }

    // Max fitting error
    let maxError = 0;
    for (const obs of sorted) {
      const fitted = interpolatedCurve.reduce((best, p) =>
        Math.abs(p.tenor - obs.tenor) < Math.abs(best.tenor - obs.tenor)
          ? p
          : best,
      );
      maxError = Math.max(maxError, Math.abs(fitted.rate - obs.rate));
    }

    return {
      knots,
      interpolatedCurve,
      smoothnessMetric: +smoothness.toFixed(10),
      maxError: +(maxError * 10000).toFixed(2), // in bps
      interpretation: `Vasicek-Fong spline fit with ${n} knot points. Max error: ${(maxError * 10000).toFixed(1)} bps. Smoothness: ${smoothness.toExponential(2)}.`,
      interpretationEs: `Ajuste spline Vasicek-Fong con ${n} puntos nodo. Error max: ${(maxError * 10000).toFixed(1)} pbs. Suavidad: ${smoothness.toExponential(2)}.`,
    };
  }

  private naturalCubicSpline(
    x: number[],
    y: number[],
  ): { a: number[]; b: number[]; c: number[]; d: number[] } {
    const n = x.length - 1;
    const h = x.map((_, i) => (i < n ? x[i + 1] - x[i] : 0));
    const a = [...y];
    const alpha: number[] = new Array(n + 1).fill(0);

    for (let i = 1; i < n; i++) {
      alpha[i] =
        (3 / h[i]) * (a[i + 1] - a[i]) - (3 / h[i - 1]) * (a[i] - a[i - 1]);
    }

    const c: number[] = new Array(n + 1).fill(0);
    const l: number[] = new Array(n + 1).fill(1);
    const mu: number[] = new Array(n + 1).fill(0);
    const z: number[] = new Array(n + 1).fill(0);

    for (let i = 1; i < n; i++) {
      l[i] = 2 * (x[i + 1] - x[i - 1]) - h[i - 1] * mu[i - 1];
      mu[i] = h[i] / l[i];
      z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
    }

    const b: number[] = new Array(n).fill(0);
    const d: number[] = new Array(n).fill(0);

    for (let j = n - 1; j >= 0; j--) {
      c[j] = z[j] - mu[j] * c[j + 1];
      b[j] = (a[j + 1] - a[j]) / h[j] - (h[j] * (c[j + 1] + 2 * c[j])) / 3;
      d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
    }

    return { a, b, c, d };
  }

  private evaluateSpline(
    spline: { a: number[]; b: number[]; c: number[]; d: number[] },
    x: number[],
    t: number,
  ): number {
    let i = x.length - 2;
    for (let j = 0; j < x.length - 1; j++) {
      if (t <= x[j + 1]) {
        i = j;
        break;
      }
    }
    const dx = t - x[i];
    return (
      spline.a[i] +
      spline.b[i] * dx +
      spline.c[i] * dx * dx +
      spline.d[i] * dx * dx * dx
    );
  }

  private getDemoResult(): VasicekFongResult {
    const obs = [
      { tenor: 0.25, rate: 0.048 },
      { tenor: 0.5, rate: 0.0465 },
      { tenor: 1, rate: 0.044 },
      { tenor: 2, rate: 0.042 },
      { tenor: 3, rate: 0.041 },
      { tenor: 5, rate: 0.0405 },
      { tenor: 7, rate: 0.041 },
      { tenor: 10, rate: 0.042 },
      { tenor: 20, rate: 0.0455 },
      { tenor: 30, rate: 0.0465 },
    ];
    return this.fitCurve(obs);
  }
}
