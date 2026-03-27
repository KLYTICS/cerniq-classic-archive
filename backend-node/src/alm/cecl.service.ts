import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// ─── Macro Scenario Weights (FASB 326 guidance) ──────────────

const SCENARIO_WEIGHTS = {
  baseline: 0.5,
  adverse: 0.3,
  severely_adverse: 0.2,
};

// PD multiplier by scenario
const PD_MULTIPLIERS = {
  baseline: 1.0,
  adverse: 1.8,
  severely_adverse: 3.0,
};

// ─── Types ───────────────────────────────────────────────────

export interface CECLSegmentResult {
  segmentName: string;
  balance: number;
  methodology: string;
  historicalLossRate: number;
  qualitativeAdj: number;
  adjustedLossRate: number;
  expectedLoss: number;
  allowanceRequired: number;
  coverageRatio: number; // allowance / balance
}

export interface CECLSummary {
  totalBalance: number;
  totalAllowance: number;
  weightedCoverageRatio: number;
  methodology: string;
  segments: CECLSegmentResult[];
  macroScenarioBreakdown?: {
    baseline: number;
    adverse: number;
    severelyAdverse: number;
    weighted: number;
  };
}

export interface CECLForecast {
  quarters: Array<{
    quarter: string;
    allowance: number;
    provisionExpense: number;
    netChargeOffs: number;
    coverageRatio: number;
  }>;
  totalProvision12M: number;
}

