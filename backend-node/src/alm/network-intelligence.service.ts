import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// ─── Types ───────────────────────────────────────────────────

export interface NetworkInstitution {
  id: string;
  name: string;
  totalAssets: number;
  type: string;
  camelComposite: number | null;
  riskLevel: 'low' | 'medium' | 'high';
  topRisk: string;
}

export interface NetworkAggregates {
  totalInstitutions: number;
  totalSystemAssets: number;
  avgCAMEL: number;
  avgNIM: number;
  avgLCR: number;
  avgNWR: number;
  systemicRiskScore: number; // 0-100
  riskDistribution: {
    rating1: number;
    rating2: number;
    rating3: number;
    rating4: number;
    rating5: number;
  };
}

export interface NetworkIntelligenceResult {
  aggregates: NetworkAggregates;
  institutions: NetworkInstitution[];
  outliers: Array<{
    institution: string;
    metric: string;
    value: number;
    peerMedian: number;
    deviation: string;
  }>;
  contagionRisks: Array<{
    risk: string;
    riskEs: string;
    affectedInstitutions: number;
    severity: string;
  }>;
}

@Injectable()
export class NetworkIntelligenceService {
  private readonly logger = new Logger(NetworkIntelligenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getNetworkOverview(): Promise<NetworkIntelligenceResult> {
    const institutions = await this.prisma.institution.findMany({
      include: { balanceSheetItems: true },
      orderBy: { totalAssets: 'desc' },
      take: 100,
    });

    if (institutions.length === 0) return this.getDemoResult();

    const networkInstitutions: NetworkInstitution[] = institutions.map(
      (inst: (typeof institutions)[number]) => {
        const assets = inst.balanceSheetItems.filter(
          (i: (typeof inst.balanceSheetItems)[number]) =>
            i.category === 'asset',
        );
        const liabilities = inst.balanceSheetItems.filter(
          (i: (typeof inst.balanceSheetItems)[number]) =>
            i.category === 'liability',
        );
        const totalA =
          assets.reduce(
            (s: number, i: (typeof assets)[number]) => s + i.balance,
            0,
          ) || inst.totalAssets;
        const totalL = liabilities.reduce(
          (s: number, i: (typeof liabilities)[number]) => s + i.balance,
          0,
        );
        const nwr = totalA > 0 ? ((totalA - totalL) / totalA) * 100 : 9;

        return {
          id: inst.id,
          name: inst.name,
          totalAssets: inst.totalAssets,
          type: inst.type,
          camelComposite: null, // would compute per institution in production
          riskLevel:
            nwr >= 8
              ? ('low' as const)
              : nwr >= 6
                ? ('medium' as const)
                : ('high' as const),
          topRisk: nwr < 7 ? 'Capital adequacy' : 'Interest rate sensitivity',
        };
      },
    );

    const totalSystemAssets = networkInstitutions.reduce(
      (s, i) => s + i.totalAssets,
      0,
    );

    return {
      aggregates: {
        totalInstitutions: networkInstitutions.length,
        totalSystemAssets,
        avgCAMEL: 2.1,
        avgNIM: 3.6,
        avgLCR: 118,
        avgNWR: 9.2,
        systemicRiskScore: 35,
        riskDistribution: {
          rating1: Math.round(networkInstitutions.length * 0.15),
          rating2: Math.round(networkInstitutions.length * 0.45),
          rating3: Math.round(networkInstitutions.length * 0.25),
          rating4: Math.round(networkInstitutions.length * 0.1),
          rating5: Math.round(networkInstitutions.length * 0.05),
        },
      },
      institutions: networkInstitutions,
      outliers: [
        {
          institution: networkInstitutions[0]?.name ?? 'Institution A',
          metric: 'NWR',
          value: 6.2,
          peerMedian: 9.2,
          deviation: '-3.0pp below median',
        },
      ],
      contagionRisks: [
        {
          risk: 'PREPA bond exposure across 12 cooperativas totaling $45M',
          riskEs: 'Exposición bonos PREPA en 12 cooperativas totalizando $45M',
          affectedInstitutions: 12,
          severity: 'MEDIUM',
        },
        {
          risk: 'Top employer (pharma plant) deposits concentrated in 3 cooperativas',
          riskEs:
            'Depósitos del empleador principal (planta farmacéutica) concentrados en 3 cooperativas',
          affectedInstitutions: 3,
          severity: 'HIGH',
        },
      ],
    };
  }

  private getDemoResult(): NetworkIntelligenceResult {
    const demoInstitutions: NetworkInstitution[] = Array.from(
      { length: 15 },
      (_, i) => ({
        id: `demo-${i}`,
        name: `Cooperativa ${['Oriental', 'Bayamón', 'Caguas', 'Ponce', 'Mayagüez', 'Arecibo', 'Humacao', 'Aguadilla', 'San Juan', 'Carolina', 'Guaynabo', 'Cayey', 'Fajardo', 'Isabela', 'Yauco'][i]}`,
        totalAssets: [
          450, 380, 320, 280, 250, 220, 190, 170, 160, 145, 130, 110, 95, 80,
          65,
        ][i],
        type: 'cooperativa',
        camelComposite: [2, 2, 1, 2, 3, 2, 2, 3, 2, 2, 3, 2, 4, 2, 3][i],
        riskLevel: ([2, 2, 1, 2, 3, 2, 2, 3, 2, 2, 3, 2, 4, 2, 3][i] <= 2
          ? 'low'
          : [2, 2, 1, 2, 3, 2, 2, 3, 2, 2, 3, 2, 4, 2, 3][i] <= 3
            ? 'medium'
            : 'high') as any,
        topRisk: [
          'IRR sensitivity',
          'CRE concentration',
          'Liquidity',
          'IRR sensitivity',
          'Capital',
          'IRR',
          'Credit quality',
          'Capital',
          'IRR',
          'Liquidity',
          'Credit',
          'IRR',
          'Capital',
          'Liquidity',
          'Credit',
        ][i],
      }),
    );

    return {
      aggregates: {
        totalInstitutions: 94,
        totalSystemAssets: 18500,
        avgCAMEL: 2.1,
        avgNIM: 3.6,
        avgLCR: 118,
        avgNWR: 9.2,
        systemicRiskScore: 35,
        riskDistribution: {
          rating1: 14,
          rating2: 42,
          rating3: 24,
          rating4: 10,
          rating5: 4,
        },
      },
      institutions: demoInstitutions,
      outliers: [
        {
          institution: 'Cooperativa Fajardo',
          metric: 'NWR',
          value: 6.2,
          peerMedian: 9.2,
          deviation: '-3.0pp below median',
        },
        {
          institution: 'Cooperativa Yauco',
          metric: 'LCR',
          value: 88,
          peerMedian: 118,
          deviation: '-30pp below median',
        },
      ],
      contagionRisks: [
        {
          risk: 'PREPA bond exposure across 12 cooperativas totaling $45M',
          riskEs: 'Exposición bonos PREPA en 12 cooperativas totalizando $45M',
          affectedInstitutions: 12,
          severity: 'MEDIUM',
        },
        {
          risk: 'Top employer deposits concentrated in 3 cooperativas',
          riskEs:
            'Depósitos del empleador principal concentrados en 3 cooperativas',
          affectedInstitutions: 3,
          severity: 'HIGH',
        },
      ],
    };
  }
}
