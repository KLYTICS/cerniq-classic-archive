import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// ─── Types ───────────────────────────────────────────────────

export interface CohortCell {
  originationQtr: string;
  ageMonths: number;
  cumulativeDefaultRate: number;
  balance: number;
}

export interface WeibullParams {
  loanType: string;
  shape: number; // k (shape parameter, >1 means increasing hazard)
  scale: number; // λ (scale parameter)
  r2: number; // goodness of fit
}

export interface VintageAllowanceResult {
  methodology: 'vintage';
  totalBalance: number;
  baseAllowance: number;
  adverseAllowance: number;
  severeAllowance: number;
  segmentBreakdown: Record<
    string,
    { base: number; adverse: number; severe: number; balance: number }
  >;
  cohortMatrix: CohortCell[];
  weibullParams: WeibullParams[];
}

// PR-specific qualitative factor adjustments
const PR_MACRO_FACTORS: Record<
  string,
  { base: number; adverse: number; severe: number }
> = {
  tourism: { base: 0, adverse: 0.002, severe: 0.005 }, // tourism downturn impact
  pharma: { base: 0, adverse: 0.001, severe: 0.003 }, // pharmaceutical sector
  hurricane: { base: 0, adverse: 0.008, severe: 0.02 }, // hurricane impact modifier
  inflation: { base: 0, adverse: 0.002, severe: 0.004 },
};

@Injectable()
export class CECLVintageService {
  private readonly logger = new Logger(CECLVintageService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Build Cohort Matrix from DB ──────────────────────────

  async getCohortMatrix(institutionId: string): Promise<CohortCell[]> {
    const cohorts = await this.prisma.loanCohort.findMany({
      where: { institutionId },
      orderBy: [{ originationQtr: 'asc' }, { ageMonths: 'asc' }],
    });

    if (cohorts.length === 0) return this.getDemoCohortMatrix();

    return cohorts.map((c) => ({
      originationQtr: c.originationQtr,
      ageMonths: c.ageMonths,
      cumulativeDefaultRate:
        c.originalBalance > 0 ? c.defaults / c.originalBalance : 0,
      balance: c.currentBalance,
    }));
  }

  // ─── Weibull Survival Fit ─────────────────────────────────

  fitWeibull(cohorts: CohortCell[], loanType: string): WeibullParams {
    // Weibull CDF: F(t) = 1 - exp(-(t/λ)^k)
    // Linearized: ln(-ln(1-F(t))) = k·ln(t) - k·ln(λ)
    // OLS on y = k·x + c where y = ln(-ln(1-F)), x = ln(t)

    const validPoints = cohorts.filter(
      (c) =>
        c.cumulativeDefaultRate > 0 &&
        c.cumulativeDefaultRate < 1 &&
        c.ageMonths > 0,
    );

    if (validPoints.length < 3) {
      return { loanType, shape: 1.5, scale: 36, r2: 0 }; // default
    }

    const xs = validPoints.map((c) => Math.log(c.ageMonths));
    const ys = validPoints.map((c) =>
      Math.log(-Math.log(1 - c.cumulativeDefaultRate)),
    );

    // OLS: y = b0 + b1*x
    const n = xs.length;
    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = ys.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
    const sumXX = xs.reduce((a, x) => a + x * x, 0);

    const b1 = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const b0 = (sumY - b1 * sumX) / n;

    const shape = Math.max(0.5, Math.min(5, b1)); // k
    const scale = Math.exp(-b0 / shape); // λ

    // R²
    const yMean = sumY / n;
    const ssRes = ys.reduce((a, y, i) => a + (y - (b0 + b1 * xs[i])) ** 2, 0);
    const ssTot = ys.reduce((a, y) => a + (y - yMean) ** 2, 0);
    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    return { loanType, shape, scale, r2 };
  }

  // ─── Full Vintage Analysis ────────────────────────────────

  async runVintageAnalysis(
    institutionId: string,
    macroScenario: 'base' | 'adverse' | 'severe' = 'base',
  ): Promise<VintageAllowanceResult> {
    const cohorts = await this.getCohortMatrix(institutionId);
    const loanSegments = await this.prisma.loanSegment.findMany({
      where: { institutionId },
    });

    // Group cohorts by loan type
    const byType = new Map<string, CohortCell[]>();
    for (const c of cohorts) {
      const type = this.inferLoanType(c.originationQtr);
      if (!byType.has(type)) byType.set(type, []);
      byType.get(type).push(c);
    }

    // Fit Weibull per type
    const weibullParams: WeibullParams[] = [];
    for (const [type, cells] of byType) {
      weibullParams.push(this.fitWeibull(cells, type));
    }

    // Compute allowance per segment
    const segmentBreakdown: VintageAllowanceResult['segmentBreakdown'] = {};
    let totalBase = 0,
      totalAdverse = 0,
      totalSevere = 0,
      totalBalance = 0;

    for (const seg of loanSegments.length > 0
      ? loanSegments
      : this.getDemoSegments()) {
      const weibull = weibullParams.find(
        (w) => w.loanType === this.normalizeLoanType(seg.segmentName),
      ) ?? { shape: 1.5, scale: 36, r2: 0, loanType: seg.segmentName };

      const lifetimeMonths = (seg.weightedAvgMaturity ?? 5) * 12;

      // Weibull lifetime PD: F(T) = 1 - exp(-(T/λ)^k)
      const basePD =
        1 - Math.exp(-Math.pow(lifetimeMonths / weibull.scale, weibull.shape));

      // Macro adjustments
      const macroAdj = Object.values(PR_MACRO_FACTORS).reduce(
        (s, f) => s + f[macroScenario],
        0,
      );
      const lgd = seg.lgd ?? 0.5;

      const baseEL = seg.balance * (basePD + (seg.qualitativeAdj ?? 0)) * lgd;
      const adverseEL =
        seg.balance *
        (basePD * 1.8 + macroAdj + (seg.qualitativeAdj ?? 0)) *
        lgd;
      const severeEL =
        seg.balance *
        (basePD * 3.0 + macroAdj * 2 + (seg.qualitativeAdj ?? 0)) *
        lgd;

      segmentBreakdown[seg.segmentName] = {
        base: Math.round(baseEL * 1000) / 1000,
        adverse: Math.round(adverseEL * 1000) / 1000,
        severe: Math.round(severeEL * 1000) / 1000,
        balance: seg.balance,
      };

      totalBase += baseEL;
      totalAdverse += adverseEL;
      totalSevere += severeEL;
      totalBalance += seg.balance;
    }

    // Persist result
    try {
      await this.prisma.ceclVintageAllowance.create({
        data: {
          institutionId,
          methodology: 'vintage',
          baseAllowance: totalBase,
          adverseAllowance: totalAdverse,
          severeAllowance: totalSevere,
          segmentBreakdown: segmentBreakdown as any,
        },
      });
    } catch {
      /* non-critical */
    }

    return {
      methodology: 'vintage',
      totalBalance,
      baseAllowance: Math.round(totalBase * 100) / 100,
      adverseAllowance: Math.round(totalAdverse * 100) / 100,
      severeAllowance: Math.round(totalSevere * 100) / 100,
      segmentBreakdown,
      cohortMatrix: cohorts,
      weibullParams,
    };
  }

  // ─── Import Cohort Data ───────────────────────────────────

  async importCohorts(
    institutionId: string,
    cohorts: Array<{
      loanType: string;
      originationQtr: string;
      originalBalance: number;
      currentBalance: number;
      defaults: number;
      ageMonths: number;
    }>,
  ) {
    await this.prisma.loanCohort.deleteMany({ where: { institutionId } });
    const created = await this.prisma.loanCohort.createMany({
      data: cohorts.map((c) => ({ institutionId, ...c })),
    });
    return { imported: created.count };
  }

  // ─── Private ──────────────────────────────────────────────

  private inferLoanType(originationQtr: string): string {
    // In real implementation, this comes from the cohort data
    return 'consumer';
  }

  private normalizeLoanType(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('auto') || n.includes('vehicle')) return 'auto';
    if (n.includes('mortgage') || n.includes('residential'))
      return 'residential_mortgage';
    if (n.includes('commercial') && n.includes('re')) return 'commercial_re';
    if (n.includes('consumer') || n.includes('personal')) return 'consumer';
    if (n.includes('credit') && n.includes('card')) return 'credit_cards';
    return 'consumer';
  }

