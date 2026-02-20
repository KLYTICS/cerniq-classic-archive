import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AlmService } from './alm.service';
import {
  BalanceSheetDto,
  InstrumentDto,
  FullAnalysisResult,
  DurationGapResult,
  NIIResult,
  LCRResult,
} from './alm.dto';

/** Round to n decimal places */
function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export interface DurationGapSummary {
  assetDuration: number;
  liabilityDuration: number;
  durationGap: number;
  riskProfile: 'asset-sensitive' | 'liability-sensitive' | 'neutral';
}

export interface NIISensitivityResult {
  scenarios: Array<{
    name: string;
    shiftBps: number;
    niImpact: number;
    niImpactPct: number;
    mveImpact: number;
    mveImpactPct: number;
  }>;
  baseNII: number;
  riskRating: 'low' | 'moderate' | 'high' | 'critical';
}

export interface LCRSummary {
  lcr: number;
  hqla: number;
  netOutflows: number;
  status: 'compliant' | 'warning' | 'breach';
  buffer: number;
}

export interface ALMSummaryResult {
  institution: {
    id: string;
    name: string;
    type: string;
    totalAssets: number;
    currency: string;
    reportingDate: string;
  };
  durationGap: DurationGapSummary;
  niiSensitivity: NIISensitivityResult;
  liquidity: LCRSummary;
  topRisks: string[];
  recommendations: string[];
  riskScore: number;
  fullAnalysis: FullAnalysisResult;
}

@Injectable()
export class AlmEnterpriseService {
  private readonly logger = new Logger(AlmEnterpriseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly almService: AlmService,
  ) {}

  // ─── Institution CRUD ──────────────────────────────────────────

  async createInstitution(data: {
    workspaceId: string;
    name: string;
    type: string;
    totalAssets: number;
    currency?: string;
    reportingDate: string;
  }) {
    return this.prisma.institution.create({
      data: {
        workspaceId: data.workspaceId,
        name: data.name,
        type: data.type,
        totalAssets: data.totalAssets,
        currency: data.currency || 'USD',
        reportingDate: new Date(data.reportingDate),
      },
    });
  }

