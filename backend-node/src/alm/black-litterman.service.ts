import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// Black-Litterman (1992) — Goldman Sachs Asset Management model
// Blends market equilibrium with investor views via Bayesian posterior

export interface BLView {
  description: string;
  assets: string[];
  weights?: number[];
  type: 'absolute' | 'relative';
  expectedReturn: number;
  confidence: number; // 0-1
}

export interface BLResult {
  equilibriumReturns: number[];
  posteriorReturns: number[];
  optimalWeights: number[];
  assetNames: string[];
  viewContributions: Array<{
    view: string;
    priorReturn: number;
    posteriorReturn: number;
    shift: number;
  }>;
  portfolioExpectedReturn: number;
  portfolioRisk: number;
  sharpeRatio: number;
}

@Injectable()
export class BlackLittermanService {
  private readonly logger = new Logger(BlackLittermanService.name);

  constructor(private readonly prisma: PrismaService) {}

  async computeBLPortfolio(
    institutionId: string,
    views: BLView[] = [],
  ): Promise<BLResult> {
    const items = await this.prisma.balanceSheetItem.findMany({
      where: { institutionId, category: 'asset' },
    });

    // Build asset universe from balance sheet
    const bySub = new Map<string, { balance: number; rate: number }>();
    for (const item of items) {
      if (!bySub.has(item.subcategory))
        bySub.set(item.subcategory, { balance: 0, rate: 0 });
      const e = bySub.get(item.subcategory);
      e.balance += item.balance;
      e.rate += item.rate * item.balance;
    }

    const assetNames = Array.from(bySub.keys());
    const n = assetNames.length || 6;

    if (n === 0) return this.getDemoResult();

    // Market cap weights (balance-weighted)
    const totalBalance = Array.from(bySub.values()).reduce(
      (s, v) => s + v.balance,
      0,
    );
    const marketWeights = assetNames.map(
      (name) => (bySub.get(name)?.balance ?? 0) / (totalBalance || 1),
    );

    // Covariance matrix (simplified: diagonal + correlation)
    const vols = assetNames.map((name) => {
      const sub = name.toLowerCase();
      if (sub.includes('cash')) return 0.01;
      if (sub.includes('securities') || sub.includes('treasury')) return 0.04;
      if (sub.includes('mortgage') || sub.includes('residential')) return 0.06;
      if (sub.includes('commercial')) return 0.08;
      if (sub.includes('consumer') || sub.includes('auto')) return 0.05;
      return 0.05;
    });
    const rho = 0.3; // average correlation
    const covMatrix = vols.map((vi, i) =>
      vols.map((vj, j) => (i === j ? vi * vi : vi * vj * rho)),
    );

    // Risk aversion: δ = (E[Rm] - Rf) / σ²m
    const delta = 2.5;
    const tau = 0.025; // uncertainty in prior

    // Step 1: Implied equilibrium returns: π = δ × Σ × w_mkt
    const equilibriumReturns = this.matVec(
      this.scalarMat(covMatrix, delta),
      marketWeights,
    );

    if (views.length === 0) {
      // No views — optimize on equilibrium
      const optWeights = this.mvoOptimize(equilibriumReturns, covMatrix, delta);
      const portRet = optWeights.reduce(
        (s, w, i) => s + w * equilibriumReturns[i],
        0,
      );
      const portVar = this.quadForm(optWeights, covMatrix);
      return {
        equilibriumReturns,
        posteriorReturns: equilibriumReturns,
        optimalWeights: optWeights,
        assetNames,
        viewContributions: [],
        portfolioExpectedReturn: +portRet.toFixed(4),
        portfolioRisk: +Math.sqrt(portVar).toFixed(4),
        sharpeRatio:
          portVar > 0 ? +(portRet / Math.sqrt(portVar)).toFixed(4) : 0,
      };
    }

    // Step 2: Build P matrix (k × n) and Q vector
    const k = views.length;
    const P: number[][] = views.map((v) => {
      const row = new Array(n).fill(0);
      v.assets.forEach((a, i) => {
        const idx = assetNames.indexOf(a);
        if (idx >= 0) row[idx] = v.weights?.[i] ?? 1;
      });
      return row;
    });
    const Q = views.map((v) => v.expectedReturn);

    // Step 3: Omega = diag(P × τΣ × Pᵀ) / confidence
    const tauSigma = this.scalarMat(covMatrix, tau);
    const P_tS_Pt = this.matMul(this.matMul(P, tauSigma), this.transpose(P));
    const omega = views.map((v, i) =>
      P_tS_Pt[i]?.[i] ? P_tS_Pt[i][i] / (v.confidence || 0.5) : 0.01,
    );
    const omegaMat = omega.map((o, i) =>
      omega.map((_, j) => (i === j ? o : 0)),
    );

    // Step 4: BL posterior
    const tauSigmaInv = this.pseudoInverse(tauSigma);
    const omegaInv = this.pseudoInverse(omegaMat);
    const PtOmegaInvP = this.matMul(
      this.matMul(this.transpose(P), omegaInv),
      P,
    );
    const M = this.addMat(tauSigmaInv, PtOmegaInvP);
    const Minv = this.pseudoInverse(M);

    const term1 = this.matVec(tauSigmaInv, equilibriumReturns);
    const term2 = this.matVec(this.matMul(this.transpose(P), omegaInv), Q);
    const posteriorReturns = this.matVec(
      Minv,
      term1.map((v, i) => v + (term2[i] ?? 0)),
    );

    // Step 5: MVO on posterior
    const optWeights = this.mvoOptimize(posteriorReturns, covMatrix, delta);
    const portRet = optWeights.reduce(
      (s, w, i) => s + w * posteriorReturns[i],
      0,
    );
    const portVar = this.quadForm(optWeights, covMatrix);

    return {
      equilibriumReturns: equilibriumReturns.map((r) => +r.toFixed(6)),
      posteriorReturns: posteriorReturns.map((r) => +r.toFixed(6)),
      optimalWeights: optWeights.map((w) => +w.toFixed(4)),
      assetNames,
      viewContributions: views.map((v, i) => ({
        view: v.description,
        priorReturn:
          +equilibriumReturns[assetNames.indexOf(v.assets[0]) ?? 0]?.toFixed(4),
        posteriorReturn:
          +posteriorReturns[assetNames.indexOf(v.assets[0]) ?? 0]?.toFixed(4),
        shift: +(
          posteriorReturns[assetNames.indexOf(v.assets[0]) ?? 0] -
          equilibriumReturns[assetNames.indexOf(v.assets[0]) ?? 0]
        ).toFixed(4),
      })),
      portfolioExpectedReturn: +portRet.toFixed(4),
      portfolioRisk: +Math.sqrt(portVar).toFixed(4),
      sharpeRatio: portVar > 0 ? +(portRet / Math.sqrt(portVar)).toFixed(4) : 0,
    };
  }

