import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { IntelligenceService } from '../intelligence/intelligence.service';
import { DemoSeatService } from '../portal/demo-seat.service';
import { DailyPipelineService } from '../jobs/daily-pipeline.service';
import { AuditService } from '../audit/audit.service';
import {
  SessionContinuityService,
  type SessionContinuitySnapshot,
} from './session-continuity.service';
import {
  type ControlTowerSummary,
  type OperatorActionKind,
  type OperatorActionResult,
} from './control-tower.types';

@Injectable()
export class ControlTowerService {
  private readonly logger = new Logger(ControlTowerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly intelligence: IntelligenceService,
    private readonly demoSeats: DemoSeatService,
    private readonly dailyPipeline: DailyPipelineService,
    private readonly audit: AuditService,
    private readonly sessionContinuity: SessionContinuityService,
  ) {}

  async getSummary(): Promise<ControlTowerSummary> {
    const [
      stats,
      revenue,
      pipeline,
      exports,
      intelligenceOverview,
      demoSeatSnapshot,
      sessionContinuity,
      health,
    ] = await Promise.all([
      this.getAdminStats(),
      this.getRevenueMetrics(),
      this.getPipelineSnapshot(),
      this.getExportSnapshot(),
      this.safeIntelligenceOverview(),
      this.safeDemoSeatSnapshot(),
      this.sessionContinuity.getSnapshot(),
      this.buildHealthSnapshot(),
    ]);

    const portal = await this.getPortalSnapshot();

    const featureBridge: Array<{
      id: string;
      label: string;
      status: 'healthy' | 'warning' | 'active';
      detail: string;
      href: string;
    }> = [
      {
        id: 'portal',
        label: 'Portal & report cycles',
        status:
          portal.counts.validationFailed > 0 || portal.counts.failed > 0
            ? 'warning'
            : portal.counts.processing > 0
              ? 'active'
              : 'healthy',
        detail: `${portal.counts.awaitingData} awaiting, ${portal.counts.validationFailed} validation failed, ${portal.counts.processing} processing`,
        href: '/admin/pipeline',
      },
      {
        id: 'demo_seats',
        label: 'Demo seats',
        status: demoSeatSnapshot.expiringSoon > 0 ? 'warning' : 'healthy',
        detail: `${demoSeatSnapshot.active} active, ${demoSeatSnapshot.expiringSoon} expiring soon`,
        href: '/admin/demo-seats',
      },
      {
        id: 'intelligence',
        label: 'Intelligence OS',
        status:
          intelligenceOverview.stats.staleAccounts > 0 ||
          intelligenceOverview.stats.overdueActions > 0
            ? 'warning'
            : 'healthy',
        detail: `${intelligenceOverview.stats.staleAccounts} stale accounts, ${intelligenceOverview.stats.overdueActions} overdue actions`,
        href: '/admin/intelligence',
      },
      {
        id: 'session',
        label: 'Session continuity',
        status:
          sessionContinuity.latestStatusBlockers.length > 0
            ? 'warning'
            : 'healthy',
        detail:
          sessionContinuity.latestStatusSummary[0] ||
          'Session continuity artifacts available',
        href: '/admin',
      },
      {
        id: 'metrics',
        label: 'Revenue & metrics',
        status: revenue.activeSubscriptions > 0 ? 'active' : 'healthy',
        detail: `MRR ${formatUsd(revenue.mrr)} across ${revenue.activeSubscriptions} active subscriptions`,
        href: '/admin/metrics',
      },
      {
        id: 'audit',
        label: 'Audit trail',
        status: 'healthy',
        detail: 'Live admin audit history and operator actions are available.',
        href: '/admin/audit',
      },
      {
        id: 'exports',
        label: 'Financial report exports',
        status:
          exports.degradedCount > 0
            ? 'warning'
            : exports.readyManifestCount > 0
              ? 'active'
              : 'healthy',
        detail: `${exports.readyManifestCount} ready report manifests, ${exports.onDemandFallbackJobs} on-demand fallback jobs`,
        href: '/admin',
      },
    ];

    const nextActions: Array<{
      id: string;
      title: string;
      domain: string;
      severity: 'high' | 'medium';
      href?: string;
      action?: OperatorActionKind;
    }> = [
      ...(portal.counts.validationFailed > 0
        ? [
            {
              id: 'portal-validation',
              title: 'Clear portal validation failures',
              domain: 'portal',
              severity: 'high' as const,
              href: '/admin/pipeline',
            },
          ]
        : []),
      ...(demoSeatSnapshot.expiringSoon > 0
        ? [
            {
              id: 'demo-seat-expiring',
              title: 'Review expiring demo seats',
              domain: 'demo_seats',
              severity: 'medium' as const,
              href: '/admin/demo-seats',
            },
          ]
        : []),
      ...(intelligenceOverview.stats.staleAccounts > 0
        ? [
            {
              id: 'refresh-intelligence',
              title: 'Refresh stale intelligence accounts',
              domain: 'intelligence',
              severity: 'medium' as const,
              action: 'refresh_intelligence' as const,
            },
          ]
        : []),
      ...(sessionContinuity.latestStatusBlockers.length > 0
        ? [
            {
              id: 'session-blockers',
              title: 'Review session blockers',
              domain: 'session',
              severity: 'medium' as const,
              href: '/admin',
            },
          ]
        : []),
    ];

    const safeActions = [
      {
        action: 'refresh_intelligence' as const,
        label: 'Refresh stale intelligence',
        description: 'Run a stale-only intelligence refresh pass.',
      },
      {
        action: 'run_pipeline' as const,
        label: 'Run market pipeline',
        description: 'Trigger the daily market pipeline manually.',
      },
      {
        action: 'sweep_demo_seats' as const,
        label: 'Sweep demo seats',
        description: 'Expire overdue demo seats and refresh their status.',
      },
      {
        action: 'refresh_session_snapshot' as const,
        label: 'Refresh session snapshot',
        description: 'Re-read repo handoff and .omx continuity artifacts.',
      },
    ];

    const blockers: ControlTowerSummary['blockers'] = nextActions.map(
      (action) => ({
        key: action.id,
        severity: action.severity,
        title: action.title,
        description: action.domain
          ? `${action.title} (${action.domain})`
          : action.title,
        href: action.href,
        actionKey: action.action,
        targetId: null,
      }),
    );

    const recommendedActions: ControlTowerSummary['recommendedActions'] = [
      ...safeActions.map((action) => ({
        key: action.action,
        label: action.label,
        description: action.description,
        tone:
          action.action === 'refresh_intelligence' ? 'primary' : 'secondary',
      })),
    ];

    const continuity = {
      workspaceRoot: sessionContinuity.workspaceRoot,
      branch: sessionContinuity.activeBranch || 'unknown',
      dirtyFiles: 0,
      latestSessionSummary: sessionContinuity.latestStatusSummary,
      latestHandoffObjective: null,
      blockers: sessionContinuity.latestStatusBlockers,
      nextCommands: sessionContinuity.recommendedCommands,
      activeSkill: sessionContinuity.activeModes[0] || null,
      activeSkillPhase: null,
      recentAgentTurns: sessionContinuity.metrics?.turnCount || 0,
      lastHudTitle: sessionContinuity.lastAgentOutputTitle,
      omxStateFiles: sessionContinuity.stateFiles.map((file) => ({
        file,
        updatedAt:
          sessionContinuity.latestStatusUpdatedAt ||
          sessionContinuity.handoffUpdatedAt ||
          new Date().toISOString(),
      })),
    };

    const featureBridgeCards = featureBridge.map((feature) => ({
      id: feature.id,
      label: feature.label,
      status: feature.status,
      href: feature.href,
      detail: feature.detail,
      metricLabel:
        feature.id === 'portal'
          ? 'Awaiting upload'
          : feature.id === 'demo_seats'
            ? 'Active demo seats'
            : feature.id === 'intelligence'
              ? 'Tracked accounts'
              : feature.id === 'metrics'
                ? 'MRR'
                : feature.id === 'audit'
                  ? 'Recent users'
                  : feature.id === 'exports'
                    ? 'Ready manifests'
                    : 'Continuity blockers',
      metricValue:
        feature.id === 'portal'
          ? portal.counts.awaitingData + portal.counts.validationFailed
          : feature.id === 'demo_seats'
            ? demoSeatSnapshot.active
            : feature.id === 'intelligence'
              ? intelligenceOverview.stats.totalAccounts
              : feature.id === 'metrics'
                ? revenue.mrr
                : feature.id === 'audit'
                  ? stats.recentUsers
                  : feature.id === 'exports'
                    ? exports.readyManifestCount
                    : sessionContinuity.latestStatusBlockers.length,
      nextActionLabel:
        feature.id === 'portal'
          ? 'Open pipeline'
          : feature.id === 'demo_seats'
            ? 'Open demo seats'
            : feature.id === 'intelligence'
              ? 'Open intelligence'
              : feature.id === 'metrics'
                ? 'Open metrics'
                : feature.id === 'audit'
                  ? 'Open audit'
                  : feature.id === 'exports'
                    ? 'Review exports'
                    : 'Review continuity',
    }));

    return {
      generatedAt: new Date().toISOString(),
      executive: {
        ...stats,
        ...revenue,
      },
      health,
      stats,
      revenue,
      pipeline,
      portal,
      exports,
      demoSeats: demoSeatSnapshot,
      intelligence: intelligenceOverview,
      continuity,
      sessionContinuity,
      featureBridge: featureBridgeCards,
      nextActions,
      blockers,
      recommendedActions,
      safeActions,
    };
  }

