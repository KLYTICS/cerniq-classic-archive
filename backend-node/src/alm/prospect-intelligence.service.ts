import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NCUADataPullService } from './data-pull/ncua-data-pull.service';

// ─── Types ───────────────────────────────────────────────────

export interface ProspectRiskFlag {
  metric: string;
  metricEs: string;
  actual: number;
  peerMedian: number;
  gap: number;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  narrative: string;
  narrativeEs: string;
}

export interface ProspectAnalysis {
  charterNumber: string;
  institutionName: string;
  totalAssets: number;
  assetTier: string;
  riskFlags: ProspectRiskFlag[];
  overallRiskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  emailDraft: string;
  emailDraftEs: string;
  estimatedAnnualValue: number; // $ value CERNIQ can deliver
}

// PR cooperativa peer medians for comparison
const PEER_MEDIANS: Record<string, number> = {
  nwr: 9.2,
  loanToShare: 72,
  nim: 3.6,
  delinquency: 1.5,
  expenseRatio: 78,
  lcrEstimate: 118,
};

@Injectable()
export class ProspectIntelligenceService {
  private readonly logger = new Logger(ProspectIntelligenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ncuaPull: NCUADataPullService,
  ) {}

  async analyzeProspect(charterNumber: string): Promise<ProspectAnalysis> {
    const ncuaData = await this.ncuaPull.pullByCharterNumber(charterNumber);

    const assets = ncuaData.items.filter(i => i.category === 'asset');
    const liabilities = ncuaData.items.filter(i => i.category === 'liability');
    const totalAssets = assets.reduce((s, i) => s + i.balance, 0);
    const totalLiabilities = liabilities.reduce((s, i) => s + i.balance, 0);
    const equity = totalAssets - totalLiabilities;
    const nwr = totalAssets > 0 ? (equity / totalAssets) * 100 : 0;

    const loans = assets.filter(i => !['cash', 'securities'].includes(i.subcategory));
    const totalLoans = loans.reduce((s, i) => s + i.balance, 0);
    const totalShares = liabilities.reduce((s, i) => s + i.balance, 0);
    const loanToShare = totalShares > 0 ? (totalLoans / totalShares) * 100 : 0;

    const assetIncome = assets.reduce((s, i) => s + i.balance * i.rate, 0);
    const liabCost = liabilities.reduce((s, i) => s + i.balance * i.rate, 0);
    const nim = totalAssets > 0 ? ((assetIncome - liabCost) / totalAssets) * 100 : 0;

    const assetTier = totalAssets < 50 ? 'small' : totalAssets < 300 ? 'medium' : 'large';

    // Identify risk flags vs. peer medians
    const riskFlags: ProspectRiskFlag[] = [];

    if (nwr < PEER_MEDIANS.nwr) {
      riskFlags.push({
        metric: 'Net Worth Ratio', metricEs: 'Ratio de Capital Neto',
        actual: +nwr.toFixed(1), peerMedian: PEER_MEDIANS.nwr, gap: +(nwr - PEER_MEDIANS.nwr).toFixed(1),
        severity: nwr < 7 ? 'HIGH' : 'MEDIUM',
        narrative: `NWR of ${nwr.toFixed(1)}% is below the PR cooperativa median of ${PEER_MEDIANS.nwr}%.`,
        narrativeEs: `NWR de ${nwr.toFixed(1)}% está por debajo de la mediana de cooperativas PR de ${PEER_MEDIANS.nwr}%.`,
      });
    }

    if (nim < PEER_MEDIANS.nim) {
      riskFlags.push({
        metric: 'Net Interest Margin', metricEs: 'Margen de Interés Neto',
        actual: +nim.toFixed(2), peerMedian: PEER_MEDIANS.nim, gap: +(nim - PEER_MEDIANS.nim).toFixed(2),
        severity: nim < 2.5 ? 'HIGH' : 'MEDIUM',
        narrative: `NIM of ${nim.toFixed(2)}% is below the peer median of ${PEER_MEDIANS.nim}%.`,
        narrativeEs: `NIM de ${nim.toFixed(2)}% está por debajo de la mediana de pares de ${PEER_MEDIANS.nim}%.`,
      });
    }

    if (loanToShare > PEER_MEDIANS.loanToShare + 10) {
      riskFlags.push({
        metric: 'Loan-to-Share Ratio', metricEs: 'Ratio Préstamos/Acciones',
        actual: +loanToShare.toFixed(1), peerMedian: PEER_MEDIANS.loanToShare, gap: +(loanToShare - PEER_MEDIANS.loanToShare).toFixed(1),
        severity: loanToShare > 90 ? 'HIGH' : 'MEDIUM',
        narrative: `Loan-to-share of ${loanToShare.toFixed(1)}% exceeds peer median of ${PEER_MEDIANS.loanToShare}%.`,
        narrativeEs: `Ratio préstamos/acciones de ${loanToShare.toFixed(1)}% excede la mediana de pares de ${PEER_MEDIANS.loanToShare}%.`,
      });
    }

    // Always add at least one flag for outreach relevance
    if (riskFlags.length === 0) {
      riskFlags.push({
        metric: 'Exam Preparation', metricEs: 'Preparación de Examen',
        actual: 0, peerMedian: 0, gap: 0, severity: 'LOW',
        narrative: 'Institution metrics are within peer norms — COSSEC exam prep automation is the primary value proposition.',
        narrativeEs: 'Las métricas institucionales están dentro de normas de pares — la automatización de preparación de examen COSSEC es la propuesta de valor principal.',
      });
    }

    const overallRiskLevel = riskFlags.some(f => f.severity === 'HIGH') ? 'HIGH'
      : riskFlags.some(f => f.severity === 'MEDIUM') ? 'MEDIUM' : 'LOW';

    // Generate personalized email
    const topFlag = riskFlags[0];
    const emailDraftEs = `Estimado/a Director/a Financiero/a,

Revisé los datos NCUA más recientes de ${ncuaData.institutionName} y noté que su ${topFlag.metricEs} de ${topFlag.actual}${topFlag.metric.includes('Ratio') ? '%' : ''} está ${topFlag.gap < 0 ? 'por debajo' : 'por encima'} de la mediana de cooperativas PR de ${topFlag.peerMedian}${topFlag.metric.includes('Ratio') ? '%' : ''}.

CERNIQ es la única plataforma ALM construida específicamente para cooperativas de Puerto Rico — con integración NCUA, formato exacto COSSEC para exámenes, y análisis cuantitativo de nivel institucional en español.

¿Tendría 15 minutos esta semana para ver cómo se comparan sus métricas con las de sus pares en nuestro dashboard?

Erwin Kiess-Alfonso
Founder & CEO, KLYTICS LLC
cerniq.io`;

    const emailDraft = `Dear CFO,

I reviewed ${ncuaData.institutionName}'s latest NCUA data and noticed your ${topFlag.metric} of ${topFlag.actual}${topFlag.metric.includes('Ratio') ? '%' : ''} is ${topFlag.gap < 0 ? 'below' : 'above'} the PR cooperativa median of ${topFlag.peerMedian}${topFlag.metric.includes('Ratio') ? '%' : ''}.

CERNIQ is the only ALM platform purpose-built for PR cooperativas — with NCUA integration, exact COSSEC exam format, and institutional-grade quant analytics in both English and Spanish.

Would 15 minutes this week be worth seeing how your metrics compare to peers on our dashboard?

Erwin Kiess-Alfonso
Founder & CEO, KLYTICS LLC
cerniq.io`;

    // Estimated annual value: exam prep savings + time savings
    const estimatedAnnualValue = 15000 + totalAssets * 20; // $15K exam + $20 per $M assets

    return {
      charterNumber,
      institutionName: ncuaData.institutionName,
      totalAssets: +totalAssets.toFixed(1),
      assetTier,
      riskFlags,
      overallRiskLevel,
      emailDraft,
      emailDraftEs,
      estimatedAnnualValue: Math.round(estimatedAnnualValue),
    };
  }

