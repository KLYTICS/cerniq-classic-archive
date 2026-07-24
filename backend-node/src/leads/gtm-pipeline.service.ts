import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { GtmEnrichmentService } from './gtm-enrichment.service';
import {
  writeGtmArtifactBundle,
  type GtmArtifactBundle,
} from './gtm-run.store';

export type GtmPipelineTrigger = 'cron' | 'cli' | 'api' | 'github';

@Injectable()
export class GtmPipelineService {
  private readonly logger = new Logger(GtmPipelineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly enrichment: GtmEnrichmentService,
  ) {}

  async executeFullPipeline(options?: {
    triggerSource?: GtmPipelineTrigger;
    linkedInCsv?: string;
    persistArtifacts?: boolean;
  }) {
    const triggerSource = options?.triggerSource ?? 'api';
    const startedAt = Date.now();
    const run = await this.prisma.gtmPipelineRun.create({
      data: {
        triggerSource,
        status: 'RUNNING',
      },
    });

    try {
      const seeded = await this.enrichment.seedAllCooperativasFromCsv();
      const enriched = await this.enrichment.enrichAllProspects({
        syncIntelligence: true,
        scoreLeads: true,
        limit: 500,
      });

      let linkedIn = null;
      if (options?.linkedInCsv?.trim()) {
        linkedIn = await this.enrichment.importLinkedInConnections(
          options.linkedInCsv,
        );
      }

      const playbook = await this.enrichment.buildFieldSalesPlaybook();

      const summary = {
        runId: run.id,
        triggerSource,
        seeded,
        enriched,
        linkedIn,
        topTargets: enriched.qualificationTop10,
        completedAt: new Date().toISOString(),
      };

      let artifactPath: string | null = null;
      if (options?.persistArtifacts !== false) {
        const bundle: GtmArtifactBundle = {
          runId: run.id,
          generatedAt: new Date().toISOString(),
          triggerSource,
          summary,
          playbook,
        };
        artifactPath = writeGtmArtifactBundle(bundle);
      }

      const durationMs = Date.now() - startedAt;
      await this.prisma.gtmPipelineRun.update({
        where: { id: run.id },
        data: {
          status: 'SUCCESS',
          completedAt: new Date(),
          durationMs,
          summary,
          playbook,
          artifactPath,
        },
      });

      this.logger.log({
        event: 'gtm.pipeline.success',
        runId: run.id,
        durationMs,
        prospectsTotal: seeded.total,
        cossecLinked: enriched.cossecLinked,
        artifactPath,
      });

      return {
        runId: run.id,
        status: 'SUCCESS',
        durationMs,
        artifactPath,
        summary,
        playbook,
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown GTM pipeline error';
      const durationMs = Date.now() - startedAt;

      await this.prisma.gtmPipelineRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          durationMs,
          errorMessage: message,
        },
      });

      this.logger.error({
        event: 'gtm.pipeline.failed',
        runId: run.id,
        durationMs,
        error: message,
      });

      throw error;
    }
  }

  async listRuns(limit = 20) {
    return this.prisma.gtmPipelineRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        startedAt: true,
        completedAt: true,
        status: true,
        triggerSource: true,
        durationMs: true,
        artifactPath: true,
        errorMessage: true,
        summary: true,
      },
    });
  }

  async getLatestRun() {
    return this.prisma.gtmPipelineRun.findFirst({
      orderBy: { startedAt: 'desc' },
    });
  }
}
