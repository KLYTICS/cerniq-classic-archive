import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// ─── Types ───────────────────────────────────────────────────

export interface ForwardSimConfig {
  institutionId: string;
  horizon?: number; // years (default 3)
  growthAssumptions?: Record<string, number>; // subcategory → YoY %
  prepaymentAssumptions?: Record<string, number>; // loanType → annual CPR
  ratePaths?: string[]; // which paths to run
}

export interface ForwardQuarter {
  quarter: string;
  ratePath: string;
  projectedNII: number;
  projectedEVE: number;
  projectedLCR: number;
  projectedNSFR: number;
  projectedNWR: number;
  totalAssets: number;
  totalLiabilities: number;
}

export interface ForwardSimResult {
  config: {
    horizon: number;
    growthAssumptions: Record<string, number>;
    ratePaths: string[];
  };
  quarters: ForwardQuarter[];
  summary: {
    baseNIIYear1: number;
    baseNIIYear3: number;
    up200NIIYear3: number;
    down100NIIYear3: number;
    worstCaseNWR: number;
    worstCaseLCR: number;
  };
}

const DEFAULT_GROWTH: Record<string, number> = {
  consumer_loans: 0.04,
  auto_loans: 0.03,
  residential_mortgage: 0.05,
  commercial_re: 0.06,
  securities: 0.02,
  demand_deposits: 0.03,
  savings: 0.03,
  time_deposits: 0.04,
  borrowings: 0.02,
};

const DEFAULT_PREPAY: Record<string, number> = {
  residential_mortgage: 0.08,
  auto_loans: 0.15,
  consumer_loans: 0.2,
  commercial_re: 0.05,
};

const RATE_PATHS: Record<string, number> = {
  base: 0,
  up200: 200,
  down100: -100,
};

