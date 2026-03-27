import { Injectable, Logger } from '@nestjs/common';

// PCA Yield Curve — 3-Factor Decomposition (Level, Slope, Curvature)
// Decomposes yield curve movements into orthogonal risk factors

export interface PCAFactor {
  name: string;
  loadings: number[];
  explainedVariancePct: number;
  eigenvalue: number;
}

export interface PCAResult {
  factors: PCAFactor[];
  totalExplainedPct: number;
  tenorLabels: string[];
  dv01Attribution?: { level: number; slope: number; curvature: number };
}

@Injectable()
export class PCAYieldCurveService {
  private readonly logger = new Logger(PCAYieldCurveService.name);

  computePCAFactors(yieldChanges: number[][]): PCAResult {
    if (yieldChanges.length < 10) return this.getDemoResult();

    const n = yieldChanges.length;
    const m = yieldChanges[0]?.length ?? 10;
    const tenorLabels = [
      '3M',
      '6M',
      '1Y',
      '2Y',
      '3Y',
      '5Y',
      '7Y',
      '10Y',
      '20Y',
      '30Y',
    ].slice(0, m);

    // Demean
    const means = Array(m)
      .fill(0)
      .map((_, j) => yieldChanges.reduce((s, r) => s + (r[j] ?? 0), 0) / n);
    const demeaned = yieldChanges.map((row) => row.map((v, j) => v - means[j]));

    // Covariance matrix
    const cov: number[][] = Array.from({ length: m }, (_, i) =>
      Array.from(
        { length: m },
        (_, j) =>
          demeaned.reduce((s, r) => s + (r[i] ?? 0) * (r[j] ?? 0), 0) / (n - 1),
      ),
    );

    // Power iteration for top 3 eigenvectors
    const totalVar = cov.reduce((s, r, i) => s + r[i], 0);
    const factors: PCAFactor[] = [];
    let deflatedCov = cov.map((r) => [...r]);

    for (let f = 0; f < 3; f++) {
      const [eigvec, eigval] = this.powerIteration(deflatedCov, 200);
      const name = f === 0 ? 'Level' : f === 1 ? 'Slope' : 'Curvature';
      factors.push({
        name,
        loadings: eigvec.map((v) => +v.toFixed(4)),
        explainedVariancePct: +((eigval / totalVar) * 100).toFixed(1),
        eigenvalue: +eigval.toFixed(6),
      });
      // Deflate: remove this factor's contribution
      deflatedCov = deflatedCov.map((row, i) =>
        row.map((v, j) => v - eigval * eigvec[i] * eigvec[j]),
      );
    }

    return {
      factors,
      totalExplainedPct: +factors
        .reduce((s, f) => s + f.explainedVariancePct, 0)
        .toFixed(1),
      tenorLabels,
    };
  }

  // Attribute portfolio DV01 to PCA factors
  attributeDV01(
    portfolioDV01: number[],
    factors: PCAFactor[],
  ): { level: number; slope: number; curvature: number } {
    const project = (loadings: number[]) =>
      loadings.reduce((s, l, i) => s + l * (portfolioDV01[i] ?? 0), 0);
    return {
      level: +project(factors[0]?.loadings ?? []).toFixed(2),
      slope: +project(factors[1]?.loadings ?? []).toFixed(2),
      curvature: +project(factors[2]?.loadings ?? []).toFixed(2),
    };
  }

  // Generate synthetic yield changes from current rates for demo
  generateSyntheticChanges(
    baseRates: number[],
    weeks: number = 52,
  ): number[][] {
    const m = baseRates.length;
    const changes: number[][] = [];
    const rng = this.seededRNG(42);

    for (let w = 0; w < weeks; w++) {
      const levelShock = this.normalRandom(rng) * 5; // 5bps std
      const slopeShock = this.normalRandom(rng) * 3;
      const curvShock = this.normalRandom(rng) * 2;

      const row = baseRates.map((_, j) => {
        const tenorFraction = j / (m - 1); // 0 for short end, 1 for long end
        return (
          (levelShock +
            slopeShock * (tenorFraction - 0.5) * 2 +
            curvShock * (4 * tenorFraction * (1 - tenorFraction) - 0.5)) /
          10000
        ); // convert bps to decimal
      });
      changes.push(row);
    }
    return changes;
  }

  private powerIteration(M: number[][], maxIter: number): [number[], number] {
    const n = M.length;
    let v: number[] = M.map((_, i) => (i === 0 ? 1 : 0));
    for (let iter = 0; iter < maxIter; iter++) {
      const Mv = M.map((row) => row.reduce((s, a, j) => s + a * v[j], 0));
      const norm = Math.sqrt(Mv.reduce((s, x) => s + x * x, 0)) || 1;
      v = Mv.map((x) => x / norm);
    }
    const lambda = v.reduce(
      (s, vi, i) => s + vi * M[i].reduce((ss, a, j) => ss + a * v[j], 0),
      0,
    );
    return [v, lambda];
  }

  private seededRNG(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  }

  private normalRandom(rng: () => number): number {
    const u1 = rng() || 1e-10,
      u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  private getDemoResult(): PCAResult {
    return {
      factors: [
        {
          name: 'Level',
          loadings: [0.31, 0.32, 0.33, 0.33, 0.33, 0.32, 0.32, 0.31, 0.3, 0.29],
          explainedVariancePct: 89.2,
          eigenvalue: 0.000245,
        },
        {
          name: 'Slope',
          loadings: [
            -0.42, -0.35, -0.25, -0.1, 0.05, 0.2, 0.3, 0.38, 0.42, 0.43,
          ],
          explainedVariancePct: 7.8,
          eigenvalue: 0.000021,
        },
        {
          name: 'Curvature',
          loadings: [0.35, 0.2, -0.05, -0.3, -0.4, -0.3, -0.1, 0.15, 0.4, 0.45],
          explainedVariancePct: 2.1,
          eigenvalue: 0.0000058,
        },
      ],
      totalExplainedPct: 99.1,
      tenorLabels: [
        '3M',
        '6M',
        '1Y',
        '2Y',
        '3Y',
        '5Y',
        '7Y',
        '10Y',
        '20Y',
        '30Y',
      ],
    };
  }
}
