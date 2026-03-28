import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

interface QualificationSignal {
  name: string;
  score: number;
  maxScore: number;
  reason: string;
  reasonEs: string;
}

export interface QualificationResult {
  totalScore: number;
  maxPossible: number;
  grade: 'A' | 'B' | 'C' | 'D';
  signals: QualificationSignal[];
  recommendation: string;
  recommendationEs: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  nextAction: string;
  nextActionEs: string;
}

@Injectable()
export class LeadQualificationService {
  private readonly logger = new Logger(LeadQualificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Score a prospect/lead based on multiple qualification signals.
   * Higher score = more likely to convert = should be contacted first.
   *
   * Scoring dimensions:
   * 1. Asset size (larger = more budget for ALM)
   * 2. Institution type (cooperativa = perfect ICP)
   * 3. Exam proximity (upcoming COSSEC exam = urgent need)
   * 4. Engagement level (opened email, visited demo, replied)
   * 5. Current ALM solution (no solution = higher urgency)
   * 6. Regulatory pressure (recent findings = pain)
   * 7. Decision-maker access (CFO vs. analyst)
   */
  async qualifyProspect(prospectId: string): Promise<QualificationResult> {
    const prospect = await this.prisma.prospectInstitution.findUnique({
      where: { id: prospectId },
    });

    if (!prospect) {
      return this.buildResult(
        [],
        'Prospect not found',
        'Prospecto no encontrado',
      );
    }

    const signals: QualificationSignal[] = [];

    // 1. Asset Size (0-25 points)
    const assetsM = (prospect.estimatedAssets ?? 0) / 1_000_000;
    if (assetsM >= 500) {
      signals.push({
        name: 'asset_size',
        score: 25,
        maxScore: 25,
        reason: `$${assetsM.toFixed(0)}M — Tier 1, high budget capacity`,
        reasonEs: `$${assetsM.toFixed(0)}M — Nivel 1, alta capacidad presupuestaria`,
      });
    } else if (assetsM >= 200) {
      signals.push({
        name: 'asset_size',
        score: 20,
        maxScore: 25,
        reason: `$${assetsM.toFixed(0)}M — Tier 2, strong fit`,
        reasonEs: `$${assetsM.toFixed(0)}M — Nivel 2, ajuste fuerte`,
      });
    } else if (assetsM >= 100) {
      signals.push({
        name: 'asset_size',
        score: 15,
        maxScore: 25,
        reason: `$${assetsM.toFixed(0)}M — Mid-market, standard fit`,
        reasonEs: `$${assetsM.toFixed(0)}M — Mercado medio, ajuste estandar`,
      });
    } else {
      signals.push({
        name: 'asset_size',
        score: 8,
        maxScore: 25,
        reason: `$${assetsM.toFixed(0)}M — Smaller institution`,
        reasonEs: `$${assetsM.toFixed(0)}M — Institucion mas pequena`,
      });
    }

    // 2. Institution Type (0-20 points)
    const instType = prospect.institutionType ?? '';
    if (instType === 'cooperativa') {
      signals.push({
        name: 'institution_type',
        score: 20,
        maxScore: 20,
        reason: 'Cooperativa — perfect ICP, COSSEC-regulated',
        reasonEs: 'Cooperativa — ICP perfecto, regulada por COSSEC',
      });
    } else if (instType === 'credit_union') {
      signals.push({
        name: 'institution_type',
        score: 15,
        maxScore: 20,
        reason: 'Credit union — strong fit, NCUA-regulated',
        reasonEs: 'Credit union — ajuste fuerte, regulada por NCUA',
      });
    } else {
      signals.push({
        name: 'institution_type',
        score: 8,
        maxScore: 20,
        reason: `${instType} — adjacent market`,
        reasonEs: `${instType} — mercado adyacente`,
      });
    }

    // 3. Contact Role (0-15 points)
    const role = (prospect.contactRole ?? '').toLowerCase();
    if (
      role.includes('cfo') ||
      role.includes('director financiero') ||
      role.includes('vp finanz')
    ) {
      signals.push({
        name: 'decision_maker',
        score: 15,
        maxScore: 15,
        reason: 'CFO/Finance Director — direct decision maker',
        reasonEs: 'CFO/Director Financiero — tomador de decisiones directo',
      });
    } else if (role.includes('gerente') || role.includes('manager')) {
      signals.push({
        name: 'decision_maker',
        score: 10,
        maxScore: 15,
        reason: 'Manager — influencer, needs CFO approval',
        reasonEs: 'Gerente — influyente, necesita aprobacion del CFO',
      });
    } else {
      signals.push({
        name: 'decision_maker',
        score: 5,
        maxScore: 15,
        reason: `${prospect.contactRole} — may need escalation`,
        reasonEs: `${prospect.contactRole} — puede necesitar escalacion`,
      });
    }

    // 4. Data Source (0-10 points)
    const source = prospect.publicDataSource ?? '';
    if (source === 'cossec') {
      signals.push({
        name: 'data_source',
        score: 10,
        maxScore: 10,
        reason: 'COSSEC-registered — public data available for preview report',
        reasonEs:
          'Registrada en COSSEC — datos publicos disponibles para informe preview',
      });
    } else {
      signals.push({
        name: 'data_source',
        score: 5,
        maxScore: 10,
        reason: 'Limited public data — may need manual research',
        reasonEs:
          'Datos publicos limitados — puede requerir investigacion manual',
      });
    }

    // 5. Outreach Status (0-15 points)
    if (prospect.outreachSentAt) {
      const daysSinceOutreach =
        (Date.now() - new Date(prospect.outreachSentAt).getTime()) / 86_400_000;
      if (daysSinceOutreach <= 3) {
        signals.push({
          name: 'outreach_recency',
          score: 15,
          maxScore: 15,
          reason: 'Outreach sent within 3 days — hot lead',
          reasonEs: 'Outreach enviado en 3 dias — lead caliente',
        });
      } else if (daysSinceOutreach <= 14) {
        signals.push({
          name: 'outreach_recency',
          score: 10,
          maxScore: 15,
          reason: 'Outreach sent within 2 weeks — follow up',
          reasonEs: 'Outreach enviado en 2 semanas — dar seguimiento',
        });
      } else {
        signals.push({
          name: 'outreach_recency',
          score: 5,
          maxScore: 15,
          reason: 'Outreach sent 14+ days ago — re-engage',
          reasonEs: 'Outreach enviado hace 14+ dias — re-contactar',
        });
      }
    } else {
      signals.push({
        name: 'outreach_recency',
        score: 0,
        maxScore: 15,
        reason: 'No outreach sent yet — first contact needed',
        reasonEs: 'Sin outreach enviado — necesita primer contacto',
      });
    }

    // 6. Location proximity (0-15 points) — PR cooperativas are ideal
    const location = (prospect.location ?? '').toLowerCase();
    if (location.includes('pr') || location.includes('puerto rico')) {
      signals.push({
        name: 'location',
        score: 15,
        maxScore: 15,
        reason: 'Puerto Rico — core market, Spanish-first',
        reasonEs: 'Puerto Rico — mercado principal, espanol primero',
      });
    } else if (location.includes('usvi') || location.includes('virgin')) {
      signals.push({
        name: 'location',
        score: 10,
        maxScore: 15,
        reason: 'USVI — expansion market',
        reasonEs: 'USVI — mercado de expansion',
      });
    } else {
      signals.push({
        name: 'location',
        score: 5,
        maxScore: 15,
        reason: 'Outside PR — future market',
        reasonEs: 'Fuera de PR — mercado futuro',
      });
    }

    return this.buildResult(
      signals,
      this.getRecommendation(signals),
      this.getRecommendationEs(signals),
    );
  }

  /**
   * Batch-qualify all prospects and return sorted by score.
   */
  async qualifyAllProspects(): Promise<
    Array<{
      prospectId: string;
      name: string;
      assets: number;
      qualification: QualificationResult;
    }>
  > {
    const prospects = await this.prisma.prospectInstitution.findMany({
      orderBy: { estimatedAssets: 'desc' },
      take: 100,
    });

    const results = await Promise.all(
      prospects.map(
        async (p: { id: string; name: string; estimatedAssets: any }) => ({
          prospectId: p.id,
          name: p.name,
          assets: p.estimatedAssets ?? 0,
          qualification: await this.qualifyProspect(p.id),
        }),
      ),
    );

    return results.sort(
      (a, b) => b.qualification.totalScore - a.qualification.totalScore,
    );
  }

  private buildResult(
    signals: QualificationSignal[],
    recommendation: string,
    recommendationEs: string,
  ): QualificationResult {
    const totalScore = signals.reduce((s, sig) => s + sig.score, 0);
    const maxPossible = signals.reduce((s, sig) => s + sig.maxScore, 0) || 100;
    const pct = maxPossible > 0 ? totalScore / maxPossible : 0;

    let grade: 'A' | 'B' | 'C' | 'D';
    let priority: QualificationResult['priority'];
    let nextAction: string;
    let nextActionEs: string;

    if (pct >= 0.8) {
      grade = 'A';
      priority = 'CRITICAL';
      nextAction = 'Call today — high-value prospect ready for demo';
      nextActionEs = 'Llamar hoy — prospecto de alto valor listo para demo';
    } else if (pct >= 0.6) {
      grade = 'B';
      priority = 'HIGH';
      nextAction = 'Send personalized outreach within 48 hours';
      nextActionEs = 'Enviar outreach personalizado en 48 horas';
    } else if (pct >= 0.4) {
      grade = 'C';
      priority = 'MEDIUM';
      nextAction = 'Add to email sequence — nurture over 2 weeks';
      nextActionEs = 'Agregar a secuencia de email — nutrir en 2 semanas';
    } else {
      grade = 'D';
      priority = 'LOW';
      nextAction = 'Park for now — revisit when capacity allows';
      nextActionEs = 'Pausar — revisitar cuando haya capacidad';
    }

    return {
      totalScore,
      maxPossible,
      grade,
      signals,
      recommendation,
      recommendationEs,
      priority,
      nextAction,
      nextActionEs,
    };
  }

  private getRecommendation(signals: QualificationSignal[]): string {
    const topSignals = signals
      .filter((s) => s.score >= s.maxScore * 0.8)
      .map((s) => s.reason);
    if (topSignals.length === 0)
      return 'Moderate fit — needs more qualification.';
    return `Strong signals: ${topSignals.slice(0, 3).join('; ')}`;
  }

  private getRecommendationEs(signals: QualificationSignal[]): string {
    const topSignals = signals
      .filter((s) => s.score >= s.maxScore * 0.8)
      .map((s) => s.reasonEs);
    if (topSignals.length === 0)
      return 'Ajuste moderado — necesita mas calificacion.';
    return `Senales fuertes: ${topSignals.slice(0, 3).join('; ')}`;
  }
}
