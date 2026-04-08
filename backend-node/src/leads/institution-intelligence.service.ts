import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma.service';
import { LeadQualificationService } from './lead-qualification.service';
import { LeadScoringService } from './lead-scoring.service';
import { ProspectIntelligenceService } from '../alm/prospect-intelligence.service';
import { SampleReportFactoryService } from '../alm/sample-report-factory.service';
import {
  buildManifestId,
  createPdfManifest,
} from '../alm/document-exports.util';
import type { DocumentExportManifest } from '../alm/document-exports.types';

type BuyerAccountSummary = {
  accountId: string;
  prospectId: string | null;
  name: string;
  status: string;
  institutionalType: string | null;
  location: string | null;
  estimatedAssets: number | null;
  freshnessScore: number;
  opportunityScore: number;
  actionScore: number;
  sourceCount: number;
  openActionCount: number;
  latestSnapshotAt: string | null;
  latestArtifactTitle: string | null;
  topInsight: {
    title: string;
    severity: string;
    type: string;
  } | null;
  linkedLeadStatus: string | null;
};

type DossierFacts = {
  prospectId: string;
  institutionName: string;
  institutionalType: string | null;
  location: string | null;
  region: string | null;
  country: string;
  estimatedAssets: number | null;
  estimatedAssetsVsBenchmarkPct: number | null;
  sourceOfTruth: string | null;
  benchmark: {
    period: string | null;
    totalAssetsMedian: number | null;
    capitalRatioMedian: number | null;
    loanToShareMedian: number | null;
    liquidityRatioMedian: number | null;
    niiMarginMedian: number | null;
  };
  qualification: {
    totalScore: number;
    grade: string;
    priority: string;
    nextAction: string;
    nextActionEs: string;
  } | null;
  leadScore: {
    total: number;
    fit: number;
    intent: number;
    tier: string;
  } | null;
  outreach: {
    status: string;
    sentAt: string | null;
    hasContactEmail: boolean;
    contactRole: string | null;
  };
  artifactState: {
    hasSampleReport: boolean;
  };
};

@Injectable()
export class InstitutionIntelligenceService {
  private readonly logger = new Logger(InstitutionIntelligenceService.name);

  private static readonly SYSTEM_WORKSPACE_NAME = '__SYSTEM_INTELLIGENCE__';
  private static readonly GENERATED_BY = 'institution_intelligence_v1';
  private static readonly DEFAULT_COUNTRY = 'Puerto Rico';
  private static readonly DEFAULT_REFRESH_DAYS = 7;

  constructor(
    private readonly prisma: PrismaService,
    private readonly leadQualification: LeadQualificationService,
    private readonly leadScoring: LeadScoringService,
    private readonly prospectIntelligence: ProspectIntelligenceService,
    private readonly sampleReportFactory: SampleReportFactoryService,
  ) {}

  async syncProspectsToAccounts(limit = 250) {
    const workspaceId = await this.getOrCreateSystemWorkspaceId();
    const prospects = await this.prisma.prospectInstitution.findMany({
      orderBy: [{ estimatedAssets: 'desc' }, { createdAt: 'asc' }],
      take: limit,
    });

    let created = 0;
    let updated = 0;

    for (const prospect of prospects) {
      const normalizedName = this.normalizeName(prospect.name);
      const existing = await this.prisma.intelligenceAccount.findFirst({
        where: {
          workspaceId,
          kind: 'BUYER',
          normalizedName,
        },
      });

      const account = existing
        ? await this.prisma.intelligenceAccount.update({
            where: { id: existing.id },
            data: {
              name: prospect.name,
              normalizedName,
              institutionalType: prospect.institutionType,
              region: this.deriveRegion(prospect.location),
              sourceOfTruth: prospect.publicDataSource || 'official_registry',
              status: this.mapOutreachStatusToAccountStatus(
                prospect.outreachStatus,
              ),
              metadata: {
                ...(this.asRecord(existing.metadata) || {}),
                prospectId: prospect.id,
                contactRole: prospect.contactRole,
                contactEmail: prospect.contactEmail,
                generatedBy: InstitutionIntelligenceService.GENERATED_BY,
              },
            },
          })
        : await this.prisma.intelligenceAccount.create({
            data: {
              workspaceId,
              kind: 'BUYER',
              name: prospect.name,
              normalizedName,
              status: this.mapOutreachStatusToAccountStatus(
                prospect.outreachStatus,
              ),
              region: this.deriveRegion(prospect.location),
              country: InstitutionIntelligenceService.DEFAULT_COUNTRY,
              institutionalType: prospect.institutionType,
              sourceOfTruth: prospect.publicDataSource || 'official_registry',
              metadata: {
                prospectId: prospect.id,
                contactRole: prospect.contactRole,
                contactEmail: prospect.contactEmail,
                generatedBy: InstitutionIntelligenceService.GENERATED_BY,
              },
            },
          });

      await this.ensureOfficialRegistrySource(account.id, prospect);

      await this.prisma.prospectInstitution.update({
        where: { id: prospect.id },
        data: {
          intelligenceAccountId: account.id,
        },
      });

      await this.linkMatchingLeads(account.id, prospect);

      if (existing) {
        updated++;
      } else {
        created++;
      }
    }

    return {
      workspaceId,
      synced: prospects.length,
      created,
      updated,
    };
  }

