import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EmailService } from '../email/email.service';
import { SubmitLeadDto, UpdateLeadDto } from './leads.dto';
import {
  COOPERATIVA_PROSPECTS,
  COSSEC_BENCHMARK_Q3_2025,
} from './prospect-seed';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  async submitLead(dto: SubmitLeadDto) {
    // Duplicate detection: same email within 24h
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existing = await this.prisma.lead.findFirst({
      where: { email: dto.email, createdAt: { gte: cutoff } },
    });

    if (existing) {
      // Update existing lead rather than duplicate
      const updated = await this.prisma.lead.update({
        where: { id: existing.id },
        data: {
          name: dto.name,
          phone: dto.phone,
          institutionName: dto.institutionName,
          institutionType: dto.institutionType,
          message: dto.message,
          source: dto.source || existing.source,
        },
      });
      this.logger.log(`Lead updated (duplicate within 24h): ${updated.id}`);
      return {
        leadId: updated.id,
        message: "We'll have your sample report ready within 48 hours.",
        duplicate: true,
      };
    }

    // Auto-assign priority
    const priority = this.assignPriority(dto.institutionType);

    // Next follow-up: next business day at 9am AST (UTC-4)
    const nextFollowUp = this.nextBusinessDay9am();

    const lead = await this.prisma.lead.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        role: dto.role || 'CFO',
        institutionName: dto.institutionName,
        institutionType: dto.institutionType,
        message: dto.message,
        source: dto.source || 'landing_page',
        utmSource: dto.utmSource,
        utmCampaign: dto.utmCampaign,
        referredBy: dto.referredBy,
        priority,
        nextFollowUp,
      },
    });

    this.logger.log(
      `New lead created: ${lead.id} — ${dto.institutionName} (${priority})`,
    );

    // Fire-and-forget: send notification emails
    this.sendNotificationEmails(lead, dto).catch((err) => {
      this.logger.error(`Email notification failed: ${err.message}`);
    });

    return {
      leadId: lead.id,
      message: "We'll have your sample report ready within 48 hours.",
    };
  }

  private assignPriority(institutionType: string): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (
      ['cooperativa', 'credit_union', 'cpa_consultant'].includes(
        institutionType,
      )
    )
      return 'HIGH';
    if (['community_bank'].includes(institutionType)) return 'MEDIUM';
    return 'LOW';
  }

  private nextBusinessDay9am(): Date {
    const now = new Date();
    const d = new Date(now);
    // Move to next day
    d.setDate(d.getDate() + 1);
    // Skip weekends
    while (d.getDay() === 0 || d.getDay() === 6) {
      d.setDate(d.getDate() + 1);
    }
    // Set to 9am AST (13:00 UTC)
    d.setUTCHours(13, 0, 0, 0);
    return d;
  }

  private async sendNotificationEmails(lead: any, dto: SubmitLeadDto) {
    // Email 1: Internal notification to Erwin
    await this.email.sendLeadNotification({
      leadId: lead.id,
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      role: dto.role || 'CFO',
      institutionName: dto.institutionName,
      institutionType: dto.institutionType,
      message: dto.message,
      priority: lead.priority,
      nextFollowUp: lead.nextFollowUp,
    });

    // Email 2: Confirmation to lead
    const isCooperativa = dto.institutionType === 'cooperativa';
    await this.email.sendLeadConfirmation({
      name: dto.name,
      email: dto.email,
      institutionName: dto.institutionName,
      bilingual: isCooperativa,
    });
  }

  // ── Admin Operations ──

  async listLeads(userId: string, filters?: { status?: string; priority?: string }) {
    const where: any = { createdByUserId: userId };
    if (filters?.status) where.status = filters.status;
    if (filters?.priority) where.priority = filters.priority;

    return this.prisma.lead.findMany({
      where,
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    });
  }

  async getLead(id: string, userId: string) {
    return this.prisma.lead.findFirstOrThrow({
      where: { id, createdByUserId: userId },
    });
  }

  async updateLead(id: string, userId: string, dto: UpdateLeadDto) {
    // Verify ownership before updating
    await this.prisma.lead.findFirstOrThrow({
      where: { id, createdByUserId: userId },
    });

    const data: any = { ...dto };

    // If closing as won, set convertedAt
    if (dto.status === 'CLOSED_WON' && !data.convertedAt) {
      data.convertedAt = new Date();
    }

    if (dto.nextFollowUp) {
      data.nextFollowUp = new Date(dto.nextFollowUp);
    }

    return this.prisma.lead.update({ where: { id }, data });
  }

  async addNote(id: string, userId: string, note: string) {
    const lead = await this.prisma.lead.findFirstOrThrow({
      where: { id, createdByUserId: userId },
    });
    const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const newNotes = lead.notes
      ? `${lead.notes}\n[${timestamp}] ${note}`
      : `[${timestamp}] ${note}`;
    return this.prisma.lead.update({
      where: { id },
      data: { notes: newNotes },
    });
  }

  async markReportSent(id: string, userId: string) {
    // Verify ownership before updating
    await this.prisma.lead.findFirstOrThrow({
      where: { id, createdByUserId: userId },
    });
    return this.prisma.lead.update({
      where: { id },
      data: { reportSentAt: new Date() },
    });
  }

  // ── Pipeline Metrics ──

  async getPipelineMetrics(userId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [allLeads, monthLeads] = await Promise.all([
      this.prisma.lead.findMany({ where: { createdByUserId: userId } }),
      this.prisma.lead.findMany({ where: { createdByUserId: userId, createdAt: { gte: monthStart } } }),
    ]);

    const statusCounts: Record<string, number> = {};
    const statusRevenue: Record<string, number> = {};
    let totalRevenue = 0;
    let monthRevenue = 0;
    let closedWon = 0;
    let totalCloseTimeMs = 0;

    for (const lead of allLeads) {
      statusCounts[lead.status] = (statusCounts[lead.status] || 0) + 1;
      if (lead.status === 'CLOSED_WON') {
        closedWon++;
        totalRevenue += lead.revenueAmount || 0;
        if (lead.convertedAt) {
          totalCloseTimeMs +=
            lead.convertedAt.getTime() - lead.createdAt.getTime();
        }
        if (lead.convertedAt && lead.convertedAt >= monthStart) {
          monthRevenue += lead.revenueAmount || 0;
        }
      }
      // Pipeline value for active stages
      const activeStages = [
        'CONTACTED',
        'DEMO_SCHEDULED',
        'DEMO_COMPLETED',
        'PROPOSAL_SENT',
        'NEGOTIATING',
      ];
      if (activeStages.includes(lead.status)) {
        statusRevenue[lead.status] = (statusRevenue[lead.status] || 0) + 750; // Expected deal value
      }
    }

    return {
      totalLeads: allLeads.length,
      monthLeads: monthLeads.length,
      statusCounts,
      conversionRate:
        allLeads.length > 0
          ? ((closedWon / allLeads.length) * 100).toFixed(1) + '%'
          : '0%',
      avgCloseTimeDays:
        closedWon > 0
          ? Math.round(totalCloseTimeMs / closedWon / 86400000)
          : null,
      monthRevenue,
      totalRevenue,
      pipelineValue: Object.values(statusRevenue).reduce((a, b) => a + b, 0),
    };
  }

  // ── Prospect Pipeline (Outbound) ──

  async seedProspectPipeline() {
    let created = 0;
    for (const prospect of COOPERATIVA_PROSPECTS) {
      const existing = await this.prisma.prospectInstitution.findFirst({
        where: { name: prospect.name },
      });
      if (!existing) {
        await this.prisma.prospectInstitution.create({ data: prospect });
        created++;
      }
    }

    // Seed benchmark
    const existingBenchmark = await this.prisma.cooperativaBenchmark.findFirst({
      where: { period: COSSEC_BENCHMARK_Q3_2025.period },
    });
    if (!existingBenchmark) {
      await this.prisma.cooperativaBenchmark.create({
        data: COSSEC_BENCHMARK_Q3_2025,
      });
    }

    this.logger.log(`Prospect pipeline seeded: ${created} new prospects`);
    return {
      created,
      total: COOPERATIVA_PROSPECTS.length,
      benchmarkSeeded: !existingBenchmark,
    };
  }

  async listProspects() {
    return this.prisma.prospectInstitution.findMany({
      orderBy: [{ estimatedAssets: 'desc' }],
      take: 100,
    });
  }

  async getBenchmarks() {
    return this.prisma.cooperativaBenchmark.findMany({
      orderBy: { period: 'desc' },
      take: 100,
    });
  }

  // ── Outreach Message Generator ──

  async generateOutreach(prospectId: string, lang: 'en' | 'es' = 'es') {
    const prospect = await this.prisma.prospectInstitution.findUniqueOrThrow({
      where: { id: prospectId },
    });

    const benchmark = await this.prisma.cooperativaBenchmark.findFirst({
      orderBy: { period: 'desc' },
    });

    const assetsM = (prospect.estimatedAssets / 1_000_000).toFixed(0);
    const sectorMedianM = benchmark
      ? (benchmark.totalAssetsMedian / 1_000_000).toFixed(0)
      : '185';
    const capitalRatio = benchmark?.capitalRatioMedian?.toFixed(1) ?? '9.2';

    // Compute key flags for this prospect
    const flags: string[] = [];
    if (
      prospect.estimatedAssets > (benchmark?.totalAssetsMedian ?? 185_000_000)
    ) {
      flags.push(
        lang === 'es'
          ? `Con $${assetsM}M en activos, su cooperativa está por encima de la mediana del sector ($${sectorMedianM}M)`
          : `At $${assetsM}M in assets, your cooperativa is above the sector median ($${sectorMedianM}M)`,
      );
    } else {
      flags.push(
        lang === 'es'
          ? `Su cooperativa de $${assetsM}M puede aprovechar las economías de escala con herramientas ALM automatizadas`
          : `Your $${assetsM}M cooperativa can leverage economies of scale with automated ALM tools`,
      );
    }

    flags.push(
      lang === 'es'
        ? `La mediana del ratio de capital del sector es ${capitalRatio}% — ¿cómo se compara su institución?`
        : `The sector median capital ratio is ${capitalRatio}% — how does your institution compare?`,
    );

    const subject =
      lang === 'es'
        ? `Informe ALM gratuito para ${prospect.name}`
        : `Free ALM Report for ${prospect.name}`;

    const body =
      lang === 'es'
        ? `Estimado/a ${prospect.contactRole || 'Director Financiero'},

Nos dirigimos a usted desde CERNIQ, plataforma de inteligencia ALM diseñada para cooperativas en Puerto Rico.

${flags.join('\n\n')}

Hemos preparado un informe ALM de muestra para ${prospect.name} basado en datos públicos de COSSEC. El informe incluye:

• Análisis de brecha de duración y sensibilidad NII
• Cumplimiento LCR/NSFR bajo Basilea III
• Prueba de estrés Monte Carlo con 1,000 escenarios
• Comparación con la mediana del sector

¿Le gustaría recibir su informe personalizado? Responda a este correo o programe una demostración de 15 minutos.

Saludos cordiales,
Erwin Kiess
CERNIQ — San Juan, PR`
        : `Dear ${prospect.contactRole || 'CFO'},

We're reaching out from CERNIQ, an ALM intelligence platform built for cooperativas in Puerto Rico.

${flags.join('\n\n')}

We've prepared a sample ALM report for ${prospect.name} using publicly available COSSEC data. The report includes:

• Duration gap and NII sensitivity analysis
• LCR/NSFR compliance under Basel III
• Monte Carlo stress test with 1,000 scenarios
• Sector median benchmarking

Would you like to receive your personalized report? Reply to this email or schedule a 15-minute demo.

Best regards,
Erwin Kiess
CERNIQ — San Juan, PR`;

    return {
      subject,
      body,
      flags,
      prospect: {
        name: prospect.name,
        assets: assetsM,
        location: prospect.location,
      },
    };
  }
}
