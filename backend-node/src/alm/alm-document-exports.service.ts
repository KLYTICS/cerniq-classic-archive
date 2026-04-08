import { Injectable } from '@nestjs/common';
import { AlmEnterpriseService } from './alm-enterprise.service';
import { ReportsService } from './reports/reports.service';
import { PreviewReportService } from './preview-report.service';
import { SampleReportFactoryService } from './sample-report-factory.service';
import { buildManifestId, createPdfManifest } from './document-exports.util';
import {
  DocumentExportManifest,
  GeneratedDocumentExport,
} from './document-exports.types';

@Injectable()
export class AlmDocumentExportsService {
  constructor(
    private readonly almEnterprise: AlmEnterpriseService,
    private readonly reportsService: ReportsService,
    private readonly sampleReportFactory: SampleReportFactoryService,
    private readonly previewReports: PreviewReportService,
  ) {}

  async listInstitutionExports(
    institutionId: string,
  ): Promise<DocumentExportManifest[]> {
    const institution = await this.almEnterprise.getInstitution(institutionId);
    const generatedAt = institution.reportingDate || new Date();

    return (['es', 'en'] as const).map((language) =>
      createPdfManifest({
        id: buildManifestId('alm_report', institutionId, language),
        kind: 'alm_report',
        language,
        audience: 'internal',
        status: 'ready',
        downloadUrl: `/api/alm/${institutionId}/report?lang=${language}`,
        sourceInstitutionId: institutionId,
        institutionName: institution.name,
        generatedAt,
        watermark: null,
      }),
    );
  }

  async generateInstitutionExport(
    institutionId: string,
    language: 'en' | 'es' = 'en',
  ): Promise<GeneratedDocumentExport> {
    const institution = await this.almEnterprise.getInstitution(institutionId);
    const buffer = await this.reportsService.generateALMReport(
      institutionId,
      language,
    );
    return {
      manifest: createPdfManifest({
        id: buildManifestId('alm_report', institutionId, language),
        kind: 'alm_report',
        language,
        audience: 'internal',
        status: 'ready',
        downloadUrl: `/api/alm/${institutionId}/report?lang=${language}`,
        sourceInstitutionId: institutionId,
        institutionName: institution.name,
        generatedAt: new Date(),
        watermark: null,
      }),
      buffer,
    };
  }

  listSampleExports(charterNumber: string): DocumentExportManifest[] {
    return (['es', 'en'] as const).map((language) =>
      createPdfManifest({
        id: buildManifestId('sample_report', charterNumber, language),
        kind: 'sample_report',
        language,
        audience: 'sample',
        status: 'ready',
        downloadUrl: `/api/alm/sample-report/${encodeURIComponent(charterNumber)}?lang=${language}`,
        sourceLabel: charterNumber,
        generatedAt: new Date(),
      }),
    );
  }

  async generateSampleExport(
    charterNumber: string,
    language: 'en' | 'es' = 'en',
  ): Promise<GeneratedDocumentExport> {
    const buffer = await this.sampleReportFactory.generateSampleReport(
      charterNumber,
      language,
    );
    return {
      manifest: createPdfManifest({
        id: buildManifestId('sample_report', charterNumber, language),
        kind: 'sample_report',
        language,
        audience: 'sample',
        status: 'ready',
        downloadUrl: `/api/alm/sample-report/${encodeURIComponent(charterNumber)}?lang=${language}`,
        sourceLabel: charterNumber,
        generatedAt: new Date(),
      }),
      buffer,
    };
  }

  listPreviewExports(slug: string): DocumentExportManifest[] {
    const preview = this.previewReports.getPreviewDefinition(slug);
    return (['es', 'en'] as const).map((language) =>
      createPdfManifest({
        id: buildManifestId('preview_report', slug, language),
        kind: 'preview_report',
        language,
        audience: 'sample',
        status: 'ready',
        downloadUrl: `/api/alm/previews/${encodeURIComponent(slug)}/report?lang=${language}`,
        sourceLabel: preview.name,
        generatedAt: new Date(),
      }),
    );
  }

  async generatePreviewExport(
    slug: string,
    language: 'en' | 'es' = 'es',
  ): Promise<GeneratedDocumentExport> {
    const preview = this.previewReports.getPreviewDefinition(slug);
    const buffer = await this.previewReports.generatePreviewReport(
      slug,
      language,
    );
    return {
      manifest: createPdfManifest({
        id: buildManifestId('preview_report', slug, language),
        kind: 'preview_report',
        language,
        audience: 'sample',
        status: 'ready',
        downloadUrl: `/api/alm/previews/${encodeURIComponent(slug)}/report?lang=${language}`,
        sourceLabel: preview.name,
        generatedAt: new Date(),
      }),
      buffer,
    };
  }
}