  async runAction(
    action: OperatorActionKind,
    payload: Record<string, unknown> = {},
  ): Promise<OperatorActionResult> {
    switch (action) {
      case 'refresh_intelligence':
        return this.logAction(
          action,
          'Refreshed stale intelligence accounts',
          await this.intelligence.refreshAccounts({
            staleOnly: true,
            trigger: 'control_tower',
          }),
        );
      case 'run_pipeline':
        return this.logAction(
          action,
          'Pipeline run completed',
          await this.dailyPipeline.runPipeline(),
        );
      case 'sweep_demo_seats':
        return this.logAction(
          action,
          'Demo seat sweep completed',
          await this.demoSeats.sweepExpired(),
        );
      case 'retry_pipeline_job': {
        const jobId =
          typeof payload.jobId === 'string' ? payload.jobId.trim() : '';
        if (!jobId) {
          throw new BadRequestException('retry_pipeline_job requires jobId');
        }
        return this.logAction(
          action,
          'Pipeline job re-queued',
          await this.prisma.reportJob.update({
            where: { id: jobId },
            data: { status: 'QUEUED', retryCount: 0, errorMessage: null },
          }),
        );
      }
      case 'open_portal_cycle': {
        const userId =
          typeof payload.userId === 'string' ? payload.userId.trim() : '';
        if (!userId) {
          throw new BadRequestException('open_portal_cycle requires userId');
        }
        return this.logAction(
          action,
          'Portal report cycle prepared',
          await this.openPortalCycle(userId),
        );
      }
      case 'refresh_session_snapshot':
        return this.logAction(
          action,
          'Session continuity snapshot refreshed',
          (await this.sessionContinuity.getSnapshot()) as unknown as Record<
            string,
            unknown
          >,
        );
      default:
        throw new BadRequestException(
          `Unsupported control-tower action: ${action}`,
        );
    }
  }