  async getInstitution(institutionId: string) {
    const inst = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      include: {
        balanceSheetItems: true,
        liquidityPositions: { orderBy: { date: 'desc' }, take: 1 },
      },
    });
    if (!inst) throw new NotFoundException('Institution not found');
    return inst;
  }

  async getInstitutionsByWorkspace(workspaceId: string) {
    return this.prisma.institution.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Balance Sheet Import ──────────────────────────────────────

  async importBalanceSheetItems(
    institutionId: string,
    items: Array<{
      category: string;
      subcategory: string;
      name: string;
      balance: number;
      rate: number;
      duration: number;
      repriceDate?: string;
      maturityDate?: string;
      rateType: string;
    }>,
  ) {
    // Delete existing items and replace
    await this.prisma.balanceSheetItem.deleteMany({
      where: { institutionId },
    });

    const created = await this.prisma.balanceSheetItem.createMany({
      data: items.map((item) => ({
        institutionId,
        category: item.category,
        subcategory: item.subcategory,
        name: item.name,
        balance: item.balance,
        rate: item.rate,
        duration: item.duration,
        repriceDate: item.repriceDate ? new Date(item.repriceDate) : null,
        maturityDate: item.maturityDate ? new Date(item.maturityDate) : null,
        rateType: item.rateType,
      })),
    });

    // Update institution totalAssets
    const assetTotal = items
      .filter((i) => i.category === 'asset')
      .reduce((sum, i) => sum + i.balance, 0);
    await this.prisma.institution.update({
      where: { id: institutionId },
      data: { totalAssets: assetTotal },
    });

    return { count: created.count };
  }

  // ─── Save Liquidity Position ───────────────────────────────────

  async saveLiquidityPosition(
    institutionId: string,
    data: {
      hqlaLevel1: number;
      hqlaLevel2: number;
      cashOutflows: number;
      cashInflows: number;
      lcr: number;
      nsfr: number;
    },
  ) {
    return this.prisma.liquidityPosition.create({
      data: {
        institutionId,
        date: new Date(),
        ...data,
      },
    });
  }

  // ─── Core ALM Calculations (DB-backed) ─────────────────────────

  /**
   * Convert DB balance sheet items into the stateless BalanceSheetDto
   * format expected by the existing AlmService calculation engine.
   */
  private async buildBalanceSheetDto(institutionId: string): Promise<BalanceSheetDto> {
    const items = await this.prisma.balanceSheetItem.findMany({
      where: { institutionId },
    });

    if (items.length === 0) {
      // Return empty-but-valid balance sheet
      return {
        assets: [{ name: 'No assets', amount: 0, rate: 0, maturityYears: 0, isFloating: false }],
        liabilities: [{ name: 'No liabilities', amount: 0, rate: 0, maturityYears: 0, isFloating: false }],
        equity: 0,
      };
    }

    const toInstrument = (item: typeof items[0]): InstrumentDto => {
      const maturityYears = item.maturityDate
        ? Math.max(0, (item.maturityDate.getTime() - Date.now()) / (365.25 * 24 * 3600 * 1000))
        : item.duration; // use duration as proxy for maturity if no date

      return {
        name: item.name,
        amount: item.balance * 1_000_000, // balance is in millions, AlmService expects dollars
        rate: item.rate,
        maturityYears: round(maturityYears, 2),
        isFloating: item.rateType === 'variable',
        repricingFrequencyMonths: item.rateType === 'variable' && item.repriceDate
          ? Math.max(1, round((item.repriceDate.getTime() - Date.now()) / (30 * 24 * 3600 * 1000), 0))
          : item.rateType === 'variable' ? 3 : undefined, // default quarterly for variable
      };
    };

    const assets = items.filter((i) => i.category === 'asset').map(toInstrument);
    const liabilities = items.filter((i) => i.category === 'liability').map(toInstrument);

    const totalAssets = assets.reduce((s, a) => s + a.amount, 0);
    const totalLiabilities = liabilities.reduce((s, l) => s + l.amount, 0);
    const equity = totalAssets - totalLiabilities;

    return {
      assets: assets.length > 0 ? assets : [{ name: 'No assets', amount: 0, rate: 0, maturityYears: 0, isFloating: false }],
      liabilities: liabilities.length > 0 ? liabilities : [{ name: 'No liabilities', amount: 0, rate: 0, maturityYears: 0, isFloating: false }],
      equity,
    };
  }

  async calculateDurationGap(institutionId: string): Promise<DurationGapSummary> {
    const bs = await this.buildBalanceSheetDto(institutionId);
    const result = this.almService.durationGapAnalysis(bs);

    const gap = result.durationGap;
    let riskProfile: 'asset-sensitive' | 'liability-sensitive' | 'neutral';
    if (Math.abs(gap) < 0.5) {
      riskProfile = 'neutral';
    } else if (gap > 0) {
      riskProfile = 'asset-sensitive';
    } else {
      riskProfile = 'liability-sensitive';
    }

    return {
      assetDuration: round(result.assetDuration, 2),
      liabilityDuration: round(result.liabilityDuration, 2),
      durationGap: round(gap, 2),
      riskProfile,
    };
  }

  async calculateNIISensitivity(institutionId: string): Promise<NIISensitivityResult> {
    const bs = await this.buildBalanceSheetDto(institutionId);
    const niiResult = this.almService.niiSimulation(bs);
    const eveResult = this.almService.eveAnalysis(bs);

    const scenarios = niiResult.scenarios
      .filter((s) => s.shockBps !== 0)
      .map((s) => {
        const eveScenario = eveResult.scenarios.find((e) => e.shockBps === s.shockBps);
        return {
          name: s.shockBps > 0 ? `+${s.shockBps}bps` : `${s.shockBps}bps`,
          shiftBps: s.shockBps,
          niImpact: round(s.change / 1_000_000, 2), // convert to millions
          niImpactPct: round(s.changePct * 100, 2),
          mveImpact: eveScenario ? round(eveScenario.change / 1_000_000, 2) : 0,
          mveImpactPct: eveScenario ? round(eveScenario.changePct * 100, 2) : 0,
        };
      });

    // Risk rating based on worst-case NII impact
    const worstPct = Math.max(...scenarios.map((s) => Math.abs(s.niImpactPct)));
    let riskRating: 'low' | 'moderate' | 'high' | 'critical';
    if (worstPct < 5) riskRating = 'low';
    else if (worstPct < 10) riskRating = 'moderate';
    else if (worstPct < 20) riskRating = 'high';
    else riskRating = 'critical';

    return {
      scenarios,
      baseNII: round(niiResult.baseNII / 1_000_000, 2), // in millions
      riskRating,
    };
  }

  async calculateLCR(institutionId: string): Promise<LCRSummary> {
    // Try to use stored liquidity position first
    const latestPosition = await this.prisma.liquidityPosition.findFirst({
      where: { institutionId },
      orderBy: { date: 'desc' },
    });

    if (latestPosition) {
      const hqla = latestPosition.hqlaLevel1 + latestPosition.hqlaLevel2;
      const netOutflows = latestPosition.cashOutflows - latestPosition.cashInflows;
      return {
        lcr: round(latestPosition.lcr, 2),
        hqla: round(hqla, 2),
        netOutflows: round(netOutflows, 2),
        status: latestPosition.lcr >= 100 ? 'compliant' : latestPosition.lcr >= 90 ? 'warning' : 'breach',
        buffer: round(latestPosition.lcr - 100, 2),
      };
    }

    // Fall back to deriving from balance sheet
    const bs = await this.buildBalanceSheetDto(institutionId);
    const lcrResult = this.almService.fullAnalysis(bs).lcr;

    if (!lcrResult) {
      return { lcr: 0, hqla: 0, netOutflows: 0, status: 'breach', buffer: -100 };
    }

    return {
      lcr: round(lcrResult.lcr, 2),
      hqla: round(lcrResult.hqlaTotal / 1_000_000, 2), // in millions
      netOutflows: round(lcrResult.totalNetOutflows / 1_000_000, 2),
      status: lcrResult.status,
      buffer: round(lcrResult.lcr - 100, 2),
    };
  }

  async getALMSummary(institutionId: string): Promise<ALMSummaryResult> {
    const institution = await this.getInstitution(institutionId);
    const bs = await this.buildBalanceSheetDto(institutionId);
    const fullAnalysis = this.almService.fullAnalysis(bs);

    const durationGap = await this.calculateDurationGap(institutionId);
    const niiSensitivity = await this.calculateNIISensitivity(institutionId);
    const liquidity = await this.calculateLCR(institutionId);

    // ─── Risk Score (0-100) ───
    // Duration gap: 40% weight, NII sensitivity: 35%, LCR: 25%
    const durationGapScore = this.scoreDurationGap(durationGap.durationGap);
    const niiScore = this.scoreNII(niiSensitivity);
    const lcrScore = this.scoreLCR(liquidity.lcr);

    const riskScore = round(
      durationGapScore * 0.40 + niiScore * 0.35 + lcrScore * 0.25,
      0,
    );

    // ─── Top Risks ───
    const topRisks = this.identifyTopRisks(durationGap, niiSensitivity, liquidity);

    // ─── Recommendations ───
    const recommendations = this.generateRecommendations(durationGap, niiSensitivity, liquidity);

    // Save computed scenarios to DB
    await this.persistScenarios(institutionId, niiSensitivity, fullAnalysis);

    return {
      institution: {
        id: institution.id,
        name: institution.name,
        type: institution.type,
        totalAssets: institution.totalAssets,
        currency: institution.currency,
        reportingDate: institution.reportingDate.toISOString(),
      },
      durationGap,
      niiSensitivity,
      liquidity,
      topRisks,
      recommendations,
      riskScore,
      fullAnalysis,
    };
  }

  // ─── Risk Scoring ──────────────────────────────────────────────

  /** Score duration gap (0=worst, 100=best). Gap near 0 is ideal. */
  private scoreDurationGap(gap: number): number {
    const absGap = Math.abs(gap);
    if (absGap < 0.5) return 95;
    if (absGap < 1.0) return 80;
    if (absGap < 2.0) return 60;
    if (absGap < 3.0) return 40;
    if (absGap < 5.0) return 20;
    return 5;
  }

  /** Score NII sensitivity (0=worst, 100=best) */
  private scoreNII(nii: NIISensitivityResult): number {
    switch (nii.riskRating) {
      case 'low': return 90;
      case 'moderate': return 70;
      case 'high': return 40;
      case 'critical': return 15;
    }
  }

  /** Score LCR (0=worst, 100=best). >=100% is good. */
  private scoreLCR(lcr: number): number {
    if (lcr >= 150) return 95;
    if (lcr >= 120) return 85;
    if (lcr >= 100) return 70;
    if (lcr >= 90) return 40;
    if (lcr >= 80) return 20;
    return 5;
  }

  // ─── Risk Identification ───────────────────────────────────────

  private identifyTopRisks(
    dg: DurationGapSummary,
    nii: NIISensitivityResult,
    lcr: LCRSummary,
  ): string[] {
    const risks: string[] = [];

    if (Math.abs(dg.durationGap) > 2.0) {
      risks.push(
        dg.durationGap > 0
          ? `Significant duration mismatch (+${dg.durationGap}yr) — equity exposed to rising rates`
          : `Significant duration mismatch (${dg.durationGap}yr) — equity exposed to falling rates`,
      );
    }

    if (nii.riskRating === 'high' || nii.riskRating === 'critical') {
      const worstScenario = nii.scenarios.reduce((worst, s) =>
        Math.abs(s.niImpact) > Math.abs(worst.niImpact) ? s : worst,
      );
      risks.push(
        `NII at risk: ${worstScenario.name} scenario impacts NII by $${worstScenario.niImpact}M (${worstScenario.niImpactPct}%)`,
      );
    }

    if (lcr.status === 'breach') {
      risks.push(`LCR below Basel III minimum (${lcr.lcr}% vs 100% required)`);
    } else if (lcr.status === 'warning') {
      risks.push(`LCR near minimum threshold (${lcr.lcr}%) — limited buffer`);
    }

    if (risks.length === 0) {
      risks.push('No significant risks identified — strong ALM position');
    }

    return risks;
  }

  // ─── Recommendations ───────────────────────────────────────────

  private generateRecommendations(
    dg: DurationGapSummary,
    nii: NIISensitivityResult,
    lcr: LCRSummary,
  ): string[] {
    const recs: string[] = [];

    if (dg.riskProfile === 'asset-sensitive' && dg.durationGap > 1.5) {
      recs.push('Consider extending liability duration (e.g., longer-term CDs or FHLB advances) to narrow the gap');
      recs.push('Evaluate interest rate swaps (pay-fixed, receive-floating) to reduce asset sensitivity');
    } else if (dg.riskProfile === 'liability-sensitive' && dg.durationGap < -1.5) {
      recs.push('Consider shortening asset duration or adding floating-rate loans');
      recs.push('Evaluate receive-fixed interest rate swaps');
    }

    if (nii.riskRating === 'high' || nii.riskRating === 'critical') {
      recs.push('Implement rate caps/floors on variable-rate instruments to limit NII volatility');
    }

    if (lcr.buffer < 20 && lcr.status !== 'breach') {
      recs.push('Build HQLA buffer — target LCR above 120% for adequate cushion');
    }
    if (lcr.status === 'breach') {
      recs.push('URGENT: Increase HQLA holdings immediately to meet Basel III LCR requirement');
    }

    if (recs.length === 0) {
      recs.push('Maintain current ALM strategy — risk metrics within acceptable ranges');
      recs.push('Continue monitoring rate sensitivity quarterly');
    }

    return recs;
  }

  // ─── Persist Computed Scenarios ────────────────────────────────

  private async persistScenarios(
    institutionId: string,
    nii: NIISensitivityResult,
    full: FullAnalysisResult,
  ) {
    // Clear old scenarios
    await this.prisma.interestRateScenario.deleteMany({
      where: { institutionId },
    });

    // Save new ones
    const scenarios = nii.scenarios.map((s) => ({
      institutionId,
      name: s.name,
      shiftBps: s.shiftBps,
      niImpact: s.niImpact,
      mveImpact: s.mveImpact,
      duration: full.durationGap.durationGap,
    }));

    if (scenarios.length > 0) {
      await this.prisma.interestRateScenario.createMany({ data: scenarios });
    }
  }
}
