import { Injectable, Logger } from '@nestjs/common';

/**
 * Merton Jump-Diffusion Model — Quant Model #45
 *
 * Extension of geometric Brownian motion with Poisson jumps.
 * Models asset prices that can experience sudden discontinuities
 * (e.g., credit events, regulatory changes, natural disasters).
 *
 * dS/S = (μ - λk)dt + σdW + JdN
 * Where:
 *   μ = drift, σ = diffusion volatility
 *   λ = jump intensity (jumps/year)
 *   J = jump size (log-normal: mean=μ_J, vol=σ_J)
 *   N = Poisson process
 *
 * Cooperativa use cases:
 * - Model sudden deposit outflows (bank run scenarios)
 * - Hurricane impact on real estate collateral
 * - COSSEC regulatory shock events
 * - Stress testing beyond Gaussian assumptions
 */

export interface JumpDiffusionResult {
  params: {
    drift: number;
    diffusionVol: number;
    jumpIntensity: number; // λ — expected jumps per year
    jumpMean: number; // μ_J — average jump size (log)
    jumpVol: number; // σ_J — jump size volatility
    totalVol: number; // combined vol including jumps
  };
  paths: number[][]; // sample simulated paths (first 10)
  statistics: {
    meanReturn: number;
    totalVol: number;
    skewness: number;
    kurtosis: number; // >3 = fat tails from jumps
    jumpContributionPct: number; // % of total variance from jumps
  };
  riskMetrics: {
    var95: number;
    var99: number;
    cvar95: number; // expected shortfall
    maxDrawdown: number;
    jumpProbability1Y: number; // P(at least 1 jump in 1 year)
  };
  interpretation: string;
  interpretationEs: string;
}

@Injectable()
export class MertonJumpDiffusionService {
  private readonly logger = new Logger(MertonJumpDiffusionService.name);

  simulate(params: {
    initialValue?: number;
    drift?: number;
    diffusionVol?: number;
    jumpIntensity?: number;
    jumpMean?: number;
    jumpVol?: number;
    horizonYears?: number;
    numPaths?: number;
    stepsPerYear?: number;
  }): JumpDiffusionResult {
    const {
      initialValue = 100,
      drift = 0.03,
      diffusionVol = 0.15,
      jumpIntensity = 0.5,
      jumpMean = -0.05,
      jumpVol = 0.08,
      horizonYears = 3,
      numPaths = 5000,
      stepsPerYear = 252,
    } = params;

    const dt = 1 / stepsPerYear;
    const totalSteps = Math.round(horizonYears * stepsPerYear);
    const k = Math.exp(jumpMean + jumpVol * jumpVol / 2) - 1;
    const adjustedDrift = drift - jumpIntensity * k;

    const allPaths: number[][] = [];
    const finalValues: number[] = [];

    for (let p = 0; p < numPaths; p++) {
      const path = [initialValue];
      let S = initialValue;

      for (let t = 0; t < totalSteps; t++) {
        // Diffusion component
        const dW = this.gaussianRandom() * Math.sqrt(dt);
        let dS = adjustedDrift * dt + diffusionVol * dW;

        // Jump component (Poisson)
        const numJumps = this.poissonRandom(jumpIntensity * dt);
        for (let j = 0; j < numJumps; j++) {
          const jumpSize = jumpMean + jumpVol * this.gaussianRandom();
          dS += jumpSize;
        }

        S = S * Math.exp(dS);
        if (p < 10) path.push(S); // only store first 10 paths
      }

      if (p < 10) allPaths.push(path);
      finalValues.push(S);
    }

    // Statistics
    const returns = finalValues.map(v => Math.log(v / initialValue));
    const meanReturn = returns.reduce((s, r) => s + r, 0) / numPaths;
    const variance = returns.reduce((s, r) => s + (r - meanReturn) ** 2, 0) / (numPaths - 1);
    const totalVol = Math.sqrt(variance / horizonYears);

    const m3 = returns.reduce((s, r) => s + (r - meanReturn) ** 3, 0) / numPaths;
    const m4 = returns.reduce((s, r) => s + (r - meanReturn) ** 4, 0) / numPaths;
    const skewness = m3 / Math.pow(variance, 1.5);
    const kurtosis = m4 / (variance * variance);

    const jumpVar = jumpIntensity * (jumpMean * jumpMean + jumpVol * jumpVol);
    const totalVar = diffusionVol * diffusionVol + jumpVar;
    const jumpContributionPct = (jumpVar / totalVar) * 100;

    // Risk metrics
    const sorted = [...finalValues].sort((a, b) => a - b);
    const var95 = initialValue - sorted[Math.floor(numPaths * 0.05)];
    const var99 = initialValue - sorted[Math.floor(numPaths * 0.01)];
    const cvar95Idx = Math.floor(numPaths * 0.05);
    const cvar95 = initialValue - sorted.slice(0, cvar95Idx).reduce((s, v) => s + v, 0) / cvar95Idx;
    const maxDrawdown = initialValue - sorted[0];
    const jumpProb1Y = 1 - Math.exp(-jumpIntensity);

    return {
      params: { drift, diffusionVol, jumpIntensity, jumpMean, jumpVol, totalVol: +totalVol.toFixed(4) },
      paths: allPaths,
      statistics: {
        meanReturn: +meanReturn.toFixed(4),
        totalVol: +totalVol.toFixed(4),
        skewness: +skewness.toFixed(3),
        kurtosis: +kurtosis.toFixed(3),
        jumpContributionPct: +jumpContributionPct.toFixed(1),
      },
      riskMetrics: {
        var95: +var95.toFixed(2),
        var99: +var99.toFixed(2),
        cvar95: +cvar95.toFixed(2),
        maxDrawdown: +maxDrawdown.toFixed(2),
        jumpProbability1Y: +jumpProb1Y.toFixed(3),
      },
      interpretation: `Total vol: ${(totalVol * 100).toFixed(1)}% (${jumpContributionPct.toFixed(0)}% from jumps). Kurtosis: ${kurtosis.toFixed(1)} (>3 = fat tails). VaR(99%): ${((var99 / initialValue) * 100).toFixed(1)}%. Jump probability: ${(jumpProb1Y * 100).toFixed(0)}%/year.`,
      interpretationEs: `Vol total: ${(totalVol * 100).toFixed(1)}% (${jumpContributionPct.toFixed(0)}% por saltos). Curtosis: ${kurtosis.toFixed(1)} (>3 = colas pesadas). VaR(99%): ${((var99 / initialValue) * 100).toFixed(1)}%. Probabilidad de salto: ${(jumpProb1Y * 100).toFixed(0)}%/ano.`,
    };
  }

  private gaussianRandom(): number {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  private poissonRandom(lambda: number): number {
    if (lambda < 0.01) return Math.random() < lambda ? 1 : 0;
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do { k++; p *= Math.random(); } while (p > L);
    return k - 1;
  }
}