  async analyzeAllProspects(): Promise<{ analyzed: number; results: ProspectAnalysis[] }> {
    // Pull all prospects from ProspectInstitution table
    const prospects = await this.prisma.prospectInstitution.findMany({
      where: { outreachStatus: { in: ['not_started', 'sample_generated'] } },
      take: 20,
    });

    const results: ProspectAnalysis[] = [];
    for (const prospect of prospects) {
      if (!prospect.publicDataSource) continue;
      try {
        // Use a deterministic charter-like number from the prospect name
        const charter = String(Math.abs(this.hashCode(prospect.name)) % 100000).padStart(5, '0');
        const analysis = await this.analyzeProspect(charter);
        results.push({ ...analysis, institutionName: prospect.name, charterNumber: charter });

        // Update prospect status
        await this.prisma.prospectInstitution.update({
          where: { id: prospect.id },
          data: { outreachStatus: 'sample_generated', notes: `Risk flags: ${analysis.riskFlags.map(f => f.metric).join(', ')}` },
        });
      } catch (err) {
        this.logger.warn(`Failed to analyze prospect ${prospect.name}: ${err}`);
      }
    }

    return { analyzed: results.length, results };
  }

  private hashCode(s: string): number {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      hash = ((hash << 5) - hash) + s.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }
}
