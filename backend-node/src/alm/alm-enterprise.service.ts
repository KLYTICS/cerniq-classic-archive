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
import {
  PR_COOP_BENCHMARKS,
  getPercentileRank,
  SectorBenchmark,
} from './benchmarks/pr-cooperativa-benchmarks';
import { getFramework, IRegulatoryFramework } from './frameworks';
import { PaginationQueryDto, PaginatedResult } from '../common/dto/pagination.dto';

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

export interface COSSECCheck {
  name: string;
  nameEs: string;
  value: number;
  threshold: number;
  unit: string;
  status: 'pass' | 'warning' | 'fail';
  description: string;
  descriptionEs: string;
}

export interface CossecRatioResult {
  id: number;
  name: string;
  nameEs: string;
  value: number;
  unit: string;
  threshold: string;
  thresholdDirection: 'gte' | 'lte' | 'range' | 'info';
  status: 'pass' | 'warning' | 'fail' | 'info';
  description: string;
  descriptionEs: string;
  examReadinessContribution: number;
  sectorMedian: number | null;
  percentileRank: string | null;
  percentileRankEs: string | null;
}

export interface COSSECComplianceResult {
  institutionName: string;
  institutionType: string;
  reportingDate: string;
  checks: COSSECCheck[];
  ratios: CossecRatioResult[];
  examReadinessScore: number;
  overallStatus: 'compliant' | 'conditional' | 'non-compliant';
  summary: {
    totalAssets: number;
    totalLiabilities: number;
    equity: number;
    totalLoans: number;
    totalShares: number;
    liquidAssets: number;
    capitalRatio: number;
    loanToShareRatio: number;
    liquidityRatio: number;
    earningAssets: number;
    interestIncome: number;
    interestExpense: number;
    nim: number;
    earningAssetsYield: number;
    costOfFunds: number;
    largestSectorPct: number;
    largestSectorName: string;
  };
}

export interface TrendDelta {
  ratioId: number;
  ratioName: string;
  ratioNameEs: string;
  currentValue: number;
  previousValue: number;
  delta: number;           // absolute change (currentValue - previousValue)
  deltaBps?: number;       // change in bps for percentage ratios
  trend: 'improving' | 'deteriorating' | 'stable';
  unit: string;
  previousPeriod: string;  // e.g. "Q4-2025"
}