@Injectable()
export class ForwardSimulationService {
  private readonly logger = new Logger(ForwardSimulationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async runForwardSimulation(
    config: ForwardSimConfig,
  ): Promise<ForwardSimResult> {
    const items = await this.prisma.balanceSheetItem.findMany({
      where: { institutionId: config.institutionId },
    });

    const horizon = config.horizon ?? 3;
    const growth = { ...DEFAULT_GROWTH, ...config.growthAssumptions };
    const prepay = { ...DEFAULT_PREPAY, ...config.prepaymentAssumptions };
    const paths = config.ratePaths ?? ['base', 'up200', 'down100'];

    if (items.length === 0) return this.getDemoResult(horizon, paths);

    const totalQuarters = horizon * 4;
    const quarters: ForwardQuarter[] = [];

    for (const path of paths) {
      const shockBps = RATE_PATHS[path] ?? 0;
      let projectedAssets = [...items.filter((i) => i.category === 'asset')];
      let projectedLiabilities = [
        ...items.filter((i) => i.category === 'liability'),
      ];

      for (let q = 1; q <= totalQuarters; q++) {
        const year = Math.ceil(q / 4);
        const quarterLabel = `Q${((q - 1) % 4) + 1} ${new Date().getFullYear() + Math.ceil(q / 4) - 1}`;
        const quarterlyGrowth = (growthFactor: number) =>
          Math.pow(1 + growthFactor, 1 / 4);

        // Project balances
        let totalAssetBal = 0;
        let assetIncome = 0;
        for (const item of projectedAssets) {
          const sub = item.subcategory.toLowerCase();
          const gf = quarterlyGrowth(growth[sub] ?? 0.03);
          const prepayFactor = 1 - (prepay[sub] ?? 0) / 4;
          const balance = item.balance * gf * prepayFactor;
          const rate =
            item.rate +
            (shockBps / 10000) *
              (item.rateType === 'variable' ? 1.0 : q <= 4 ? 0 : 0.3);
          totalAssetBal += balance;
          assetIncome += (balance * rate) / 4;
          item.balance = balance;
        }

        let totalLiabBal = 0;
        let liabExpense = 0;
        for (const item of projectedLiabilities) {
          const sub = item.subcategory.toLowerCase();
          const gf = quarterlyGrowth(growth[sub] ?? 0.03);
          const beta = item.depositBeta ?? this.getDefaultBeta(sub);
          const balance = item.balance * gf;
          const rate = item.rate + (shockBps / 10000) * beta;
          totalLiabBal += balance;
          liabExpense += (balance * rate) / 4;
          item.balance = balance;
        }

        const nii = assetIncome - liabExpense;
        const equity = totalAssetBal - totalLiabBal;
        const nwr = totalAssetBal > 0 ? (equity / totalAssetBal) * 100 : 0;
        const lcr =
          100 + ((totalAssetBal * 0.15) / (totalLiabBal * 0.08) - 1) * 50; // simplified
        const nsfr = 100 + (equity / (totalAssetBal * 0.65) - 0.04) * 200; // simplified

        quarters.push({
          quarter: quarterLabel,
          ratePath: path,
          projectedNII: Math.round(nii * 100) / 100,
          projectedEVE: Math.round(equity * 100) / 100,
          projectedLCR: Math.min(200, Math.max(50, Math.round(lcr * 10) / 10)),
          projectedNSFR: Math.min(
            200,
            Math.max(50, Math.round(nsfr * 10) / 10),
          ),
          projectedNWR: Math.round(nwr * 100) / 100,
          totalAssets: Math.round(totalAssetBal * 10) / 10,
          totalLiabilities: Math.round(totalLiabBal * 10) / 10,
        });

        // Reset items for next path
        if (q === totalQuarters) {
          projectedAssets = [...items.filter((i) => i.category === 'asset')];
          projectedLiabilities = [
            ...items.filter((i) => i.category === 'liability'),
          ];
        }
      }
    }

    const baseQ = quarters.filter((q) => q.ratePath === 'base');
    const up200Q = quarters.filter((q) => q.ratePath === 'up200');
    const down100Q = quarters.filter((q) => q.ratePath === 'down100');

    return {
      config: { horizon, growthAssumptions: growth, ratePaths: paths },
      quarters,
      summary: {
        baseNIIYear1: baseQ.slice(0, 4).reduce((s, q) => s + q.projectedNII, 0),
        baseNIIYear3: baseQ.reduce((s, q) => s + q.projectedNII, 0),
        up200NIIYear3:
          up200Q.length > 0
            ? up200Q.reduce((s, q) => s + q.projectedNII, 0)
            : 0,
        down100NIIYear3:
          down100Q.length > 0
            ? down100Q.reduce((s, q) => s + q.projectedNII, 0)
            : 0,
        worstCaseNWR: Math.min(...quarters.map((q) => q.projectedNWR)),
        worstCaseLCR: Math.min(...quarters.map((q) => q.projectedLCR)),
      },
    };
  }

  private getDefaultBeta(sub: string): number {
    if (sub.includes('demand') || sub.includes('checking')) return 0.1;
    if (sub.includes('saving') || sub.includes('ahorro')) return 0.4;
    if (sub.includes('time') || sub.includes('cd') || sub.includes('plazo'))
      return 0.8;
    return 0.5;
  }

  private getDemoResult(horizon: number, paths: string[]): ForwardSimResult {
    const totalQ = horizon * 4;
    const quarters: ForwardQuarter[] = [];
    const baseNII = 3.2; // quarterly

    for (const path of paths) {
      const shock = RATE_PATHS[path] ?? 0;
      for (let q = 1; q <= totalQ; q++) {
        const growthFactor = Math.pow(1.03, q / 4);
        const rateEffect = ((shock / 10000) * 0.5 * q) / totalQ;
        quarters.push({
          quarter: `Q${((q - 1) % 4) + 1} ${new Date().getFullYear() + Math.ceil(q / 4) - 1}`,
          ratePath: path,
          projectedNII:
            Math.round((baseNII * growthFactor + baseNII * rateEffect) * 100) /
            100,
          projectedEVE:
            Math.round(
              (52 * growthFactor - (shock * 0.08 * q) / totalQ) * 100,
            ) / 100,
          projectedLCR: Math.min(
            180,
            Math.max(80, 115 + shock * 0.01 - q * 0.5),
          ),
          projectedNSFR: Math.min(160, Math.max(85, 108 + shock * 0.005)),
          projectedNWR: Math.max(5, 9.2 - q * 0.05 + shock * 0.001),
          totalAssets: Math.round(445 * growthFactor),
          totalLiabilities: Math.round(385 * growthFactor),
        });
      }
    }

    return {
      config: { horizon, growthAssumptions: DEFAULT_GROWTH, ratePaths: paths },
      quarters,
      summary: {
        baseNIIYear1: 12.8,
        baseNIIYear3: 41.2,
        up200NIIYear3: 48.5,
        down100NIIYear3: 35.8,
        worstCaseNWR: 6.8,
        worstCaseLCR: 88,
      },
    };
  }
}
