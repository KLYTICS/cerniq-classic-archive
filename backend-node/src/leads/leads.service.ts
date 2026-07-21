import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EmailService } from '../email/email.service';
import { SlackService } from '../notifications/slack.service';
import { SubmitLeadDto, UpdateLeadDto } from './leads.dto';
import {
  COSSEC_BENCHMARK_Q2_2025,
  COSSEC_BENCHMARK_Q3_2025,
  LEGACY_COOPERATIVA_PROSPECT_NAMES,
  registryProspectCount,
} from './prospect-seed';
import { listPrCooperativas } from '../alm/data/registry/pr-cooperativas.registry';
import { InstitutionIntelligenceService } from './institution-intelligence.service';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    @Optional() private readonly slack?: SlackService,
    @Optional()
    private readonly institutionIntelligence?: InstitutionIntelligenceService,
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

    // Fire-and-forget: send notification emails + Slack alert
    this.sendNotificationEmails(lead, dto).catch((err: any) => {
      this.logger.error(`Email notification failed: ${err.message}`);
    });
    this.slack
      ?.notifyNewLead({
        name: dto.name,
        email: dto.email,
        institution: dto.institutionName,
        type: dto.institutionType,
        priority,
      })
      .catch(() => {});

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
    // All arithmetic in UTC to avoid a TZ-boundary bug: previously we
    // used `setDate`/`getDay` (local TZ) then `setUTCHours(13)` (UTC),
    // which on machines west of UTC evaluated in the evening would
    // silently shift the target date forward 24h — turning Friday into
    // Saturday. Both this branch and origin/main landed the same fix
    // in parallel (D14) — this is the merged canonical form.
    // Puerto Rico (AST = UTC-4 year-round, no DST) makes the
    // conversion trivial: 09:00 AST == 13:00 UTC, every day.
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 1);
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
      d.setUTCDate(d.getUTCDate() + 1);
    }
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

  async listLeads(filters?: { status?: string; priority?: string }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.priority) where.priority = filters.priority;

    return this.prisma.lead.findMany({
      where,
      include: {
        intelligenceAccount: {
          select: {
            id: true,
            kind: true,
            freshnessScore: true,
            opportunityScore: true,
            threatScore: true,
            actionScore: true,
            lastRefreshedAt: true,
          },
        },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    });
  }

  async getLead(id: string) {
    return this.prisma.lead.findUniqueOrThrow({
      where: { id },
      include: {
        intelligenceAccount: {
          select: {
            id: true,
            kind: true,
            freshnessScore: true,
            opportunityScore: true,
            threatScore: true,
            actionScore: true,
            currentSummary: true,
            lastRefreshedAt: true,
          },
        },
      },
    });
  }

  async updateLead(id: string, dto: UpdateLeadDto) {
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

  async addNote(id: string, note: string) {
    const lead = await this.prisma.lead.findUniqueOrThrow({ where: { id } });
    const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const newNotes = lead.notes
      ? `${lead.notes}\n[${timestamp}] ${note}`
      : `[${timestamp}] ${note}`;
    return this.prisma.lead.update({
      where: { id },
      data: { notes: newNotes },
    });
  }

  async markReportSent(id: string) {
    return this.prisma.lead.update({
      where: { id },
      data: { reportSentAt: new Date() },
    });
  }

  // ── Pipeline Metrics ──

  async getPipelineMetrics() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [allLeads, monthLeads] = await Promise.all([
      this.prisma.lead.findMany({ take: 1000 }),
      this.prisma.lead.findMany({
        where: { createdAt: { gte: monthStart } },
        take: 1000,
      }),
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
        totalRevenue += Number(lead.revenueAmount) || 0;
        if (lead.convertedAt) {
          totalCloseTimeMs +=
            lead.convertedAt.getTime() - lead.createdAt.getTime();
        }
        if (lead.convertedAt && lead.convertedAt >= monthStart) {
          monthRevenue += Number(lead.revenueAmount) || 0;
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

  /**
   * Upsert all COSSEC-insured cooperativas from the committed Anejo 9 registry.
   * Idempotent on `publicDataIdentifier` (COSSEC charter). Legacy name-only rows
   * without a charter are tagged `stale_pre_registry` (never deleted — demo seats).
   */
  async seedProspectPipeline() {
    const registry = listPrCooperativas();
    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const row of registry) {
      const location = `${row.hqMunicipality}, PR`;
      const data = {
        name: row.displayName,
        institutionType: 'cooperativa',
        location,
        estimatedAssets: row.totalAssetsUsd,
        publicDataSource: 'cossec',
        publicDataIdentifier: row.cossecCharter,
        memberCount: row.members,
        employeeCount: row.employees,
        region: row.region,
        icpTier: row.icpTier,
        contactRole: 'CFO',
      };

      const existing = await this.prisma.prospectInstitution.findUnique({
        where: { publicDataIdentifier: row.cossecCharter },
      });

      if (!existing) {
        await this.prisma.prospectInstitution.create({ data });
        created++;
        continue;
      }

      const assetsEqual =
        existing.estimatedAssets == null
          ? false
          : Number(existing.estimatedAssets) === row.totalAssetsUsd;
      const same =
        existing.name === data.name &&
        existing.location === data.location &&
        assetsEqual &&
        existing.memberCount === data.memberCount &&
        existing.employeeCount === data.employeeCount &&
        existing.region === data.region &&
        existing.icpTier === data.icpTier;

      if (same) {
        unchanged++;
      } else {
        await this.prisma.prospectInstitution.update({
          where: { id: existing.id },
          data: {
            name: data.name,
            location: data.location,
            estimatedAssets: data.estimatedAssets,
            publicDataSource: data.publicDataSource,
            memberCount: data.memberCount,
            employeeCount: data.employeeCount,
            region: data.region,
            icpTier: data.icpTier,
          },
        });
        updated++;
      }
    }

    const staleTagged = await this.tagStaleLegacyProspects();

    const benchmarkSeeded = await this.upsertBenchmarks();

    let intelligence:
      | { synced: number; created: number; updated: number }
      | undefined;
    if (this.institutionIntelligence) {
      intelligence = await this.institutionIntelligence.syncProspectsToAccounts(
        Math.max(registry.length, 250),
      );
    }

    this.logger.log(
      `Prospect pipeline seeded: created=${created} updated=${updated} unchanged=${unchanged} staleTagged=${staleTagged}`,
    );
    return {
      created,
      updated,
      unchanged,
      staleTagged,
      total: registryProspectCount(),
      benchmarkSeeded,
      intelligence,
    };
  }

  /** Mark legacy name-only prospects that are not in the COSSEC registry. */
  private async tagStaleLegacyProspects(): Promise<number> {
    const legacyNames = new Set(
      LEGACY_COOPERATIVA_PROSPECT_NAMES.map((n) => n.toLowerCase()),
    );
    const orphans = await this.prisma.prospectInstitution.findMany({
      where: {
        OR: [
          { publicDataIdentifier: null },
          {
            name: {
              in: [...LEGACY_COOPERATIVA_PROSPECT_NAMES],
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        notes: true,
        publicDataIdentifier: true,
        demoUserId: true,
      },
    });

    const registryNames = new Set(
      listPrCooperativas().map((r) => r.displayName.toLowerCase()),
    );
    let tagged = 0;
    for (const row of orphans) {
      if (row.publicDataIdentifier) continue;
      const isLegacy = legacyNames.has(row.name.toLowerCase());
      const notInRegistry = !registryNames.has(row.name.toLowerCase());
      if (!isLegacy && !notInRegistry) continue;
      if (row.notes?.includes('stale_pre_registry')) continue;
      const note = [
        row.notes,
        'stale_pre_registry: superseded by COSSEC Anejo 9 charter upsert',
      ]
        .filter(Boolean)
        .join(' | ');
      await this.prisma.prospectInstitution.update({
        where: { id: row.id },
        data: { notes: note },
      });
      tagged++;
    }
    return tagged;
  }

  private async upsertBenchmarks(): Promise<boolean> {
    let seeded = false;
    for (const bench of [COSSEC_BENCHMARK_Q2_2025, COSSEC_BENCHMARK_Q3_2025]) {
      const existing = await this.prisma.cooperativaBenchmark.findUnique({
        where: { period: bench.period },
      });
      if (!existing) {
        await this.prisma.cooperativaBenchmark.create({ data: bench });
        seeded = true;
      } else if (existing.activeInstitutions !== 91) {
        await this.prisma.cooperativaBenchmark.update({
          where: { period: bench.period },
          data: {
            activeInstitutions: 91,
            memberCountTotal: bench.memberCountTotal,
          },
        });
        seeded = true;
      }
    }
    return seeded;
  }

  async listProspects(filters?: {
    icpTier?: string;
    outreachStatus?: string;
    hasEmail?: boolean;
  }) {
    const where: {
      icpTier?: string;
      outreachStatus?: string;
      contactEmail?: { not: null } | null;
    } = {};
    if (filters?.icpTier) where.icpTier = filters.icpTier;
    if (filters?.outreachStatus) where.outreachStatus = filters.outreachStatus;
    if (filters?.hasEmail === true) where.contactEmail = { not: null };
    if (filters?.hasEmail === false) where.contactEmail = null;

    return this.prisma.prospectInstitution.findMany({
      where,
      orderBy: [{ estimatedAssets: 'desc' }],
      take: 200,
    });
  }

  /**
   * Portfolio suite summary for the admin operating surface — ICP tiers,
   * outreach funnel, and email readiness across the COSSEC registry.
   */
  async getPortfolioSummary() {
    const rows = await this.prisma.prospectInstitution.findMany({
      select: {
        icpTier: true,
        outreachStatus: true,
        contactEmail: true,
        estimatedAssets: true,
        institutionType: true,
      },
      take: 200,
    });

    const byTier: Record<string, number> = {
      tier1: 0,
      tier2: 0,
      tier3: 0,
      unset: 0,
    };
    const byOutreach: Record<string, number> = {};
    let withEmail = 0;
    let cooperativas = 0;
    let assetsUsd = 0;

    for (const row of rows) {
      const tier = row.icpTier ?? 'unset';
      byTier[tier] = (byTier[tier] ?? 0) + 1;
      byOutreach[row.outreachStatus] = (byOutreach[row.outreachStatus] ?? 0) + 1;
      if (row.contactEmail) withEmail += 1;
      if (row.institutionType === 'cooperativa') cooperativas += 1;
      assetsUsd += Number(row.estimatedAssets ?? 0);
    }

    return {
      total: rows.length,
      cooperativas,
      withEmail,
      withoutEmail: rows.length - withEmail,
      byTier,
      byOutreach,
      totalAssetsUsd: assetsUsd,
      mission:
        'CERNIQ — bilingual ALM wedge today; operating system for institutional balance-sheet intelligence across the cooperativa portfolio.',
    };
  }

  /** CSV of the full prospect portfolio for offline outreach / CRM import. */
  async exportPortfolioCsv(filters?: {
    icpTier?: string;
    outreachStatus?: string;
  }): Promise<string> {
    const rows = await this.listProspects(filters);
    const header = [
      'name',
      'cossec_charter',
      'location',
      'region',
      'icp_tier',
      'estimated_assets_usd',
      'members',
      'employees',
      'outreach_status',
      'contact_role',
      'contact_name',
      'contact_email',
      'institution_type',
    ].join(',');

    const escape = (v: string | number | null | undefined) => {
      if (v == null) return '';
      const s = String(v);
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const lines = rows.map((r) =>
      [
        escape(r.name),
        escape(r.publicDataIdentifier),
        escape(r.location),
        escape(r.region),
        escape(r.icpTier),
        escape(r.estimatedAssets != null ? Number(r.estimatedAssets) : ''),
        escape(r.memberCount),
        escape(r.employeeCount),
        escape(r.outreachStatus),
        escape(r.contactRole),
        escape(r.contactName),
        escape(r.contactEmail),
        escape(r.institutionType),
      ].join(','),
    );

    return [header, ...lines].join('\n') + '\n';
  }

  /**
   * Generate mailto-ready outreach drafts for many prospects (no send).
   * Used when contact emails are not yet on file — founder copies / pastes.
   */
  async generateOutreachDraftPack(
    lang: 'en' | 'es' = 'es',
    options?: { icpTier?: string; limit?: number },
  ) {
    const limit = Math.min(Math.max(options?.limit ?? 91, 1), 200);
    const prospects = await this.listProspects({
      icpTier: options?.icpTier,
    });
    const slice = prospects.slice(0, limit);
    const drafts = [];
    for (const p of slice) {
      const draft = await this.generateOutreach(p.id, lang);
      drafts.push({
        prospectId: p.id,
        name: p.name,
        icpTier: p.icpTier,
        contactEmail: p.contactEmail,
        contactRole: p.contactRole,
        outreachStatus: p.outreachStatus,
        ...draft,
        mailto: p.contactEmail
          ? `mailto:${encodeURIComponent(p.contactEmail)}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`
          : null,
      });
    }
    return {
      lang,
      count: drafts.length,
      withEmail: drafts.filter((d) => d.contactEmail).length,
      drafts,
    };
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

    const assetsNum = Number(prospect.estimatedAssets ?? 0);
    const assetsM = (assetsNum / 1_000_000).toFixed(0);
    const sectorMedianNum = Number(benchmark?.totalAssetsMedian ?? 185_000_000);
    const sectorMedianM = (sectorMedianNum / 1_000_000).toFixed(0);
    const capitalRatio = benchmark?.capitalRatioMedian?.toFixed(1) ?? '9.2';
    const tierLabel =
      prospect.icpTier === 'tier1'
        ? lang === 'es'
          ? 'prioridad primaria (≥$100M)'
          : 'primary ICP (≥$100M)'
        : prospect.icpTier === 'tier2'
          ? lang === 'es'
            ? 'prioridad secundaria ($50–100M)'
            : 'secondary ICP ($50–100M)'
          : lang === 'es'
            ? 'universo COSSEC'
            : 'COSSEC universe';

    // Compute key flags for this prospect
    const flags: string[] = [];
    if (assetsNum > sectorMedianNum) {
      flags.push(
        lang === 'es'
          ? `Con $${assetsM}M en activos (${tierLabel}), su cooperativa está por encima de la mediana del sector ($${sectorMedianM}M)`
          : `At $${assetsM}M in assets (${tierLabel}), your cooperativa is above the sector median ($${sectorMedianM}M)`,
      );
    } else {
      flags.push(
        lang === 'es'
          ? `Su cooperativa de $${assetsM}M (${tierLabel}) puede aprovechar ALM automatizado sin un equipo cuant interno`
          : `Your $${assetsM}M cooperativa (${tierLabel}) can run automated ALM without an in-house quant team`,
      );
    }

    flags.push(
      lang === 'es'
        ? `La mediana del ratio de capital del sector es ${capitalRatio}% — ¿cómo se compara su institución?`
        : `The sector median capital ratio is ${capitalRatio}% — how does your institution compare?`,
    );

    const subject =
      lang === 'es'
        ? `Informe ALM bilingüe para ${prospect.name}`
        : `Bilingual ALM report for ${prospect.name}`;

    const body =
      lang === 'es'
        ? `Estimado/a ${prospect.contactRole || 'Director Financiero'},

Nos dirigimos a usted desde CERNIQ — la plataforma de inteligencia financiera institucional para cooperativas en Puerto Rico. Nuestro producto de entrada es simple: subir el balance → recibir un informe ALM bilingüe listo para la junta. A largo plazo, somos el sistema operativo de inteligencia de balance (ALM, liquidez, tesorería, cumplimiento COSSEC) para su institución.

${flags.join('\n\n')}

Hemos preparado un informe ALM de muestra para ${prospect.name} basado en datos públicos de COSSEC (Anejo 9). El informe incluye:

• Análisis de brecha de duración y sensibilidad NII
• Cumplimiento LCR/NSFR y vista COSSEC
• Prueba de estrés con escenarios gobernados
• Comparación con la mediana del sector

¿Le gustaría recibir su informe personalizado o una demostración de 15 minutos del portafolio CERNIQ?

Saludos cordiales,
Erwin Kiess
CERNIQ — San Juan, PR
cerniq.io`
        : `Dear ${prospect.contactRole || 'CFO'},

We're reaching out from CERNIQ — institutional financial intelligence for cooperativas in Puerto Rico. The wedge is simple: upload a balance sheet → get a bilingual board-ready ALM report. Longer term, we become the operating system for your balance-sheet intelligence (ALM, liquidity, treasury, COSSEC compliance) across your institution.

${flags.join('\n\n')}

We've prepared a sample ALM report for ${prospect.name} from public COSSEC Anejo 9 data. The report includes:

• Duration gap and NII sensitivity analysis
• LCR/NSFR and COSSEC compliance view
• Stress testing with governed scenarios
• Sector median benchmarking

Would you like your personalized report or a 15-minute walkthrough of the CERNIQ portfolio suite?

Best regards,
Erwin Kiess
CERNIQ — San Juan, PR
cerniq.io`;

    return {
      subject,
      body,
      flags,
      prospect: {
        name: prospect.name,
        assets: assetsM,
        location: prospect.location,
        icpTier: prospect.icpTier,
        cossecCharter: prospect.publicDataIdentifier,
      },
    };
  }
}