export interface COSSECComplianceWithTrend extends COSSECComplianceResult {
  trends: TrendDelta[] | null;
  previousPeriod: string | null;
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
    primaryRegulator?: string;
  }) {
    return this.prisma.institution.create({
      data: {
        workspaceId: data.workspaceId,
        name: data.name,
        type: data.type,
        totalAssets: data.totalAssets,
        currency: data.currency || 'USD',
        reportingDate: new Date(data.reportingDate),
        primaryRegulator: data.primaryRegulator || 'COSSEC',
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

  async getInstitutionsByWorkspace(workspaceId: string, pagination?: PaginationQueryDto) {
    const page = pagination?.page || 1;
    const pageSize = pagination?.pageSize || 20;
    const where = { workspaceId };

    const [items, total] = await Promise.all([
      this.prisma.institution.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: pagination?.sortOrder || 'desc' },
      }),
      this.prisma.institution.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async getInstitutionsByUser(userId: string, pagination?: PaginationQueryDto) {
    const page = pagination?.page || 1;
    const pageSize = pagination?.pageSize || 20;

    const workspaces = await this.prisma.workspace.findMany({
      where: { ownerId: userId },
      select: { id: true },
    });
    const workspaceIds = workspaces.map((w) => w.id);
    if (workspaceIds.length === 0) {
      return { items: [], total: 0, page, pageSize, totalPages: 0 };
    }

    const where = { workspaceId: { in: workspaceIds } };
    const [items, total] = await Promise.all([
      this.prisma.institution.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: pagination?.sortOrder || 'desc' },
      }),
      this.prisma.institution.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
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

  async listBalanceSheetItems(institutionId: string, pagination?: PaginationQueryDto) {
    const page = pagination?.page || 1;
    const pageSize = pagination?.pageSize || 20;
    const where = { institutionId };

    const [items, total] = await Promise.all([
      this.prisma.balanceSheetItem.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.balanceSheetItem.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
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

  async getBalanceSheetSnapshot(institutionId: string): Promise<BalanceSheetDto> {
    return this.buildBalanceSheetDto(institutionId);
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

  async calculateNIISensitivity(institutionId: string, rateShocksBps?: number[]): Promise<NIISensitivityResult> {
    const bs = await this.buildBalanceSheetDto(institutionId);
    const niiResult = this.almService.niiSimulation(bs, rateShocksBps);
    const eveResult = this.almService.eveAnalysis(bs, rateShocksBps);

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

  // ─── COSSEC Compliance — Full 12-Ratio Engine ─────────────────

  async getCOSSECCompliance(institutionId: string): Promise<COSSECComplianceResult> {
    const institution = await this.getInstitution(institutionId);
    const items = await this.prisma.balanceSheetItem.findMany({ where: { institutionId } });

    // ── Aggregate balance sheet ──
    const assetItems = items.filter(i => i.category === 'asset');
    const liabilityItems = items.filter(i => i.category === 'liability');

    const totalAssets = assetItems.reduce((s, i) => s + i.balance, 0);
    const totalLiabilities = liabilityItems.reduce((s, i) => s + i.balance, 0);
    const equity = totalAssets - totalLiabilities;

    const loanSubcats = ['consumer_loans', 'residential_mortgages', 'commercial_loans'];
    const depositSubcats = ['savings_deposits', 'demand_deposits', 'time_deposits'];
    const liquidSubcats = ['cash_equivalents', 'investment_securities'];
    const earningSubcats = [...loanSubcats, 'investment_securities'];

    const totalLoans = assetItems.filter(i => loanSubcats.includes(i.subcategory)).reduce((s, i) => s + i.balance, 0);
    const totalShares = liabilityItems.filter(i => depositSubcats.includes(i.subcategory)).reduce((s, i) => s + i.balance, 0);
    const liquidAssets = assetItems.filter(i => liquidSubcats.includes(i.subcategory)).reduce((s, i) => s + i.balance, 0);
    const earningAssets = assetItems.filter(i => earningSubcats.includes(i.subcategory)).reduce((s, i) => s + i.balance, 0);
    const interestBearingLiabilities = liabilityItems.filter(i => i.rate > 0).reduce((s, i) => s + i.balance, 0);

    // Weighted interest income/expense (annualized, in $M)
    const interestIncome = assetItems
      .filter(i => earningSubcats.includes(i.subcategory))
      .reduce((s, i) => s + i.balance * (i.rate > 1 ? i.rate / 100 : i.rate), 0);
    const interestExpense = liabilityItems
      .filter(i => i.rate > 0)
      .reduce((s, i) => s + i.balance * (i.rate > 1 ? i.rate / 100 : i.rate), 0);

    // ── Derived ratios ──
    const capitalRatio = totalAssets > 0 ? (equity / totalAssets) * 100 : 0;
    const loanToShareRatio = totalShares > 0 ? (totalLoans / totalShares) * 100 : 0;
    const liquidityRatio = totalAssets > 0 ? (liquidAssets / totalAssets) * 100 : 0;
    const earningAssetsYield = earningAssets > 0 ? (interestIncome / earningAssets) * 100 : 0;
    const costOfFunds = interestBearingLiabilities > 0 ? (interestExpense / interestBearingLiabilities) * 100 : 0;
    const nim = earningAssets > 0 ? ((interestIncome - interestExpense) / earningAssets) * 100 : 0;

    // Concentration risk: largest subcategory as % of total loans
    const sectorMap = new Map<string, number>();
    for (const item of assetItems.filter(i => loanSubcats.includes(i.subcategory))) {
      sectorMap.set(item.subcategory, (sectorMap.get(item.subcategory) || 0) + item.balance);
    }
    let largestSectorName = 'N/A';
    let largestSectorBalance = 0;
    for (const [sector, bal] of sectorMap) {
      if (bal > largestSectorBalance) {
        largestSectorBalance = bal;
        largestSectorName = sector;
      }
    }
    const largestSectorPct = totalLoans > 0 ? (largestSectorBalance / totalLoans) * 100 : 0;

    // Reuse existing calculations
    const lcr = await this.calculateLCR(institutionId);
    const durationGap = await this.calculateDurationGap(institutionId);
    const niiSensitivity = await this.calculateNIISensitivity(institutionId);

    // EVE sensitivity from +200bps scenario
    const eve200 = niiSensitivity.scenarios.find(s => s.shiftBps === 200);
    const eveSensitivity = eve200 ? Math.abs(eve200.mveImpactPct) : 0;

    // ── Build 12 COSSEC ratios ──
    const b = PR_COOP_BENCHMARKS.ratios;
    const ratios: CossecRatioResult[] = [
      this.buildRatio(1, 'Capital Adequacy', 'Suficiencia de Capital',
        capitalRatio, '%', '>= 8%', 'gte',
        capitalRatio >= 8 ? 'pass' : capitalRatio >= 6 ? 'warning' : 'fail',
        `Equity/Assets: ${round(capitalRatio, 1)}%. Well-capitalized: 8%+.`,
        `Capital/Activos: ${round(capitalRatio, 1)}%. Bien capitalizado: 8%+.`,
        20, b.capitalAdequacy, capitalRatio, false),

      this.buildRatio(2, 'Asset Quality (Est.)', 'Calidad de Activos (Est.)',
        0, '%', '<= 5%', 'lte', 'pass',
        'Non-performing loan data not available from current balance sheet. Assumed healthy.',
        'Datos de morosidad no disponibles. Se asume buena calidad.',
        15, b.assetQuality, 0, true),

      this.buildRatio(3, 'Liquidity Ratio', 'Razon de Liquidez',
        liquidityRatio, '%', '>= 15%', 'gte',
        liquidityRatio >= 20 ? 'pass' : liquidityRatio >= 15 ? 'warning' : 'fail',
        `Liquid assets/Total assets: ${round(liquidityRatio, 1)}%. Minimum: 15%.`,
        `Activos liquidos/Activos totales: ${round(liquidityRatio, 1)}%. Minimo: 15%.`,
        10, b.liquidity, liquidityRatio, false),

      this.buildRatio(4, 'Loan-to-Deposit Ratio', 'Razon Prestamos/Depositos',
        loanToShareRatio, '%', '<= 80%', 'lte',
        loanToShareRatio <= 80 ? 'pass' : loanToShareRatio <= 100 ? 'warning' : 'fail',
        `Loans/Deposits: ${round(loanToShareRatio, 1)}%. Target: <=80%.`,
        `Prestamos/Depositos: ${round(loanToShareRatio, 1)}%. Meta: <=80%.`,
        10, b.loanToDeposit, loanToShareRatio, true),

      this.buildRatio(5, 'NII Sensitivity', 'Sensibilidad NII',
        niiSensitivity.riskRating === 'low' ? 100 : niiSensitivity.riskRating === 'moderate' ? 70 : niiSensitivity.riskRating === 'high' ? 40 : 15,
        'score', '<= 15% per 100bps', 'info',
        niiSensitivity.riskRating === 'low' ? 'pass' : niiSensitivity.riskRating === 'moderate' ? 'warning' : 'fail',
        `NII risk rating: ${niiSensitivity.riskRating}. Base NII: $${niiSensitivity.baseNII.toFixed(1)}M.`,
        `Clasificacion NII: ${niiSensitivity.riskRating}. NII base: $${niiSensitivity.baseNII.toFixed(1)}M.`,
        10, null, 0, false),

      this.buildRatio(6, 'Duration Gap', 'Brecha de Duracion',
        durationGap.durationGap, 'yr', '-1yr to +3yr', 'range',
        Math.abs(durationGap.durationGap) <= 1 ? 'pass' : Math.abs(durationGap.durationGap) <= 3 ? 'warning' : 'fail',
        `Gap: ${durationGap.durationGap > 0 ? '+' : ''}${durationGap.durationGap.toFixed(2)}yr. Profile: ${durationGap.riskProfile}.`,
        `Brecha: ${durationGap.durationGap > 0 ? '+' : ''}${durationGap.durationGap.toFixed(2)} anos. Perfil: ${durationGap.riskProfile}.`,
        10, b.durationGap, Math.abs(durationGap.durationGap), true),

      this.buildRatio(7, 'EVE Sensitivity', 'Sensibilidad EVE',
        eveSensitivity, '%', '<= 25%', 'lte',
        eveSensitivity <= 15 ? 'pass' : eveSensitivity <= 25 ? 'warning' : 'fail',
        `EVE change per +200bps: ${round(eveSensitivity, 1)}%. Threshold: <=25%.`,
        `Cambio EVE por +200bps: ${round(eveSensitivity, 1)}%. Umbral: <=25%.`,
        5, null, 0, true),

      this.buildRatio(8, 'Concentration Risk', 'Riesgo de Concentracion',
        largestSectorPct, '%', '<= 25%', 'lte',
        largestSectorPct <= 25 ? 'pass' : largestSectorPct <= 40 ? 'warning' : 'fail',
        `Largest sector (${largestSectorName}): ${round(largestSectorPct, 1)}% of loans.`,
        `Mayor sector (${largestSectorName}): ${round(largestSectorPct, 1)}% de prestamos.`,
        5, b.concentrationRisk, largestSectorPct, true),

      this.buildRatio(9, 'LCR (Basel III)', 'LCR (Basilea III)',
        lcr.lcr, '%', '>= 100%', 'gte',
        lcr.lcr >= 120 ? 'pass' : lcr.lcr >= 100 ? 'warning' : 'fail',
        `HQLA/Net outflows: ${round(lcr.lcr, 1)}%. Required: 100%. Target: 120%+.`,
        `HQLA/Flujos netos: ${round(lcr.lcr, 1)}%. Requerido: 100%. Meta: 120%+.`,
        5, b.lcr, lcr.lcr, false),

      this.buildRatio(10, 'Earning Assets Yield', 'Rendimiento Activos Productivos',
        earningAssetsYield, '%', 'Benchmark', 'info',
        'info',
        `Interest income / Earning assets: ${round(earningAssetsYield, 2)}%. PR median: ${b.earningAssetsYield.median}%.`,
        `Ingreso por intereses / Activos productivos: ${round(earningAssetsYield, 2)}%. Mediana PR: ${b.earningAssetsYield.median}%.`,
        0, b.earningAssetsYield, earningAssetsYield, false),

      this.buildRatio(11, 'Cost of Funds', 'Costo de Fondos',
        costOfFunds, '%', 'Benchmark', 'info',
        'info',
        `Interest expense / Interest-bearing liabilities: ${round(costOfFunds, 2)}%. PR median: ${b.costOfFunds.median}%.`,
        `Gasto por intereses / Pasivos con intereses: ${round(costOfFunds, 2)}%. Mediana PR: ${b.costOfFunds.median}%.`,
        0, b.costOfFunds, costOfFunds, true),

      this.buildRatio(12, 'Net Interest Margin', 'Margen de Interes Neto',
        nim, '%', '>= 2.5%', 'gte',
        nim >= 2.5 ? 'pass' : nim >= 2.0 ? 'warning' : 'fail',
        `NIM: ${round(nim, 2)}%. Threshold: >=2.5%. PR median: ${b.nim.median}%.`,
        `MNI: ${round(nim, 2)}%. Umbral: >=2.5%. Mediana PR: ${b.nim.median}%.`,
        10, b.nim, nim, false),
    ];

    // Exam readiness: sum of weights for PASS ratios (max 100)
    const examReadinessScore = ratios
      .filter(r => r.status === 'pass')
      .reduce((s, r) => s + r.examReadinessContribution, 0);

    // Legacy checks (backward compat with old 4-check code)
    const checks: COSSECCheck[] = ratios
      .filter(r => r.status !== 'info')
      .slice(0, 9)
      .map(r => ({
        name: r.name,
        nameEs: r.nameEs,
        value: round(r.value, 2),
        threshold: parseFloat(r.threshold.replace(/[^0-9.\-]/g, '')) || 0,
        unit: r.unit,
        status: r.status === 'info' ? 'pass' : r.status,
        description: r.description,
        descriptionEs: r.descriptionEs,
      }));

    const overallStatus = ratios.some(r => r.status === 'fail') ? 'non-compliant'
      : ratios.some(r => r.status === 'warning') ? 'conditional' : 'compliant';

    return {
      institutionName: institution.name,
      institutionType: institution.type,
      reportingDate: institution.reportingDate.toISOString(),
      checks,
      ratios,
      examReadinessScore,
      overallStatus,
      summary: {
        totalAssets,
        totalLiabilities,
        equity,
        totalLoans,
        totalShares,
        liquidAssets,
        capitalRatio: round(capitalRatio, 2),
        loanToShareRatio: round(loanToShareRatio, 2),
        liquidityRatio: round(liquidityRatio, 2),
        earningAssets: round(earningAssets, 2),
        interestIncome: round(interestIncome, 2),
        interestExpense: round(interestExpense, 2),
        nim: round(nim, 2),
        earningAssetsYield: round(earningAssetsYield, 2),
        costOfFunds: round(costOfFunds, 2),
        largestSectorPct: round(largestSectorPct, 2),
        largestSectorName,
      },
    };
  }

  // ─── Multi-Period Trend Analysis ────────────────────────────────

  /**
   * Returns COSSEC compliance data enriched with trend deltas from the
   * most recent prior completed AnalysisRun for the same institution.
   * Gracefully returns trends: null when no previous period exists.
   */
  async getCOSSECComplianceWithTrend(institutionId: string): Promise<COSSECComplianceWithTrend> {
    const current = await this.getCOSSECCompliance(institutionId);

    // Find the previous completed analysis run for this institution (skip current)
    let previousRun: any = null;
    try {
      previousRun = await this.prisma.analysisRun.findFirst({
        where: { institutionId, status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        skip: 1, // skip the current one, get the previous
      });
    } catch {
      // Table may not exist yet; graceful degradation
      this.logger.warn({ event: 'trend.previous_run_lookup_failed', institutionId });
    }

    if (!previousRun?.resultSummary) {
      return { ...current, trends: null, previousPeriod: null };
    }

    // Also check if there is a previous ReportJob with an analysisPeriod
    let previousPeriodLabel: string | null = null;
    try {
      const prevJob = await this.prisma.reportJob.findFirst({
        where: { institutionId, status: 'COMPLETE' },
        orderBy: { completedAt: 'desc' },
        skip: 1,
        select: { analysisPeriod: true, completedAt: true },
      });
      previousPeriodLabel = prevJob?.analysisPeriod ||
        (previousRun.createdAt ? this.derivePeriodLabel(previousRun.createdAt) : null);
    } catch {
      previousPeriodLabel = previousRun.createdAt ? this.derivePeriodLabel(previousRun.createdAt) : null;
    }

    const prevSummary = previousRun.resultSummary as any;
    const trends = this.calculateTrendDeltas(current.ratios, prevSummary, previousPeriodLabel || 'Prior');

    return { ...current, trends, previousPeriod: previousPeriodLabel };
  }

  /**
   * Calculate deltas between current ratios and previous period's summary.
   * Maps stored resultSummary keys to ratio IDs.
   */
  private calculateTrendDeltas(
    currentRatios: CossecRatioResult[],
    prevSummary: any,
    previousPeriod: string,
  ): TrendDelta[] {
    // Map ratio IDs to the keys stored in resultSummary
    const prevMapping: Record<number, { key: string; lowerIsBetter: boolean }> = {
      1:  { key: 'capitalRatio',      lowerIsBetter: false },
      3:  { key: 'liquidityRatio',    lowerIsBetter: false },
      4:  { key: 'loanToShareRatio',  lowerIsBetter: true },
      8:  { key: 'largestSectorPct',  lowerIsBetter: true },
      10: { key: 'earningAssetsYield', lowerIsBetter: false },
      11: { key: 'costOfFunds',       lowerIsBetter: true },
      12: { key: 'nim',               lowerIsBetter: false },
    };

    const trends: TrendDelta[] = [];

    for (const ratio of currentRatios) {
      const mapping = prevMapping[ratio.id];
      if (!mapping) continue;

      // Look for key in prevSummary or prevSummary.summary
      const prevData = prevSummary.summary || prevSummary;
      const prevValue = prevData[mapping.key];
      if (prevValue == null || typeof prevValue !== 'number') continue;

      const delta = round(ratio.value - prevValue, 2);
      const deltaBps = ratio.unit === '%' ? Math.round(delta * 100) : undefined;

      // Determine trend direction
      const STABLE_THRESHOLD = 0.05; // 5bps for percentages
      let trend: 'improving' | 'deteriorating' | 'stable';
      if (Math.abs(delta) < STABLE_THRESHOLD) {
        trend = 'stable';
      } else if (mapping.lowerIsBetter) {
        trend = delta < 0 ? 'improving' : 'deteriorating';
      } else {
        trend = delta > 0 ? 'improving' : 'deteriorating';
      }

      trends.push({
        ratioId: ratio.id,
        ratioName: ratio.name,
        ratioNameEs: ratio.nameEs,
        currentValue: ratio.value,
        previousValue: round(prevValue, 2),
        delta,
        deltaBps,
        trend,
        unit: ratio.unit,
        previousPeriod,
      });
    }

    return trends;
  }

  /** Derive a period label like "Q1-2026" from a date. */
  private derivePeriodLabel(date: Date): string {
    const q = Math.ceil((date.getMonth() + 1) / 3);
    return `Q${q}-${date.getFullYear()}`;
  }

  private buildRatio(
    id: number, name: string, nameEs: string,
    value: number, unit: string, threshold: string,
    thresholdDirection: 'gte' | 'lte' | 'range' | 'info',
    status: 'pass' | 'warning' | 'fail' | 'info',
    description: string, descriptionEs: string,
    examReadinessContribution: number,
    benchmark: SectorBenchmark | null,
    benchmarkValue: number,
    lowerIsBetter: boolean,
  ): CossecRatioResult {
    let sectorMedian: number | null = null;
    let percentileRank: string | null = null;
    let percentileRankEs: string | null = null;

    if (benchmark) {
      sectorMedian = benchmark.median;
      const rank = getPercentileRank(benchmarkValue, benchmark, lowerIsBetter);
      percentileRank = rank.rank;
      percentileRankEs = rank.rankEs;
    }

    return {
      id, name, nameEs, value: round(value, 2), unit, threshold,
      thresholdDirection, status, description, descriptionEs,
      examReadinessContribution, sectorMedian, percentileRank, percentileRankEs,
    };
  }

  // ─── Framework-Aware Regulatory Compliance ──────────────────

  /**
   * Dispatch to the correct compliance engine based on the institution's
   * primaryRegulator field. Returns the same COSSECComplianceResult type
   * for frontend compatibility — only the ratio names, thresholds, and
   * weights differ between frameworks.
   */
  async getRegulatoryCompliance(institutionId: string): Promise<COSSECComplianceResult> {
    const institution = await this.getInstitution(institutionId);
    const framework = getFramework(institution.primaryRegulator);

    if (framework.id === 'ncua-us') {
      return this.calculateNcuaCompliance(institutionId, framework);
    }
    // Default: COSSEC
    return this.getCOSSECCompliance(institutionId);
  }

  /**
   * NCUA CAMEL compliance engine.
   *
   * Computes 7 NCUA-specific ratios from the same balance-sheet data
   * used by the COSSEC engine, returning a COSSECComplianceResult for
   * frontend compatibility. The remaining 5 slots (up to 12) are filled
   * with 'N/A' placeholders so the 12-ratio grid renders cleanly.
   */
  async calculateNcuaCompliance(
    institutionId: string,
    framework: IRegulatoryFramework,
  ): Promise<COSSECComplianceResult> {
    const institution = await this.getInstitution(institutionId);
    const items = await this.prisma.balanceSheetItem.findMany({ where: { institutionId } });

    // ── Aggregate balance sheet ──
    const assetItems = items.filter(i => i.category === 'asset');
    const liabilityItems = items.filter(i => i.category === 'liability');

    const totalAssets = assetItems.reduce((s, i) => s + i.balance, 0);
    const totalLiabilities = liabilityItems.reduce((s, i) => s + i.balance, 0);
    const equity = totalAssets - totalLiabilities;

    const loanSubcats = ['consumer_loans', 'residential_mortgages', 'commercial_loans'];
    const depositSubcats = ['savings_deposits', 'demand_deposits', 'time_deposits'];
    const liquidSubcats = ['cash_equivalents', 'investment_securities'];
    const earningSubcats = [...loanSubcats, 'investment_securities'];

    const totalLoans = assetItems.filter(i => loanSubcats.includes(i.subcategory)).reduce((s, i) => s + i.balance, 0);
    const totalShares = liabilityItems.filter(i => depositSubcats.includes(i.subcategory)).reduce((s, i) => s + i.balance, 0);
    const liquidAssets = assetItems.filter(i => liquidSubcats.includes(i.subcategory)).reduce((s, i) => s + i.balance, 0);
    const earningAssets = assetItems.filter(i => earningSubcats.includes(i.subcategory)).reduce((s, i) => s + i.balance, 0);
    const interestBearingLiabilities = liabilityItems.filter(i => i.rate > 0).reduce((s, i) => s + i.balance, 0);

    // Weighted interest income/expense (annualized, in $M)
    const interestIncome = assetItems
      .filter(i => earningSubcats.includes(i.subcategory))
      .reduce((s, i) => s + i.balance * (i.rate > 1 ? i.rate / 100 : i.rate), 0);
    const interestExpense = liabilityItems
      .filter(i => i.rate > 0)
      .reduce((s, i) => s + i.balance * (i.rate > 1 ? i.rate / 100 : i.rate), 0);

    // ── NCUA CAMEL Ratios ──

    // 1. Net Worth Ratio (Capital): equity / totalAssets * 100
    const netWorthRatio = totalAssets > 0 ? (equity / totalAssets) * 100 : 0;
    const netWorthStatus: 'pass' | 'warning' | 'fail' =
      netWorthRatio >= 7 ? 'pass' : netWorthRatio >= 6 ? 'warning' : 'fail';

    // 2. Delinquency Ratio (Asset Quality): estimated from loan quality
    // Balance sheet doesn't carry NPL data — estimate conservatively
    const delinquencyRatio = 0; // will show as info/estimated
    const delinquencyStatus: 'pass' | 'warning' | 'fail' = 'pass'; // assumed healthy

    // 3. Return on Assets (Earnings): (interestIncome - interestExpense) / totalAssets * 100
    const roa = totalAssets > 0 ? ((interestIncome - interestExpense) / totalAssets) * 100 : 0;
    const roaStatus: 'pass' | 'warning' | 'fail' =
      roa >= 0.5 ? 'pass' : roa >= 0.25 ? 'warning' : 'fail';

    // 4. Operating Expense Ratio: estimated from available data
    // Proxy: interest expense as % of total income (conservative)
    const operatingExpenseRatio = interestIncome > 0 ? (interestExpense / interestIncome) * 100 : 0;
    const opexStatus: 'pass' | 'warning' | 'fail' =
      operatingExpenseRatio <= 75 ? 'pass' : operatingExpenseRatio <= 85 ? 'warning' : 'fail';

    // 5. Liquidity Ratio: (cash + shortTermSecurities) / totalAssets * 100
    const liquidityRatio = totalAssets > 0 ? (liquidAssets / totalAssets) * 100 : 0;
    const liquidityStatus: 'pass' | 'warning' | 'fail' =
      liquidityRatio >= 10 ? 'pass' : liquidityRatio >= 7 ? 'warning' : 'fail';

    // 6. Loan-to-Share Ratio: totalLoans / totalDeposits * 100
    const loanToShareRatio = totalShares > 0 ? (totalLoans / totalShares) * 100 : 0;
    const ltsStatus: 'pass' | 'warning' | 'fail' =
      loanToShareRatio <= 90 ? 'pass' : loanToShareRatio <= 100 ? 'warning' : 'fail';

    // 7. Net Interest Margin
    const nim = earningAssets > 0 ? ((interestIncome - interestExpense) / earningAssets) * 100 : 0;
    const nimStatus: 'pass' | 'warning' | 'fail' =
      nim >= 2.0 ? 'pass' : nim >= 1.5 ? 'warning' : 'fail';

    // Derived shared values
    const capitalRatio = netWorthRatio;
    const earningAssetsYield = earningAssets > 0 ? (interestIncome / earningAssets) * 100 : 0;
    const costOfFunds = interestBearingLiabilities > 0 ? (interestExpense / interestBearingLiabilities) * 100 : 0;

    // Concentration (for summary only)
    const sectorMap = new Map<string, number>();
    for (const item of assetItems.filter(i => loanSubcats.includes(i.subcategory))) {
      sectorMap.set(item.subcategory, (sectorMap.get(item.subcategory) || 0) + item.balance);
    }
    let largestSectorName = 'N/A';
    let largestSectorBalance = 0;
    for (const [sector, bal] of sectorMap) {
      if (bal > largestSectorBalance) {
        largestSectorBalance = bal;
        largestSectorName = sector;
      }
    }
    const largestSectorPct = totalLoans > 0 ? (largestSectorBalance / totalLoans) * 100 : 0;

    // ── Build 7 NCUA ratios ──
    const fwRatios = framework.ratios;
    const ratios: CossecRatioResult[] = [
      this.buildRatio(
        fwRatios[0].id, fwRatios[0].name, fwRatios[0].nameEs,
        netWorthRatio, '%', fwRatios[0].threshold, fwRatios[0].thresholdDirection,
        netWorthStatus,
        `Net Worth/Assets: ${round(netWorthRatio, 1)}%. Well-capitalized: >=7%. Adequately: 6-7%.`,
        `Capital Neto/Activos: ${round(netWorthRatio, 1)}%. Bien capitalizado: >=7%.`,
        fwRatios[0].weight, null, 0, false,
      ),
      this.buildRatio(
        fwRatios[1].id, fwRatios[1].name, fwRatios[1].nameEs,
        delinquencyRatio, '%', fwRatios[1].threshold, fwRatios[1].thresholdDirection,
        delinquencyStatus,
        'Delinquent loan data not available from balance sheet. Assumed healthy.',
        'Datos de morosidad no disponibles del balance. Se asume buena calidad.',
        fwRatios[1].weight, null, 0, true,
      ),
      this.buildRatio(
        fwRatios[2].id, fwRatios[2].name, fwRatios[2].nameEs,
        roa, '%', fwRatios[2].threshold, fwRatios[2].thresholdDirection,
        roaStatus,
        `Net Income/Assets: ${round(roa, 2)}%. Target: >=0.5%.`,
        `Ingreso Neto/Activos: ${round(roa, 2)}%. Meta: >=0.5%.`,
        fwRatios[2].weight, null, 0, false,
      ),
      this.buildRatio(
        fwRatios[3].id, fwRatios[3].name, fwRatios[3].nameEs,
        operatingExpenseRatio, '%', fwRatios[3].threshold, fwRatios[3].thresholdDirection,
        opexStatus,
        `Operating expenses / income (est.): ${round(operatingExpenseRatio, 1)}%. Target: <=75%.`,
        `Gastos operativos / ingresos (est.): ${round(operatingExpenseRatio, 1)}%. Meta: <=75%.`,
        fwRatios[3].weight, null, 0, true,
      ),
      this.buildRatio(
        fwRatios[4].id, fwRatios[4].name, fwRatios[4].nameEs,
        liquidityRatio, '%', fwRatios[4].threshold, fwRatios[4].thresholdDirection,
        liquidityStatus,
        `Liquid assets/Total assets: ${round(liquidityRatio, 1)}%. NCUA minimum: 10%.`,
        `Activos liquidos/Activos totales: ${round(liquidityRatio, 1)}%. Minimo NCUA: 10%.`,
        fwRatios[4].weight, null, 0, false,
      ),
      this.buildRatio(
        fwRatios[5].id, fwRatios[5].name, fwRatios[5].nameEs,
        loanToShareRatio, '%', fwRatios[5].threshold, fwRatios[5].thresholdDirection,
        ltsStatus,
        `Loans/Shares: ${round(loanToShareRatio, 1)}%. NCUA guideline: <=90%.`,
        `Prestamos/Depositos: ${round(loanToShareRatio, 1)}%. Guia NCUA: <=90%.`,
        fwRatios[5].weight, null, 0, true,
      ),
      this.buildRatio(
        fwRatios[6].id, fwRatios[6].name, fwRatios[6].nameEs,
        nim, '%', fwRatios[6].threshold, fwRatios[6].thresholdDirection,
        nimStatus,
        `NIM: ${round(nim, 2)}%. NCUA target: >=2.0%.`,
        `MNI: ${round(nim, 2)}%. Meta NCUA: >=2.0%.`,
        fwRatios[6].weight, null, 0, false,
      ),
    ];

    // Pad to 12 slots with N/A placeholders for grid compatibility
    for (let i = ratios.length + 1; i <= 12; i++) {
      ratios.push(this.buildRatio(
        i, 'N/A', 'N/A', 0, '', 'N/A', 'info', 'info',
        'Not applicable under NCUA framework.',
        'No aplica bajo el marco NCUA.',
        0, null, 0, false,
      ));
    }

    // Exam readiness: sum of weights for PASS ratios
    const examReadinessScore = ratios
      .filter(r => r.status === 'pass')
      .reduce((s, r) => s + r.examReadinessContribution, 0);

    // Legacy checks (backward compat)
    const checks: COSSECCheck[] = ratios
      .filter(r => r.status !== 'info')
      .slice(0, 9)
      .map(r => ({
        name: r.name,
        nameEs: r.nameEs,
        value: round(r.value, 2),
        threshold: parseFloat(r.threshold.replace(/[^0-9.\-]/g, '')) || 0,
        unit: r.unit,
        status: r.status === 'info' ? 'pass' : r.status,
        description: r.description,
        descriptionEs: r.descriptionEs,
      }));

    const overallStatus = ratios.some(r => r.status === 'fail') ? 'non-compliant'
      : ratios.some(r => r.status === 'warning') ? 'conditional' : 'compliant';

    return {
      institutionName: institution.name,
      institutionType: institution.type,
      reportingDate: institution.reportingDate.toISOString(),
      checks,
      ratios,
      examReadinessScore,
      overallStatus,
      summary: {
        totalAssets,
        totalLiabilities,
        equity,
        totalLoans,
        totalShares,
        liquidAssets,
        capitalRatio: round(capitalRatio, 2),
        loanToShareRatio: round(loanToShareRatio, 2),
        liquidityRatio: round(liquidityRatio, 2),
        earningAssets: round(earningAssets, 2),
        interestIncome: round(interestIncome, 2),
        interestExpense: round(interestExpense, 2),
        nim: round(nim, 2),
        earningAssetsYield: round(earningAssetsYield, 2),
        costOfFunds: round(costOfFunds, 2),
        largestSectorPct: round(largestSectorPct, 2),
        largestSectorName,
      },
    };
  }

  async getALMSummary(institutionId: string, rateShocksBps?: number[]): Promise<ALMSummaryResult> {
    const institution = await this.getInstitution(institutionId);
    const bs = await this.buildBalanceSheetDto(institutionId);
    const fullAnalysis = this.almService.fullAnalysis(bs, rateShocksBps);

    const durationGap = await this.calculateDurationGap(institutionId);
    const niiSensitivity = await this.calculateNIISensitivity(institutionId, rateShocksBps);
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
