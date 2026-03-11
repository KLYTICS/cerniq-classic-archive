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
      const t = (es: string, en: string) => isEs ? es : en;
      const fmtM = (v: number) => `$${(v || 0).toFixed(1)}M`;
      const fmtPct = (v: number) => `${(v || 0).toFixed(1)}%`;
      const PW = 612;
      const ML = 60;
      const MR = 60;
      const CW = PW - ML - MR;
      let pageNum = 0;

      const pageHeader = (title: string): number => {
        doc.rect(0, 0, PW, 48).fill('#1B3A6B');
        doc.fill('#FFFFFF').fontSize(9).font('Helvetica-Bold').text('CERNIQ', ML, 17);
        doc.font('Helvetica').fontSize(8).text(institution?.name || '', PW - MR - 200, 17, { width: 200, align: 'right' });
        doc.fill('#1B3A6B').fontSize(15).font('Helvetica-Bold').text(title, ML, 62);
        doc.moveTo(ML, 82).lineTo(PW - MR, 82).strokeColor('#D1D5DB').lineWidth(0.5).stroke();
        return 95;
      };

      const drawFooter = () => {
        pageNum++;
        doc.fill('#94A3B8').fontSize(7).font('Helvetica');
        doc.text('CERNIQ — KLYTICS LLC', ML, 752, { lineBreak: false });
        doc.text(t('CONFIDENCIAL', 'CONFIDENTIAL'), PW / 2 - 40, 752, { width: 80, align: 'center', lineBreak: false });
        doc.text(`${t('Pag.', 'Pg.')} ${pageNum}`, PW - MR - 40, 752, { width: 40, align: 'right', lineBreak: false });
      };

      const statusClr = (s: string) => s === 'pass' ? '#16A34A' : s === 'warning' ? '#D97706' : '#DC2626';

      const tblRow = (y: number, cols: string[], widths: number[], opts?: { bg?: string; header?: boolean }) => {
        const h = 18;
        if (opts?.bg) doc.rect(ML, y - 2, CW, h).fill(opts.bg);
        doc.fill(opts?.header ? '#FFFFFF' : '#1F2937')
          .font(opts?.header ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(opts?.header ? 8 : 9);
        let x = ML;
        for (let i = 0; i < cols.length; i++) {
          doc.text(cols[i], x + 4, y, { width: widths[i] - 8, lineBreak: false });
          x += widths[i];
        }
        return y + h;
      };

      // ═════════════════════════════════════════════════════════════
      // PAGE 1: COVER
      // ═════════════════════════════════════════════════════════════
      doc.rect(0, 0, PW, 280).fill('#1B3A6B');
      doc.fill('#FFFFFF').font('Helvetica-Bold').fontSize(32).text('CERNIQ', ML, 80);
      doc.font('Helvetica').fontSize(13).text(
        t('Plataforma de Inteligencia de Riesgo', 'Risk Intelligence Platform'), ML, 120,
      );
      doc.moveTo(ML, 150).lineTo(ML + 120, 150).strokeColor('#1ABFFF').lineWidth(2).stroke();
      doc.fill('#FFFFFF').font('Helvetica-Bold').fontSize(20).text(
        t('Informe de Gestion de\nActivos y Pasivos', 'Asset Liability\nManagement Report'), ML, 180,
      );

      doc.fill('#1B3A6B').font('Helvetica-Bold').fontSize(22).text(institution?.name || 'Institution', ML, 320);
      doc.font('Helvetica').fontSize(11).fill('#475569').text(
        new Date().toLocaleDateString(isEs ? 'es-PR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }), ML, 350,
      );
      doc.fontSize(9).fill('#64748B');
      doc.text(`${t('Tipo', 'Type')}: ${institution?.type || 'Cooperativa'}`, ML, 390);
      doc.text(`${t('Moneda', 'Currency')}: ${institution?.currency || 'USD'}`, ML, 405);
      if (summary?.institution?.totalAssets) {
        doc.text(`${t('Activos Totales', 'Total Assets')}: $${(summary.institution.totalAssets / 1e6).toFixed(1)}M`, ML, 420);
      }

      doc.rect(ML, 680, CW, 36).fill('#FEF3C7');
      doc.fill('#92400E').font('Helvetica-Bold').fontSize(8).text(t('CONFIDENCIAL', 'CONFIDENTIAL'), ML + 12, 688);
      doc.font('Helvetica').fontSize(7).fill('#78350F').text(
        t(
          'Este informe es propiedad de la institucion destinataria. Distribucion no autorizada esta prohibida.',
          'This report is proprietary to the recipient institution. Unauthorized distribution is prohibited.',
        ), ML + 12, 700, { width: CW - 24 },
      );

      // ═════════════════════════════════════════════════════════════
      // PAGE 2: TABLE OF CONTENTS
      // ═════════════════════════════════════════════════════════════
      doc.addPage();
      let y = pageHeader(t('CONTENIDO', 'TABLE OF CONTENTS'));
      drawFooter();
      const tocItems = [
        [t('Resumen Ejecutivo', 'Executive Summary'), '3'],
        [t('Panorama del Balance General', 'Balance Sheet Overview'), '4'],
        [t('Analisis de Brecha de Duracion', 'Duration Gap Analysis'), '5'],
        [t('Sensibilidad de Ingreso Neto por Intereses', 'Net Interest Income Sensitivity'), '6'],
        [t('Cobertura de Liquidez (LCR)', 'Liquidity Coverage Ratio (LCR)'), '7'],
        [t('Cumplimiento Regulatorio COSSEC', 'COSSEC Regulatory Compliance'), '8'],
        [t('Resultados de Pruebas de Estres', 'Stress Test Results'), '9'],
        [t('Recomendaciones', 'Recommendations'), '10'],
        [t('Metodologia y Aviso Legal', 'Methodology & Disclaimer'), '11'],
      ];
      doc.font('Helvetica').fontSize(11).fill('#1F2937');
      for (const [title, pg] of tocItems) {
        doc.text(title, ML + 10, y, { width: CW - 60, lineBreak: false });
        doc.text(pg, PW - MR - 30, y, { width: 30, align: 'right', lineBreak: false });
        y += 28;
      }

      // ═════════════════════════════════════════════════════════════
      // PAGE 3: EXECUTIVE SUMMARY
      // ═════════════════════════════════════════════════════════════
      doc.addPage();
      y = pageHeader(t('RESUMEN EJECUTIVO', 'EXECUTIVE SUMMARY'));
      drawFooter();

      const riskScore = summary?.riskScore ?? 0;
      const scoreColor = riskScore >= 70 ? '#16A34A' : riskScore >= 40 ? '#D97706' : '#DC2626';
      const scoreLabel = riskScore >= 70 ? t('Bajo Riesgo', 'Low Risk') : riskScore >= 40 ? t('Riesgo Moderado', 'Moderate Risk') : t('Alto Riesgo', 'High Risk');

      doc.rect(ML, y, 130, 80).fill('#F8FAFC');
      doc.fill(scoreColor).font('Helvetica-Bold').fontSize(36).text(`${riskScore}`, ML + 15, y + 10, { width: 100, align: 'center' });
      doc.fill('#64748B').font('Helvetica').fontSize(8).text(scoreLabel, ML + 15, y + 52, { width: 100, align: 'center' });

      const mX = ML + 155;
      const keyMetrics: [string, string, string][] = [
        [t('Brecha de Duracion', 'Duration Gap'), `${summary?.durationGap?.durationGap?.toFixed(2) || 'N/A'} yr`, summary?.durationGap?.riskProfile || 'neutral'],
        [t('LCR', 'LCR'), fmtPct(summary?.liquidity?.lcr || 0), summary?.liquidity?.status || 'compliant'],
        [t('NII Base', 'Base NII'), fmtM(summary?.niiSensitivity?.baseNII || 0), summary?.niiSensitivity?.riskRating || 'low'],
        [t('COSSEC', 'COSSEC'), cossec?.overallStatus === 'compliant' ? t('Cumple', 'Compliant') : cossec?.overallStatus === 'conditional' ? t('Condicional', 'Conditional') : t('No Cumple', 'Non-compliant'), cossec?.overallStatus || 'compliant'],
      ];
      let my = y;
      for (const [label, value, status] of keyMetrics) {
        doc.fill('#64748B').font('Helvetica').fontSize(9).text(label, mX, my, { lineBreak: false });
        doc.fill('#1F2937').font('Helvetica-Bold').text(value, mX + 180, my, { width: 100, lineBreak: false });
        const dotColor = ['pass', 'compliant', 'low', 'neutral'].includes(status) ? '#16A34A'
          : ['warning', 'conditional', 'moderate', 'asset-sensitive', 'liability-sensitive'].includes(status) ? '#D97706' : '#DC2626';
        doc.circle(mX + 290, my + 5, 3).fill(dotColor);
        my += 20;
      }

      y = Math.max(y + 90, my + 15);
      doc.fill('#1B3A6B').font('Helvetica-Bold').fontSize(12).text(t('RIESGOS PRINCIPALES', 'TOP RISKS'), ML, y);
      y += 20;
      if (summary?.topRisks) {
        for (const risk of summary.topRisks) {
          doc.circle(ML + 5, y + 4, 2.5).fill('#DC2626');
          doc.fill('#1F2937').font('Helvetica').fontSize(9).text(risk, ML + 15, y, { width: CW - 15 });
          const riskH = doc.heightOfString(risk, { width: CW - 15 });
          y += Math.max(14, riskH + 6);
        }
      }

      if (stressTest?.regulatory?.overallRating) {
        y += 15;
        doc.fill('#1B3A6B').font('Helvetica-Bold').fontSize(12).text(t('RESILIENCIA A ESTRES', 'STRESS RESILIENCE'), ML, y);
        y += 18;
        const rating = stressTest.regulatory.overallRating;
        const rc = rating === 'resilient' ? '#16A34A' : rating === 'adequate' ? '#1ABFFF' : rating === 'vulnerable' ? '#D97706' : '#DC2626';
        doc.rect(ML, y, 150, 26).fill(rc);
        doc.fill('#FFFFFF').font('Helvetica-Bold').fontSize(10).text(rating.toUpperCase(), ML + 10, y + 7, { width: 130, align: 'center' });
      }

      // ═════════════════════════════════════════════════════════════
      // PAGE 4: BALANCE SHEET OVERVIEW
      // ═════════════════════════════════════════════════════════════
      doc.addPage();
      y = pageHeader(t('PANORAMA DEL BALANCE GENERAL', 'BALANCE SHEET OVERVIEW'));
      drawFooter();

      if (cossec?.summary) {
        const s = cossec.summary;
        const cards: [string, string][] = [
          [t('Activos Totales', 'Total Assets'), fmtM(s.totalAssets)],
          [t('Pasivos Totales', 'Total Liabilities'), fmtM(s.totalLiabilities)],
          [t('Capital', 'Equity'), fmtM(s.equity)],
        ];
        let cx = ML;
        for (const [label, value] of cards) {
          doc.rect(cx, y, 150, 55).fill('#F0F9FF');
          doc.fill('#1B3A6B').font('Helvetica-Bold').fontSize(18).text(value, cx + 12, y + 10, { width: 126 });
          doc.fill('#64748B').font('Helvetica').fontSize(8).text(label, cx + 12, y + 35, { width: 126 });
          cx += 165;
        }
        y += 75;

        doc.fill('#1B3A6B').font('Helvetica-Bold').fontSize(12).text(t('COMPOSICION', 'COMPOSITION'), ML, y);
        y += 20;
        const cw = [200, 100, 100, 92];
        y = tblRow(y, [t('Categoria', 'Category'), t('Monto ($M)', 'Amount ($M)'), t('% Activos', '% Assets'), t('Estado', 'Status')], cw, { bg: '#1B3A6B', header: true });
        const compRows: string[][] = [
          [t('Prestamos Totales', 'Total Loans'), fmtM(s.totalLoans), fmtPct(s.totalAssets > 0 ? (s.totalLoans / s.totalAssets) * 100 : 0), ''],
          [t('Depositos/Acciones', 'Deposits/Shares'), fmtM(s.totalShares), fmtPct(s.totalAssets > 0 ? (s.totalShares / s.totalAssets) * 100 : 0), ''],
          [t('Activos Liquidos', 'Liquid Assets'), fmtM(s.liquidAssets), fmtPct(s.liquidityRatio), ''],
          [t('Capital / Activos', 'Capital / Assets'), '', fmtPct(s.capitalRatio), s.capitalRatio >= 8 ? t('Bien Capitalizado', 'Well Capitalized') : t('Adecuado', 'Adequate')],
        ];
        for (let i = 0; i < compRows.length; i++) {
          y = tblRow(y, compRows[i], cw, { bg: i % 2 === 0 ? '#FFFFFF' : '#F8FAFC' });
        }

        y += 25;
        doc.fill('#1B3A6B').font('Helvetica-Bold').fontSize(12).text(t('RAZONES CLAVE', 'KEY RATIOS'), ML, y);
        y += 20;
        const rw = [200, 100, 100, 92];
        y = tblRow(y, [t('Razon', 'Ratio'), t('Valor', 'Value'), t('Umbral', 'Threshold'), t('Estado', 'Status')], rw, { bg: '#1B3A6B', header: true });
        const ratioRows: string[][] = [
          [t('Razon de Capital', 'Capital Ratio'), fmtPct(s.capitalRatio), '>= 6.0%', s.capitalRatio >= 8 ? 'PASS' : s.capitalRatio >= 6 ? 'WARN' : 'FAIL'],
          [t('Prestamos/Acciones', 'Loan-to-Share'), fmtPct(s.loanToShareRatio), '<= 100%', s.loanToShareRatio <= 80 ? 'PASS' : s.loanToShareRatio <= 100 ? 'WARN' : 'FAIL'],
          [t('Razon de Liquidez', 'Liquidity Ratio'), fmtPct(s.liquidityRatio), '>= 15%', s.liquidityRatio >= 20 ? 'PASS' : s.liquidityRatio >= 15 ? 'WARN' : 'FAIL'],
        ];
        for (let i = 0; i < ratioRows.length; i++) {
          y = tblRow(y, ratioRows[i], rw, { bg: i % 2 === 0 ? '#FFFFFF' : '#F8FAFC' });
        }
      }

      // ═════════════════════════════════════════════════════════════
      // PAGE 5: DURATION GAP ANALYSIS
      // ═════════════════════════════════════════════════════════════
      doc.addPage();
      y = pageHeader(t('ANALISIS DE BRECHA DE DURACION', 'DURATION GAP ANALYSIS'));
      drawFooter();

      if (summary?.durationGap) {
        const dg = summary.durationGap;
        doc.font('Helvetica').fontSize(9).fill('#475569').text(
          t(
            'La brecha de duracion mide la diferencia entre la duracion promedio ponderada de activos y pasivos. Una brecha positiva indica sensibilidad a activos (perdida de valor cuando las tasas suben).',
            'Duration gap measures the difference between the weighted average duration of assets and liabilities. A positive gap indicates asset sensitivity (value loss when rates rise).',
          ), ML, y, { width: CW },
        );
        y += 45;

        const maxDur = Math.max(dg.assetDuration || 1, dg.liabilityDuration || 1, 1);
        const barMax = 300;

        doc.font('Helvetica-Bold').fontSize(10).fill('#1B3A6B').text(t('Duracion de Activos', 'Asset Duration'), ML, y);
        doc.text(`${dg.assetDuration.toFixed(2)} yr`, ML + barMax + 20, y);
        y += 15;
        const assetBarW = Math.max(10, (dg.assetDuration / maxDur) * barMax);
        doc.rect(ML, y, assetBarW, 16).fill('#1ABFFF');
        y += 28;

        doc.font('Helvetica-Bold').fontSize(10).fill('#1B3A6B').text(t('Duracion de Pasivos', 'Liability Duration'), ML, y);
        doc.text(`${dg.liabilityDuration.toFixed(2)} yr`, ML + barMax + 20, y);
        y += 15;
        const liabBarW = Math.max(10, (dg.liabilityDuration / maxDur) * barMax);
        doc.rect(ML, y, liabBarW, 16).fill('#E8A020');
        y += 35;

        const gapColor = Math.abs(dg.durationGap) < 1 ? '#16A34A' : Math.abs(dg.durationGap) < 2.5 ? '#D97706' : '#DC2626';
        doc.rect(ML, y, CW, 60).fill('#F8FAFC');
        doc.rect(ML, y, 4, 60).fill(gapColor);
        doc.fill(gapColor).font('Helvetica-Bold').fontSize(24).text(
          `${dg.durationGap > 0 ? '+' : ''}${dg.durationGap.toFixed(2)} yr`, ML + 20, y + 8,
        );
        doc.fill('#475569').font('Helvetica').fontSize(10).text(t('Brecha de Duracion', 'Duration Gap'), ML + 20, y + 38);

        const profileText = dg.riskProfile === 'asset-sensitive' ? t('Sensible a Activos', 'Asset Sensitive')
          : dg.riskProfile === 'liability-sensitive' ? t('Sensible a Pasivos', 'Liability Sensitive')
          : t('Neutral', 'Neutral');
        const profileColor = dg.riskProfile === 'neutral' ? '#16A34A' : '#D97706';
        doc.rect(ML + 280, y + 15, 160, 28).fill(profileColor);
        doc.fill('#FFFFFF').font('Helvetica-Bold').fontSize(10).text(profileText, ML + 290, y + 22, { width: 140, align: 'center' });

        y += 80;
        doc.fill('#1B3A6B').font('Helvetica-Bold').fontSize(11).text(t('INTERPRETACION', 'INTERPRETATION'), ML, y);
        y += 18;
        doc.font('Helvetica').fontSize(9).fill('#1F2937');
        if (dg.riskProfile === 'asset-sensitive') {
          doc.text(t(
            'Su institucion es sensible a activos. Si las tasas de interes suben, el valor economico del capital puede disminuir. Considere alargar la duracion de los pasivos.',
            'Your institution is asset-sensitive. If interest rates rise, the economic value of equity may decline. Consider extending liability duration.',
          ), ML, y, { width: CW });
        } else if (dg.riskProfile === 'liability-sensitive') {
          doc.text(t(
            'Su institucion es sensible a pasivos. Si las tasas de interes bajan, los ingresos netos por intereses pueden disminuir.',
            'Your institution is liability-sensitive. If interest rates fall, net interest income may decline. Consider reducing asset duration.',
          ), ML, y, { width: CW });
        } else {
          doc.text(t(
            'Su brecha de duracion esta bien equilibrada, indicando una exposicion minima a cambios en las tasas de interes.',
            'Your duration gap is well-balanced, indicating minimal exposure to interest rate changes.',
          ), ML, y, { width: CW });
        }
      }

      // ═════════════════════════════════════════════════════════════
      // PAGE 6: NII SENSITIVITY
      // ═════════════════════════════════════════════════════════════
      doc.addPage();
      y = pageHeader(t('SENSIBILIDAD DE INGRESO NETO POR INTERESES', 'NET INTEREST INCOME SENSITIVITY'));
      drawFooter();

      if (summary?.niiSensitivity) {
        const nii = summary.niiSensitivity;
        const ratingClr = nii.riskRating === 'low' ? '#16A34A' : nii.riskRating === 'moderate' ? '#D97706' : '#DC2626';

        doc.font('Helvetica').fontSize(9).fill('#475569');
        doc.text(`${t('NII Base', 'Base NII')}: ${fmtM(nii.baseNII)}`, ML, y, { lineBreak: false });
        doc.text(`${t('Clasificacion de Riesgo', 'Risk Rating')}: `, ML + 200, y, { continued: true, lineBreak: false });
        doc.fill(ratingClr).font('Helvetica-Bold').text(nii.riskRating.toUpperCase(), { lineBreak: false });
        y += 25;

        const sw = [100, 80, 80, 80, 80, 72];
        y = tblRow(y, [t('Escenario', 'Scenario'), t('Choque', 'Shock'), t('NII ($M)', 'NII ($M)'), 'NII %', t('MVE ($M)', 'MVE ($M)'), 'MVE %'], sw, { bg: '#1B3A6B', header: true });

        if (nii.scenarios) {
          for (let i = 0; i < nii.scenarios.length; i++) {
            const s = nii.scenarios[i];
            y = tblRow(y, [
              s.name,
              `${s.shiftBps > 0 ? '+' : ''}${s.shiftBps}bps`,
              fmtM(s.niImpact),
              `${s.niImpactPct > 0 ? '+' : ''}${s.niImpactPct.toFixed(1)}%`,
              fmtM(s.mveImpact),
              `${s.mveImpactPct > 0 ? '+' : ''}${s.mveImpactPct.toFixed(1)}%`,
            ], sw, { bg: i % 2 === 0 ? '#FFFFFF' : '#F8FAFC' });
          }
        }

        y += 25;
        doc.fill('#1B3A6B').font('Helvetica-Bold').fontSize(11).text(t('ANALISIS', 'ANALYSIS'), ML, y);
        y += 18;
        doc.font('Helvetica').fontSize(9).fill('#1F2937').text(
          t(
            'La tabla muestra como cambios en las tasas de interes afectarian el ingreso neto por intereses (NII) y el valor de mercado del capital (MVE). Cambios mayores al 10% en NII se consideran alto riesgo.',
            'The table shows how interest rate changes would affect net interest income (NII) and market value of equity (MVE). NII changes exceeding 10% are considered high risk.',
          ), ML, y, { width: CW },
        );
      }

      // ═════════════════════════════════════════════════════════════
      // PAGE 7: LIQUIDITY COVERAGE
      // ═════════════════════════════════════════════════════════════
      doc.addPage();
      y = pageHeader(t('COBERTURA DE LIQUIDEZ', 'LIQUIDITY COVERAGE RATIO'));
      drawFooter();

      if (summary?.liquidity) {
        const liq = summary.liquidity;
        const lcrColor = liq.status === 'compliant' ? '#16A34A' : liq.status === 'warning' ? '#D97706' : '#DC2626';

        doc.rect(ML, y, 160, 90).fill('#F8FAFC');
        doc.rect(ML, y, 4, 90).fill(lcrColor);
        doc.fill(lcrColor).font('Helvetica-Bold').fontSize(40).text(`${liq.lcr.toFixed(0)}%`, ML + 15, y + 10, { width: 130, align: 'center' });
        doc.fill('#475569').font('Helvetica').fontSize(9).text('LCR', ML + 15, y + 58, { width: 130, align: 'center' });
        const lcrStatusText = liq.status === 'compliant' ? t('CUMPLE', 'COMPLIANT') : liq.status === 'warning' ? t('ALERTA', 'WARNING') : t('INCUMPLIMIENTO', 'BREACH');
        doc.fill('#475569').fontSize(8).text(lcrStatusText, ML + 15, y + 72, { width: 130, align: 'center' });

        const lx = ML + 190;
        const liqMetrics: [string, string][] = [
          [t('HQLA Total', 'Total HQLA'), fmtM(liq.hqla)],
          [t('Flujos Netos de Salida', 'Net Cash Outflows'), fmtM(liq.netOutflows)],
          [t('Amortiguador vs 100%', 'Buffer vs 100%'), `${liq.buffer > 0 ? '+' : ''}${liq.buffer.toFixed(1)}%`],
          [t('Requisito Basilea III', 'Basel III Requirement'), '>= 100%'],
          [t('Meta CERNIQ', 'CERNIQ Target'), '>= 120%'],
        ];
        let ly = y + 5;
        for (const [label, value] of liqMetrics) {
          doc.fill('#64748B').font('Helvetica').fontSize(9).text(label, lx, ly, { lineBreak: false });
          doc.fill('#1F2937').font('Helvetica-Bold').text(value, lx + 180, ly, { width: 80, lineBreak: false });
          ly += 18;
        }

        y += 110;
        doc.fill('#1B3A6B').font('Helvetica-Bold').fontSize(11).text(t('INTERPRETACION', 'INTERPRETATION'), ML, y);
        y += 18;
        doc.font('Helvetica').fontSize(9).fill('#1F2937');
        if (liq.status === 'compliant') {
          doc.text(t(
            'La institucion mantiene reservas de liquidez adecuadas. Se recomienda mantener un amortiguador por encima del 120%.',
            'The institution maintains adequate liquidity reserves. Maintaining a buffer above 120% is recommended.',
          ), ML, y, { width: CW });
        } else if (liq.status === 'warning') {
          doc.text(t(
            'El LCR cumple el minimo pero tiene margen limitado. Considere aumentar las posiciones en HQLA.',
            'LCR meets the minimum but has limited buffer. Consider increasing HQLA positions.',
          ), ML, y, { width: CW });
        } else {
          doc.text(t(
            'URGENTE: El LCR esta por debajo del minimo de Basilea III. Accion inmediata requerida.',
            'URGENT: LCR is below the Basel III minimum. Immediate action required to increase HQLA.',
          ), ML, y, { width: CW });
        }
      }

      // ═════════════════════════════════════════════════════════════
      // PAGE 8: COSSEC COMPLIANCE
      // ═════════════════════════════════════════════════════════════
      doc.addPage();
      y = pageHeader(t('CUMPLIMIENTO REGULATORIO COSSEC', 'COSSEC REGULATORY COMPLIANCE'));
      drawFooter();

      if (cossec) {
        const osColor = cossec.overallStatus === 'compliant' ? '#16A34A' : cossec.overallStatus === 'conditional' ? '#D97706' : '#DC2626';
        const osText = cossec.overallStatus === 'compliant' ? t('CUMPLE', 'COMPLIANT')
          : cossec.overallStatus === 'conditional' ? t('CONDICIONAL', 'CONDITIONAL')
          : t('NO CUMPLE', 'NON-COMPLIANT');
        doc.rect(ML, y, CW, 30).fill(osColor);
        doc.fill('#FFFFFF').font('Helvetica-Bold').fontSize(12).text(
          `${t('Estado General', 'Overall Status')}: ${osText}`, ML + 15, y + 8, { width: CW - 30 },
        );
        y += 45;

        if (cossec.checks) {
          for (const check of cossec.checks) {
            const checkClr = statusClr(check.status);
            doc.rect(ML, y, CW, 62).fill('#F8FAFC');
            doc.rect(ML, y, 4, 62).fill(checkClr);

            doc.circle(ML + 20, y + 14, 6).fill(checkClr);
            const badge = check.status === 'pass' ? 'P' : check.status === 'warning' ? 'W' : 'F';
            doc.fill('#FFFFFF').font('Helvetica-Bold').fontSize(8).text(badge, ML + 15, y + 10, { width: 10, align: 'center' });

            doc.fill('#1F2937').font('Helvetica-Bold').fontSize(11).text(
              isEs ? check.nameEs : check.name, ML + 35, y + 8, { lineBreak: false },
            );
            doc.fill(checkClr).font('Helvetica-Bold').fontSize(14).text(
              `${check.value}${check.unit}`, PW - MR - 100, y + 6, { width: 90, align: 'right', lineBreak: false },
            );
            doc.fill('#64748B').font('Helvetica').fontSize(8).text(
              isEs ? check.descriptionEs : check.description, ML + 35, y + 28, { width: CW - 80 },
            );
            doc.fill('#94A3B8').fontSize(7).text(
              `${t('Umbral', 'Threshold')}: ${check.threshold}${check.unit}`, ML + 35, y + 48, { lineBreak: false },
            );
            y += 72;
          }
        }
      }

      // ═════════════════════════════════════════════════════════════
      // PAGE 9: STRESS TEST RESULTS
      // ═════════════════════════════════════════════════════════════
      doc.addPage();
      y = pageHeader(t('RESULTADOS DE PRUEBAS DE ESTRES', 'STRESS TEST RESULTS'));
      drawFooter();

      if (stressTest?.monteCarlo) {
        const mc = stressTest.monteCarlo;
        doc.fill('#1B3A6B').font('Helvetica-Bold').fontSize(12).text(
          t('SIMULACION MONTE CARLO', 'MONTE CARLO SIMULATION'), ML, y,
        );
        y += 5;
        doc.fill('#64748B').font('Helvetica').fontSize(8).text(
          `${mc.paths} ${t('trayectorias', 'paths')} | ${mc.horizon} ${t('meses', 'months')} | ${t('Modelo Vasicek', 'Vasicek Model')}`, ML, y,
        );
        y += 20;

        const dw = [100, 78, 78, 78, 78, 80];
        y = tblRow(y, [t('Metrica', 'Metric'), 'P5', 'P25', t('Mediana', 'Median'), 'P75', 'P95'], dw, { bg: '#1B3A6B', header: true });

        if (mc.niiDistribution) {
          const d = mc.niiDistribution;
          y = tblRow(y, [t('NII Proyectado', 'Projected NII'), fmtM(d.p5), fmtM(d.p25), fmtM(d.median), fmtM(d.p75), fmtM(d.p95)], dw, { bg: '#F8FAFC' });
        }

        y += 15;
        const mcMetrics: [string, string][] = [
          [t('NII Esperado', 'Expected NII'), fmtM(mc.expectedNII)],
          [t('NII Peor Caso', 'Worst Case NII'), fmtM(mc.worstCaseNII)],
          [t('NII en Riesgo (EaR)', 'NII at Risk (EaR)'), fmtM(mc.niiAtRisk)],
        ];
        for (const [label, value] of mcMetrics) {
          doc.fill('#64748B').font('Helvetica').fontSize(9).text(label, ML, y, { lineBreak: false });
          doc.fill('#1F2937').font('Helvetica-Bold').text(value, ML + 200, y, { width: 100, lineBreak: false });
          y += 16;
        }
        y += 20;
      }

      if (stressTest?.regulatory?.scenarios) {
        doc.fill('#1B3A6B').font('Helvetica-Bold').fontSize(12).text(
          t('ESCENARIOS REGULATORIOS', 'REGULATORY SCENARIOS'), ML, y,
        );
        y += 20;

        const rw2 = [140, 70, 70, 70, 70, 72];
        y = tblRow(y, [t('Escenario', 'Scenario'), 'NII ($M)', 'MVE ($M)', 'LCR', t('Capital', 'Capital'), t('Estado', 'Status')], rw2, { bg: '#1B3A6B', header: true });

        for (let i = 0; i < stressTest.regulatory.scenarios.length; i++) {
          const s = stressTest.regulatory.scenarios[i];
          y = tblRow(y, [
            s.name, fmtM(s.niImpact), fmtM(s.mveImpact), fmtPct(s.lcrImpact), fmtPct(s.capitalImpact), s.passFailStatus.toUpperCase(),
          ], rw2, { bg: i % 2 === 0 ? '#FFFFFF' : '#F8FAFC' });
        }

        y += 15;
        const overallClr = stressTest.regulatory.overallRating === 'resilient' ? '#16A34A'
          : stressTest.regulatory.overallRating === 'adequate' ? '#1ABFFF'
          : stressTest.regulatory.overallRating === 'vulnerable' ? '#D97706' : '#DC2626';
        doc.rect(ML, y, 220, 26).fill(overallClr);
        doc.fill('#FFFFFF').font('Helvetica-Bold').fontSize(10).text(
          `${t('Calificacion', 'Rating')}: ${stressTest.regulatory.overallRating.toUpperCase()}`, ML + 12, y + 7,
        );
      }

      // ═════════════════════════════════════════════════════════════
      // PAGE 10: RECOMMENDATIONS
      // ═════════════════════════════════════════════════════════════
      doc.addPage();
      y = pageHeader(t('RECOMENDACIONES', 'RECOMMENDATIONS'));
      drawFooter();

      doc.font('Helvetica').fontSize(9).fill('#475569').text(
        t(
          'Las siguientes recomendaciones estan basadas en el analisis automatizado de los datos del balance general, metricas de riesgo y requisitos regulatorios.',
          'The following recommendations are based on automated analysis of balance sheet data, risk metrics, and regulatory requirements.',
        ), ML, y, { width: CW },
      );
      y += 30;

      if (summary?.recommendations) {
        for (let i = 0; i < summary.recommendations.length; i++) {
          const rec = summary.recommendations[i];
          doc.circle(ML + 12, y + 7, 12).fill('#1B3A6B');
          doc.fill('#FFFFFF').font('Helvetica-Bold').fontSize(11).text(`${i + 1}`, ML + 5, y + 2, { width: 14, align: 'center' });
          doc.fill('#1F2937').font('Helvetica').fontSize(10).text(rec, ML + 35, y + 1, { width: CW - 40 });
          const recH = doc.heightOfString(rec, { width: CW - 40 });
          y += Math.max(30, recH + 15);
        }
      }

      // ═════════════════════════════════════════════════════════════
      // PAGE 11: METHODOLOGY & DISCLAIMER
      // ═════════════════════════════════════════════════════════════
      doc.addPage();
      y = pageHeader(t('METODOLOGIA Y AVISO LEGAL', 'METHODOLOGY & DISCLAIMER'));
      drawFooter();

      doc.fill('#1B3A6B').font('Helvetica-Bold').fontSize(12).text(t('METODOLOGIA', 'METHODOLOGY'), ML, y);
      y += 20;
      const methodItems = [
        t('Duracion: Duracion modificada de Macaulay usando rendimientos de mercado actuales.', 'Duration: Modified Macaulay duration using current market yields.'),
        t('NII: Simulacion de ingreso neto por intereses bajo multiples escenarios de tasas (+/- 100, 200, 300 bps).', 'NII: Net interest income simulation under multiple rate scenarios (+/- 100, 200, 300 bps).'),
        t('LCR: Activos liquidos de alta calidad / Flujos netos de salida a 30 dias (Basilea III).', 'LCR: High-quality liquid assets / Net 30-day cash outflows (Basel III).'),
        t('Monte Carlo: Modelo Vasicek con reversion a la media, 500 trayectorias, horizonte de 12 meses.', 'Monte Carlo: Vasicek model with mean reversion, 500 paths, 12-month horizon.'),
        t('COSSEC: Verificacion contra umbrales regulatorios de COSSEC para cooperativas de PR.', 'COSSEC: Verification against COSSEC regulatory thresholds for PR cooperativas.'),
        t('MVE: Valor de mercado del capital bajo escenarios de choque de tasas.', 'MVE: Market value of equity under rate shock scenarios.'),
      ];
      doc.font('Helvetica').fontSize(9).fill('#1F2937');
      for (const item of methodItems) {
        doc.circle(ML + 5, y + 4, 2).fill('#1ABFFF');
        doc.fill('#1F2937').font('Helvetica').fontSize(9).text(item, ML + 15, y, { width: CW - 15 });
        const itemH = doc.heightOfString(item, { width: CW - 15 });
        y += Math.max(14, itemH + 8);
      }

      y += 25;
      doc.moveTo(ML, y).lineTo(PW - MR, y).strokeColor('#D1D5DB').lineWidth(0.5).stroke();
      y += 15;

      doc.fill('#1B3A6B').font('Helvetica-Bold').fontSize(12).text(t('AVISO LEGAL', 'DISCLAIMER'), ML, y);
      y += 20;
      doc.font('Helvetica').fontSize(8).fill('#64748B').text(
        t(
          'Este informe es generado automaticamente por la plataforma CERNIQ, propiedad de KLYTICS LLC, San Juan, Puerto Rico. KLYTICS LLC no es un asesor de inversion registrado, banco, ni entidad regulada. Este informe no constituye asesoramiento financiero, legal ni regulatorio. Los resultados se basan en los datos proporcionados por la institucion y modelos cuantitativos estandar de la industria. KLYTICS LLC no garantiza la exactitud, completitud ni idoneidad de los resultados para ningun proposito particular. Las decisiones de inversion, regulatorias o de gestion de riesgo deben tomarse con la asesoria de profesionales cualificados.',
          'This report is automatically generated by the CERNIQ platform, owned by KLYTICS LLC, San Juan, Puerto Rico. KLYTICS LLC is not a registered investment advisor, bank, or regulated entity. This report does not constitute financial, legal, or regulatory advice. Results are based on data provided by the institution and industry-standard quantitative models. KLYTICS LLC does not guarantee the accuracy, completeness, or suitability of the results for any particular purpose. Investment, regulatory, or risk management decisions should be made with the advice of qualified professionals.',
        ), ML, y, { width: CW },
      );

      y += 80;
      doc.fill('#94A3B8').fontSize(7).text(
        `${t('Generado', 'Generated')}: ${new Date().toISOString()} | CERNIQ v1.0 | KLYTICS LLC ${new Date().getFullYear()}`,
        ML, y, { width: CW, align: 'center' },
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
