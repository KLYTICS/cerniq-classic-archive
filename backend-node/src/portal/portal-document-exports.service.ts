import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AlcoPackService } from '../pipeline/alco-pack.service';
import { AlmEnterpriseService } from '../alm/alm-enterprise.service';
import {
  buildManifestId,
  createPdfManifest,
} from '../alm/document-exports.util';
import {
  DocumentExportManifest,
  GeneratedDocumentExport,
} from '../alm/document-exports.types';
import { PortalAlmReportService } from './portal-alm-report.service';

@Injectable()
export class PortalDocumentExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alcoPackService: AlcoPackService,
    private readonly almEnterprise: AlmEnterpriseService,
    private readonly portalAlmReport: PortalAlmReportService,
  ) {}

  async listJobExports(
    userId: string,
    jobId: string,
  ): Promise<DocumentExportManifest[]> {
    const job = await this.prisma.reportJob.findFirst({
      where: { id: jobId, userId },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    const manifests: DocumentExportManifest[] = [];
    const generatedAt = job.completedAt || job.createdAt;
    const expiresAt = job.completedAt
      ? new Date(job.completedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
      : null;

    const isDemoProvisioned = job.triggeredBy === 'demo_provision';
    const hasR2Es =
      Boolean(job.reportUrl) && this.looksLikeAbsoluteUrl(job.reportUrl);
    const hasR2En =
      Boolean(job.reportUrlEn) && this.looksLikeAbsoluteUrl(job.reportUrlEn);

    if (hasR2Es) {
      manifests.push(
        createPdfManifest({
          id: buildManifestId('alm_report', jobId, 'es'),
          kind: 'alm_report',
          language: 'es',
          audience: 'internal',
          status: job.status === 'COMPLETE' ? 'ready' : 'processing',
          downloadUrl: job.reportUrl,
          sourceInstitutionId: job.institutionId,
          sourceJobId: job.id,
          institutionName: job.institutionName,
          generatedAt,
          expiresAt,
          watermark: null,
        }),
      );
    }

    if (hasR2En) {
      manifests.push(
        createPdfManifest({
          id: buildManifestId('alm_report', jobId, 'en'),
          kind: 'alm_report',
          language: 'en',
          audience: 'internal',
          status: job.status === 'COMPLETE' ? 'ready' : 'processing',
          downloadUrl: job.reportUrlEn,
          sourceInstitutionId: job.institutionId,
          sourceJobId: job.id,
          institutionName: job.institutionName,
          generatedAt,
          expiresAt,
          watermark: null,
        }),
      );
    }

    // ── On-demand fallback ──
    // For demo seats (no R2 storage) and any completed job whose pipeline-uploaded
    // URL is missing/relative, expose the streaming endpoint as a fallback manifest.
    // This guarantees a working "Download report" button regardless of storage state.
    const needsOnDemandEs =
      job.status === 'COMPLETE' &&
      job.institutionId &&
      (!hasR2Es || isDemoProvisioned);
    const needsOnDemandEn =
      job.status === 'COMPLETE' &&
      job.institutionId &&
      (!hasR2En || isDemoProvisioned);

    const alreadyHasManifestForLang = (lang: 'en' | 'es') =>
      manifests.some((m) => m.kind === 'alm_report' && m.language === lang);

    if (needsOnDemandEs && !alreadyHasManifestForLang('es')) {
      manifests.push(
        this.portalAlmReport.buildManifestStub({
          jobId: job.id,
          institutionId: job.institutionId,
          institutionName: job.institutionName,
          language: 'es',
          generatedAt,
          expiresAt: null,
          triggeredBy: job.triggeredBy,
        }),
      );
    }
    if (needsOnDemandEn && !alreadyHasManifestForLang('en')) {
      manifests.push(
        this.portalAlmReport.buildManifestStub({
          jobId: job.id,
          institutionId: job.institutionId,
          institutionName: job.institutionName,
          language: 'en',
          generatedAt,
          expiresAt: null,
          triggeredBy: job.triggeredBy,
        }),
      );
    }

    if (job.status === 'COMPLETE' && job.institutionId) {
      manifests.push(
        ...(['es', 'en'] as const).map((language) =>
          createPdfManifest({
            id: buildManifestId('alco_pack', jobId, language),
            kind: 'alco_pack',
            language,
            audience: 'internal',
            status: 'ready',
            downloadUrl: `/api/portal/jobs/${job.id}/alco-pack?lang=${language}`,
            sourceInstitutionId: job.institutionId,
            sourceJobId: job.id,
            institutionName: job.institutionName,
            generatedAt,
            watermark: null,
          }),
        ),
      );
    }

    return manifests;
  }

  async generateAlcoPackExport(
    userId: string,
    jobId: string,
    language: 'en' | 'es' = 'es',
  ): Promise<GeneratedDocumentExport> {
    const job = await this.prisma.reportJob.findFirst({
      where: { id: jobId, userId },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (!job.institutionId) {
      throw new NotFoundException('Institution not linked to this job');
    }

    const institution = await this.almEnterprise.getInstitution(
      job.institutionId,
    );
    const buffer = await this.alcoPackService.buildALCOPack(
      job.institutionId,
      language,
    );

    return {
      manifest: createPdfManifest({
        id: buildManifestId('alco_pack', jobId, language),
        kind: 'alco_pack',
        language,
        audience: 'internal',
        status: 'ready',
        downloadUrl: `/api/portal/jobs/${job.id}/alco-pack?lang=${language}`,
        sourceInstitutionId: job.institutionId,
        sourceJobId: job.id,
        institutionName: institution.name || job.institutionName,
        generatedAt: new Date(),
        watermark: null,
      }),
      buffer,
    };
  }

  private looksLikeAbsoluteUrl(url: string | null | undefined): boolean {
    if (!url) return false;
    return /^https?:\/\//i.test(url);
  }
}