  private async getAdminStats() {
    const [
      demoRequests,
      institutions,
      users,
      prospects,
      recentUsers,
      totalReportJobs,
      completedReports,
      failedReports,
    ] = await Promise.all([
      this.prisma.demoRequest.count(),
      this.prisma.institution.count(),
      this.prisma.user.count(),
      this.prisma.prospectInstitution.count(),
      this.prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      this.prisma.reportJob.count(),
      this.prisma.reportJob.count({ where: { status: 'COMPLETE' } }),
      this.prisma.reportJob.count({
        where: { status: { in: ['FAILED', 'VALIDATION_FAILED'] as any } },
      }),
    ]);

    return {
      demoRequests,
      institutions,
      users,
      prospects,
      recentUsers,
      totalReportJobs,
      completedReports,
      failedReports,
    };
  }

  private async getRevenueMetrics() {
    const [
      activeSubscriptions,
      totalSubscriptions,
      monthlySubs,
      annualSubs,
      partnerSubs,
    ] = await Promise.all([
      this.prisma.subscription.count({
        where: { status: 'active', tier: { not: 'one_time' } },
      }),
      this.prisma.subscription.count({ where: { status: 'active' } }),
      this.prisma.subscription.count({
        where: { status: 'active', tier: 'monthly' },
      }),
      this.prisma.subscription.count({
        where: { status: 'active', tier: 'annual' },
      }),
      this.prisma.subscription.count({
        where: { status: 'active', tier: 'partner' },
      }),
    ]);

    const mrr = monthlySubs * 299 + annualSubs * 200 + partnerSubs * 499;
    return { activeSubscriptions, totalSubscriptions, mrr, arr: mrr * 12 };
  }

