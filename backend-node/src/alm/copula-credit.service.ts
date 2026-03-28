import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// Gaussian + Student-t Copula Credit Correlation Model
// Li (2000) — the model that changed credit risk forever

export interface CopulaResult {
  method: 'gaussian' | 't-copula';
  var99: number;
  var999: number;
  es99: number;
  tailDependence: number;
  tCopulaPremium: number; // extra risk from fat tails
  jointDefaultProbability: number;
  correlationMatrix: number[][];
  segments: string[];
}

@Injectable()
export class CopulaCreditService {
  private readonly logger = new Logger(CopulaCreditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async simulateWithCopula(
    institutionId: string,
    copulaType: 'gaussian' | 't-copula' = 'gaussian',
    nuDof: number = 5,
    paths: number = 10000,
  ): Promise<CopulaResult> {
    const segments = await this.prisma.loanSegment.findMany({
      where: { institutionId },
    });
    if (segments.length === 0) return this.getDemoResult(copulaType);

    const n = segments.length;
    const pds = segments.map((s: any) =>
      Math.min(0.3, s.historicalLossRate * 2),
    );
    const lgds = segments.map((s: any) => s.lgd);
    const eads = segments.map((s: any) => s.balance);

    // Build correlation matrix (simplified: uniform rho)
    const rho = 0.15;
    const corrMatrix = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? 1.0 : rho)),
    );

    // Cholesky decomposition
    const L = this.cholesky(corrMatrix);
    const rng = this.seededRNG(42);
    const losses: number[] = [];

    for (let p = 0; p < paths; p++) {
      // Draw independent normals
      const z = Array.from({ length: n }, () => this.normalRandom(rng));

      // Apply Cholesky correlation
      const x: number[] = new Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j <= i; j++) x[i] += L[i][j] * z[j];
      }

      // Transform to uniforms
      let u: number[];
      if (copulaType === 't-copula') {
        // t-copula: divide by chi-squared
        const chi2 = this.chiSquaredSample(rng, nuDof);
        const tVars = x.map((xi) => xi / Math.sqrt(chi2 / nuDof));
        u = tVars.map((ti) => this.tCDF(ti, nuDof));
      } else {
        u = x.map((xi) => this.normCDF(xi));
      }

      // Default if u_i < PD_i
      let loss = 0;
      for (let i = 0; i < n; i++) {
        if (u[i] < pds[i]) loss += eads[i] * lgds[i];
      }
      losses.push(loss);
    }

    losses.sort((a, b) => a - b);
    const var99 = losses[Math.floor(paths * 0.99)];
    const var999 = losses[Math.floor(paths * 0.999)];
    const es99 =
      losses.slice(Math.floor(paths * 0.99)).reduce((s, v) => s + v, 0) /
      (paths * 0.01);

    // Tail dependence (t-copula)
    const tailDep =
      copulaType === 't-copula'
        ? 2 *
          this.tCDF(
            -Math.sqrt(((nuDof + 1) * (1 - rho)) / (1 + rho)),
            nuDof + 1,
          )
        : 0;

    // Joint default probability
    const jointDefault =
      losses.filter(
        (l) => l > eads.reduce((s: number, e: number) => s + e, 0) * 0.5,
      ).length / paths;

    // t-copula premium: how much more risk than Gaussian
    let tPremium = 0;
    if (copulaType === 't-copula') {
      // Run Gaussian for comparison
      const gaussResult = await this.simulateWithCopula(
        institutionId,
        'gaussian',
        5,
        Math.min(paths, 5000),
      );
      tPremium = var99 - gaussResult.var99;
    }

    return {
      method: copulaType,
      var99: +var99.toFixed(2),
      var999: +var999.toFixed(2),
      es99: +es99.toFixed(2),
      tailDependence: +tailDep.toFixed(4),
      tCopulaPremium: +tPremium.toFixed(2),
      jointDefaultProbability: +jointDefault.toFixed(6),
      correlationMatrix: corrMatrix,
      segments: segments.map((s: any) => s.segmentName),
    };
  }

  private cholesky(R: number[][]): number[][] {
    const n = R.length;
    const L = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let sum = R[i][j];
        for (let k = 0; k < j; k++) sum -= L[i][k] * L[j][k];
        L[i][j] = j === i ? Math.sqrt(Math.max(0, sum)) : sum / (L[j][j] || 1);
      }
    }
    return L;
  }

  private chiSquaredSample(rng: () => number, df: number): number {
    let sum = 0;
    for (let i = 0; i < df; i++) {
      const z = this.normalRandom(rng);
      sum += z * z;
    }
    return sum;
  }

  private tCDF(x: number, nu: number): number {
    // Approximation for student-t CDF
    const t = x / Math.sqrt(nu);
    return (
      0.5 +
      0.5 *
        Math.sign(t) *
        (1 - Math.exp(-0.5 * t * t * (1 + (0.25 * t * t) / nu)))
    );
  }

  private normCDF(x: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989422804014327;
    const p =
      d *
      Math.exp((-x * x) / 2) *
      t *
      (0.3193815 +
        t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - p : p;
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

  private getDemoResult(method: string): CopulaResult {
    return {
      method: method as any,
      var99: 22.5,
      var999: 35.8,
      es99: 28.4,
      tailDependence: method === 't-copula' ? 0.12 : 0,
      tCopulaPremium: method === 't-copula' ? 4.2 : 0,
      jointDefaultProbability: 0.0008,
      correlationMatrix: [
        [1, 0.15],
        [0.15, 1],
      ],
      segments: ['Consumer', 'Commercial'],
    };
  }
}
