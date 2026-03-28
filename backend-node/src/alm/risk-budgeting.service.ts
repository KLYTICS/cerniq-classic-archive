import { Injectable, Logger } from '@nestjs/common';

// ─── Types ───────────────────────────────────────────────────

export interface RiskPosition {
  name: string;
  weight: number;
  annualReturn: number;
  annualVolatility: number;
}

export interface RiskDecompositionResult {
  portfolioVolatility: number;
  portfolioReturn: number;
  sharpeRatio: number;
  positions: Array<{
    name: string;
    weight: number;
    mctr: number;
    componentRisk: number;
    percentContribution: number;
    standalone_risk: number;
  }>;
}

export interface RiskAsset {
  name: string;
  annualVolatility: number;
}

export interface RiskParityResult {
  weights: Array<{ name: string; weight: number }>;
  portfolioVolatility: number;
  equalRiskContribution: number;
  iterations: number;
}

export interface RiskBudgetResult {
  weights: Array<{ name: string; weight: number }>;
  actualBudgets: number[];
  targetBudgets: number[];
  trackingError: number;
  portfolioVolatility: number;
}

// ─── Service ─────────────────────────────────────────────────

@Injectable()
export class RiskBudgetingService {
  private readonly logger = new Logger(RiskBudgetingService.name);

  // ─── Risk Decomposition ──────────────────────────────────

  calculateRiskDecomposition(params: {
    positions: RiskPosition[];
    correlationMatrix: number[][];
  }): RiskDecompositionResult {
    const { positions, correlationMatrix } = params;
    const n = positions.length;

    // Single asset edge case
    if (n === 1) {
      const p = positions[0];
      return {
        portfolioVolatility: p.annualVolatility * Math.abs(p.weight),
        portfolioReturn: p.annualReturn * p.weight,
        sharpeRatio:
          p.annualVolatility > 0 ? p.annualReturn / p.annualVolatility : 0,
        positions: [
          {
            name: p.name,
            weight: p.weight,
            mctr: p.annualVolatility,
            componentRisk: p.annualVolatility * Math.abs(p.weight),
            percentContribution: 1.0,
            standalone_risk: p.annualVolatility,
          },
        ],
      };
    }

    // Build covariance matrix: Cov(i,j) = vol_i * vol_j * corr(i,j)
    const cov = this.buildCovarianceMatrix(
      positions.map((p) => p.annualVolatility),
      correlationMatrix,
    );

    const weights = positions.map((p) => p.weight);

    // Portfolio variance = w' * Cov * w
    const portVar = this.quadraticForm(weights, cov);
    const portVol = Math.sqrt(Math.max(portVar, 0));

    // Portfolio return = sum(w_i * r_i)
    const portReturn = positions.reduce(
      (s, p) => s + p.weight * p.annualReturn,
      0,
    );

    // MCTR_i = (Cov * w)_i / sigma_p
    const covW = this.matVecMul(cov, weights);
    const mctr = covW.map((v) => (portVol > 0 ? v / portVol : 0));

    // Component risk: CR_i = w_i * MCTR_i
    const componentRisks = weights.map((w, i) => w * mctr[i]);
    const totalCR = componentRisks.reduce((s, c) => s + c, 0);

    // Percent contribution
    const pctContributions = componentRisks.map((cr) =>
      totalCR > 0 ? cr / totalCR : 1 / n,
    );

    return {
      portfolioVolatility: +portVol.toFixed(8),
      portfolioReturn: +portReturn.toFixed(8),
      sharpeRatio: portVol > 0 ? +(portReturn / portVol).toFixed(6) : 0,
      positions: positions.map((p, i) => ({
        name: p.name,
        weight: p.weight,
        mctr: +mctr[i].toFixed(8),
        componentRisk: +componentRisks[i].toFixed(8),
        percentContribution: +pctContributions[i].toFixed(8),
        standalone_risk: p.annualVolatility,
      })),
    };
  }

  // ─── Risk Parity ─────────────────────────────────────────

  calculateRiskParity(params: {
    assets: RiskAsset[];
    correlationMatrix: number[][];
    targetRisk?: number;
  }): RiskParityResult {
    const { assets, correlationMatrix, targetRisk } = params;
    const n = assets.length;

    // Single asset: 100% weight
    if (n === 1) {
      return {
        weights: [{ name: assets[0].name, weight: 1.0 }],
        portfolioVolatility: assets[0].annualVolatility,
        equalRiskContribution: 1.0,
        iterations: 0,
      };
    }

    const cov = this.buildCovarianceMatrix(
      assets.map((a) => a.annualVolatility),
      correlationMatrix,
    );

    // Initialize with inverse-volatility weights
    let weights = assets.map((a) =>
      a.annualVolatility > 0 ? 1 / a.annualVolatility : 1,
    );
    weights = this.normalizeWeights(weights);

    const maxIter = 1000;
    const tol = 1e-10;
    let iter = 0;

    for (iter = 0; iter < maxIter; iter++) {
      const portVar = this.quadraticForm(weights, cov);
      const portVol = Math.sqrt(Math.max(portVar, 0));
      if (portVol === 0) break;

      const covW = this.matVecMul(cov, weights);
      const mctr = covW.map((v) => v / portVol);
      const cr = weights.map((w, i) => w * mctr[i]);
      const targetCR = portVol / n;

      // Check convergence: all CR_i approximately equal
      const maxDev = Math.max(...cr.map((c) => Math.abs(c - targetCR)));
      if (maxDev < tol * portVol) break;

      // Fixed-point update: w_i <- w_i * (targetCR / CR_i)
      const newWeights = weights.map((w, i) => {
        const ratio = cr[i] > 0 ? targetCR / cr[i] : 1;
        // Dampen update to avoid oscillation
        return w * (0.5 + 0.5 * ratio);
      });
      weights = this.normalizeWeights(newWeights);
    }

    // Final portfolio vol
    const finalVar = this.quadraticForm(weights, cov);
    let finalVol = Math.sqrt(Math.max(finalVar, 0));

    // Scale to target risk if specified
    if (targetRisk !== undefined && targetRisk > 0 && finalVol > 0) {
      const scale = targetRisk / finalVol;
      weights = weights.map((w) => w * scale);
      weights = this.normalizeWeights(weights);
      const scaledVar = this.quadraticForm(weights, cov);
      finalVol = Math.sqrt(Math.max(scaledVar, 0));
    }

    return {
      weights: assets.map((a, i) => ({
        name: a.name,
        weight: +weights[i].toFixed(8),
      })),
      portfolioVolatility: +finalVol.toFixed(8),
      equalRiskContribution: +(1 / n).toFixed(8),
      iterations: iter,
    };
  }