  private async getPipelineSnapshot() {
    const [awaitingData, processing, complete, failed, recentJobs] =
      await Promise.all([
        this.prisma.reportJob.count({ where: { status: 'AWAITING_DATA' } }),
        this.prisma.reportJob.count({
          where: {
            status: {
              in: [
                'PROCESSING',
                'GENERATING_PDF',
                'UPLOADING',
                'QUEUED',
                'VALIDATING',
              ] as any,
            },
          },
        }),
        this.prisma.reportJob.count({ where: { status: 'COMPLETE' } }),
        this.prisma.reportJob.count({
          where: { status: { in: ['FAILED', 'VALIDATION_FAILED'] as any } },
        }),
        this.prisma.reportJob.findMany({
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: {
            id: true,
            institutionName: true,
            status: true,
            retryCount: true,
            createdAt: true,
            completedAt: true,
            errorMessage: true,
            triggeredBy: true,
            user: { select: { email: true, name: true } },
          },
        }),
      ]);

    return {
      health: { awaitingData, processing, complete, failed },
      recentJobs,
    };
  }

  private async getPortalSnapshot() {
    const [
      awaitingData,
      validationFailed,
      processing,
      failed,
      complete,
      stalledJobs,
    ] = await Promise.all([
      this.prisma.reportJob.count({ where: { status: 'AWAITING_DATA' } }),
      this.prisma.reportJob.count({ where: { status: 'VALIDATION_FAILED' } }),
      this.prisma.reportJob.count({
        where: {
          status: {
            in: [
              'QUEUED',
              'PROCESSING',
              'GENERATING_PDF',
              'UPLOADING',
              'VALIDATING',
            ] as any,
          },
        },
      }),
      this.prisma.reportJob.count({ where: { status: 'FAILED' } }),
      this.prisma.reportJob.count({ where: { status: 'COMPLETE' } }),
      this.prisma.reportJob.findMany({
        where: {
          status: {
            in: ['AWAITING_DATA', 'VALIDATION_FAILED', 'FAILED'] as any,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          userId: true,
          institutionName: true,
          status: true,
          errorMessage: true,
          createdAt: true,
          user: { select: { email: true, name: true } },
        },
      }),
    ]);

    return {
      counts: {
        awaitingData,
        validationFailed,
        processing,
        complete,
        failed,
        stalledActivations: stalledJobs.length,
      },
      stalledJobs,
      recentActionableJobs: stalledJobs,
    };
  }

  private async safeIntelligenceOverview() {
    try {
      return await this.intelligence.getOverview();
    } catch (error) {
      this.logger.warn(
        `Could not load intelligence overview: ${String(error)}`,
      );
      return {
        workspace: { id: 'unavailable', name: 'Intelligence unavailable' },
        stats: {
          totalAccounts: 0,
          buyers: 0,
          competitors: 0,
          staleAccounts: 0,
          overdueActions: 0,
        },
        hotChanges: [],
        staleAccounts: [],
        actions: [],
        recentRuns: [],
        recentArtifacts: [],
        handoff: {
          summary: 'Intelligence overview unavailable',
          pinnedEntries: [],
        },
      };
    }
  }

  private async safeDemoSeatSnapshot() {
    const seats = await this.demoSeats.listAdminDemoSeats('all');
    return {
      active: seats.filter((seat: any) => seat.status === 'active').length,
      expired: seats.filter((seat: any) => seat.status === 'expired').length,
      expiringSoon: seats.filter(
        (seat: any) =>
          seat.status === 'active' &&
          typeof seat.daysRemaining === 'number' &&
          seat.daysRemaining <= 3,
      ).length,
      recent: seats.slice(0, 6),
    };
  }

  private async getExportSnapshot() {
    const [completedJobs, onDemandFallbackJobs] = await Promise.all([
      this.prisma.reportJob.count({ where: { status: 'COMPLETE' } }),
      this.prisma.reportJob.count({
        where: {
          status: 'COMPLETE',
          OR: [{ reportUrl: null }, { reportUrlEn: null }],
        },
      }),
    ]);

    const readyManifestCount = completedJobs * 2;
    return {
      completedJobs,
      onDemandFallbackJobs,
      readyManifestCount,
      degradedCount: onDemandFallbackJobs,
    };
  }

  private async openPortalCycle(userId: string) {
    const existingJob = await this.prisma.reportJob.findFirst({
      where: {
        userId,
        status: { in: ['VALIDATION_FAILED', 'AWAITING_DATA'] as any },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingJob) {
      return {
        created: false,
        jobId: existingJob.id,
        status: existingJob.status,
      };
    }

    const seedJob = await this.prisma.reportJob.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { institutionId: true, institutionName: true },
    });
    const workspace = await this.prisma.workspace.findFirst({
      where: { ownerId: userId },
      orderBy: { createdAt: 'asc' },
      select: { name: true },
    });

    const job = await this.prisma.reportJob.create({
      data: {
        userId,
        institutionId: seedJob?.institutionId || null,
        institutionName:
          seedJob?.institutionName ||
          workspace?.name?.replace(/\s+workspace$/i, '').trim() ||
          'Pending Institution',
        status: 'AWAITING_DATA',
        triggeredBy: 'admin_control_tower',
      },
    });

    return {
      created: true,
      jobId: job.id,
      status: job.status,
    };
  }

  private async buildHealthSnapshot() {
    const memory = process.memoryUsage();
    let database = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }

    return {
      api: database === 'up' ? 'healthy' : 'degraded',
      database,
      uptimeSeconds: Math.round(process.uptime()),
      memoryPercent: Math.round((memory.heapUsed / memory.heapTotal) * 100),
      timestamp: new Date().toISOString(),
    };
  }

  private logAction(
    action: OperatorActionKind,
    summary: string,
    data: unknown,
  ): OperatorActionResult {
    this.audit.log({
      action: 'admin_control_action',
      resource: 'control_tower',
      resourceId: action,
      metadata: { summary, data },
    });

    return { action, status: 'success', summary, message: summary, data };
  }
}

function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 10_000) return `$${(value / 1_000).toFixed(0)}K`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}