@Injectable()
export class CECLService {
  private readonly logger = new Logger(CECLService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── WARM Method (Weighted Average Remaining Life) ─────────

  calculateWARM(
    segments: Array<{
      segmentName: string;
      balance: number;
      weightedAvgMaturity: number;
      historicalLossRate: number;
      lgd?: number;
      qualitativeAdj?: number;
    }>,
  ): CECLSummary {
    const results: CECLSegmentResult[] = segments.map((seg) => {
      const adjRate = seg.historicalLossRate + (seg.qualitativeAdj ?? 0);
      // WARM: lifetime loss = annual loss rate × remaining life
      const lifetimeLossRate = adjRate * seg.weightedAvgMaturity;
      const expectedLoss = seg.balance * lifetimeLossRate;
      const allowance = expectedLoss;

      return {
        segmentName: seg.segmentName,
        balance: seg.balance,
        methodology: 'WARM',
        historicalLossRate: seg.historicalLossRate,
        qualitativeAdj: seg.qualitativeAdj ?? 0,
        adjustedLossRate: adjRate,
        expectedLoss,
        allowanceRequired: allowance,
        coverageRatio: seg.balance > 0 ? allowance / seg.balance : 0,
      };
    });

    const totalBalance = results.reduce((sum, r) => sum + r.balance, 0);
    const totalAllowance = results.reduce(
      (sum, r) => sum + r.allowanceRequired,
      0,
    );

    return {
      totalBalance,
      totalAllowance,
      weightedCoverageRatio:
        totalBalance > 0 ? totalAllowance / totalBalance : 0,
      methodology: 'WARM',
      segments: results,
    };
  }

  // ─── Vintage / Cohort Analysis ────────────────────────────

  calculateVintage(
    segments: Array<{
      segmentName: string;
      balance: number;
      weightedAvgMaturity: number;
      historicalLossRate: number;
      lgd?: number;
      qualitativeAdj?: number;
    }>,
  ): CECLSummary {
    const results: CECLSegmentResult[] = segments.map((seg) => {
      // Vintage: cumulative loss curve based on age
      // Simplified: use loss emergence pattern (30% Y1, 25% Y2, 20% Y3, 15% Y4, 10% Y5+)
      const emergencePattern = [0.3, 0.25, 0.2, 0.15, 0.1];
      const years = Math.ceil(seg.weightedAvgMaturity);
      const adjRate = seg.historicalLossRate + (seg.qualitativeAdj ?? 0);

      let cumulativeLoss = 0;
      for (let y = 0; y < Math.min(years, emergencePattern.length); y++) {
        cumulativeLoss += adjRate * emergencePattern[y];
      }
      // Any remaining years use flat tail
      if (years > emergencePattern.length) {
        const remainingYears = years - emergencePattern.length;
        cumulativeLoss += adjRate * 0.05 * remainingYears;
      }

      const expectedLoss = seg.balance * cumulativeLoss;
      const lgd = seg.lgd ?? 0.5;
      const allowance = expectedLoss * lgd;

      return {
        segmentName: seg.segmentName,
        balance: seg.balance,
        methodology: 'Vintage',
        historicalLossRate: seg.historicalLossRate,
        qualitativeAdj: seg.qualitativeAdj ?? 0,
        adjustedLossRate: adjRate,
        expectedLoss,
        allowanceRequired: allowance,
        coverageRatio: seg.balance > 0 ? allowance / seg.balance : 0,
      };
    });

    const totalBalance = results.reduce((sum, r) => sum + r.balance, 0);
    const totalAllowance = results.reduce(
      (sum, r) => sum + r.allowanceRequired,
      0,
    );

    return {
      totalBalance,
      totalAllowance,
      weightedCoverageRatio:
        totalBalance > 0 ? totalAllowance / totalBalance : 0,
      methodology: 'Vintage',
      segments: results,
    };
  }

  // ─── PD × LGD with Macro Scenarios ────────────────────────

  calculatePDxLGD(
    segments: Array<{
      segmentName: string;
      balance: number;
      weightedAvgMaturity: number;
      historicalLossRate: number;
      lgd?: number;
      qualitativeAdj?: number;
    }>,
  ): CECLSummary {
    const scenarioResults: Record<string, CECLSegmentResult[]> = {};
    const scenarioTotals: Record<string, number> = {};

    for (const [scenario, pdMult] of Object.entries(PD_MULTIPLIERS)) {
      const results: CECLSegmentResult[] = segments.map((seg) => {
        const basePD = seg.historicalLossRate + (seg.qualitativeAdj ?? 0);
        const scenarioPD = basePD * pdMult;
        const lgd = seg.lgd ?? 0.5;

        // Lifetime PD: 1 - (1 - annual PD)^maturity
        const lifetimePD =
          1 - Math.pow(1 - Math.min(scenarioPD, 0.99), seg.weightedAvgMaturity);
        const expectedLoss = seg.balance * lifetimePD * lgd;

        return {
          segmentName: seg.segmentName,
          balance: seg.balance,
          methodology: `PD×LGD (${scenario})`,
          historicalLossRate: seg.historicalLossRate,
          qualitativeAdj: seg.qualitativeAdj ?? 0,
          adjustedLossRate: scenarioPD,
          expectedLoss,
          allowanceRequired: expectedLoss,
          coverageRatio: seg.balance > 0 ? expectedLoss / seg.balance : 0,
        };
      });

      scenarioResults[scenario] = results;
      scenarioTotals[scenario] = results.reduce(
        (sum, r) => sum + r.allowanceRequired,
        0,
      );
    }

    // Weighted average across scenarios
    const weightedAllowance =
      scenarioTotals.baseline * SCENARIO_WEIGHTS.baseline +
      scenarioTotals.adverse * SCENARIO_WEIGHTS.adverse +
      scenarioTotals.severely_adverse * SCENARIO_WEIGHTS.severely_adverse;

    // Use baseline segment breakdown with weighted allowance
    const baselineResults = scenarioResults.baseline;
    const totalBalance = baselineResults.reduce((sum, r) => sum + r.balance, 0);

    // Prorate weighted allowance across segments
    const baselineTotal = scenarioTotals.baseline || 1;
    const weightedResults = baselineResults.map((r) => ({
      ...r,
      methodology: 'PD×LGD (Weighted)',
      allowanceRequired:
        (r.allowanceRequired / baselineTotal) * weightedAllowance,
      coverageRatio:
        r.balance > 0
          ? ((r.allowanceRequired / baselineTotal) * weightedAllowance) /
            r.balance
          : 0,
    }));

    return {
      totalBalance,
      totalAllowance: weightedAllowance,
      weightedCoverageRatio:
        totalBalance > 0 ? weightedAllowance / totalBalance : 0,
      methodology: 'PD×LGD',
      segments: weightedResults,
      macroScenarioBreakdown: {
        baseline: scenarioTotals.baseline,
        adverse: scenarioTotals.adverse,
        severelyAdverse: scenarioTotals.severely_adverse,
        weighted: weightedAllowance,
      },
    };
  }

  // ─── Enterprise: Full CECL Analysis ────────────────────────

  async getCECLAnalysis(
    institutionId: string,
    methodology?: string,
  ): Promise<CECLSummary> {
    const segments = await this.prisma.loanSegment.findMany({
      where: { institutionId },
      orderBy: { balance: 'desc' },
    });

    if (segments.length === 0) {
      // Return demo segments
      return this.calculateWARM(this.getDemoSegments());
    }

    const segmentData = segments.map((s) => ({
      segmentName: s.segmentName,
      balance: s.balance,
      weightedAvgRate: s.weightedAvgRate,
      weightedAvgMaturity: s.weightedAvgMaturity,
      historicalLossRate: s.historicalLossRate,
      lgd: s.lgd,
      qualitativeAdj: s.qualitativeAdj,
    }));

    switch (methodology) {
      case 'vintage':
        return this.calculateVintage(segmentData);
      case 'pdlgd':
        return this.calculatePDxLGD(segmentData);
      default:
        return this.calculateWARM(segmentData);
    }
  }

  // ─── 8-Quarter Forecast ────────────────────────────────────

  async getCECLForecast(institutionId: string): Promise<CECLForecast> {
    const current = await this.getCECLAnalysis(institutionId);

    const quarters: CECLForecast['quarters'] = [];
    let prevAllowance = current.totalAllowance;
    const baseChargeOffRate = current.weightedCoverageRatio * 0.25; // quarterly

    for (let q = 1; q <= 8; q++) {
      // Assume gradual normalization
      const growthFactor = 1 + (q <= 4 ? 0.02 : -0.01); // slight growth then stabilization
      const quarterBalance = current.totalBalance * Math.pow(growthFactor, q);
      const quarterCoverage =
        current.weightedCoverageRatio * (1 + (q <= 2 ? 0.05 : -0.02) * q);
      const targetAllowance = quarterBalance * Math.max(quarterCoverage, 0.005);
      const netChargeOffs = quarterBalance * baseChargeOffRate * (1 + q * 0.05);
      const provisionExpense = targetAllowance - prevAllowance + netChargeOffs;

      const now = new Date();
      const quarterDate = new Date(
        now.getFullYear(),
        now.getMonth() + q * 3,
        1,
      );
      const quarterLabel = `Q${Math.ceil((quarterDate.getMonth() + 1) / 3)} ${quarterDate.getFullYear()}`;

      quarters.push({
        quarter: quarterLabel,
        allowance: targetAllowance,
        provisionExpense: Math.max(provisionExpense, 0),
        netChargeOffs,
        coverageRatio:
          quarterBalance > 0 ? targetAllowance / quarterBalance : 0,
      });

      prevAllowance = targetAllowance;
    }

    return {
      quarters,
      totalProvision12M: quarters
        .slice(0, 4)
        .reduce((sum, q) => sum + q.provisionExpense, 0),
    };
  }

  // ─── Import Segments ──────────────────────────────────────

  async importLoanSegments(
    institutionId: string,
    segments: Array<{
      segmentName: string;
      balance: number;
      weightedAvgRate: number;
      weightedAvgMaturity: number;
      historicalLossRate: number;
      lgd?: number;
      qualitativeAdj?: number;
    }>,
  ) {
    // Delete existing segments for this institution
    await this.prisma.loanSegment.deleteMany({ where: { institutionId } });

    const created = await this.prisma.loanSegment.createMany({
      data: segments.map((s) => ({
        institutionId,
        segmentName: s.segmentName,
        balance: s.balance,
        weightedAvgRate: s.weightedAvgRate,
        weightedAvgMaturity: s.weightedAvgMaturity,
        historicalLossRate: s.historicalLossRate,
        lgd: s.lgd ?? 0.5,
        qualitativeAdj: s.qualitativeAdj ?? 0,
        asOfDate: new Date(),
      })),
    });

    return { imported: created.count, institutionId };
  }

  // ─── Demo Data ────────────────────────────────────────────

  private getDemoSegments() {
    return [
      {
        segmentName: 'Consumer Loans',
        balance: 85,
        weightedAvgRate: 0.072,
        weightedAvgMaturity: 3.5,
        historicalLossRate: 0.018,
        lgd: 0.45,
        qualitativeAdj: 0.002,
      },
      {
        segmentName: 'Auto Loans',
        balance: 62,
        weightedAvgRate: 0.065,
        weightedAvgMaturity: 4.2,
        historicalLossRate: 0.012,
        lgd: 0.35,
        qualitativeAdj: 0.001,
      },
      {
        segmentName: 'Commercial RE',
        balance: 120,
        weightedAvgRate: 0.058,
        weightedAvgMaturity: 7.5,
        historicalLossRate: 0.008,
        lgd: 0.4,
        qualitativeAdj: 0.003,
      },
      {
        segmentName: 'Residential Mortgage',
        balance: 95,
        weightedAvgRate: 0.055,
        weightedAvgMaturity: 15.0,
        historicalLossRate: 0.004,
        lgd: 0.3,
        qualitativeAdj: 0.001,
      },
      {
        segmentName: 'Credit Cards',
        balance: 28,
        weightedAvgRate: 0.145,
        weightedAvgMaturity: 1.5,
        historicalLossRate: 0.035,
        lgd: 0.8,
        qualitativeAdj: 0.005,
      },
      {
        segmentName: 'Commercial & Industrial',
        balance: 55,
        weightedAvgRate: 0.068,
        weightedAvgMaturity: 5.0,
        historicalLossRate: 0.015,
        lgd: 0.5,
        qualitativeAdj: 0.002,
      },
    ];
  }
}
