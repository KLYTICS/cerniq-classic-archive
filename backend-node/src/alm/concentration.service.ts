import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// ─── Default Policy Limits ──────────────────────────────────

const DEFAULT_LIMITS: Record<string, { maxPct: number; type: string }> = {
  'Commercial RE': { maxPct: 0.3, type: 'sector' },
  'Residential Mortgage': { maxPct: 0.35, type: 'sector' },
  'Consumer Loans': { maxPct: 0.25, type: 'sector' },
  'Auto Loans': { maxPct: 0.15, type: 'sector' },
  'Credit Cards': { maxPct: 0.1, type: 'product' },
  'C&I Loans': { maxPct: 0.25, type: 'sector' },
  'Top 10 Borrowers': { maxPct: 0.25, type: 'single_name' },
  'Single Counterparty': { maxPct: 0.1, type: 'single_name' },
};

// ─── Types ───────────────────────────────────────────────────

export interface ConcentrationExposure {
  limitName: string;
  limitType: string;
  maxPct: number;
  currentPct: number;
  currentBalance: number;
  headroom: number; // maxPct - currentPct
  status: 'compliant' | 'warning' | 'breach';
  utilizationPct: number; // currentPct / maxPct
}

export interface ConcentrationAnalysis {
  exposures: ConcentrationExposure[];
  hhi: number; // Herfindahl-Hirschman Index (0-10000)
  hhiInterpretation: string;
  diversificationScore: number; // 0-100
  breachCount: number;
  warningCount: number;
  totalAssets: number;
}

@Injectable()
export class ConcentrationService {
  private readonly logger = new Logger(ConcentrationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getConcentrationAnalysis(
    institutionId: string,
  ): Promise<ConcentrationAnalysis> {
    const items = await this.prisma.balanceSheetItem.findMany({
      where: { institutionId },
    });
    const customLimits = await this.prisma.concentrationLimit.findMany({
      where: { institutionId },
    });

    const assets = items.filter((i) => i.category === 'asset');
    const totalAssets = assets.reduce((s, i) => s + i.balance, 0);

    if (totalAssets === 0) {
      return this.getDemoAnalysis();
    }

    // Aggregate by subcategory
    const sectorBalances = new Map<string, number>();
    for (const item of assets) {
      const sector = this.normalizeSectorName(item.subcategory);
      sectorBalances.set(
        sector,
        (sectorBalances.get(sector) ?? 0) + item.balance,
      );
    }

    // Build exposure list from custom limits or defaults
    const exposures: ConcentrationExposure[] = [];

    if (customLimits.length > 0) {
      for (const limit of customLimits) {
        const balance =
          sectorBalances.get(this.normalizeSectorName(limit.limitName)) ?? 0;
        const currentPct = totalAssets > 0 ? balance / totalAssets : 0;
        const headroom = limit.maxPct - currentPct;
        const utilization = limit.maxPct > 0 ? currentPct / limit.maxPct : 0;

        exposures.push({
          limitName: limit.limitName,
          limitType: limit.limitType,
          maxPct: limit.maxPct,
          currentPct,
          currentBalance: balance,
          headroom,
          status:
            currentPct > limit.maxPct
              ? 'breach'
              : utilization > 0.8
                ? 'warning'
                : 'compliant',
          utilizationPct: utilization * 100,
        });
      }
    } else {
      // Use defaults
      for (const [name, config] of Object.entries(DEFAULT_LIMITS)) {
        const balance = sectorBalances.get(this.normalizeSectorName(name)) ?? 0;
        const currentPct = totalAssets > 0 ? balance / totalAssets : 0;
        const headroom = config.maxPct - currentPct;
        const utilization = config.maxPct > 0 ? currentPct / config.maxPct : 0;

        if (balance > 0 || config.type === 'single_name') {
          exposures.push({
            limitName: name,
            limitType: config.type,
            maxPct: config.maxPct,
            currentPct,
            currentBalance: balance,
            headroom,
            status:
              currentPct > config.maxPct
                ? 'breach'
                : utilization > 0.8
                  ? 'warning'
                  : 'compliant',
            utilizationPct: utilization * 100,
          });
        }
      }
    }

    // HHI calculation
    const shares = Array.from(sectorBalances.values()).map(
      (b) => (b / totalAssets) * 100,
    );
    const hhi = shares.reduce((sum, s) => sum + s * s, 0);
    const hhiInterpretation =
      hhi < 1500
        ? 'Well diversified'
        : hhi < 2500
          ? 'Moderate concentration'
          : 'Highly concentrated';
    const diversificationScore = Math.max(0, Math.min(100, 100 - hhi / 100));

    return {
      exposures: exposures.sort((a, b) => b.utilizationPct - a.utilizationPct),
      hhi: Math.round(hhi),
      hhiInterpretation,
      diversificationScore: Math.round(diversificationScore),
      breachCount: exposures.filter((e) => e.status === 'breach').length,
      warningCount: exposures.filter((e) => e.status === 'warning').length,
      totalAssets,
    };
  }

  async saveConcentrationLimits(
    institutionId: string,
    limits: Array<{
      limitType: string;
      limitName: string;
      maxPct: number;
    }>,
  ) {
    await this.prisma.concentrationLimit.deleteMany({
      where: { institutionId },
    });
    return this.prisma.concentrationLimit.createMany({
      data: limits.map((l) => ({
        institutionId,
        limitType: l.limitType,
        limitName: l.limitName,
        maxPct: l.maxPct,
        currentPct: 0,
        status: 'compliant',
      })),
    });
  }

  private normalizeSectorName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[_-]/g, ' ')
      .replace(/\b(re|loans?|mortgage)\b/g, (m) => m)
      .trim();
  }

  private getDemoAnalysis(): ConcentrationAnalysis {
    return {
      exposures: [
        {
          limitName: 'Commercial RE',
          limitType: 'sector',
          maxPct: 0.3,
          currentPct: 0.27,
          currentBalance: 120,
          headroom: 0.03,
          status: 'warning',
          utilizationPct: 90,
        },
        {
          limitName: 'Residential Mortgage',
          limitType: 'sector',
          maxPct: 0.35,
          currentPct: 0.21,
          currentBalance: 95,
          headroom: 0.14,
          status: 'compliant',
          utilizationPct: 60,
        },
        {
          limitName: 'Consumer Loans',
          limitType: 'sector',
          maxPct: 0.25,
          currentPct: 0.19,
          currentBalance: 85,
          headroom: 0.06,
          status: 'compliant',
          utilizationPct: 76,
        },
        {
          limitName: 'Auto Loans',
          limitType: 'sector',
          maxPct: 0.15,
          currentPct: 0.14,
          currentBalance: 62,
          headroom: 0.01,
          status: 'warning',
          utilizationPct: 93,
        },
        {
          limitName: 'C&I Loans',
          limitType: 'sector',
          maxPct: 0.25,
          currentPct: 0.12,
          currentBalance: 55,
          headroom: 0.13,
          status: 'compliant',
          utilizationPct: 48,
        },
        {
          limitName: 'Credit Cards',
          limitType: 'product',
          maxPct: 0.1,
          currentPct: 0.06,
          currentBalance: 28,
          headroom: 0.04,
          status: 'compliant',
          utilizationPct: 60,
        },
      ],
      hhi: 1850,
      hhiInterpretation: 'Moderate concentration',
      diversificationScore: 82,
      breachCount: 0,
      warningCount: 2,
      totalAssets: 445,
    };
  }
}
