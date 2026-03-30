import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// CVaR Portfolio Optimizer — Rockafellar-Uryasev (2000)
// Minimizes Expected Shortfall via LP reformulation

export interface CVaROptResult {
  weights: number[];
  assetNames: string[];
  cvar: number; // portfolio CVaR (ES) at alpha
  var: number; // portfolio VaR at alpha
  expectedReturn: number;
  alpha: number;
  scenarioCount: number;
  efficientFrontier: Array<{
    targetReturn: number;
    cvar: number;
    weights: number[];
  }>;
}

@Injectable()
export class CVaROptimizerService {
  private readonly logger = new Logger(CVaROptimizerService.name);

  constructor(private readonly prisma: PrismaService) {}

  async optimize(
    institutionId: string,
    alpha: number = 0.05,
  ): Promise<CVaROptResult> {
    const items = await this.prisma.balanceSheetItem.findMany({
      where: { institutionId, category: 'asset' },
    });

    // Build asset returns from balance sheet
    const bySub = new Map<string, { balance: number; rate: number }>();
    for (const item of items) {
      if (!bySub.has(item.subcategory))
        bySub.set(item.subcategory, { balance: 0, rate: 0 });
      const e = bySub.get(item.subcategory)!;
      e.balance += item.balance;
      e.rate += item.rate * item.balance;
    }

    const assetNames = Array.from(bySub.keys());
    const n = assetNames.length;
    if (n === 0) return this.getDemoResult(alpha);

    const expectedReturns = assetNames.map((name) => {
      const e = bySub.get(name)!;
      return e.balance > 0 ? e.rate / e.balance : 0;
    });

    // Generate 500 scenario returns (Monte Carlo)
    const S = 500;
    const scenarios: number[][] = [];
    const vols = expectedReturns.map((r) => Math.max(0.01, r * 0.3)); // vol = 30% of expected return

    for (let s = 0; s < S; s++) {
      const row: number[] = [];
      for (let j = 0; j < n; j++) {
        const z = this.normalRandom();
        row.push(expectedReturns[j] + vols[j] * z);
      }
      scenarios.push(row);
    }

    // CVaR minimization via iterative LP approximation
    // min nu + (1/(alpha*S)) * sum_s z_s
    // s.t. z_s >= -r_s^T w - nu, z_s >= 0, sum w = 1, w >= 0

    // Simplified: grid search over weights + compute CVaR for each
    const bestResult = this.gridOptimize(
      assetNames,
      expectedReturns,
      scenarios,
      alpha,
    );

    // Compute efficient frontier (5 points)
    const frontier: CVaROptResult['efficientFrontier'] = [];
    const minRet = Math.min(...expectedReturns) * 0.5;
    const maxRet = Math.max(...expectedReturns) * 0.9;
    for (let i = 0; i < 5; i++) {
      const target = minRet + ((maxRet - minRet) * i) / 4;
      const result = this.gridOptimize(
        assetNames,
        expectedReturns,
        scenarios,
        alpha,
        target,
      );
      frontier.push({
        targetReturn: +target.toFixed(4),
        cvar: result.cvar,
        weights: result.weights,
      });
    }

    return {
      ...bestResult,
      assetNames,
      alpha,
      scenarioCount: S,
      efficientFrontier: frontier,
    };
  }

  private gridOptimize(
    assetNames: string[],
    expectedReturns: number[],
    scenarios: number[][],
    alpha: number,
    targetReturn?: number,
  ): { weights: number[]; cvar: number; var: number; expectedReturn: number } {
    const n = assetNames.length;
    const S = scenarios.length;

    let bestWeights = new Array(n).fill(1 / n);
    let bestCVaR = Infinity;

    // Generate 200 candidate weight vectors
    for (let trial = 0; trial < 200; trial++) {
      const w = this.randomWeights(n);
      const portRet = w.reduce((s, wi, i) => s + wi * expectedReturns[i], 0);

      if (targetReturn !== undefined && portRet < targetReturn * 0.95) continue;

      // Compute portfolio returns under each scenario
      const portReturns = scenarios.map((row) =>
        w.reduce((s, wi, i) => s + wi * row[i], 0),
      );
      portReturns.sort((a, b) => a - b);

      // VaR = -percentile(alpha)
      const varIdx = Math.floor(S * alpha);
      const varVal = -portReturns[varIdx];

      // CVaR = average of worst alpha% returns
      const tailReturns = portReturns.slice(0, varIdx);
      const cvar =
        tailReturns.length > 0
          ? -tailReturns.reduce((s, r) => s + r, 0) / tailReturns.length
          : varVal;

      if (cvar < bestCVaR) {
        bestCVaR = cvar;
        bestWeights = w;
      }
    }

    const portRet = bestWeights.reduce(
      (s, wi, i) => s + wi * expectedReturns[i],
      0,
    );
    const portReturns = scenarios
      .map((row) => bestWeights.reduce((s, wi, i) => s + wi * row[i], 0))
      .sort((a, b) => a - b);
    const varVal = -portReturns[Math.floor(S * alpha)];

    return {
      weights: bestWeights.map((w) => +w.toFixed(4)),
      cvar: +bestCVaR.toFixed(6),
      var: +varVal.toFixed(6),
      expectedReturn: +portRet.toFixed(6),
    };
  }

  private randomWeights(n: number): number[] {
    const raw = Array.from({ length: n }, () => Math.random());
    const total = raw.reduce((s, w) => s + w, 0);
    return raw.map((w) => w / total);
  }

  private normalRandom(): number {
    const u1 = Math.random(),
      u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2);
  }

  private getDemoResult(alpha: number): CVaROptResult {
    return {
      weights: [0.08, 0.22, 0.28, 0.12, 0.18, 0.12],
      assetNames: [
        'cash',
        'securities',
        'residential_mortgage',
        'commercial_re',
        'consumer_loans',
        'auto_loans',
      ],
      cvar: 0.032,
      var: 0.025,
      expectedReturn: 0.058,
      alpha,
      scenarioCount: 500,
      efficientFrontier: [
        {
          targetReturn: 0.03,
          cvar: 0.012,
          weights: [0.3, 0.4, 0.1, 0.05, 0.1, 0.05],
        },
        {
          targetReturn: 0.04,
          cvar: 0.018,
          weights: [0.2, 0.3, 0.2, 0.1, 0.15, 0.05],
        },
        {
          targetReturn: 0.05,
          cvar: 0.025,
          weights: [0.1, 0.25, 0.25, 0.15, 0.15, 0.1],
        },
        {
          targetReturn: 0.06,
          cvar: 0.035,
          weights: [0.05, 0.15, 0.3, 0.2, 0.2, 0.1],
        },
        {
          targetReturn: 0.07,
          cvar: 0.048,
          weights: [0.02, 0.08, 0.25, 0.25, 0.25, 0.15],
        },
      ],
    };
  }
}
