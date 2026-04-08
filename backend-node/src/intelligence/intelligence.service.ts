import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma.service';
import {
  IntelligenceAccountsImportRequestDto,
  IntelligenceRefreshRequestDto,
  IntelligenceReportRequestDto,
  IntelligenceAccountSummary,
  IntelligenceAccountKind,
  IntelligenceActionStatus,
  IntelligenceActionRecord,
  IntelligenceArtifactType,
  IntelligenceContactRecord,
  IntelligenceInsightRecord,
  IntelligenceSourceFetchPolicy,
  WorkspaceMemoryEntryType,
  WorkspaceHandoff,
} from './dto/intelligence.dto';
import {
  AdapterAccountInput,
  AdapterResult,
  AdapterSourceInput,
  intelligenceAdapters,
} from './intelligence.adapters';

type JsonObject = Prisma.JsonObject;
type IntelligenceActionType =
  | 'REVIEW_ACCOUNT'
  | 'REFRESH_ACCOUNT'
  | 'CONTACT_BUYER'
  | 'UPDATE_CRM'
  | 'GENERATE_REPORT'
  | 'REVIEW_COMPETITOR';

function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferDomain(input?: string | null): string | null {
  if (!input) return null;
  const normalized = input.trim().toLowerCase();
  if (!normalized) return null;

  if (!normalized.includes('://') && !normalized.includes('/')) {
    return normalized.replace(/^www\./, '');
  }

  try {
    return new URL(normalized).hostname.replace(/^www\./, '');
  } catch {
    return normalized.replace(/^https?:\/\//, '').replace(/^www\./, '');
  }
}

function scoreContact(contact: {
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
}): number {
  let score = 10;
  const title = (contact.title || '').toLowerCase();
  if (/(chief|cfo|finance|treasurer|president|controller|risk)/.test(title)) {
    score += 35;
  }
  if (contact.email) score += 25;
  if (contact.phone) score += 10;
  if (contact.linkedinUrl) score += 10;
  return Math.min(100, score);
}

function computeFreshness(lastRefreshedAt?: Date | null): number {
  if (!lastRefreshedAt) return 5;
  const ageDays =
    (Date.now() - new Date(lastRefreshedAt).getTime()) / 86_400_000;
  return Math.max(0, Math.round(100 - ageDays * 8));
}

function csvEscape(value: unknown): string {
  const stringValue =
    value === null || value === undefined
      ? ''
      : String(value).replace(/\r?\n/g, ' ');
  return /[",]/.test(stringValue)
    ? `"${stringValue.replace(/"/g, '""')}"`
    : stringValue;
}

@Injectable()
export class IntelligenceService {
  private readonly logger = new Logger(IntelligenceService.name);
  private readonly defaultWorkspaceName = 'Cerniq Intelligence';

  constructor(private readonly prisma: PrismaService) {}

  async getOverview(workspaceId?: string) {
    const workspace = await this.ensureWorkspace(workspaceId);
    const [accounts, openActions, recentRuns, recentArtifacts] =
      await Promise.all([
        this.prisma.intelligenceAccount.findMany({
          where: { workspaceId: workspace.id },
          include: {
            insights: {
              orderBy: { createdAt: 'desc' },
              take: 3,
            },
          },
          orderBy: [{ actionScore: 'desc' }, { updatedAt: 'desc' }],
          take: 12,
        }),
        this.prisma.intelligenceAction.findMany({
          where: {
            account: { workspaceId: workspace.id },
            status: { in: ['OPEN', 'IN_PROGRESS'] },
          },
          include: { account: true },
          orderBy: [{ dueAt: 'asc' }, { actionScore: 'desc' }],
          take: 12,
        }),
        this.prisma.intelligenceRun.findMany({
          where: { workspaceId: workspace.id },
          orderBy: { startedAt: 'desc' },
          take: 5,
        }),
        this.prisma.intelligenceArtifact.findMany({
          where: { workspaceId: workspace.id },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
      ]);

    const staleAccounts = accounts.filter(
      (account: any) => account.freshnessScore < 40,
    );
    const hotChanges = accounts
      .flatMap((account: any) =>
        account.insights.map((insight: any) => ({
          id: insight.id,
          accountId: account.id,
          accountName: account.name,
          title: insight.title,
          severity: insight.severity,
          createdAt: insight.createdAt,
        })),
      )
      .sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 8);

    return {
      workspace: { id: workspace.id, name: workspace.name },
      stats: {
        totalAccounts: accounts.length,
        buyers: accounts.filter((account: any) => account.kind === 'BUYER')
          .length,
        competitors: accounts.filter(
          (account: any) => account.kind === 'COMPETITOR',
        ).length,
        staleAccounts: staleAccounts.length,
        overdueActions: openActions.filter(
          (action: any) => action.dueAt && action.dueAt.getTime() < Date.now(),
        ).length,
      },
      hotChanges,
      staleAccounts: staleAccounts.slice(0, 8).map((account: any) => ({
        id: account.id,
        name: account.name,
        kind: account.kind,
        freshnessScore: account.freshnessScore,
        nextRefreshAt: account.nextRefreshAt,
      })),
      actions: openActions.map((action: any) => this.mapActionRecord(action)),
      recentRuns,
      recentArtifacts,
      handoff: await this.getWorkspaceHandoff(workspace.id),
    };
  }

  async listAccounts(filters: {
    workspaceId?: string;
    kind?: IntelligenceAccountKind;
    status?: string;
    search?: string;
  }): Promise<IntelligenceAccountSummary[]> {
    const workspace = await this.ensureWorkspace(filters.workspaceId);
    const where: any = {
      workspaceId: workspace.id,
    };
    if (filters.kind) where.kind = filters.kind;
    if (filters.status) where.status = filters.status as any;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { domain: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const accounts = await this.prisma.intelligenceAccount.findMany({
      where,
      include: {
        contacts: true,
        actions: {
          where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
        },
        insights: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        syncedLeads: {
          select: { id: true },
          take: 1,
        },
        syncedProspects: {
          select: { id: true },
          take: 1,
        },
      },
      orderBy: [{ actionScore: 'desc' }, { updatedAt: 'desc' }],
    });

    return accounts.map((account: any) => ({
      id: account.id,
      workspaceId: account.workspaceId,
      kind: account.kind,
      status: account.status,
      name: account.name,
      domain: account.domain,
      websiteUrl: account.websiteUrl,
      currentSummary: account.currentSummary,
      freshnessScore: account.freshnessScore,
      opportunityScore: account.opportunityScore,
      threatScore: account.threatScore,
      actionScore: account.actionScore,
      lastRefreshedAt: account.lastRefreshedAt?.toISOString() || null,
      nextRefreshAt: account.nextRefreshAt?.toISOString() || null,
      contactCount: account.contacts.length,
      openActionCount: account.actions.length,
      recentInsightCount: account.insights.length,
      linkedLeadId: account.syncedLeads[0]?.id || null,
      linkedProspectId: account.syncedProspects[0]?.id || null,
    }));
  }

  async getAccountDetail(id: string) {
    const account = await this.prisma.intelligenceAccount.findUnique({
      where: { id },
      include: {
        contacts: {
          orderBy: [{ contactScore: 'desc' }, { updatedAt: 'desc' }],
        },
        sources: {
          orderBy: [{ trustLevel: 'asc' }, { updatedAt: 'desc' }],
        },
        snapshots: {
          orderBy: { capturedAt: 'desc' },
          take: 10,
        },
        insights: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        actions: {
          orderBy: [
            { status: 'asc' },
            { dueAt: 'asc' },
            { actionScore: 'desc' },
          ],
          take: 20,
        },
        artifacts: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        memoryEntries: {
          orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
          take: 20,
        },
        syncedLeads: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            priority: true,
            nextFollowUp: true,
          },
        },
        syncedProspects: {
          select: {
            id: true,
            name: true,
            institutionType: true,
            outreachStatus: true,
            contactName: true,
            contactEmail: true,
          },
        },
      },
    });

    if (!account) throw new NotFoundException('Intelligence account not found');

    return {
      id: account.id,
      workspaceId: account.workspaceId,
      kind: account.kind,
      status: account.status,
      name: account.name,
      domain: account.domain,
      websiteUrl: account.websiteUrl,
      currentSummary: account.currentSummary,
      freshnessScore: account.freshnessScore,
      opportunityScore: account.opportunityScore,
      threatScore: account.threatScore,
      actionScore: account.actionScore,
      lastRefreshedAt: account.lastRefreshedAt?.toISOString() || null,
      nextRefreshAt: account.nextRefreshAt?.toISOString() || null,
      contacts: account.contacts.map(
        (contact: any): IntelligenceContactRecord => ({
          id: contact.id,
          fullName: contact.fullName,
          title: contact.title,
          email: contact.email,
          phone: contact.phone,
          linkedinUrl: contact.linkedinUrl,
          contactScore: contact.contactScore,
          reachabilityScore: contact.reachabilityScore,
          lastVerifiedAt: contact.lastVerifiedAt?.toISOString() || null,
        }),
      ),
      sources: account.sources,
      snapshots: account.snapshots,
      insights: account.insights.map(
        (insight: any): IntelligenceInsightRecord => ({
          id: insight.id,
          type: insight.type,
          severity: insight.severity,
          title: insight.title,
          description: insight.description,
          confidence: insight.confidence,
          createdAt: insight.createdAt.toISOString(),
          reviewedAt: insight.reviewedAt?.toISOString() || null,
        }),
      ),
      actions: account.actions.map((action: any) =>
        this.mapActionRecord(action),
      ),
      artifacts: account.artifacts,
      memoryEntries: account.memoryEntries,
      syncedLeads: account.syncedLeads,
      syncedProspects: account.syncedProspects,
    };
  }

  async getTimeline(id: string) {
    const account = await this.prisma.intelligenceAccount.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!account) throw new NotFoundException('Intelligence account not found');

    const [snapshots, insights, actions, memoryEntries, artifacts] =
      await Promise.all([
        this.prisma.intelligenceSnapshot.findMany({
          where: { accountId: id },
          orderBy: { capturedAt: 'desc' },
          take: 20,
        }),
        this.prisma.intelligenceInsight.findMany({
          where: { accountId: id },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        this.prisma.intelligenceAction.findMany({
          where: { accountId: id },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        this.prisma.workspaceMemoryEntry.findMany({
          where: { accountId: id },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        this.prisma.intelligenceArtifact.findMany({
          where: { accountId: id },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
      ]);

    return [
      ...snapshots.map((snapshot: any) => ({
        id: snapshot.id,
        kind: 'snapshot',
        title: snapshot.summary || 'Snapshot captured',
        description: snapshot.summary || 'Source snapshot stored',
        timestamp: snapshot.capturedAt,
      })),
      ...insights.map((insight: any) => ({
        id: insight.id,
        kind: 'insight',
        title: insight.title,
        description: insight.description,
        timestamp: insight.createdAt,
        severity: insight.severity,
      })),
      ...actions.map((action: any) => ({
        id: action.id,
        kind: 'action',
        title: action.title,
        description: action.description,
        timestamp: action.createdAt,
        status: action.status,
      })),
      ...memoryEntries.map((entry: any) => ({
        id: entry.id,
        kind: 'memory',
        title: entry.title,
        description: entry.body,
        timestamp: entry.createdAt,
        pinned: entry.pinned,
      })),
      ...artifacts.map((artifact: any) => ({
        id: artifact.id,
        kind: 'artifact',
        title: artifact.title,
        description: artifact.summary || artifact.type,
        timestamp: artifact.createdAt,
      })),
    ].sort((a: any, b: any) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async listActions(filters: {
    workspaceId?: string;
    status?: IntelligenceActionStatus;
    kind?: IntelligenceAccountKind;
  }): Promise<IntelligenceActionRecord[]> {
    const workspace = await this.ensureWorkspace(filters.workspaceId);
    const actions = await this.prisma.intelligenceAction.findMany({
      where: {
        status: filters.status,
        account: {
          workspaceId: workspace.id,
          kind: filters.kind,
        },
      },
      include: { account: true },
      orderBy: [
        { dueAt: 'asc' },
        { actionScore: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return actions.map((action: any) => this.mapActionRecord(action));
  }

  async importAccounts(body: IntelligenceAccountsImportRequestDto) {
    const workspace = await this.ensureWorkspace(body.workspaceId);
    let created = 0;
    let updated = 0;

    const accounts = [];
    for (const record of body.accounts) {
      const normalizedName = normalizeName(record.name);
      const inferredDomain = inferDomain(
        record.domain || record.websiteUrl || null,
      );
      const existing = await this.findExistingAccount(
        workspace.id,
        record.kind,
        normalizedName,
        inferredDomain,
      );

      const account = existing
        ? await this.prisma.intelligenceAccount.update({
            where: { id: existing.id },
            data: {
              name: record.name,
              domain: inferredDomain,
              websiteUrl: record.websiteUrl || existing.websiteUrl,
              region: record.region,
              country: record.country || 'Puerto Rico',
              industry: record.industry,
              institutionalType: record.institutionalType,
              sourceOfTruth: record.sourceOfTruth,
              currentSummary: record.currentSummary || existing.currentSummary,
              metadata: this.mergeJson(existing.metadata, record.metadata),
              status:
                existing.status === 'ARCHIVED' ? 'TRACKED' : existing.status,
            },
          })
        : await this.prisma.intelligenceAccount.create({
            data: {
              workspaceId: workspace.id,
              kind: record.kind,
              name: record.name,
              normalizedName,
              domain: inferredDomain,
              websiteUrl: record.websiteUrl,
              region: record.region,
              country: record.country || 'Puerto Rico',
              industry: record.industry,
              institutionalType: record.institutionalType,
              sourceOfTruth: record.sourceOfTruth,
              currentSummary: record.currentSummary,
              metadata: (record.metadata || {}) as JsonObject,
              freshnessScore: 10,
              nextRefreshAt: this.computeNextRefreshDate(record.kind, 'WEEKLY'),
            },
          });

      if (existing) updated += 1;
      else created += 1;

      await this.upsertSources(account.id, record.sources || []);
      await this.upsertContacts(account.id, record.contacts || []);
      await this.syncAccountToPipelines(account.id);
      accounts.push(account);
    }

    await this.createHandoffEntry(workspace.id, {
      type: 'HANDOFF',
      title: 'Intelligence account import completed',
      body: `Imported ${body.accounts.length} intelligence accounts. Created ${created}, updated ${updated}.`,
      pinned: false,
    });

    return {
      workspaceId: workspace.id,
      created,
      updated,
      accounts: await this.listAccounts({ workspaceId: workspace.id }),
    };
  }

  async refreshAccounts(body: IntelligenceRefreshRequestDto) {
    const workspace = await this.ensureWorkspace(body.workspaceId);
    const accounts = await this.prisma.intelligenceAccount.findMany({
      where: {
        workspaceId: workspace.id,
        id: body.accountIds ? { in: body.accountIds } : undefined,
        kind: body.kinds ? { in: body.kinds } : undefined,
        ...(body.staleOnly
          ? {
              OR: [
                { lastRefreshedAt: null },
                { nextRefreshAt: { lte: new Date() } },
                { freshnessScore: { lt: 40 } },
              ],
            }
          : {}),
      },
      include: {
        sources: {
          where: { active: true },
          orderBy: [{ trustLevel: 'asc' }, { updatedAt: 'desc' }],
        },
        contacts: true,
      },
    });

    const run = await this.prisma.intelligenceRun.create({
      data: {
        workspaceId: workspace.id,
        trigger: body.trigger || 'manual',
        status: 'RUNNING',
        accountCount: accounts.length,
      },
    });

    let snapshotCount = 0;
    let insightCount = 0;

    try {
      for (const account of accounts) {
        const adapterAccount: AdapterAccountInput = {
          id: account.id,
          kind: account.kind,
          name: account.name,
          domain: account.domain,
          websiteUrl: account.websiteUrl,
          currentSummary: account.currentSummary,
          institutionalType: account.institutionalType,
        };

        const sources =
          account.sources.length > 0
            ? account.sources
            : await this.bootstrapDefaultSources(
                account.id,
                account.kind,
                account.websiteUrl,
              );

        const results: AdapterResult[] = [];
        for (const source of sources) {
          const adapter = intelligenceAdapters.find((candidate) =>
            candidate.supports(source.sourceType),
          );
          if (!adapter) continue;
          try {
            const result = await adapter.collect(adapterAccount, {
              id: source.id,
              label: source.label,
              url: source.url,
              sourceType: source.sourceType,
              fetchPolicy: source.fetchPolicy,
              trustLevel: source.trustLevel,
              metadata:
                (source.metadata as Record<string, unknown> | null) || {},
            });
            results.push(result);

            const payload = {
              facts: result.facts,
              summary: result.summary,
              sourceType: source.sourceType,
              url: source.url,
            };
            const changeHash = createHash('sha256')
              .update(JSON.stringify(payload))
              .digest('hex');

            await this.prisma.intelligenceSource.update({
              where: { id: source.id },
              data: {
                lastFetchedAt: new Date(),
                lastHttpStatus:
                  typeof result.rawMetadata.status === 'number'
                    ? result.rawMetadata.status
                    : 200,
              },
            });

            await this.prisma.intelligenceSnapshot.upsert({
              where: {
                accountId_changeHash: {
                  accountId: account.id,
                  changeHash,
                },
              },
              update: {
                summary: result.summary,
                factsJson: payload.facts as JsonObject,
                rawMetadata: result.rawMetadata as JsonObject,
                capturedAt: new Date(),
                runId: run.id,
                sourceId: source.id,
              },
              create: {
                accountId: account.id,
                sourceId: source.id,
                runId: run.id,
                summary: result.summary,
                factsJson: payload.facts as JsonObject,
                rawMetadata: result.rawMetadata as JsonObject,
                changeHash,
                capturedAt: new Date(),
              },
            });
            snapshotCount += 1;

            for (const insight of result.insights) {
              await this.prisma.intelligenceInsight.create({
                data: {
                  accountId: account.id,
                  runId: run.id,
                  type: insight.type as any,
                  severity: insight.severity as any,
                  title: insight.title,
                  description: insight.description,
                  confidence: insight.confidence,
                  data: payload.facts as JsonObject,
                },
              });
              insightCount += 1;
            }
          } catch (error: any) {
            this.logger.warn(
              `Intelligence refresh failed for ${account.name} / ${source.url}: ${error.message}`,
            );
            await this.prisma.intelligenceInsight.create({
              data: {
                accountId: account.id,
                runId: run.id,
                type: 'REFRESH_NOTE',
                severity: 'LOW',
                title: `${account.name} refresh fallback`,
                description: `Source refresh failed for ${source.url}: ${error.message}`,
                confidence: 0.4,
                data: { sourceUrl: source.url } as JsonObject,
              },
            });
            insightCount += 1;
          }
        }

        await this.recalculateAccountScores(
          account.id,
          results,
          account.contacts,
        );
        await this.syncAccountToPipelines(account.id);
      }

      await this.prisma.intelligenceRun.update({
        where: { id: run.id },
        data: {
          status: insightCount > snapshotCount ? 'PARTIAL' : 'COMPLETED',
          snapshotCount,
          insightCount,
          completedAt: new Date(),
        },
      });

      await this.createHandoffEntry(workspace.id, {
        type: 'HANDOFF',
        title: 'Intelligence refresh completed',
        body: `Refresh run ${run.id} processed ${accounts.length} accounts, created ${snapshotCount} snapshots, and logged ${insightCount} insights.`,
        pinned: false,
      });

      return {
        runId: run.id,
        workspaceId: workspace.id,
        accountCount: accounts.length,
        snapshotCount,
        insightCount,
      };
    } catch (error: any) {
      await this.prisma.intelligenceRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
          snapshotCount,
          insightCount,
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }

  async generateReport(body: IntelligenceReportRequestDto) {
    const workspace = await this.ensureWorkspace(body.workspaceId);
    const accounts = await this.prisma.intelligenceAccount.findMany({
      where: {
        workspaceId: workspace.id,
        id: body.accountIds?.length ? { in: body.accountIds } : undefined,
      },
      include: {
        actions: true,
        insights: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        contacts: {
          orderBy: { contactScore: 'desc' },
          take: 3,
        },
      },
      orderBy: [{ actionScore: 'desc' }, { updatedAt: 'desc' }],
    });

    if (accounts.length === 0) {
      throw new BadRequestException(
        'No intelligence accounts available for report generation',
      );
    }

    const rows = accounts.map((account: any) => ({
      id: account.id,
      kind: account.kind,
      name: account.name,
      domain: account.domain || '',
      status: account.status,
      freshnessScore: account.freshnessScore,
      opportunityScore: account.opportunityScore,
      threatScore: account.threatScore,
      actionScore: account.actionScore,
      openActions: account.actions.filter(
        (action: any) => body.includeClosedActions || action.status !== 'DONE',
      ).length,
      topInsight: account.insights[0]?.title || '',
      topContact: account.contacts[0]?.fullName || '',
    }));

    const csvLines = [
      Object.keys(rows[0]).join(','),
      ...rows.map((row: any) =>
        Object.values(row)
          .map((value: unknown) => csvEscape(value))
          .join(','),
      ),
    ];
    const csvContent = csvLines.join('\n');

    const summary =
      body.type === 'WEEKLY_BRIEF'
        ? `Weekly brief covering ${accounts.length} tracked accounts with ${rows.reduce((sum: number, row: any) => sum + Number(row.openActions), 0)} active actions.`
        : body.type === 'COMPETITOR_TEAR_SHEET'
          ? `Competitor tear sheet for ${accounts.filter((account: any) => account.kind === 'COMPETITOR').length} tracked rivals.`
          : `Buyer dossier report for ${accounts.filter((account: any) => account.kind === 'BUYER').length} target institutions.`;

    const artifact = await this.prisma.intelligenceArtifact.create({
      data: {
        workspaceId: workspace.id,
        type: body.type,
        title:
          body.title ||
          `${body.type.replace(/_/g, ' ')} ${new Date().toISOString().slice(0, 10)}`,
        summary,
        filtersJson: {
          accountIds: body.accountIds || [],
          includeClosedActions: !!body.includeClosedActions,
        } as JsonObject,
        artifactData: {
          generatedAt: new Date().toISOString(),
          rows,
          stats: {
            accountCount: accounts.length,
            buyerCount: accounts.filter(
              (account: any) => account.kind === 'BUYER',
            ).length,
            competitorCount: accounts.filter(
              (account: any) => account.kind === 'COMPETITOR',
            ).length,
          },
        } as JsonObject,
        artifactText: summary,
        csvContent,
      },
    });

    await this.createHandoffEntry(workspace.id, {
      type: 'HANDOFF',
      title: `Report generated: ${artifact.title}`,
      body: summary,
      pinned: body.type === 'HANDOFF_REPORT',
    });

    return artifact;
  }

  async exportArtifact(id: string, format: 'csv' | 'json') {
    const artifact = await this.prisma.intelligenceArtifact.findUnique({
      where: { id },
    });
    if (!artifact) throw new NotFoundException('Artifact not found');

    if (format === 'csv') {
      return {
        filename: `${artifact.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`,
        contentType: 'text/csv',
        body: artifact.csvContent || '',
      };
    }

    return {
      filename: `${artifact.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`,
      contentType: 'application/json',
      body: artifact.artifactData || {},
    };
  }

  async getWorkspaceHandoff(workspaceId?: string): Promise<WorkspaceHandoff> {
    const workspace = await this.ensureWorkspace(workspaceId);
    const [entries, overdueActions, staleAccounts, latestArtifact] =
      await Promise.all([
        this.prisma.workspaceMemoryEntry.findMany({
          where: { workspaceId: workspace.id, pinned: true },
          orderBy: [{ createdAt: 'desc' }],
          take: 5,
        }),
        this.prisma.intelligenceAction.count({
          where: {
            account: { workspaceId: workspace.id },
            status: { in: ['OPEN', 'IN_PROGRESS'] },
            dueAt: { lt: new Date() },
          },
        }),
        this.prisma.intelligenceAccount.count({
          where: { workspaceId: workspace.id, freshnessScore: { lt: 40 } },
        }),
        this.prisma.intelligenceArtifact.findFirst({
          where: { workspaceId: workspace.id },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

    const summary =
      entries[0]?.body ||
      `Resume with ${overdueActions} overdue actions, ${staleAccounts} stale accounts, and ${latestArtifact ? `the latest artifact "${latestArtifact.title}"` : 'no generated artifacts yet'}.`;

    return {
      workspaceId: workspace.id,
      summary,
      pinnedEntries: entries.map((entry: any) => ({
        id: entry.id,
        title: entry.title,
        type: entry.type,
        body: entry.body,
        createdAt: entry.createdAt.toISOString(),
      })),
      overdueActions,
      staleAccounts,
      latestArtifactTitle: latestArtifact?.title || null,
    };
  }

  async createMemoryEntry(input: {
    workspaceId?: string;
    accountId?: string;
    type: WorkspaceMemoryEntryType;
    title: string;
    body: string;
    pinned?: boolean;
  }) {
    const workspace = await this.ensureWorkspace(input.workspaceId);
    return this.prisma.workspaceMemoryEntry.create({
      data: {
        workspaceId: workspace.id,
        accountId: input.accountId,
        type: input.type,
        title: input.title,
        body: input.body,
        pinned: !!input.pinned,
      },
    });
  }

  private async ensureWorkspace(workspaceId?: string) {
    if (workspaceId) {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
      });
      if (!workspace) throw new NotFoundException('Workspace not found');
      return workspace;
    }

    const existing = await this.prisma.workspace.findFirst({
      where: { name: this.defaultWorkspaceName },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return existing;

    return this.prisma.workspace.create({
      data: {
        name: this.defaultWorkspaceName,
      },
    });
  }

  private async findExistingAccount(
    workspaceId: string,
    kind: IntelligenceAccountKind,
    normalizedName: string,
    domain: string | null,
  ) {
    return this.prisma.intelligenceAccount.findFirst({
      where: {
        workspaceId,
        kind,
        OR: [{ normalizedName }, ...(domain ? [{ domain }] : [])],
      },
    });
  }

  private async upsertSources(
    accountId: string,
    sources: IntelligenceAccountsImportRequestDto['accounts'][number]['sources'],
  ) {
    for (const source of sources || []) {
      await this.prisma.intelligenceSource.upsert({
        where: {
          accountId_url: {
            accountId,
            url: source.url,
          },
        },
        update: {
          label: source.label,
          sourceType: source.sourceType,
          fetchPolicy: source.fetchPolicy || 'WEEKLY',
          trustLevel: source.trustLevel || 'MEDIUM',
          metadata: (source.metadata || {}) as JsonObject,
          active: true,
        },
        create: {
          accountId,
          label: source.label,
          url: source.url,
          sourceType: source.sourceType,
          fetchPolicy: source.fetchPolicy || 'WEEKLY',
          trustLevel: source.trustLevel || 'MEDIUM',
          metadata: (source.metadata || {}) as JsonObject,
        },
      });
    }
  }

  private async upsertContacts(
    accountId: string,
    contacts: IntelligenceAccountsImportRequestDto['accounts'][number]['contacts'],
  ) {
    for (const contact of contacts || []) {
      const normalizedName = normalizeName(contact.fullName);
      const existing = await this.prisma.intelligenceContact.findFirst({
        where: {
          accountId,
          OR: [
            ...(contact.email ? [{ email: contact.email }] : []),
            { normalizedName, title: contact.title || null },
          ],
        },
      });

      const data = {
        fullName: contact.fullName,
        normalizedName,
        title: contact.title,
        department: contact.department,
        seniority: contact.seniority,
        email: contact.email,
        phone: contact.phone,
        linkedinUrl: contact.linkedinUrl,
        contactScore: contact.contactScore ?? scoreContact(contact),
        reachabilityScore:
          contact.reachabilityScore ??
          Math.min(
            100,
            (contact.email ? 50 : 10) +
              (contact.phone ? 20 : 0) +
              (contact.linkedinUrl ? 15 : 0),
          ),
        metadata: (contact.metadata || {}) as JsonObject,
        lastVerifiedAt: new Date(),
      };

      if (existing) {
        await this.prisma.intelligenceContact.update({
          where: { id: existing.id },
          data,
        });
      } else {
        await this.prisma.intelligenceContact.create({
          data: {
            accountId,
            ...data,
          },
        });
      }
    }
  }

  private async bootstrapDefaultSources(
    accountId: string,
    kind: IntelligenceAccountKind,
    websiteUrl?: string | null,
  ) {
    if (!websiteUrl) return [];
    const source = await this.prisma.intelligenceSource.create({
      data: {
        accountId,
        url: websiteUrl,
        label:
          kind === 'COMPETITOR' ? 'Primary website' : 'Institution website',
        sourceType:
          kind === 'COMPETITOR' ? 'PUBLIC_WEBSITE' : 'OFFICIAL_REGISTRY',
        fetchPolicy: kind === 'COMPETITOR' ? 'WEEKLY' : 'MONTHLY',
      },
    });
    return [source];
  }

  private async recalculateAccountScores(
    accountId: string,
    adapterResults: AdapterResult[],
    contacts: Array<{ contactScore: number; email: string | null }>,
  ) {
    const account = await this.prisma.intelligenceAccount.findUnique({
      where: { id: accountId },
      include: {
        insights: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!account) return;

    const highestContactScore =
      contacts.length > 0
        ? Math.max(...contacts.map((contact: any) => contact.contactScore))
        : 0;
    const highSeverityCount = account.insights.filter(
      (insight: any) => insight.severity === 'HIGH',
    ).length;
    const mediumSeverityCount = account.insights.filter(
      (insight: any) => insight.severity === 'MEDIUM',
    ).length;

    const opportunityScore =
      account.kind === 'BUYER'
        ? Math.min(
            100,
            25 +
              highestContactScore * 0.45 +
              highSeverityCount * 12 +
              mediumSeverityCount * 6,
          )
        : 0;
    const threatScore =
      account.kind === 'COMPETITOR'
        ? Math.min(
            100,
            30 +
              highSeverityCount * 15 +
              mediumSeverityCount * 8 +
              adapterResults.filter((result: AdapterResult) =>
                result.insights.some(
                  (insight: any) => insight.type === 'PRICING_CHANGE',
                ),
              ).length *
                10,
          )
        : 0;
    const freshnessScore = computeFreshness(new Date());
    const actionScore = Math.min(
      100,
      Math.round(
        Math.max(opportunityScore, threatScore) * 0.55 +
          highSeverityCount * 10 +
          (100 - freshnessScore) * 0.25,
      ),
    );

    const summary =
      adapterResults[0]?.summary ||
      account.currentSummary ||
      `${account.name} intelligence profile updated.`;

    await this.prisma.intelligenceAccount.update({
      where: { id: accountId },
      data: {
        currentSummary: summary,
        freshnessScore,
        opportunityScore: Math.round(opportunityScore),
        threatScore: Math.round(threatScore),
        actionScore,
        lastRefreshedAt: new Date(),
        lastChangedAt: new Date(),
        nextRefreshAt: this.computeNextRefreshDate(account.kind, 'WEEKLY'),
      },
    });

    await this.ensureAutomatedActions(accountId, {
      opportunityScore: Math.round(opportunityScore),
      threatScore: Math.round(threatScore),
      actionScore,
      freshnessScore,
    });
  }

  private async ensureAutomatedActions(
    accountId: string,
    scores: {
      opportunityScore: number;
      threatScore: number;
      actionScore: number;
      freshnessScore: number;
    },
  ) {
    const account = await this.prisma.intelligenceAccount.findUnique({
      where: { id: accountId },
      include: {
        actions: {
          where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
        },
      },
    });
    if (!account) return;

    const ensureAction = async (
      type: IntelligenceActionType,
      title: string,
      description: string,
      actionScore: number,
      dueInDays: number,
    ) => {
      const existing = account.actions.find(
        (action: any) => action.type === type,
      );
      if (existing) {
        await this.prisma.intelligenceAction.update({
          where: { id: existing.id },
          data: {
            title,
            description,
            actionScore,
            dueAt: new Date(Date.now() + dueInDays * 86_400_000),
            confidence: Math.min(0.95, 0.4 + actionScore / 150),
          },
        });
        return;
      }

      await this.prisma.intelligenceAction.create({
        data: {
          accountId,
          type,
          title,
          description,
          status: 'OPEN',
          actionScore,
          dueAt: new Date(Date.now() + dueInDays * 86_400_000),
          confidence: Math.min(0.95, 0.4 + actionScore / 150),
        },
      });
    };

    if (scores.freshnessScore < 40) {
      await ensureAction(
        'REFRESH_ACCOUNT',
        `Refresh stale intelligence for ${account.name}`,
        'Source freshness dropped below target. Review sources and re-run refresh.',
        Math.max(50, scores.actionScore),
        1,
      );
    }

    if (account.kind === 'BUYER' && scores.opportunityScore >= 55) {
      await ensureAction(
        'CONTACT_BUYER',
        `Follow up with ${account.name}`,
        'Buyer account reached the opportunity threshold. Review top contact and draft outreach.',
        Math.max(60, scores.opportunityScore),
        2,
      );
      await ensureAction(
        'UPDATE_CRM',
        `Sync ${account.name} into CRM`,
        'Promote the account into the lead pipeline with the latest intelligence snapshot.',
        Math.max(55, scores.actionScore),
        2,
      );
    }

    if (account.kind === 'COMPETITOR' && scores.threatScore >= 55) {
      await ensureAction(
        'REVIEW_COMPETITOR',
        `Review competitor movement: ${account.name}`,
        'Material competitor changes were detected. Compare messaging, pricing, and market motion.',
        Math.max(60, scores.threatScore),
        2,
      );
    }
  }

  private async syncAccountToPipelines(accountId: string) {
    const account = await this.prisma.intelligenceAccount.findUnique({
      where: { id: accountId },
      include: {
        contacts: {
          orderBy: [{ contactScore: 'desc' }, { updatedAt: 'desc' }],
          take: 1,
        },
      },
    });
    if (!account || account.kind !== 'BUYER') return;

    const topContact = account.contacts[0];
    const publicDataSnapshot = {
      intelligenceAccountId: account.id,
      currentSummary: account.currentSummary,
      freshnessScore: account.freshnessScore,
      opportunityScore: account.opportunityScore,
      threatScore: account.threatScore,
      actionScore: account.actionScore,
      websiteUrl: account.websiteUrl,
      lastRefreshedAt: account.lastRefreshedAt?.toISOString() || null,
    } as JsonObject;

    let lead = await this.prisma.lead.findFirst({
      where: {
        OR: [
          { intelligenceAccountId: account.id },
          ...(topContact?.email ? [{ email: topContact.email }] : []),
        ],
      },
    });

    const mappedPriority =
      account.opportunityScore >= 70
        ? 'HIGH'
        : account.opportunityScore >= 45
          ? 'MEDIUM'
          : 'LOW';

    if (lead) {
      lead = await this.prisma.lead.update({
        where: { id: lead.id },
        data: {
          intelligenceAccountId: account.id,
          institutionName: account.name,
          institutionType:
            account.institutionalType || lead.institutionType || 'cooperativa',
          name: topContact?.fullName || lead.name,
          email: topContact?.email || lead.email,
          phone: topContact?.phone || lead.phone,
          role: topContact?.title || lead.role,
          priority: mappedPriority,
          publicDataSnapshot,
        },
      });
    } else if (topContact?.email) {
      lead = await this.prisma.lead.create({
        data: {
          name: topContact.fullName,
          email: topContact.email,
          phone: topContact.phone,
          role: topContact.title || 'CFO',
          institutionName: account.name,
          institutionType: account.institutionalType || 'cooperativa',
          source: 'outreach',
          priority: mappedPriority,
          status: 'NEW',
          intelligenceAccountId: account.id,
          publicDataSnapshot,
          nextFollowUp: new Date(Date.now() + 2 * 86_400_000),
        },
      });
    }

    let prospect = await this.prisma.prospectInstitution.findFirst({
      where: { intelligenceAccountId: account.id },
    });
    const mappedOutreachStatus =
      account.opportunityScore >= 70
        ? 'meeting_set'
        : account.opportunityScore >= 45
          ? 'sample_generated'
          : 'not_started';

    if (prospect) {
      prospect = await this.prisma.prospectInstitution.update({
        where: { id: prospect.id },
        data: {
          name: account.name,
          institutionType:
            account.institutionalType || prospect.institutionType,
          location: account.region || prospect.location,
          estimatedAssets:
            typeof account.metadata === 'object' &&
            account.metadata &&
            'estimatedAssets' in account.metadata &&
            typeof account.metadata.estimatedAssets === 'number'
              ? new Prisma.Decimal(account.metadata.estimatedAssets)
              : prospect.estimatedAssets,
          publicDataSource: account.sourceOfTruth || prospect.publicDataSource,
          outreachStatus: mappedOutreachStatus,
          contactName: topContact?.fullName || prospect.contactName,
          contactEmail: topContact?.email || prospect.contactEmail,
          contactRole: topContact?.title || prospect.contactRole,
          notes: account.currentSummary || prospect.notes,
          intelligenceAccountId: account.id,
        },
      });
    } else {
      await this.prisma.prospectInstitution.create({
        data: {
          name: account.name,
          institutionType: account.institutionalType || 'cooperativa',
          location: account.region,
          estimatedAssets:
            typeof account.metadata === 'object' &&
            account.metadata &&
            'estimatedAssets' in account.metadata &&
            typeof account.metadata.estimatedAssets === 'number'
              ? new Prisma.Decimal(account.metadata.estimatedAssets)
              : null,
          publicDataSource: account.sourceOfTruth || 'manual',
          outreachStatus: mappedOutreachStatus,
          contactName: topContact?.fullName,
          contactEmail: topContact?.email,
          contactRole: topContact?.title,
          notes: account.currentSummary,
          intelligenceAccountId: account.id,
        },
      });
    }
  }

  private async createHandoffEntry(
    workspaceId: string,
    entry: {
      type: WorkspaceMemoryEntryType;
      title: string;
      body: string;
      pinned: boolean;
    },
  ) {
    await this.prisma.workspaceMemoryEntry.create({
      data: {
        workspaceId,
        type: entry.type,
        title: entry.title,
        body: entry.body,
        pinned: entry.pinned,
      },
    });
  }

  private mapActionRecord(action: any): IntelligenceActionRecord {
    return {
      id: action.id,
      type: action.type,
      status: action.status,
      title: action.title,
      description: action.description,
      confidence: action.confidence,
      actionScore: action.actionScore,
      dueAt: action.dueAt?.toISOString() || null,
      completedAt: action.completedAt?.toISOString() || null,
    };
  }

  private computeNextRefreshDate(
    kind: IntelligenceAccountKind,
    fetchPolicy: IntelligenceSourceFetchPolicy,
  ) {
    const days =
      fetchPolicy === 'DAILY'
        ? 1
        : fetchPolicy === 'WEEKLY'
          ? kind === 'COMPETITOR'
            ? 3
            : 7
          : fetchPolicy === 'MONTHLY'
            ? 30
            : 7;
    return new Date(Date.now() + days * 86_400_000);
  }

  private mergeJson(
    existing: Prisma.JsonValue | null,
    incoming?: Record<string, unknown>,
  ): JsonObject {
    const base =
      existing && typeof existing === 'object' && !Array.isArray(existing)
        ? existing
        : {};
    const incomingJson = (incoming || {}) as Record<string, Prisma.JsonValue>;
    return { ...base, ...incomingJson };
  }
}
