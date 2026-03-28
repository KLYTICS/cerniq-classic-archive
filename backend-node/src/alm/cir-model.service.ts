import { Injectable, Logger } from '@nestjs/common';

/**
 * Cox-Ingersoll-Ross (CIR) Short-Rate Model — Quant Model #47
 *
 * dr = a(b - r)dt + σ√r dW
 *
 * Mean-reverting with rate-dependent volatility (√r ensures non-negative rates).
 * More realistic than Vasicek for low-rate environments.
 *
 * Use cases:
 * - Term structure modeling with guaranteed positive rates
 * - Bond option pricing (Feller condition: 2ab > σ²)
 * - EVE sensitivity analysis
 */

export interface CIRResult {
  params: { a: number; b: number; sigma: number; fellerSatisfied: boolean };
  simulation: {
    meanPath: number[];
    percentiles: Record<string, number[]>;
    samplePaths: number[][];
  };
  bondPrices: Array<{ maturity: number; price: number; yield_: number }>;
  interpretation: string;
  interpretationEs: string;
}

@Injectable()
export class CIRModelService {
  private readonly logger = new Logger(CIRModelService.name);

  simulate(params: {
    r0?: number; a?: number; b?: number; sigma?: number;
    horizonYears?: number; numPaths?: number; dt?: number;
  }): CIRResult {
    const { r0 = 0.045, a = 0.15, b = 0.04, sigma = 0.06, horizonYears = 5, numPaths = 1000, dt = 1/252 } = params;
    const steps = Math.round(horizonYears / dt);
    const fellerSatisfied = 2 * a * b > sigma * sigma;

    const paths: number[][] = [];
    const allFinals: number[] = [];

    for (let p = 0; p < numPaths; p++) {
      const path: number[] = [r0];
      let r = r0;
      for (let t = 0; t < steps; t++) {
        const dW = this.gaussianRandom() * Math.sqrt(dt);
        r = r + a * (b - r) * dt + sigma * Math.sqrt(Math.max(r, 0)) * dW;
        r = Math.max(r, 0);
        if (p < 5 && t % 63 === 0) path.push(r); // quarterly for display
      }
      if (p < 5) paths.push(path);
      allFinals.push(r);
    }

    const quarterlySteps = Math.ceil(horizonYears * 4) + 1;
    const meanPath = Array.from({ length: quarterlySteps }, (_, i) => {
      const t = i * 0.25;
      return r0 * Math.exp(-a * t) + b * (1 - Math.exp(-a * t));
    });

    const percentiles: Record<string, number[]> = {};
    for (const pct of [5, 25, 50, 75, 95]) {
      percentiles[`p${pct}`] = meanPath.map((m, i) => {
        const t = i * 0.25;
        const variance = (sigma * sigma * b / (2 * a)) * (1 - Math.exp(-a * t)) ** 2;
        const z = pct === 50 ? 0 : pct < 50 ? -this.normalInv(1 - pct/100) : this.normalInv(pct/100);
        return Math.max(0, m + z * Math.sqrt(Math.max(variance, 0)));
      });
    }

    // Closed-form bond prices: P(t,T) = A(t,T) × exp(-B(t,T) × r)
    const bondPrices = [0.5, 1, 2, 3, 5, 7, 10].map(T => {
      const h = Math.sqrt(a * a + 2 * sigma * sigma);
      const BtT = 2 * (Math.exp(h * T) - 1) / ((h + a) * (Math.exp(h * T) - 1) + 2 * h);
      const AtT = Math.pow(2 * h * Math.exp((a + h) * T / 2) / ((h + a) * (Math.exp(h * T) - 1) + 2 * h), 2 * a * b / (sigma * sigma));
      const price = AtT * Math.exp(-BtT * r0);
      const yield_ = -Math.log(price) / T;
      return { maturity: T, price: +price.toFixed(6), yield_: +yield_.toFixed(6) };
    });

    return {
      params: { a, b, sigma, fellerSatisfied },
      simulation: { meanPath, percentiles, samplePaths: paths },
      bondPrices,
      interpretation: `CIR model: mean reversion a=${a}, long-run rate b=${(b*100).toFixed(1)}%, vol σ=${sigma}. Feller condition ${fellerSatisfied ? 'SATISFIED' : 'VIOLATED'} (2ab=${(2*a*b).toFixed(4)} vs σ²=${(sigma*sigma).toFixed(4)}).`,
      interpretationEs: `Modelo CIR: reversion media a=${a}, tasa largo plazo b=${(b*100).toFixed(1)}%, vol σ=${sigma}. Condicion Feller ${fellerSatisfied ? 'SATISFECHA' : 'VIOLADA'} (2ab=${(2*a*b).toFixed(4)} vs σ²=${(sigma*sigma).toFixed(4)}).`,
    };
  }

  private gaussianRandom(): number {
    const u1 = Math.random(); const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  private normalInv(p: number): number {
    // Rational approximation (Abramowitz & Stegun)
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];

    const pLow = 0.02425; const pHigh = 1 - pLow;
    let q: number, r: number;

    if (p < pLow) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
    } else if (p <= pHigh) {
      q = p - 0.5; r = q * q;
      return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
    }
  }
}
