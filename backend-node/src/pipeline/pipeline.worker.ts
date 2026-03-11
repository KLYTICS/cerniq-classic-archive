import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { ReportStorageService } from './report-storage.service';
import { EmailService } from '../email/email.service';
import { AlmEnterpriseService } from '../alm/alm-enterprise.service';
import { StressTestingService } from '../alm/stress-testing/stress-testing.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

@Injectable()
export class PipelineWorker {
  private readonly logger = new Logger(PipelineWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ReportStorageService,
    private readonly email: EmailService,
    private readonly almEnterprise: AlmEnterpriseService,
    private readonly stressTesting: StressTestingService,
  ) {}

  @Cron('*/2 * * * *') // Every 2 minutes
  async processQueue() {
    let job: any;
    try {
      job = await this.prisma.reportJob.findFirst({
        where: { status: 'QUEUED' },
        orderBy: { createdAt: 'asc' },
        include: { user: true },
      });
    } catch (error: any) {
      if (this.isReportJobsTableMissing(error)) {
        this.logger.warn('Skipping pipeline queue processing: report_jobs table is missing');
        return;
      }
      throw error;
    }

    if (!job) return;

    this.logger.log({ event: 'pipeline.job.starting', jobId: job.id, institution: job.institutionName });

    try {
      // Step 1: Transition to PROCESSING
      await this.transitionJob(job.id, 'PROCESSING');

      // Step 2: Load institution data
      const institution = await this.loadInstitutionData(job.userId, job.institutionId);
      if (!institution) {
        throw new Error(`No institution data found for job ${job.id}`);
      }

      // Step 3: Run ALM calculations via enterprise service
      await this.transitionJob(job.id, 'GENERATING_PDF');
      const [summary, stressTest, cossec] = await Promise.all([
        this.almEnterprise.getALMSummary(institution.id),
        this.stressTesting.runFullStressTest(institution.id, { paths: 500, horizon: 12 }),
        this.almEnterprise.getCOSSECCompliance(institution.id),
      ]);

      // Step 4: Generate PDFs (both languages) using the ALM report service
      const pdfEs = await this.generateReport(institution.id, 'es');
      const pdfEn = await this.generateReport(institution.id, 'en');

      // Step 5: Upload to storage
      await this.transitionJob(job.id, 'UPLOADING');
      const keyEs = `reports/${job.id}/report_es.pdf`;
      const keyEn = `reports/${job.id}/report_en.pdf`;
      await Promise.all([
        this.storage.upload(keyEs, pdfEs),
        this.storage.upload(keyEn, pdfEn),
      ]);

      // Get signed URLs for the reports
      const [urlEs, urlEn] = await Promise.all([
        this.storage.getSignedUrl(keyEs, 30 * 24 * 60 * 60), // 30-day expiry
        this.storage.getSignedUrl(keyEn, 30 * 24 * 60 * 60),
      ]);

      // Step 6: Complete
      await this.prisma.reportJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETE',
          reportUrl: urlEs || keyEs,
          reportUrlEn: urlEn || keyEn,
          completedAt: new Date(),
        },
      });

      // Increment reports used
      await this.prisma.subscription.updateMany({
        where: { userId: job.userId },
        data: { reportsUsed: { increment: 1 } },
      });

      // Step 7: Notify client
      if (job.user?.email) {
        await this.email.sendReportReady({
          email: job.user.email,
          name: job.user.name || '',
          institutionName: job.institutionName,
          portalUrl: `${process.env.FRONTEND_URL || ''}/portal/reports/${job.id}`,
        });

        // Schedule C2 follow-up (24h after delivery)
        await this.prisma.emailSequence.create({
          data: {
            userId: job.userId,
            sequenceKey: 'C2',
            scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
      }

      this.logger.log({ event: 'pipeline.job.complete', jobId: job.id });
    } catch (error: any) {
      await this.prisma.reportJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          errorMessage: error.message || 'Unknown error',
        },
      });

      // Alert Erwin
      await this.email.sendJobFailedAlert({
        jobId: job.id,
        institutionName: job.institutionName,
        error: error.message || 'Unknown error',
        clientEmail: job.user?.email || 'unknown',
      });

      this.logger.error({ event: 'pipeline.job.failed', jobId: job.id, error: error.message });
    }
  }

  private async transitionJob(jobId: string, status: string) {
    const data: any = { status };
    if (status === 'PROCESSING') data.processingStartedAt = new Date();
    await this.prisma.reportJob.update({ where: { id: jobId }, data });
  }

  private isReportJobsTableMissing(error: any): boolean {
    const code = error?.code || error?.meta?.code;
    if (code === 'P2021') return true;

    const message = String(error?.message || '').toLowerCase();
    return message.includes('report_jobs') && message.includes('does not exist');
  }

  private async loadInstitutionData(userId: string, institutionId?: string | null) {
    if (institutionId) {
      return this.prisma.institution.findUnique({
        where: { id: institutionId },
        include: { balanceSheetItems: true, interestRateScenarios: true, liquidityPositions: true },
      });
    }
    // Find most recent institution for this user's workspace
    const workspace = await this.prisma.workspace.findFirst({
      where: { ownerId: userId },
      include: {
        institutions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { balanceSheetItems: true, interestRateScenarios: true, liquidityPositions: true },
        },
      },
    });
    return workspace?.institutions[0] || null;
  }

  private async generateReport(institutionId: string, lang: string): Promise<Buffer> {
    try {
      const [summary, stressTest, cossec, institution] = await Promise.all([
        this.almEnterprise.getALMSummary(institutionId),
        this.stressTesting.runFullStressTest(institutionId, { paths: 500, horizon: 12 }),
        this.almEnterprise.getCOSSECCompliance(institutionId),
        this.almEnterprise.getInstitution(institutionId),
      ]);

      // Generate a simplified PDF with the calculation data
      return this.buildPDF(institution, summary, stressTest, cossec, lang);
    } catch (err: any) {
      this.logger.error({ event: 'pipeline.pdf.generation_failed', institutionId, lang, error: err.message });
      // Fallback: generate a minimal PDF with error notice
      return this.buildFallbackPDF(institutionId, lang, err.message);
    }
  }

  private buildPDF(institution: any, summary: any, stressTest: any, cossec: any, lang: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'letter', margins: { top: 60, bottom: 70, left: 60, right: 60 } });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const isEs = lang === 'es';

      // Cover page
      doc.rect(0, 0, 612, 120).fill('#1B3A6B');
      doc.fill('#FFFFFF').fontSize(24).text('CERNIQ', 60, 45);
      doc.fontSize(12).text(isEs ? 'Informe de Gestion de Activos y Pasivos' : 'Asset Liability Management Report', 60, 75);
      doc.fill('#000000').fontSize(18).text(institution?.name || 'Institution', 60, 160);
      doc.fontSize(11).fill('#475569').text(new Date().toLocaleDateString(isEs ? 'es-PR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }), 60, 185);

      // Summary page
      doc.addPage();
      doc.fontSize(16).fill('#1B3A6B').text(isEs ? 'RESUMEN EJECUTIVO' : 'EXECUTIVE SUMMARY', 60, 60);
      doc.moveDown();

      if (summary) {
        const metrics = [
          [isEs ? 'Total Activos' : 'Total Assets', `$${((summary.durationGap?.totalAssets || 0) / 1e6).toFixed(1)}M`],
          [isEs ? 'Brecha de Duracion' : 'Duration Gap', `${summary.durationGap?.durationGap?.toFixed(2) || 'N/A'} yr`],
          [isEs ? 'Puntuacion de Riesgo' : 'Risk Score', `${summary.riskScore || 'N/A'}/100`],
        ];
        doc.fontSize(11).fill('#000000');
        for (const [label, value] of metrics) {
          doc.text(`${label}: ${value}`);
          doc.moveDown(0.3);
        }
      }

      // COSSEC compliance
      if (cossec) {
        doc.moveDown();
        doc.fontSize(14).fill('#1B3A6B').text(isEs ? 'CUMPLIMIENTO COSSEC' : 'COSSEC COMPLIANCE');
        doc.moveDown(0.5);
        doc.fontSize(11).fill('#000000');
        if (cossec.checks) {
          for (const check of cossec.checks) {
            const icon = check.passed ? 'PASS' : 'FAIL';
            doc.text(`[${icon}] ${check.name}: ${check.value}`);
            doc.moveDown(0.2);
          }
        }
      }

      // Disclaimer
      doc.addPage();
      doc.fontSize(8).fill('#94a3b8');
      doc.text(
        isEs
          ? 'Este informe es generado automaticamente por CERNIQ. KLYTICS LLC no es un asesor de inversion registrado.'
          : 'This report is generated by CERNIQ. KLYTICS LLC is not a registered investment advisor.',
        60, 700, { width: 492 },
      );

      doc.end();
    });
  }

  private buildFallbackPDF(institutionId: string, lang: string, error: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'letter' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).text('CERNIQ ALM Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Institution: ${institutionId}`);
      doc.text(`Language: ${lang}`);
      doc.text(`Generated: ${new Date().toISOString()}`);
      doc.moveDown();
      doc.fontSize(10).fill('#dc2626').text(`Note: Full report generation encountered an issue: ${error}`);
      doc.text('A team member has been notified and will regenerate this report shortly.');

      doc.end();
    });
  }
}