  // ─── Risk Budget ─────────────────────────────────────────

  riskBudget(params: {
    assets: RiskAsset[];
    correlationMatrix: number[][];
    targetBudgets: number[];
  }): RiskBudgetResult {
    const { assets, correlationMatrix, targetBudgets } = params;
    const n = assets.length;

    // Validate target budgets sum to ~1.0
    const budgetSum = targetBudgets.reduce((s, b) => s + b, 0);
    if (Math.abs(budgetSum - 1.0) > 0.01) {
      throw new Error(
        `Target budgets must sum to 1.0, got ${budgetSum.toFixed(4)}`,
      );
    }

    // Single asset: 100% weight, 100% budget
    if (n === 1) {
      return {
        weights: [{ name: assets[0].name, weight: 1.0 }],
        actualBudgets: [1.0],
        targetBudgets,
        trackingError: Math.abs(1.0 - targetBudgets[0]),
        portfolioVolatility: assets[0].annualVolatility,
      };
    }

    const cov = this.buildCovarianceMatrix(
      assets.map((a) => a.annualVolatility),
      correlationMatrix,
    );

    // Initialize with budget-weighted inverse-volatility
    let weights = assets.map((a, i) =>
      a.annualVolatility > 0
        ? targetBudgets[i] / a.annualVolatility
        : targetBudgets[i],
    );
    weights = this.normalizeWeights(weights);

    const maxIter = 1000;
    const tol = 1e-10;

    for (let iter = 0; iter < maxIter; iter++) {
      const portVar = this.quadraticForm(weights, cov);
      const portVol = Math.sqrt(Math.max(portVar, 0));
      if (portVol === 0) break;

      const covW = this.matVecMul(cov, weights);
      const mctr = covW.map((v) => v / portVol);
      const cr = weights.map((w, i) => w * mctr[i]);
      const totalCR = cr.reduce((s, c) => s + c, 0);

      // Actual budgets
      const actualBudgets = cr.map((c) => (totalCR > 0 ? c / totalCR : 1 / n));

      // Check convergence
      const maxDev = Math.max(
        ...actualBudgets.map((a, i) => Math.abs(a - targetBudgets[i])),
      );
      if (maxDev < tol) break;

      // Fixed-point update: w_i <- w_i * (target_i / actual_i)
      const newWeights = weights.map((w, i) => {
        const ratio =
          actualBudgets[i] > 0 ? targetBudgets[i] / actualBudgets[i] : 1;
        return w * (0.5 + 0.5 * ratio);
      });
      weights = this.normalizeWeights(newWeights);
    }

    // Final metrics
    const finalVar = this.quadraticForm(weights, cov);
    const finalVol = Math.sqrt(Math.max(finalVar, 0));
    const covW = this.matVecMul(cov, weights);
    const mctr = covW.map((v) => (finalVol > 0 ? v / finalVol : 0));
    const cr = weights.map((w, i) => w * mctr[i]);
    const totalCR = cr.reduce((s, c) => s + c, 0);
    const actualBudgets = cr.map((c) => (totalCR > 0 ? c / totalCR : 1 / n));

    const trackingError = Math.sqrt(
      actualBudgets.reduce(
        (s, a, i) => s + (a - targetBudgets[i]) ** 2,
        0,
      ) / n,
    );

    return {
      weights: assets.map((a, i) => ({
        name: a.name,
        weight: +weights[i].toFixed(8),
      })),
      actualBudgets: actualBudgets.map((b) => +b.toFixed(8)),
      targetBudgets,
      trackingError: +trackingError.toFixed(10),
      portfolioVolatility: +finalVol.toFixed(8),
    };
  }

  // ─── Matrix Helpers ──────────────────────────────────────

  private buildCovarianceMatrix(
    vols: number[],
    corr: number[][],
  ): number[][] {
    const n = vols.length;
    return Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => vols[i] * vols[j] * corr[i][j]),
    );
  }

  /** w' * M * w */
  private quadraticForm(w: number[], M: number[][]): number {
    const n = w.length;
    let result = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        result += w[i] * w[j] * M[i][j];
      }
    }
    return result;
  }

  /** M * v */
  private matVecMul(M: number[][], v: number[]): number[] {
    return M.map((row) => row.reduce((s, val, j) => s + val * v[j], 0));
  }

  /** Normalize weights to sum to 1 */
  private normalizeWeights(w: number[]): number[] {
    const total = w.reduce((s, v) => s + Math.abs(v), 0);
    if (total === 0) return w.map(() => 1 / w.length);
    return w.map((v) => v / total);
  }
}
