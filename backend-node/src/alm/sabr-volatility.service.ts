import { Injectable, Logger } from '@nestjs/common';

/**
 * SABR Stochastic Volatility Model — Quant Model #49
 *
 * Stochastic Alpha Beta Rho model for the volatility smile.
 * dF = σ × F^β × dW₁
 * dσ = α × σ × dW₂
 * <dW₁, dW₂> = ρ dt
 *
 * Parameters:
 * - α (alpha): vol of vol
 * - β (beta): CEV exponent (0=normal, 1=lognormal)
 * - ρ (rho): correlation between forward and vol
 * - σ₀: initial volatility
 *
 * Industry standard for swaption and cap/floor vol surfaces.
 * Used to interpolate/extrapolate implied vols across strikes.
 */

export interface SABRResult {
  params: { alpha: number; beta: number; rho: number; sigma0: number; forward: number };
  volSmile: Array<{ strike: number; impliedVol: number; moneyness: number }>;
  skewMetrics: {
    atmVol: number;
    riskReversal25D: number; // 25-delta risk reversal (skew)
    butterflySpread: number; // convexity of the smile
  };
  interpretation: string;
  interpretationEs: string;
}

@Injectable()
export class SABRVolatilityService {
  private readonly logger = new Logger(SABRVolatilityService.name);

  calibrateAndPrice(params: {
    forward: number;
    expiry: number;
    alpha?: number;
    beta?: number;
    rho?: number;
    sigma0?: number;
    strikeRange?: [number, number];
    numStrikes?: number;
  }): SABRResult {
    const {
      forward, expiry,
      alpha = 0.3, beta = 0.5, rho = -0.2, sigma0 = 0.20,
      strikeRange = [forward * 0.7, forward * 1.3],
      numStrikes = 25,
    } = params;

    const volSmile: SABRResult['volSmile'] = [];
    const strikeStep = (strikeRange[1] - strikeRange[0]) / (numStrikes - 1);

    for (let i = 0; i < numStrikes; i++) {
      const K = strikeRange[0] + i * strikeStep;
      const iv = this.haganFormula(forward, K, expiry, alpha, beta, rho, sigma0);
      volSmile.push({
        strike: +K.toFixed(4),
        impliedVol: +(iv * 100).toFixed(2),
        moneyness: +(K / forward).toFixed(4),
      });
    }

    // ATM vol
    const atmVol = this.haganFormula(forward, forward, expiry, alpha, beta, rho, sigma0) * 100;

    // 25-delta approximation: strikes at ~forward × e^(±0.67σ√T)
    const d25 = 0.67 * sigma0 * Math.sqrt(expiry);
    const k25call = forward * Math.exp(d25);
    const k25put = forward * Math.exp(-d25);
    const vol25call = this.haganFormula(forward, k25call, expiry, alpha, beta, rho, sigma0) * 100;
    const vol25put = this.haganFormula(forward, k25put, expiry, alpha, beta, rho, sigma0) * 100;
    const riskReversal25D = vol25call - vol25put;
    const butterflySpread = (vol25call + vol25put) / 2 - atmVol;

    return {
      params: { alpha, beta, rho, sigma0, forward },
      volSmile,
      skewMetrics: {
        atmVol: +atmVol.toFixed(2),
        riskReversal25D: +riskReversal25D.toFixed(2),
        butterflySpread: +butterflySpread.toFixed(2),
      },
      interpretation: `SABR vol smile: ATM=${atmVol.toFixed(1)}%, 25D RR=${riskReversal25D.toFixed(1)}% (${rho < 0 ? 'negative skew' : 'positive skew'}), butterfly=${butterflySpread.toFixed(1)}%.`,
      interpretationEs: `Sonrisa vol SABR: ATM=${atmVol.toFixed(1)}%, 25D RR=${riskReversal25D.toFixed(1)}% (${rho < 0 ? 'sesgo negativo' : 'sesgo positivo'}), mariposa=${butterflySpread.toFixed(1)}%.`,
    };
  }

  /**
   * Hagan et al. (2002) SABR implied volatility approximation.
   */
  private haganFormula(F: number, K: number, T: number, alpha: number, beta: number, rho: number, sigma0: number): number {
    if (Math.abs(F - K) < 1e-10) {
      // ATM formula
      const Fbeta = Math.pow(F, 1 - beta);
      const term1 = sigma0 / Fbeta;
      const term2 = 1 + T * (
        ((1 - beta) ** 2 * sigma0 ** 2) / (24 * F ** (2 - 2 * beta))
        + (rho * beta * alpha * sigma0) / (4 * F ** (1 - beta))
        + ((2 - 3 * rho ** 2) * alpha ** 2) / 24
      );
      return term1 * term2;
    }

    const logFK = Math.log(F / K);
    const FK = F * K;
    const FKbeta = Math.pow(FK, (1 - beta) / 2);
    const z = (alpha / sigma0) * FKbeta * logFK;
    const xz = Math.log((Math.sqrt(1 - 2 * rho * z + z * z) + z - rho) / (1 - rho));

    const prefix = sigma0 / (FKbeta * (1 + ((1 - beta) ** 2 / 24) * logFK ** 2 + ((1 - beta) ** 4 / 1920) * logFK ** 4));
    const zOverXz = Math.abs(xz) > 1e-10 ? z / xz : 1;
    const correction = 1 + T * (
      ((1 - beta) ** 2 * sigma0 ** 2) / (24 * FK ** (1 - beta))
      + (rho * beta * alpha * sigma0) / (4 * FKbeta)
      + ((2 - 3 * rho ** 2) * alpha ** 2) / 24
    );

    return prefix * zOverXz * correction;
  }
}