  // ─── Matrix Utilities ─────────────────────────────────────
  private scalarMat(M: number[][], s: number): number[][] {
    return M.map((r) => r.map((v) => v * s));
  }
  private addMat(A: number[][], B: number[][]): number[][] {
    return A.map((r, i) => r.map((v, j) => v + (B[i]?.[j] ?? 0)));
  }
  private transpose(M: number[][]): number[][] {
    return M[0]?.map((_, i) => M.map((r) => r[i])) ?? [];
  }
  private matVec(M: number[][], v: number[]): number[] {
    return M.map((r) => r.reduce((s, a, i) => s + a * (v[i] ?? 0), 0));
  }
  private matMul(A: number[][], B: number[][]): number[][] {
    return A.map((r) =>
      (B[0] ?? []).map((_, j) =>
        r.reduce((s, _, k) => s + r[k] * (B[k]?.[j] ?? 0), 0),
      ),
    );
  }
  private quadForm(w: number[], S: number[][]): number {
    return w.reduce(
      (s, wi, i) =>
        s + wi * w.reduce((s2, wj, j) => s2 + wj * (S[i]?.[j] ?? 0), 0),
      0,
    );
  }

  private mvoOptimize(mu: number[], cov: number[][], delta: number): number[] {
    // Simplified: w* = (1/δ) × Σ⁻¹ × μ, then normalize to sum=1, clamp ≥0
    const covInv = this.pseudoInverse(cov);
    const raw = this.matVec(
      covInv,
      mu.map((m) => m / delta),
    );
    const clamped = raw.map((w) => Math.max(0, w));
    const total = clamped.reduce((s, w) => s + w, 0) || 1;
    return clamped.map((w) => w / total);
  }

  private pseudoInverse(M: number[][]): number[][] {
    const n = M.length;
    // For small matrices: use Gauss-Jordan elimination
    const aug = M.map((row, i) => [
      ...row,
      ...Array(n)
        .fill(0)
        .map((_, j) => (i === j ? 1 : 0)),
    ]);
    for (let i = 0; i < n; i++) {
      let maxVal = Math.abs(aug[i][i]),
        maxRow = i;
      for (let k = i + 1; k < n; k++)
        if (Math.abs(aug[k][i]) > maxVal) {
          maxVal = Math.abs(aug[k][i]);
          maxRow = k;
        }
      [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];
      const pivot = aug[i][i] || 1e-10;
      for (let j = 0; j < 2 * n; j++) aug[i][j] /= pivot;
      for (let k = 0; k < n; k++) {
        if (k === i) continue;
        const factor = aug[k][i];
        for (let j = 0; j < 2 * n; j++) aug[k][j] -= factor * aug[i][j];
      }
    }
    return aug.map((row) => row.slice(n));
  }

  private getDemoResult(): BLResult {
    return {
      equilibriumReturns: [0.048, 0.042, 0.065, 0.058, 0.072, 0.015],
      posteriorReturns: [0.048, 0.042, 0.065, 0.058, 0.072, 0.015],
      optimalWeights: [0.1, 0.2, 0.25, 0.15, 0.2, 0.1],
      assetNames: [
        'cash',
        'securities',
        'residential_mortgage',
        'commercial_re',
        'consumer_loans',
        'savings',
      ],
      viewContributions: [],
      portfolioExpectedReturn: 0.052,
      portfolioRisk: 0.045,
      sharpeRatio: 1.15,
    };
  }
}