  private getDemoCohortMatrix(): CohortCell[] {
    const qtrs = [
      '2022Q1',
      '2022Q2',
      '2022Q3',
      '2022Q4',
      '2023Q1',
      '2023Q2',
      '2023Q3',
      '2023Q4',
    ];
    const ages = [6, 12, 18, 24, 30, 36];
    const cells: CohortCell[] = [];

    for (const qtr of qtrs) {
      const qIdx = qtrs.indexOf(qtr);
      for (const age of ages) {
        if (age > (qtrs.length - qIdx) * 6) continue;
        const baseLoss = 0.002 * (age / 6); // increasing with age
        const noise = Math.sin(qIdx * 3 + age) * 0.001;
        cells.push({
          originationQtr: qtr,
          ageMonths: age,
          cumulativeDefaultRate: Math.max(0, baseLoss + noise),
          balance: 10 - age * 0.1 - qIdx * 0.2,
        });
      }
    }
    return cells;
  }

  private getDemoSegments() {
    return [
      {
        segmentName: 'Consumer Loans',
        balance: 85,
        weightedAvgMaturity: 3.5,
        lgd: 0.45,
        qualitativeAdj: 0.002,
      },
      {
        segmentName: 'Auto Loans',
        balance: 62,
        weightedAvgMaturity: 4.2,
        lgd: 0.35,
        qualitativeAdj: 0.001,
      },
      {
        segmentName: 'Commercial RE',
        balance: 120,
        weightedAvgMaturity: 7.5,
        lgd: 0.4,
        qualitativeAdj: 0.003,
      },
      {
        segmentName: 'Residential Mortgage',
        balance: 95,
        weightedAvgMaturity: 15.0,
        lgd: 0.3,
        qualitativeAdj: 0.001,
      },
    ];
  }
}