  async refreshAllBuyerAccounts(limit = 25, staleOnly = true) {
    const workspaceId = await this.getOrCreateSystemWorkspaceId();
    await this.syncProspectsToAccounts(limit * 4);

    const where = {
      workspaceId,
      kind: 'BUYER' as const,
      ...(staleOnly
        ? {
            OR: [
              { nextRefreshAt: null },
              { nextRefreshAt: { lte: new Date() } },
            ],
          }
        : {}),
    };

    const accounts = await this.prisma.intelligenceAccount.findMany({
      where,
      orderBy: [{ nextRefreshAt: 'asc' }, { updatedAt: 'asc' }],
      take: limit,
    });

    const run = await this.prisma.intelligenceRun.create({
      data: {
        workspaceId,
        trigger: staleOnly ? 'scheduled_refresh' : 'manual_refresh',
        status: 'RUNNING',
        accountCount: accounts.length,
        metadata: {
          staleOnly,
          generatedBy: InstitutionIntelligenceService.GENERATED_BY,
        },
      },
    });

    let snapshotCount = 0;
    let insightCount = 0;

    try {
      for (const account of accounts) {
        const result = await this.refreshAccountInternal(account.id, run.id);
        snapshotCount += result.snapshotCreated ? 1 : 0;
        insightCount += result.insightCount;
      }

      await this.prisma.intelligenceRun.update({
        where: { id: run.id },
        data: {
          status: 'COMPLETED',
          snapshotCount,
          insightCount,
          completedAt: new Date(),
        },
      });
    } catch (error: any) {
      await this.prisma.intelligenceRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          errorMessage: error?.message || 'Unknown refresh failure',
          snapshotCount,
          insightCount,
          completedAt: new Date(),
        },
      });
      throw error;
    }

    return {
      runId: run.id,
      refreshed: accounts.length,
      snapshotCount,
      insightCount,
    };
  }

  async refreshProspectDossier(prospectId: string) {
    const account = await this.getOrCreateAccountForProspect(prospectId);
    const run = await this.prisma.intelligenceRun.create({
      data: {
        workspaceId: account.workspaceId,
        trigger: 'manual_prospect_refresh',
        status: 'RUNNING',
        accountCount: 1,
        metadata: {
          prospectId,
          generatedBy: InstitutionIntelligenceService.GENERATED_BY,
        },
      },
    });

    try {
      const result = await this.refreshAccountInternal(account.id, run.id);
      await this.prisma.intelligenceRun.update({
        where: { id: run.id },
        data: {
          status: 'COMPLETED',
          snapshotCount: result.snapshotCreated ? 1 : 0,
          insightCount: result.insightCount,
          completedAt: new Date(),
        },
      });
    } catch (error: any) {
      await this.prisma.intelligenceRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          errorMessage: error?.message || 'Unknown refresh failure',
          completedAt: new Date(),
        },
      });
      throw error;
    }

    return this.getProspectDossier(prospectId);
  }

  async listBuyerAccountSummaries(limit = 100): Promise<BuyerAccountSummary[]> {
    const workspaceId = await this.getOrCreateSystemWorkspaceId();
    const accounts = await this.prisma.intelligenceAccount.findMany({
      where: {
        workspaceId,
        kind: 'BUYER',
      },
      include: {
        syncedProspects: true,
        syncedLeads: true,
        snapshots: {
          orderBy: { capturedAt: 'desc' },
          take: 1,
        },
        insights: {
          orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
          take: 1,
        },
        actions: {
          where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
        },
        artifacts: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        sources: true,
      },
      orderBy: [{ actionScore: 'desc' }, { opportunityScore: 'desc' }],
      take: limit,
    });

    return accounts.map((account: any) => {
      const prospect = account.syncedProspects[0] || null;
      const topInsight = account.insights[0] || null;
      const latestArtifact = account.artifacts[0] || null;
      const latestLead = account.syncedLeads[0] || null;
      const latestSnapshot = account.snapshots[0] || null;

      return {
        accountId: account.id,
        prospectId: prospect?.id || null,
        name: account.name,
        status: account.status,
        institutionalType:
          account.institutionalType || prospect?.institutionType || null,
        location: prospect?.location || null,
        estimatedAssets: this.toNumber(prospect?.estimatedAssets),
        freshnessScore: account.freshnessScore,
        opportunityScore: account.opportunityScore,
        actionScore: account.actionScore,
        sourceCount: account.sources.length,
        openActionCount: account.actions.length,
        latestSnapshotAt: latestSnapshot?.capturedAt?.toISOString() || null,
        latestArtifactTitle: latestArtifact?.title || null,
        topInsight: topInsight
          ? {
              title: topInsight.title,
              severity: topInsight.severity,
              type: topInsight.type,
            }
          : null,
        linkedLeadStatus: latestLead?.status || null,
      };
    });
  }

  async getProspectDossier(prospectId: string) {
    const account = await this.getOrCreateAccountForProspect(prospectId);
    const detailed = await this.prisma.intelligenceAccount.findUnique({
      where: { id: account.id },
      include: {
        syncedProspects: true,
        syncedLeads: true,
        sources: {
          orderBy: { createdAt: 'asc' },
        },
        snapshots: {
          orderBy: { capturedAt: 'desc' },
          take: 5,
        },
        insights: {
          orderBy: [{ createdAt: 'desc' }],
          take: 12,
        },
        actions: {
          orderBy: [{ actionScore: 'desc' }, { createdAt: 'desc' }],
          take: 12,
        },
        artifacts: {
          orderBy: { createdAt: 'desc' },
          take: 12,
        },
        memoryEntries: {
          orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
          take: 8,
        },
      },
    });

    if (!detailed) {
      throw new NotFoundException('Intelligence account not found');
    }

    const prospect = detailed.syncedProspects[0] || null;

    return {
      account: {
        id: detailed.id,
        name: detailed.name,
        status: detailed.status,
        kind: detailed.kind,
        institutionalType: detailed.institutionalType,
        sourceOfTruth: detailed.sourceOfTruth,
        freshnessScore: detailed.freshnessScore,
        opportunityScore: detailed.opportunityScore,
        threatScore: detailed.threatScore,
        actionScore: detailed.actionScore,
        lastRefreshedAt: detailed.lastRefreshedAt,
        lastChangedAt: detailed.lastChangedAt,
        nextRefreshAt: detailed.nextRefreshAt,
        currentSummary: detailed.currentSummary,
        metadata: detailed.metadata,
      },
      prospect,
      linkedLeads: detailed.syncedLeads,
      sources: detailed.sources,
      snapshots: detailed.snapshots,
      latestSnapshot: detailed.snapshots[0] || null,
      insights: detailed.insights,
      actions: detailed.actions,
      artifacts: detailed.artifacts,
      memoryEntries: detailed.memoryEntries,
    };
  }

  async exportProspectDossierCsv(prospectId: string) {
    const dossier = await this.getProspectDossier(prospectId);
    const latestSnapshot = dossier.latestSnapshot;
    const facts = this.asRecord(latestSnapshot?.factsJson) || {};
    const prospect = dossier.prospect;

    const header = [
      'account_id',
      'prospect_id',
      'institution_name',
      'institution_type',
      'location',
      'source_of_truth',
      'estimated_assets',
      'freshness_score',
      'opportunity_score',
      'action_score',
      'top_insight',
      'top_insight_severity',
      'open_actions',
      'outreach_status',
      'contact_role',
      'contact_email',
      'summary',
    ];

    const topInsight = dossier.insights[0] || null;
    const row = [
      dossier.account.id,
      prospect?.id || '',
      dossier.account.name,
      dossier.account.institutionalType || '',
      prospect?.location || '',
      dossier.account.sourceOfTruth || '',
      String(
        this.toNumber(
          (facts.estimatedAssets as number | null) ?? prospect?.estimatedAssets,
        ) ?? '',
      ),
      String(dossier.account.freshnessScore),
      String(dossier.account.opportunityScore),
      String(dossier.account.actionScore),
      topInsight?.title || '',
      topInsight?.severity || '',
      String(
        dossier.actions.filter((action: any) => action.status === 'OPEN')
          .length,
      ),
      prospect?.outreachStatus || '',
      prospect?.contactRole || '',
      prospect?.contactEmail || '',
      dossier.account.currentSummary || '',
    ];

    return `${header.map(this.escapeCsv).join(',')}\n${row.map(this.escapeCsv).join(',')}\n`;
  }

  async completeAction(actionId: string) {
    return this.prisma.intelligenceAction.update({
      where: { id: actionId },
      data: {
        status: 'DONE',
        completedAt: new Date(),
      },
    });
  }

  async generateProspectSampleReport(
    prospectId: string,
    lang: 'en' | 'es' = 'es',
  ) {
    const account = await this.getOrCreateAccountForProspect(prospectId);
    const charterNumber = this.syntheticCharterFromName(account.name);
    const buffer = await this.sampleReportFactory.generateSampleReport(
      charterNumber,
      lang,
    );

    await this.prisma.intelligenceArtifact.create({
      data: {
        workspaceId: account.workspaceId,
        accountId: account.id,
        type: 'HANDOFF_REPORT',
        title: `${account.name} sample report (${lang.toUpperCase()})`,
        summary:
          'Prospect sample report generated from public intelligence context',
        artifactData: {
          charterNumber,
          generatedBy: InstitutionIntelligenceService.GENERATED_BY,
          language: lang,
        },
      },
    });

    return {
      buffer,
      filename: `sample-alm-report-${charterNumber}-${lang}.pdf`,
    };
  }

  async listProspectSampleReportExports(
    prospectId: string,
  ): Promise<DocumentExportManifest[]> {
    const account = await this.getOrCreateAccountForProspect(prospectId);
    const charterNumber = this.syntheticCharterFromName(account.name);

    return (['es', 'en'] as const).map((language) =>
      createPdfManifest({
        id: buildManifestId(
          'sample_report',
          `prospect-${prospectId}`,
          language,
        ),
        kind: 'sample_report',
        language,
        audience: 'sample',
        status: 'ready',
        downloadUrl: `/admin/api/prospects/${prospectId}/dossier/sample-report?lang=${language}`,
        sourceLabel: account.name,
        generatedAt: new Date(),
        watermark: null,
      }),
    );
  }

  private async refreshAccountInternal(accountId: string, runId?: string) {
    const account = await this.prisma.intelligenceAccount.findUnique({
      where: { id: accountId },
      include: {
        syncedProspects: true,
        syncedLeads: true,
      },
    });
    if (!account) {
      throw new NotFoundException('Intelligence account not found');
    }

    const prospect = account.syncedProspects[0];
    if (!prospect) {
      throw new NotFoundException(
        'Prospect not linked to intelligence account',
      );
    }

    const benchmark = await this.prisma.cooperativaBenchmark.findFirst({
      orderBy: { period: 'desc' },
    });
    const linkedLead =
      account.syncedLeads.sort(
        (a: any, b: any) => b.updatedAt.getTime() - a.updatedAt.getTime(),
      )[0] || null;

    const qualification = await this.leadQualification.qualifyProspect(
      prospect.id,
    );
    const leadScore = linkedLead
      ? await this.leadScoring.scoreLead(linkedLead.id)
      : null;
    const externalIntel = await this.safeAnalyzeProspect(prospect);

    const facts = this.buildFacts(
      prospect,
      benchmark,
      qualification,
      leadScore,
      externalIntel,
    );
    const summary = this.buildSummary(facts, externalIntel);
    const changeHash = this.hashPayload({
      facts,
      summary,
    });

    const latestSnapshot = await this.prisma.intelligenceSnapshot.findFirst({
      where: { accountId },
      orderBy: { capturedAt: 'desc' },
    });

    let snapshot = latestSnapshot;
    let snapshotCreated = false;
    if (!latestSnapshot || latestSnapshot.changeHash !== changeHash) {
      snapshot = await this.prisma.intelligenceSnapshot.create({
        data: {
          accountId,
          runId,
          sourceId: await this.getPrimarySourceId(accountId),
          summary,
          factsJson: facts,
          rawMetadata: {
            benchmarkPeriod: benchmark?.period || null,
            prospectId: prospect.id,
            linkedLeadId: linkedLead?.id || null,
            generatedBy: InstitutionIntelligenceService.GENERATED_BY,
          },
          changeHash,
        },
      });
      snapshotCreated = true;
    }

    const insightRows = this.buildInsights(
      facts,
      qualification,
      leadScore,
      externalIntel,
    );

    await this.prisma.intelligenceInsight.deleteMany({
      where: {
        accountId,
        reviewedAt: null,
      },
    });
    await this.prisma.intelligenceAction.deleteMany({
      where: {
        accountId,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        metadata: {
          path: ['generatedBy'],
          equals: InstitutionIntelligenceService.GENERATED_BY,
        },
      },
    });

    const createdInsights = await Promise.all(
      insightRows.map((row) =>
        this.prisma.intelligenceInsight.create({
          data: {
            accountId,
            runId,
            snapshotId: snapshot?.id,
            type: row.type,
            severity: row.severity,
            title: row.title,
            description: row.description,
            confidence: row.confidence,
            data: row.data,
          },
        }),
      ),
    );

    const actions = this.buildActions(
      accountId,
      prospect,
      createdInsights,
      facts,
    );
    await Promise.all(
      actions.map((action) =>
        this.prisma.intelligenceAction.create({
          data: action,
        }),
      ),
    );

    await this.createArtifacts(account, prospect, summary, facts, runId);
    await this.upsertWorkspaceMemory(account, summary, createdInsights);

    await this.prisma.intelligenceAccount.update({
      where: { id: accountId },
      data: {
        currentSummary: summary,
        freshnessScore: this.computeFreshnessScore(prospect),
        opportunityScore: this.computeOpportunityScore(
          qualification,
          leadScore,
        ),
        threatScore: this.computeThreatScore(createdInsights),
        actionScore: this.computeActionScore(createdInsights, actions.length),
        lastRefreshedAt: new Date(),
        lastChangedAt: snapshotCreated ? new Date() : account.lastChangedAt,
        nextRefreshAt: this.daysFromNow(
          InstitutionIntelligenceService.DEFAULT_REFRESH_DAYS,
        ),
        status: this.mapOutreachStatusToAccountStatus(prospect.outreachStatus),
        metadata: {
          ...(this.asRecord(account.metadata) || {}),
          generatedBy: InstitutionIntelligenceService.GENERATED_BY,
          lastRunId: runId || null,
          prospectId: prospect.id,
          linkedLeadId: linkedLead?.id || null,
        },
      },
    });

    await this.prisma.prospectInstitution.update({
      where: { id: prospect.id },
      data: {
        intelligenceAccountId: accountId,
      },
    });

    if (linkedLead) {
      await this.prisma.lead.update({
        where: { id: linkedLead.id },
        data: {
          intelligenceAccountId: accountId,
          publicDataSnapshot: {
            ...facts,
            summary,
          },
        },
      });
    }

    return {
      snapshotCreated,
      insightCount: createdInsights.length,
    };
  }

  private async createArtifacts(
    account: { id: string; workspaceId: string; name: string },
    prospect: { id: string; outreachStatus: string },
    summary: string,
    facts: DossierFacts,
    runId?: string,
  ) {
    const csvContent = this.buildArtifactCsv(
      account.id,
      prospect.id,
      facts,
      summary,
    );

    await this.prisma.intelligenceArtifact.createMany({
      data: [
        {
          workspaceId: account.workspaceId,
          accountId: account.id,
          runId,
          type: 'BUYER_DOSSIER',
          title: `${account.name} dossier`,
          summary,
          artifactData: facts,
          artifactText: summary,
        },
        {
          workspaceId: account.workspaceId,
          accountId: account.id,
          runId,
          type: 'ACCOUNT_EXPORT',
          title: `${account.name} export`,
          summary: 'Flat dossier export for CRM and analyst workflows',
          artifactData: {
            prospectId: prospect.id,
            outreachStatus: prospect.outreachStatus,
          },
          csvContent,
        },
      ],
    });
  }

  private async upsertWorkspaceMemory(
    account: { id: string; workspaceId: string; name: string },
    summary: string,
    insights: Array<{ severity: string; title: string }>,
  ) {
    const highestSeverity = insights[0]?.severity || 'LOW';
    const title = `${account.name} intelligence refresh`;

    await this.prisma.workspaceMemoryEntry.create({
      data: {
        workspaceId: account.workspaceId,
        accountId: account.id,
        type: highestSeverity === 'HIGH' ? 'ALERT' : 'NOTE',
        title,
        body: summary,
        metadata: {
          generatedBy: InstitutionIntelligenceService.GENERATED_BY,
          highestSeverity,
        },
      },
    });
  }

  private buildFacts(
    prospect: {
      id: string;
      name: string;
      institutionType: string;
      location: string | null;
      estimatedAssets: any;
      publicDataSource: string | null;
      outreachStatus: string;
      outreachSentAt: Date | null;
      contactRole: string | null;
      contactEmail: string | null;
      reportUrl: string | null;
    },
    benchmark: any,
    qualification: Awaited<
      ReturnType<LeadQualificationService['qualifyProspect']>
    >,
    leadScore: Awaited<ReturnType<LeadScoringService['scoreLead']>> | null,
    _externalIntel: Awaited<
      ReturnType<InstitutionIntelligenceService['safeAnalyzeProspect']>
    >,
  ): DossierFacts {
    const estimatedAssets = this.toNumber(prospect.estimatedAssets);
    const benchmarkAssets = this.toNumber(benchmark?.totalAssetsMedian);

    return {
      prospectId: prospect.id,
      institutionName: prospect.name,
      institutionalType: prospect.institutionType,
      location: prospect.location,
      region: this.deriveRegion(prospect.location),
      country: InstitutionIntelligenceService.DEFAULT_COUNTRY,
      estimatedAssets,
      estimatedAssetsVsBenchmarkPct:
        estimatedAssets && benchmarkAssets
          ? Number(
              (
                ((estimatedAssets - benchmarkAssets) / benchmarkAssets) *
                100
              ).toFixed(1),
            )
          : null,
      sourceOfTruth: prospect.publicDataSource,
      benchmark: {
        period: benchmark?.period || null,
        totalAssetsMedian: benchmarkAssets,
        capitalRatioMedian: this.toNumber(benchmark?.capitalRatioMedian),
        loanToShareMedian: this.toNumber(benchmark?.loanToShareMedian),
        liquidityRatioMedian: this.toNumber(benchmark?.liquidityRatioMedian),
        niiMarginMedian: this.toNumber(benchmark?.niiMarginMedian),
      },
      qualification: qualification
        ? {
            totalScore: qualification.totalScore,
            grade: qualification.grade,
            priority: qualification.priority,
            nextAction: qualification.nextAction,
            nextActionEs: qualification.nextActionEs,
          }
        : null,
      leadScore: leadScore
        ? {
            total: leadScore.total,
            fit: leadScore.fit,
            intent: leadScore.intent,
            tier: leadScore.tier,
          }
        : null,
      outreach: {
        status: prospect.outreachStatus,
        sentAt: prospect.outreachSentAt?.toISOString() || null,
        hasContactEmail: Boolean(prospect.contactEmail),
        contactRole: prospect.contactRole,
      },
      artifactState: {
        hasSampleReport: Boolean(prospect.reportUrl),
      },
    };
  }

  private buildSummary(
    facts: DossierFacts,
    externalIntel: Awaited<
      ReturnType<InstitutionIntelligenceService['safeAnalyzeProspect']>
    >,
  ) {
    const assetText = facts.estimatedAssets
      ? `$${Math.round(facts.estimatedAssets / 1_000_000)}M`
      : 'asset size unknown';
    const priority = facts.qualification?.priority || 'MEDIUM';
    const topRisk =
      externalIntel?.riskFlags?.[0]?.metricEs ||
      externalIntel?.riskFlags?.[0]?.metric ||
      'regulatory readiness';

    return `${facts.institutionName} is a ${facts.institutionalType || 'target institution'} in ${facts.location || 'Puerto Rico'} with ${assetText} in estimated assets. Current dossier priority is ${priority}. Top focus area: ${topRisk}. Outreach status: ${facts.outreach.status}. Public source of truth: ${facts.sourceOfTruth || 'manual registry'}.`;
  }

  private buildInsights(
    facts: DossierFacts,
    qualification: Awaited<
      ReturnType<LeadQualificationService['qualifyProspect']>
    >,
    leadScore: Awaited<ReturnType<LeadScoringService['scoreLead']>> | null,
    externalIntel: Awaited<
      ReturnType<InstitutionIntelligenceService['safeAnalyzeProspect']>
    >,
  ) {
    const insights: Array<{
      type:
        | 'URGENCY_SIGNAL'
        | 'REGULATORY_SIGNAL'
        | 'CONTACT_SIGNAL'
        | 'PRODUCT_SIGNAL'
        | 'REFRESH_NOTE';
      severity: 'HIGH' | 'MEDIUM' | 'LOW';
      title: string;
      description: string;
      confidence: number;
      data: Record<string, unknown>;
    }> = [];

    const qualificationPriority = qualification.priority;
    insights.push({
      type: 'URGENCY_SIGNAL',
      severity:
        qualificationPriority === 'CRITICAL' || qualificationPriority === 'HIGH'
          ? 'HIGH'
          : qualificationPriority === 'MEDIUM'
            ? 'MEDIUM'
            : 'LOW',
      title: `${facts.institutionName} buyer urgency`,
      description: `${facts.institutionName} is currently graded ${qualification.grade} with a qualification score of ${qualification.totalScore}/${qualification.maxPossible}. Recommended next step: ${qualification.nextAction}.`,
      confidence: 0.82,
      data: {
        qualificationPriority,
        qualificationScore: qualification.totalScore,
        leadTier: leadScore?.tier || null,
      },
    });

    if (externalIntel?.riskFlags?.length) {
      const topRisk = externalIntel.riskFlags[0];
      insights.push({
        type: 'REGULATORY_SIGNAL',
        severity:
          topRisk.severity === 'HIGH'
            ? 'HIGH'
            : topRisk.severity === 'MEDIUM'
              ? 'MEDIUM'
              : 'LOW',
        title: `${facts.institutionName} public risk signal`,
        description: topRisk.narrativeEs || topRisk.narrative,
        confidence: 0.74,
        data: {
          metric: topRisk.metric,
          actual: topRisk.actual,
          peerMedian: topRisk.peerMedian,
          gap: topRisk.gap,
        },
      });
    }

    if (!facts.outreach.hasContactEmail) {
      insights.push({
        type: 'CONTACT_SIGNAL',
        severity: 'MEDIUM',
        title: `${facts.institutionName} lacks a verified contact email`,
        description:
          'The dossier is actionable, but contact enrichment is incomplete. Add or verify an executive email before outreach.',
        confidence: 0.9,
        data: {
          contactRole: facts.outreach.contactRole,
        },
      });
    }

    if (!facts.artifactState.hasSampleReport) {
      insights.push({
        type: 'PRODUCT_SIGNAL',
        severity: 'MEDIUM',
        title: `${facts.institutionName} has no sample report artifact yet`,
        description:
          'Generate a sample ALM report so the operator can move from raw institutional intelligence to a sendable prospect asset.',
        confidence: 0.88,
        data: {
          reportAvailable: false,
        },
      });
    }

    insights.push({
      type: 'REFRESH_NOTE',
      severity: 'LOW',
      title: `${facts.institutionName} source freshness`,
      description: `Latest official/public data source is ${facts.sourceOfTruth || 'manual'} with benchmark period ${facts.benchmark.period || 'unknown'}.`,
      confidence: 0.68,
      data: {
        sourceOfTruth: facts.sourceOfTruth,
        benchmarkPeriod: facts.benchmark.period,
      },
    });

    return insights;
  }

  private buildActions(
    accountId: string,
    prospect: {
      id: string;
      outreachStatus: string;
      reportUrl: string | null;
      contactEmail: string | null;
    },
    insights: Array<{
      id: string;
      type: string;
      severity: string;
      title: string;
    }>,
    facts: DossierFacts,
  ) {
    const actions: Array<{
      accountId: string;
      insightId?: string;
      type:
        | 'REVIEW_ACCOUNT'
        | 'GENERATE_REPORT'
        | 'CONTACT_BUYER'
        | 'UPDATE_CRM';
      status: 'OPEN';
      title: string;
      description: string;
      confidence: number;
      actionScore: number;
      dueAt?: Date;
      metadata: Record<string, unknown>;
    }> = [];

    const topInsight = insights[0];
    actions.push({
      accountId,
      insightId: topInsight?.id,
      type: 'REVIEW_ACCOUNT',
      status: 'OPEN',
      title: 'Review latest dossier',
      description:
        'Inspect the newest institutional findings and confirm the recommended GTM path before outreach.',
      confidence: 0.84,
      actionScore: 92,
      dueAt: this.daysFromNow(1),
      metadata: {
        prospectId: prospect.id,
        generatedBy: InstitutionIntelligenceService.GENERATED_BY,
      },
    });

    if (!prospect.reportUrl) {
      actions.push({
        accountId,
        insightId: insights.find((insight) => insight.type === 'PRODUCT_SIGNAL')
          ?.id,
        type: 'GENERATE_REPORT',
        status: 'OPEN',
        title: 'Generate sample report',
        description:
          'Create a sample ALM report from the dossier context so the institution has a concrete product artifact attached to the account.',
        confidence: 0.88,
        actionScore: 90,
        dueAt: this.daysFromNow(1),
        metadata: {
          prospectId: prospect.id,
          generatedBy: InstitutionIntelligenceService.GENERATED_BY,
        },
      });
    }

    if (!prospect.contactEmail || prospect.outreachStatus === 'not_started') {
      actions.push({
        accountId,
        insightId: insights.find((insight) => insight.type === 'CONTACT_SIGNAL')
          ?.id,
        type: 'CONTACT_BUYER',
        status: 'OPEN',
        title: 'Prepare outreach',
        description:
          'Use the dossier findings to prepare the next outreach step and confirm the buyer contact path.',
        confidence: 0.8,
        actionScore: 82,
        dueAt: this.daysFromNow(2),
        metadata: {
          prospectId: prospect.id,
          generatedBy: InstitutionIntelligenceService.GENERATED_BY,
          outreachStatus: prospect.outreachStatus,
        },
      });
    }

    if (!facts.leadScore) {
      actions.push({
        accountId,
        type: 'UPDATE_CRM',
        status: 'OPEN',
        title: 'Sync dossier to CRM',
        description:
          'Link or create the matching lead so sales pipeline state and institutional intelligence stay aligned.',
        confidence: 0.78,
        actionScore: 70,
        dueAt: this.daysFromNow(2),
        metadata: {
          prospectId: prospect.id,
          generatedBy: InstitutionIntelligenceService.GENERATED_BY,
        },
      });
    }

    return actions;
  }

  private computeFreshnessScore(prospect: {
    outreachSentAt: Date | null;
    updatedAt: Date;
  }) {
    const daysSinceUpdate = Math.floor(
      (Date.now() - prospect.updatedAt.getTime()) / 86_400_000,
    );
    if (daysSinceUpdate <= 3) return 92;
    if (daysSinceUpdate <= 7) return 76;
    if (daysSinceUpdate <= 14) return 58;
    return 35;
  }

  private computeOpportunityScore(
    qualification: Awaited<
      ReturnType<LeadQualificationService['qualifyProspect']>
    >,
    leadScore: Awaited<ReturnType<LeadScoringService['scoreLead']>> | null,
  ) {
    return Math.min(
      100,
      Math.round(
        qualification.totalScore * 0.7 + (leadScore?.total || 0) * 0.3,
      ),
    );
  }

  private computeThreatScore(insights: Array<{ severity: string }>) {
    if (insights.some((insight) => insight.severity === 'HIGH')) return 78;
    if (insights.some((insight) => insight.severity === 'MEDIUM')) return 52;
    return 24;
  }

  private computeActionScore(
    insights: Array<{ severity: string }>,
    actionCount: number,
  ) {
    const severityWeight = insights.some(
      (insight) => insight.severity === 'HIGH',
    )
      ? 60
      : insights.some((insight) => insight.severity === 'MEDIUM')
        ? 42
        : 24;
    return Math.min(100, severityWeight + actionCount * 10);
  }

  private buildArtifactCsv(
    accountId: string,
    prospectId: string,
    facts: DossierFacts,
    summary: string,
  ) {
    const header = [
      'account_id',
      'prospect_id',
      'institution_name',
      'institution_type',
      'location',
      'source_of_truth',
      'estimated_assets',
      'benchmark_period',
      'qualification_grade',
      'qualification_priority',
      'lead_tier',
      'outreach_status',
      'summary',
    ];

    const row = [
      accountId,
      prospectId,
      facts.institutionName,
      facts.institutionalType || '',
      facts.location || '',
      facts.sourceOfTruth || '',
      String(facts.estimatedAssets || ''),
      facts.benchmark.period || '',
      facts.qualification?.grade || '',
      facts.qualification?.priority || '',
      facts.leadScore?.tier || '',
      facts.outreach.status,
      summary,
    ];

    return `${header.map(this.escapeCsv).join(',')}\n${row.map(this.escapeCsv).join(',')}\n`;
  }

  private async getOrCreateAccountForProspect(prospectId: string) {
    const workspaceId = await this.getOrCreateSystemWorkspaceId();
    const prospect = await this.prisma.prospectInstitution.findUnique({
      where: { id: prospectId },
    });
    if (!prospect) {
      throw new NotFoundException('Prospect not found');
    }
    if (prospect.intelligenceAccountId) {
      const existing = await this.prisma.intelligenceAccount.findUnique({
        where: { id: prospect.intelligenceAccountId },
      });
      if (existing) {
        return existing;
      }
    }

    const normalizedName = this.normalizeName(prospect.name);
    const existing = await this.prisma.intelligenceAccount.findFirst({
      where: {
        workspaceId,
        kind: 'BUYER',
        normalizedName,
      },
    });

    if (existing) {
      await this.prisma.prospectInstitution.update({
        where: { id: prospect.id },
        data: { intelligenceAccountId: existing.id },
      });
      return existing;
    }

    const account = await this.prisma.intelligenceAccount.create({
      data: {
        workspaceId,
        kind: 'BUYER',
        name: prospect.name,
        normalizedName,
        country: InstitutionIntelligenceService.DEFAULT_COUNTRY,
        region: this.deriveRegion(prospect.location),
        institutionalType: prospect.institutionType,
        sourceOfTruth: prospect.publicDataSource || 'official_registry',
        metadata: {
          prospectId: prospect.id,
          generatedBy: InstitutionIntelligenceService.GENERATED_BY,
        },
      },
    });

    await this.prisma.prospectInstitution.update({
      where: { id: prospect.id },
      data: { intelligenceAccountId: account.id },
    });
    await this.ensureOfficialRegistrySource(account.id, prospect);
    await this.linkMatchingLeads(account.id, prospect);
    return account;
  }

  private async getOrCreateSystemWorkspaceId() {
    const existing = await this.prisma.workspace.findFirst({
      where: { name: InstitutionIntelligenceService.SYSTEM_WORKSPACE_NAME },
    });
    if (existing) {
      return existing.id;
    }

    const created = await this.prisma.workspace.create({
      data: {
        name: InstitutionIntelligenceService.SYSTEM_WORKSPACE_NAME,
      },
    });
    return created.id;
  }

  private async ensureOfficialRegistrySource(
    accountId: string,
    prospect: {
      publicDataSource: string | null;
      institutionType: string;
      name: string;
    },
  ) {
    const url = this.resolveOfficialSourceUrl(
      prospect.publicDataSource,
      prospect.institutionType,
    );
    if (!url) {
      return null;
    }

    return this.prisma.intelligenceSource.upsert({
      where: {
        accountId_url: {
          accountId,
          url,
        },
      },
      update: {
        sourceType: 'OFFICIAL_REGISTRY',
        trustLevel: 'HIGH',
        fetchPolicy: 'WEEKLY',
        metadata: {
          institutionName: prospect.name,
          publicDataSource: prospect.publicDataSource,
        },
      },
      create: {
        accountId,
        label: 'Official registry',
        url,
        sourceType: 'OFFICIAL_REGISTRY',
        trustLevel: 'HIGH',
        fetchPolicy: 'WEEKLY',
        metadata: {
          institutionName: prospect.name,
          publicDataSource: prospect.publicDataSource,
        },
      },
    });
  }

  private async getPrimarySourceId(accountId: string) {
    const source = await this.prisma.intelligenceSource.findFirst({
      where: { accountId, active: true },
      orderBy: [{ trustLevel: 'asc' }, { createdAt: 'asc' }],
    });
    return source?.id;
  }

  private async linkMatchingLeads(
    accountId: string,
    prospect: { name: string; id: string; publicDataSource: string | null },
  ) {
    const matchingLeads = await this.prisma.lead.findMany({
      where: {
        institutionName: prospect.name,
      },
    });

    await Promise.all(
      matchingLeads.map((lead: any) =>
        this.prisma.lead.update({
          where: { id: lead.id },
          data: {
            intelligenceAccountId: accountId,
            publicDataSnapshot: {
              prospectId: prospect.id,
              sourceOfTruth: prospect.publicDataSource,
            },
          },
        }),
      ),
    );
  }

  private resolveOfficialSourceUrl(
    publicDataSource: string | null,
    institutionType: string,
  ) {
    if (publicDataSource === 'cossec' || institutionType === 'cooperativa') {
      return 'https://www.cossec.com/';
    }
    if (publicDataSource === 'ncua' || institutionType === 'credit_union') {
      return 'https://www.ncua.gov/';
    }
    return 'https://cerniq.io/';
  }

  private deriveRegion(location: string | null) {
    if (!location) return null;
    if (
      location.includes('San Juan') ||
      location.includes('Bayamón') ||
      location.includes('Guaynabo')
    )
      return 'Metro';
    if (location.includes('Ponce')) return 'South';
    if (location.includes('Humacao') || location.includes('Ceiba'))
      return 'East';
    if (
      location.includes('Mayagüez') ||
      location.includes('Aguada') ||
      location.includes('Aguadilla')
    )
      return 'West';
    if (location.includes('Arecibo')) return 'North';
    return 'Puerto Rico';
  }

  private normalizeName(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private mapOutreachStatusToAccountStatus(status: string) {
    if (status === 'closed') return 'ARCHIVED' as const;
    if (status === 'meeting_set' || status === 'replied')
      return 'ACTIVE' as const;
    if (status === 'sent' || status === 'sample_generated')
      return 'WATCHLIST' as const;
    return 'TRACKED' as const;
  }

  private hashPayload(payload: unknown) {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  private syntheticCharterFromName(name: string) {
    const hash = crypto.createHash('md5').update(name).digest('hex');
    const numeric = parseInt(hash.slice(0, 8), 16) % 100000;
    return String(numeric).padStart(5, '0');
  }

  private daysFromNow(days: number) {
    return new Date(Date.now() + days * 86_400_000);
  }

  private escapeCsv = (value: string) =>
    `"${String(value ?? '').replace(/"/g, '""')}"`;

  private toNumber(value: unknown) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    if (
      typeof value === 'object' &&
      value !== null &&
      'toNumber' in value &&
      typeof (value as { toNumber: () => number }).toNumber === 'function'
    ) {
      return (value as { toNumber: () => number }).toNumber();
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : null;
  }

  private async safeAnalyzeProspect(prospect: {
    name: string;
    publicDataSource: string | null;
  }) {
    try {
      const charter = this.syntheticCharterFromName(prospect.name);
      return await this.prospectIntelligence.analyzeProspect(charter);
    } catch (error) {
      this.logger.warn(
        `Prospect intelligence fallback for ${prospect.name}: ${error}`,
      );
      return null;
    }
  }
}
