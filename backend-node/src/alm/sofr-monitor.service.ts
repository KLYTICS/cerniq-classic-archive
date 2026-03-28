import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// ISDA standard LIBOR→SOFR spread adjustments
const LIBOR_SOFR_SPREADS: Record<string, number> = {
  '1M_LIBOR': 0.00114, // 11.4bps
  '3M_LIBOR': 0.00262, // 26.2bps
  '6M_LIBOR': 0.00428, // 42.8bps
  '12M_LIBOR': 0.00715, // 71.5bps
};

export interface LIBORExposure {
  instrumentId: string;
  name: string;
  subcategory: string;
  balance: number;
  referenceRate: string;
  currentRate: number;
  sofrEquivalent: number;
  spreadAdjustment: number;
  valueTransfer: number; // $ impact of conversion
  maturityYears: number;
}

export interface SOFRMonitorResult {
  exposures: LIBORExposure[];
  totalLIBORExposure: number;
  totalSOFRExposure: number;
  totalValueTransfer: number;
  pctPortfolioExposed: number;
  transitionChecklist: Array<{
    item: string;
    itemEs: string;
    status: 'complete' | 'in_progress' | 'pending';
  }>;
}

@Injectable()
export class SOFRMonitorService {
  private readonly logger = new Logger(SOFRMonitorService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getExposureReport(institutionId: string): Promise<SOFRMonitorResult> {
    const items = await this.prisma.balanceSheetItem.findMany({
      where: { institutionId },
    });
    const totalPortfolio = items.reduce((s: number, i: any) => s + i.balance, 0) || 445;

    // Identify LIBOR-referenced instruments
    const exposures: LIBORExposure[] = items
      .filter((i: any) => {
        const rt = (i.rateType || '').toLowerCase();
        const name = (i.name || '').toLowerCase();
        return (
          rt === 'variable' &&
          (name.includes('libor') || name.includes('floating'))
        );
      })
      .map((item: any) => {
        const tenor = item.duration > 0.5 ? '3M_LIBOR' : '1M_LIBOR';
        const spread =
          LIBOR_SOFR_SPREADS[tenor] ?? LIBOR_SOFR_SPREADS['3M_LIBOR'];
        const sofrRate = item.rate - spread;
        const valueTransfer = item.balance * spread * (item.duration || 1);

        return {
          instrumentId: item.id,
          name: item.name,
          subcategory: item.subcategory,
          balance: item.balance,
          referenceRate: tenor.replace('_', ' '),
          currentRate: item.rate,
          sofrEquivalent: Math.round(sofrRate * 10000) / 10000,
          spreadAdjustment: spread,
          valueTransfer: Math.round(valueTransfer * 100) / 100,
          maturityYears: item.duration || 1,
        };
      });

    // If no actual LIBOR instruments found, return demo data
    if (exposures.length === 0) return this.getDemoResult(totalPortfolio);

    const totalLIBOR = exposures.reduce((s, e) => s + e.balance, 0);
    const totalTransfer = exposures.reduce((s, e) => s + e.valueTransfer, 0);
    const sofrExposure = items
      .filter((i: any) => (i.name || '').toLowerCase().includes('sofr'))
      .reduce((s: number, i: any) => s + i.balance, 0);

    return {
      exposures,
      totalLIBORExposure: totalLIBOR,
      totalSOFRExposure: sofrExposure,
      totalValueTransfer: Math.round(totalTransfer * 100) / 100,
      pctPortfolioExposed:
        totalPortfolio > 0
          ? Math.round((totalLIBOR / totalPortfolio) * 10000) / 100
          : 0,
      transitionChecklist: this.getChecklist(),
    };
  }

  private getChecklist() {
    return [
      {
        item: 'Inventory all LIBOR-referenced instruments',
        itemEs: 'Inventariar todos los instrumentos referenciados a LIBOR',
        status: 'complete' as const,
      },
      {
        item: 'Review fallback language in loan documents',
        itemEs: 'Revisar cláusulas de respaldo en documentos de préstamo',
        status: 'in_progress' as const,
      },
      {
        item: 'Calculate ISDA spread adjustments',
        itemEs: 'Calcular ajustes de spread ISDA',
        status: 'complete' as const,
      },
      {
        item: 'Notify affected borrowers of rate conversion',
        itemEs: 'Notificar a prestatarios afectados sobre conversión de tasa',
        status: 'pending' as const,
      },
      {
        item: 'Update core banking system rate indices',
        itemEs: 'Actualizar índices de tasas en sistema core bancario',
        status: 'pending' as const,
      },
      {
        item: 'File OCIF SOFR transition attestation',
        itemEs: 'Presentar atestación de transición SOFR a OCIF',
        status: 'pending' as const,
      },
      {
        item: 'Board resolution approving transition plan',
        itemEs: 'Resolución de junta aprobando plan de transición',
        status: 'in_progress' as const,
      },
    ];
  }

  private getDemoResult(totalPortfolio: number): SOFRMonitorResult {
    return {
      exposures: [
        {
          instrumentId: 'd1',
          name: 'Variable Rate Mortgages (LIBOR)',
          subcategory: 'residential_mortgage',
          balance: 18.5,
          referenceRate: '3M LIBOR',
          currentRate: 0.068,
          sofrEquivalent: 0.0654,
          spreadAdjustment: 0.00262,
          valueTransfer: 0.36,
          maturityYears: 7.5,
        },
        {
          instrumentId: 'd2',
          name: 'C&I Floating (LIBOR)',
          subcategory: 'commercial_loans',
          balance: 12.0,
          referenceRate: '1M LIBOR',
          currentRate: 0.072,
          sofrEquivalent: 0.0709,
          spreadAdjustment: 0.00114,
          valueTransfer: 0.07,
          maturityYears: 5.0,
        },
        {
          instrumentId: 'd3',
          name: 'CRE Variable (LIBOR)',
          subcategory: 'commercial_re',
          balance: 8.2,
          referenceRate: '3M LIBOR',
          currentRate: 0.062,
          sofrEquivalent: 0.0594,
          spreadAdjustment: 0.00262,
          valueTransfer: 0.16,
          maturityYears: 7.0,
        },
      ],
      totalLIBORExposure: 38.7,
      totalSOFRExposure: 85.3,
      totalValueTransfer: 0.59,
      pctPortfolioExposed: Math.round((38.7 / totalPortfolio) * 10000) / 100,
      transitionChecklist: this.getChecklist(),
    };
  }
}
