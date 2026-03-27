import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  AnomalyDetectionService,
  APAnalysisResult,
  ApLcrImpact,
} from './anomaly-detection.service';

const PDFDocument = require('pdfkit');

@Injectable()
export class ApReportService {
  private readonly logger = new Logger(ApReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly anomalyDetection: AnomalyDetectionService,
  ) {}

  /**
   * Generate the 6-page AP Intelligence Report PDF on demand.
   * Returns a Buffer containing the complete PDF.
   */
  async generateAPReport(
    orgId: string,
    institutionId: string | null,
    language: string,
  ): Promise<Buffer> {
    this.logger.log({ event: 'ap_report.build.start', orgId, language });

    // Fetch analysis data
    const analysis = await this.anomalyDetection.analyzeOrganization(orgId);

    // Fetch organization info
    const organization = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });

    // Optionally fetch LCR impact if institutionId is provided
    let lcrImpact: ApLcrImpact | null = null;
    if (institutionId) {
      try {
        lcrImpact = await this.anomalyDetection.calculateApLcrImpact(
          orgId,
          institutionId,
        );
      } catch (err) {
        this.logger.warn(`LCR impact calculation failed: ${err}`);
      }
    }

    const pdf = await this.buildPDF(
      organization,
      analysis,
      lcrImpact,
      language,
    );
    this.logger.log({ event: 'ap_report.build.complete', orgId, pages: 6 });
    return pdf;
  }

  private buildPDF(
    organization: any,
    analysis: APAnalysisResult,
    lcrImpact: ApLcrImpact | null,
    lang: string,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'letter',
        margins: { top: 60, bottom: 70, left: 60, right: 60 },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const isEs = lang === 'es';
      const t = (es: string, en: string) => (isEs ? es : en);
      const fmtM = (v: number) => `$${((v || 0) / 1_000_000).toFixed(1)}M`;
      const fmtD = (v: number) =>
        new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(v || 0);
      const fmtPct = (v: number) => `${(v || 0).toFixed(1)}%`;
      const PW = 612;
      const ML = 60;
      const MR = 60;
      const CW = PW - ML - MR;
      const TOTAL_PAGES = 6;
      let pageNum = 0;

      // ── Reusable helpers (same style as pipeline.worker.ts / alco-pack.service.ts) ──

      const pageHeader = (title: string): number => {
        doc.rect(0, 0, PW, 48).fill('#1B3A6B');
        doc
          .fill('#FFFFFF')
          .fontSize(9)
          .font('Helvetica-Bold')
          .text('CERNIQ', ML, 17);
        doc
          .font('Helvetica')
          .fontSize(8)
          .text(organization?.name || '', PW - MR - 200, 17, {
            width: 200,
            align: 'right',
          });
        doc
          .fill('#1B3A6B')
          .fontSize(15)
          .font('Helvetica-Bold')
          .text(title, ML, 62);
        doc
          .moveTo(ML, 82)
          .lineTo(PW - MR, 82)
          .strokeColor('#D1D5DB')
          .lineWidth(0.5)
          .stroke();
        return 95;
      };

      const drawFooter = () => {
        pageNum++;
        doc.fill('#94A3B8').fontSize(7).font('Helvetica');
        doc.text('CERNIQ — KLYTICS LLC', ML, 752, { lineBreak: false });
        doc.text(
          t(
            'INFORME DE INTELIGENCIA AP — CONFIDENCIAL',
            'AP INTELLIGENCE REPORT — CONFIDENTIAL',
          ),
          PW / 2 - 80,
          752,
          { width: 160, align: 'center', lineBreak: false },
        );
        doc.text(
          `${t('Pag.', 'Pg.')} ${pageNum}/${TOTAL_PAGES}`,
          PW - MR - 40,
          752,
          {
            width: 40,
            align: 'right',
            lineBreak: false,
          },
        );
      };

      const statusClr = (s: string) =>
        s === 'pass' ? '#16A34A' : s === 'warning' ? '#D97706' : '#DC2626';

      const severityClr = (s: string) =>
        s === 'HIGH' ? '#DC2626' : s === 'MEDIUM' ? '#D97706' : '#64748B';

      const tblRow = (
        y: number,
        cols: string[],
        widths: number[],
        opts?: { bg?: string; header?: boolean },
      ) => {
        const h = 18;
        if (opts?.bg) doc.rect(ML, y - 2, CW, h).fill(opts.bg);
        doc
          .fill(opts?.header ? '#FFFFFF' : '#1F2937')
          .font(opts?.header ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(opts?.header ? 8 : 8);
        let x = ML;
        for (let i = 0; i < cols.length; i++) {
          doc.text(cols[i], x + 4, y, {
            width: widths[i] - 8,
            lineBreak: false,
          });
          x += widths[i];
        }
        return y + h;
      };

      const healthClr = (score: number) =>
        score >= 80 ? '#16A34A' : score >= 50 ? '#D97706' : '#DC2626';

      // Compute derived data
      const totalSpend =
        analysis.findings.reduce((s, f) => s + f.estimatedRecovery, 0) || 0;
      const invoiceCount = analysis.totalExpenses;
      const activeFindings = analysis.findings.length;
      const totalRecovery = analysis.estimatedTotalRecovery;
      const healthScore = analysis.healthScore;
      const topVendor = analysis.topVendorName;
      const highFindings = analysis.findings
        .filter((f) => f.severity === 'HIGH')
        .sort((a, b) => b.estimatedRecovery - a.estimatedRecovery);
      const medFindings = analysis.findings
        .filter((f) => f.severity === 'MEDIUM')
        .sort((a, b) => b.estimatedRecovery - a.estimatedRecovery);
      const vendorReport = analysis.vendorReport || [];
      const top10Vendors = vendorReport.slice(0, 10);
      const concentrationVendors = vendorReport.filter(
        (v) => v.percentOfTotalSpend > 25,
      );
      const totalExpenseAmount = vendorReport.reduce(
        (s, v) => s + v.quarterlyTotal,
        0,
      );

      // ═══════════════════════════════════════════════════════════
      // PAGE 1: COVER
      // ═══════════════════════════════════════════════════════════
      // Full navy header band
      doc.rect(0, 0, PW, 140).fill('#1B3A6B');
      doc
        .fill('#FFFFFF')
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('CERNIQ', ML, 20);
      doc
        .fill('#FFFFFF')
        .font('Helvetica')
        .fontSize(8)
        .text('KLYTICS LLC', PW - MR - 100, 20, { width: 100, align: 'right' });
      doc
        .fill('#FFFFFF')
        .font('Helvetica-Bold')
        .fontSize(24)
        .text(
          t('Informe de Inteligencia AP', 'AP Intelligence Report'),
          ML,
          55,
        );
      doc
        .fill('#FFFFFF')
        .font('Helvetica')
        .fontSize(11)
        .text(
          t('Analisis de Cuentas por Pagar', 'Accounts Payable Analysis'),
          ML,
          88,
        );
      doc
        .fill('#FFFFFF')
        .font('Helvetica')
        .fontSize(9)
        .text(
          new Date().toLocaleDateString(isEs ? 'es-PR' : 'en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
          PW - MR - 200,
          95,
          { width: 200, align: 'right' },
        );
      drawFooter();

      // Institution name
      let y = 160;
      doc
        .fill('#1B3A6B')
        .font('Helvetica-Bold')
        .fontSize(20)
        .text(organization?.name || t('Organizacion', 'Organization'), ML, y);
      y += 35;

      // AP Health Score — large gauge
      const hClr = healthClr(healthScore);
      const gaugeX = ML + 60;
      const gaugeY = y + 60;
      const gaugeR = 55;
      doc.circle(gaugeX, gaugeY, gaugeR).fill('#F1F5F9');
      doc.circle(gaugeX, gaugeY, gaugeR - 5).fill(hClr);
      doc.circle(gaugeX, gaugeY, gaugeR - 14).fill('#FFFFFF');
      doc
        .fill(hClr)
        .font('Helvetica-Bold')
        .fontSize(32)
        .text(`${healthScore}`, gaugeX - 30, gaugeY - 18, {
          width: 60,
          align: 'center',
        });
      doc
        .fill('#64748B')
        .font('Helvetica')
        .fontSize(7)
        .text('/100', gaugeX - 20, gaugeY + 16, {
          width: 40,
          align: 'center',
        });
      doc
        .fill('#64748B')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(t('Salud AP', 'AP Health'), gaugeX - 50, gaugeY + gaugeR + 10, {
          width: 100,
          align: 'center',
        });

      // Summary stats on the right of gauge
      const statX = ML + 180;
      const statData: [string, string][] = [
        [t('Gasto Total', 'Total Spend'), fmtD(totalExpenseAmount)],
        [t('Facturas', 'Invoices'), String(invoiceCount)],
        [t('Hallazgos Activos', 'Active Findings'), String(activeFindings)],
        [
          t('Recuperacion Potencial', 'Potential Recovery'),
          fmtD(totalRecovery),
        ],
        [t('Proveedor Principal', 'Top Vendor'), topVendor],
      ];
      let sy = y + 10;
      for (const [label, value] of statData) {
        doc
          .fill('#64748B')
          .font('Helvetica')
          .fontSize(9)
          .text(label, statX, sy, { lineBreak: false });
        doc
          .fill('#1F2937')
          .font('Helvetica-Bold')
          .fontSize(9)
          .text(value, statX + 160, sy, { width: 140, lineBreak: false });
        sy += 20;
      }

      // Confidentiality notice
      y = 460;
      doc.rect(ML, y, CW, 50).fill('#F8FAFC');
      doc.rect(ML, y, 4, 50).fill('#1B3A6B');
      doc
        .fill('#64748B')
        .font('Helvetica')
        .fontSize(7)
        .text(
          t(
            'AVISO DE CONFIDENCIALIDAD: Este informe fue generado por CERNIQ y contiene informacion confidencial destinada exclusivamente al uso interno de la organizacion. No debe ser distribuido, copiado ni divulgado a terceros sin autorizacion previa por escrito.',
            'CONFIDENTIALITY NOTICE: This report was generated by CERNIQ and contains confidential information intended solely for internal use by the organization. It must not be distributed, copied, or disclosed to third parties without prior written authorization.',
          ),
          ML + 16,
          y + 8,
          { width: CW - 30 },
        );

      // ═══════════════════════════════════════════════════════════
      // PAGE 2: EXECUTIVE SUMMARY
      // ═══════════════════════════════════════════════════════════
      doc.addPage();
      y = pageHeader(t('RESUMEN EJECUTIVO', 'EXECUTIVE SUMMARY'));
      drawFooter();

      // 6 KPI cards (3x2 grid)
      const kpiData: [string, string, string][] = [
        [
          t('Gasto Total Analizado', 'Total Spend Analyzed'),
          fmtD(totalExpenseAmount),
          '#1ABFFF',
        ],
        [
          t('Facturas Procesadas', 'Invoices Processed'),
          String(invoiceCount),
          '#1B3A6B',
        ],
        [
          t('Hallazgos Activos', 'Active Findings'),
          String(activeFindings),
          activeFindings > 5 ? '#DC2626' : '#D97706',
        ],
        [
          t('Recuperacion Estimada', 'Estimated Recovery'),
          fmtD(totalRecovery),
          '#16A34A',
        ],
        [t('Salud AP', 'AP Health Score'), `${healthScore}/100`, hClr],
        [
          t('Proveedor Principal', 'Top Vendor'),
          `${topVendor} (${fmtPct(analysis.topVendorPct)})`,
          '#E8A020',
        ],
      ];

      const cardW = 150;
      const cardH = 65;
      const cardGap = 21;
      for (let i = 0; i < kpiData.length; i++) {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const cx = ML + col * (cardW + cardGap);
        const cy = y + row * (cardH + 12);
        const [label, value, accent] = kpiData[i];

        doc.rect(cx, cy, cardW, cardH).fill('#F0F9FF');
        doc.rect(cx, cy, 4, cardH).fill(accent);
        doc
          .fill('#1B3A6B')
          .font('Helvetica-Bold')
          .fontSize(16)
          .text(value, cx + 14, cy + 10, { width: cardW - 22 });
        doc
          .fill('#64748B')
          .font('Helvetica')
          .fontSize(8)
          .text(label, cx + 14, cy + 38, { width: cardW - 22 });
      }

      y += 2 * (cardH + 12) + 20;

      // Summary narrative
      doc
        .fill('#1B3A6B')
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(t('RESUMEN DEL ANALISIS', 'ANALYSIS SUMMARY'), ML, y);
      y += 18;

      const healthLabel =
        healthScore >= 80
          ? t('saludable', 'healthy')
          : healthScore >= 50
            ? t(
                'moderada, con areas de atencion',
                'moderate, with areas of concern',
              )
            : t(
                'critica, requiere accion inmediata',
                'critical, requiring immediate action',
              );

      const narrativeEs = `El analisis de ${invoiceCount} facturas de ${analysis.totalVendors} proveedores revela una postura AP ${healthLabel} con un puntaje de salud de ${healthScore}/100. Se identificaron ${activeFindings} hallazgos con una recuperacion estimada de ${fmtD(totalRecovery)}. El proveedor con mayor concentracion es ${topVendor} con ${fmtPct(analysis.topVendorPct)} del gasto total.`;
      const narrativeEn = `Analysis of ${invoiceCount} invoices from ${analysis.totalVendors} vendors reveals a ${healthLabel} AP posture with a health score of ${healthScore}/100. ${activeFindings} findings were identified with an estimated recovery of ${fmtD(totalRecovery)}. The highest-concentration vendor is ${topVendor} at ${fmtPct(analysis.topVendorPct)} of total spend.`;

      doc
        .fill('#475569')
        .font('Helvetica')
        .fontSize(9)
        .text(isEs ? narrativeEs : narrativeEn, ML, y, { width: CW });

      // ═══════════════════════════════════════════════════════════
      // PAGE 3: ANOMALY ANALYSIS
      // ═══════════════════════════════════════════════════════════
      doc.addPage();
      y = pageHeader(t('ANALISIS DE ANOMALIAS', 'ANOMALY ANALYSIS'));
      drawFooter();

      // Section: HIGH findings
      const allHighMed = [...highFindings, ...medFindings];

      if (allHighMed.length === 0) {
        doc
          .fill('#16A34A')
          .font('Helvetica-Bold')
          .fontSize(12)
          .text(
            t(
              'No se identificaron hallazgos de alta o media severidad.',
              'No high or medium severity findings were identified.',
            ),
            ML,
            y,
            { width: CW },
          );
      } else {
        // Table header
        const fw = [120, 90, 70, 70, 60, 82];
        y = tblRow(
          y,
          [
            t('Tipo', 'Type'),
            t('Proveedor', 'Vendor'),
            t('Monto', 'Amount'),
            t('Recuperacion', 'Recovery'),
            t('Severidad', 'Severity'),
            t('Estado', 'Status'),
          ],
          fw,
          { bg: '#1B3A6B', header: true },
        );

        // Group header: HIGH
        if (highFindings.length > 0) {
          doc.rect(ML, y - 2, CW, 16).fill('#FEF2F2');
          doc
            .fill('#DC2626')
            .font('Helvetica-Bold')
            .fontSize(8)
            .text(
              `${t('ALTA SEVERIDAD', 'HIGH SEVERITY')} (${highFindings.length})`,
              ML + 4,
              y,
            );
          y += 16;
        }

        for (let i = 0; i < Math.min(highFindings.length, 8); i++) {
          const f = highFindings[i];
          const typeLabel = this.findingTypeLabel(f.findingType, isEs);
          y = tblRow(
            y,
            [
              typeLabel,
              f.affectedVendor.slice(0, 14),
              fmtD(f.estimatedRecovery > 0 ? f.estimatedRecovery : 0),
              fmtD(f.estimatedRecovery),
              'HIGH',
              'OPEN',
            ],
            fw,
            { bg: i % 2 === 0 ? '#FFFFFF' : '#F8FAFC' },
          );

          // Severity dot
          doc
            .circle(ML + fw[0] + fw[1] + fw[2] + fw[3] + 30, y - 10, 4)
            .fill('#DC2626');

          if (y > 680) break;
        }

        // Group header: MEDIUM
        if (medFindings.length > 0 && y < 660) {
          y += 4;
          doc.rect(ML, y - 2, CW, 16).fill('#FFF7ED');
          doc
            .fill('#D97706')
            .font('Helvetica-Bold')
            .fontSize(8)
            .text(
              `${t('SEVERIDAD MEDIA', 'MEDIUM SEVERITY')} (${medFindings.length})`,
              ML + 4,
              y,
            );
          y += 16;
        }

        for (let i = 0; i < Math.min(medFindings.length, 6); i++) {
          if (y > 680) break;
          const f = medFindings[i];
          const typeLabel = this.findingTypeLabel(f.findingType, isEs);
          y = tblRow(
            y,
            [
              typeLabel,
              f.affectedVendor.slice(0, 14),
              fmtD(f.estimatedRecovery > 0 ? f.estimatedRecovery : 0),
              fmtD(f.estimatedRecovery),
              'MEDIUM',
              'OPEN',
            ],
            fw,
            { bg: i % 2 === 0 ? '#FFFFFF' : '#F8FAFC' },
          );

          // Severity dot
          doc
            .circle(ML + fw[0] + fw[1] + fw[2] + fw[3] + 30, y - 10, 4)
            .fill('#D97706');
        }

        // Total recovery footer
        y += 8;
        doc.rect(ML, y - 2, CW, 22).fill('#F0FDF4');
        doc.rect(ML, y - 2, 4, 22).fill('#16A34A');
        doc
          .fill('#16A34A')
          .font('Helvetica-Bold')
          .fontSize(10)
          .text(
            `${t('RECUPERACION TOTAL ESTIMADA', 'TOTAL ESTIMATED RECOVERY')}: ${fmtD(totalRecovery)}`,
            ML + 16,
            y + 2,
          );
      }

      // ═══════════════════════════════════════════════════════════
      // PAGE 4: VENDOR INTELLIGENCE
      // ═══════════════════════════════════════════════════════════
      doc.addPage();
      y = pageHeader(t('INTELIGENCIA DE PROVEEDORES', 'VENDOR INTELLIGENCE'));
      drawFooter();

      // Top 10 vendors table
      doc
        .fill('#1B3A6B')
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(
          t('TOP 10 PROVEEDORES POR GASTO', 'TOP 10 VENDORS BY SPEND'),
          ML,
          y,
        );
      y += 18;

      const vw = [140, 80, 65, 60, 65, 82];
      y = tblRow(
        y,
        [
          t('Proveedor', 'Vendor'),
          t('Gasto Q', 'Q Spend'),
          t('% Total', '% Total'),
          t('Facturas', 'Invoices'),
          t('Promedio', 'Avg'),
          t('Benchmark', 'Benchmark'),
        ],
        vw,
        { bg: '#1B3A6B', header: true },
      );

      for (let i = 0; i < Math.min(top10Vendors.length, 10); i++) {
        const v = top10Vendors[i];
        const benchLabel = v.match
          ? isEs
            ? v.match.assessmentEs
            : v.match.assessment.replace(/_/g, ' ')
          : '--';
        y = tblRow(
          y,
          [
            v.vendorName.slice(0, 20),
            fmtD(v.quarterlyTotal),
            fmtPct(v.percentOfTotalSpend),
            String(v.transactionCount),
            fmtD(v.quarterlyTotal / Math.max(v.transactionCount, 1)),
            benchLabel,
          ],
          vw,
          { bg: i % 2 === 0 ? '#FFFFFF' : '#F8FAFC' },
        );

        // Concentration dot
        const dotClr =
          v.percentOfTotalSpend > 35
            ? '#DC2626'
            : v.percentOfTotalSpend > 25
              ? '#D97706'
              : '#16A34A';
        doc.circle(ML + vw[0] + vw[1] + 32, y - 10, 3).fill(dotClr);
      }

      // Concentration risk section
      y += 20;
      doc
        .fill('#1B3A6B')
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(t('RIESGO DE CONCENTRACION', 'CONCENTRATION RISK'), ML, y);
      y += 18;

      if (concentrationVendors.length === 0) {
        doc
          .fill('#16A34A')
          .font('Helvetica')
          .fontSize(9)
          .text(
            t(
              'Ningun proveedor supera el umbral de concentracion del 25%.',
              'No vendor exceeds the 25% concentration threshold.',
            ),
            ML,
            y,
            { width: CW },
          );
        y += 20;
      } else {
        for (const v of concentrationVendors) {
          const riskLevel = v.percentOfTotalSpend > 35 ? 'HIGH' : 'MEDIUM';
          const rClr = riskLevel === 'HIGH' ? '#DC2626' : '#D97706';

          doc
            .rect(ML, y - 2, CW, 20)
            .fill(riskLevel === 'HIGH' ? '#FEF2F2' : '#FFF7ED');
          doc.rect(ML, y - 2, 4, 20).fill(rClr);
          doc
            .fill('#1F2937')
            .font('Helvetica-Bold')
            .fontSize(9)
            .text(
              `${v.vendorName}: ${fmtPct(v.percentOfTotalSpend)} ${t('del gasto total', 'of total spend')} — ${fmtD(v.quarterlyTotal)}`,
              ML + 14,
              y + 2,
              { width: CW - 30 },
            );
          y += 24;
        }
      }

      // Benchmark comparison for matched vendors
      const matchedVendors = top10Vendors.filter((v) => v.match);
      if (matchedVendors.length > 0 && y < 620) {
        y += 10;
        doc
          .fill('#1B3A6B')
          .font('Helvetica-Bold')
          .fontSize(11)
          .text(
            t(
              'COMPARACION CON BENCHMARK SECTORIAL',
              'SECTOR BENCHMARK COMPARISON',
            ),
            ML,
            y,
          );
        y += 18;

        for (const v of matchedVendors.slice(0, 5)) {
          if (y > 700 || !v.match) break;
          const m = v.match;
          const assessClr =
            m.assessment === 'ABOVE_BENCHMARK'
              ? '#DC2626'
              : m.assessment === 'BELOW_BENCHMARK'
                ? '#16A34A'
                : '#1ABFFF';

          doc
            .fill('#1F2937')
            .font('Helvetica-Bold')
            .fontSize(8)
            .text(v.vendorName, ML, y, { lineBreak: false });
          doc
            .fill('#64748B')
            .font('Helvetica')
            .fontSize(8)
            .text(
              ` — ${t('Actual', 'Actual')}: ${fmtD(m.institutionQuarterlyTotal)} | ${t('Mediana', 'Median')}: ${fmtD(m.benchmarkMedian)} | P${m.percentileRank.toFixed(0)}`,
              ML + 120,
              y,
              { lineBreak: false },
            );
          doc
            .fill(assessClr)
            .font('Helvetica-Bold')
            .fontSize(7)
            .text(
              isEs ? m.assessmentEs : m.assessment.replace(/_/g, ' '),
              PW - MR - 85,
              y,
              { width: 85, align: 'right', lineBreak: false },
            );
          y += 16;
        }
      }

      // ═══════════════════════════════════════════════════════════
      // PAGE 5: CASH FLOW IMPACT
      // ═══════════════════════════════════════════════════════════
      doc.addPage();
      y = pageHeader(t('IMPACTO EN FLUJO DE EFECTIVO', 'CASH FLOW IMPACT'));
      drawFooter();

      if (lcrImpact) {
        // AP-to-LCR bridge summary
        doc
          .fill('#1B3A6B')
          .font('Helvetica-Bold')
          .fontSize(12)
          .text(
            t(
              'PUENTE AP-LCR: IMPACTO EN LIQUIDEZ',
              'AP-LCR BRIDGE: LIQUIDITY IMPACT',
            ),
            ML,
            y,
          );
        y += 25;

        // Current vs Projected LCR side by side
        const lcrW = 180;
        const lcrH = 100;

        // Current LCR box
        const currentClr =
          lcrImpact.currentLcr >= 120
            ? '#16A34A'
            : lcrImpact.currentLcr >= 100
              ? '#D97706'
              : '#DC2626';
        doc.rect(ML, y, lcrW, lcrH).fill('#F8FAFC');
        doc.rect(ML, y, 4, lcrH).fill(currentClr);
        doc
          .fill(currentClr)
          .font('Helvetica-Bold')
          .fontSize(36)
          .text(fmtPct(lcrImpact.currentLcr), ML + 15, y + 15, {
            width: lcrW - 30,
            align: 'center',
          });
        doc
          .fill('#475569')
          .font('Helvetica-Bold')
          .fontSize(10)
          .text(t('LCR Actual', 'Current LCR'), ML + 15, y + 60, {
            width: lcrW - 30,
            align: 'center',
          });
        doc
          .fill('#94A3B8')
          .font('Helvetica')
          .fontSize(8)
          .text(t('Sin AP', 'Without AP'), ML + 15, y + 76, {
            width: lcrW - 30,
            align: 'center',
          });

        // Arrow
        doc
          .fill('#64748B')
          .font('Helvetica-Bold')
          .fontSize(18)
          .text('→', ML + lcrW + 10, y + 30, {
            width: 30,
            align: 'center',
          });

        // Projected LCR box
        const projClr =
          lcrImpact.projectedLcr >= 120
            ? '#16A34A'
            : lcrImpact.projectedLcr >= 100
              ? '#D97706'
              : '#DC2626';
        const projX = ML + lcrW + 50;
        doc.rect(projX, y, lcrW, lcrH).fill('#F8FAFC');
        doc.rect(projX, y, 4, lcrH).fill(projClr);
        doc
          .fill(projClr)
          .font('Helvetica-Bold')
          .fontSize(36)
          .text(fmtPct(lcrImpact.projectedLcr), projX + 15, y + 15, {
            width: lcrW - 30,
            align: 'center',
          });
        doc
          .fill('#475569')
          .font('Helvetica-Bold')
          .fontSize(10)
          .text(t('LCR Proyectado', 'Projected LCR'), projX + 15, y + 60, {
            width: lcrW - 30,
            align: 'center',
          });
        doc
          .fill('#94A3B8')
          .font('Helvetica')
          .fontSize(8)
          .text(t('Con AP', 'With AP'), projX + 15, y + 76, {
            width: lcrW - 30,
            align: 'center',
          });

        y += lcrH + 20;

        // Delta badge
        const deltaClr = lcrImpact.delta >= 0 ? '#16A34A' : '#DC2626';
        doc.rect(ML, y, CW, 30).fill('#F8FAFC');
        doc.rect(ML, y, 4, 30).fill(deltaClr);
        doc
          .fill(deltaClr)
          .font('Helvetica-Bold')
          .fontSize(12)
          .text(
            `Delta: ${lcrImpact.delta >= 0 ? '+' : ''}${fmtPct(lcrImpact.delta)}  |  ${t('Nivel de Alerta', 'Alert Level')}: ${lcrImpact.alertLevel}`,
            ML + 16,
            y + 8,
          );
        y += 45;

        // 30-day AP obligations detail
        doc
          .fill('#1B3A6B')
          .font('Helvetica-Bold')
          .fontSize(11)
          .text(t('OBLIGACIONES AP A 30 DIAS', '30-DAY AP OBLIGATIONS'), ML, y);
        y += 18;

        const lcrMetrics: [string, string][] = [
          [t('HQLA Disponible', 'Available HQLA'), fmtM(lcrImpact.hqla)],
          [
            t('Flujos Netos Actuales', 'Current Net Outflows'),
            fmtM(lcrImpact.currentNetOutflows),
          ],
          [
            t('Proyeccion AP 30 Dias', 'AP 30-Day Projection'),
            fmtD(lcrImpact.apProjected30Day),
          ],
          [
            t('Total AP Trimestral', 'Quarterly AP Total'),
            fmtD(lcrImpact.quarterlyAPTotal),
          ],
          [
            t('vs Trimestre Anterior', 'vs Last Quarter'),
            `${lcrImpact.vsLastQuarter >= 0 ? '+' : ''}${fmtPct(lcrImpact.vsLastQuarter)}`,
          ],
        ];

        for (const [label, value] of lcrMetrics) {
          doc
            .fill('#64748B')
            .font('Helvetica')
            .fontSize(9)
            .text(label, ML, y, { lineBreak: false });
          doc
            .fill('#1F2937')
            .font('Helvetica-Bold')
            .text(value, ML + 220, y, {
              width: 120,
              lineBreak: false,
            });
          y += 18;
        }
      } else {
        // No ALM data available
        doc.rect(ML, y, CW, 140).fill('#F0F9FF');
        doc.rect(ML, y, 4, 140).fill('#1ABFFF');

        doc
          .fill('#1B3A6B')
          .font('Helvetica-Bold')
          .fontSize(14)
          .text(
            t('Conecte el Analisis ALM', 'Connect ALM Analysis'),
            ML + 20,
            y + 20,
            { width: CW - 40 },
          );
        doc
          .fill('#475569')
          .font('Helvetica')
          .fontSize(10)
          .text(
            t(
              'Para visualizar el impacto de las cuentas por pagar en su posicion de liquidez (LCR actual vs proyectado, HQLA, flujos netos), conecte su analisis ALM desde el modulo de Gestion de Activos y Pasivos.',
              'To view the impact of accounts payable on your liquidity position (current vs projected LCR, HQLA, net outflows), connect your ALM analysis from the Asset Liability Management module.',
            ),
            ML + 20,
            y + 45,
            { width: CW - 40 },
          );

        doc
          .fill('#1ABFFF')
          .font('Helvetica-Bold')
          .fontSize(9)
          .text(
            t(
              'Modulo ALM → app.cerniq.io/alm',
              'ALM Module → app.cerniq.io/alm',
            ),
            ML + 20,
            y + 100,
            { width: CW - 40 },
          );
      }

      // ═══════════════════════════════════════════════════════════
      // PAGE 6: RECOMMENDATIONS
      // ═══════════════════════════════════════════════════════════
      doc.addPage();
      y = pageHeader(t('RECOMENDACIONES', 'RECOMMENDATIONS'));
      drawFooter();

      doc
        .font('Helvetica')
        .fontSize(9)
        .fill('#475569')
        .text(
          t(
            'Las siguientes recomendaciones se basan en los hallazgos identificados durante el analisis de cuentas por pagar.',
            'The following recommendations are based on findings identified during the accounts payable analysis.',
          ),
          ML,
          y,
          { width: CW },
        );
      y += 25;

      // Generate recommendations based on findings
      const recommendations = this.generateRecommendations(
        analysis,
        lcrImpact,
        isEs,
      );

      const priorityColors: Record<string, string> = {
        HIGH: '#DC2626',
        MEDIUM: '#D97706',
        LOW: '#16A34A',
      };

      for (let i = 0; i < Math.min(recommendations.length, 5); i++) {
        const rec = recommendations[i];
        const pClr = priorityColors[rec.priority] || '#D97706';

        // Number circle
        doc.circle(ML + 14, y + 12, 14).fill('#1B3A6B');
        doc
          .fill('#FFFFFF')
          .font('Helvetica-Bold')
          .fontSize(13)
          .text(`${i + 1}`, ML + 4, y + 5, {
            width: 20,
            align: 'center',
          });

        // Priority badge
        doc.rect(ML + 38, y, 55, 16).fill(pClr);
        doc
          .fill('#FFFFFF')
          .font('Helvetica-Bold')
          .fontSize(7)
          .text(rec.priority, ML + 38, y + 4, {
            width: 55,
            align: 'center',
          });

        // Responsible party
        doc
          .fill('#64748B')
          .font('Helvetica')
          .fontSize(7)
          .text(rec.responsible, ML + 100, y + 3, { lineBreak: false });

        // Timeline
        doc
          .fill('#94A3B8')
          .font('Helvetica')
          .fontSize(7)
          .text(rec.timeline, PW - MR - 80, y + 3, {
            width: 80,
            align: 'right',
            lineBreak: false,
          });

        // Recommendation text
        doc
          .fill('#1F2937')
          .font('Helvetica')
          .fontSize(10)
          .text(rec.action, ML + 38, y + 20, { width: CW - 45 });
        const recH = doc.heightOfString(rec.action, { width: CW - 45 });
        y += Math.max(45, recH + 32);
      }

      // Methodology note
      y = Math.max(y + 15, 560);
      doc
        .moveTo(ML, y)
        .lineTo(PW - MR, y)
        .strokeColor('#D1D5DB')
        .lineWidth(0.5)
        .stroke();
      y += 12;

      doc
        .fill('#94A3B8')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(t('METODOLOGIA', 'METHODOLOGY'), ML, y);
      y += 12;
      doc
        .fill('#94A3B8')
        .font('Helvetica')
        .fontSize(7)
        .text(
          t(
            'Este informe fue generado utilizando el motor de deteccion de anomalias de CERNIQ, que aplica 7 detectores independientes (duplicados, anomalias de monto, facturacion fraccionada, concentracion de proveedores, anomalias de frecuencia, proveedores inactivos reactivados, y categorias no autorizadas) sobre los datos de cuentas por pagar de la organizacion.',
            "This report was generated using the CERNIQ anomaly detection engine, which applies 7 independent detectors (duplicates, amount anomalies, split billing, vendor concentration, frequency anomalies, dormant vendor reactivation, and unauthorized categories) to the organization's accounts payable data.",
          ),
          ML,
          y,
          { width: CW },
        );

      // Signature / disclaimer
      y += 40;
      doc
        .fill('#94A3B8')
        .font('Helvetica')
        .fontSize(8)
        .text(
          t(
            'Generado por CERNIQ — Plataforma de Inteligencia de Riesgo',
            'Generated by CERNIQ — Risk Intelligence Platform',
          ),
          ML,
          y,
          { width: CW, align: 'center' },
        );
      y += 12;
      doc
        .fill('#94A3B8')
        .font('Helvetica')
        .fontSize(7)
        .text('KLYTICS LLC, San Juan, Puerto Rico', ML, y, {
          width: CW,
          align: 'center',
        });
      y += 10;
      doc
        .fill('#94A3B8')
        .font('Helvetica')
        .fontSize(7)
        .text(
          `${t('Generado', 'Generated')}: ${new Date().toISOString()} | CERNIQ v1.0`,
          ML,
          y,
          { width: CW, align: 'center' },
        );

      doc.end();
    });
  }

  /**
   * Map finding types to human-readable labels.
   */
  private findingTypeLabel(type: string, isEs: boolean): string {
    const labels: Record<string, [string, string]> = {
      DUPLICATE_INVOICE: ['Factura Duplicada', 'Duplicate Invoice'],
      AMOUNT_ANOMALY: ['Anomalia de Monto', 'Amount Anomaly'],
      SPLIT_BILLING: ['Facturacion Fraccionada', 'Split Billing'],
      VENDOR_CONCENTRATION: ['Concentracion', 'Concentration'],
      FREQUENCY_ANOMALY: ['Anomalia Frecuencia', 'Frequency Anomaly'],
      DORMANT_VENDOR_REACTIVATED: ['Proveedor Inactivo', 'Dormant Vendor'],
      UNAUTHORIZED_CATEGORY: ['Categoria No Autorizada', 'Unauth. Category'],
    };
    const pair = labels[type];
    if (pair) return isEs ? pair[0] : pair[1];
    return type.replace(/_/g, ' ').slice(0, 18);
  }

  /**
   * Generate context-aware recommendations based on analysis results.
   */
  private generateRecommendations(
    analysis: APAnalysisResult,
    lcrImpact: ApLcrImpact | null,
    isEs: boolean,
  ): {
    action: string;
    responsible: string;
    priority: string;
    timeline: string;
  }[] {
    const recs: {
      action: string;
      responsible: string;
      priority: string;
      timeline: string;
    }[] = [];

    const t = (es: string, en: string) => (isEs ? es : en);

    // 1. Duplicate recovery
    const dupeFindings = analysis.findings.filter(
      (f) => f.findingType === 'DUPLICATE_INVOICE',
    );
    const dupeRecovery = dupeFindings.reduce(
      (s, f) => s + f.estimatedRecovery,
      0,
    );
    if (dupeFindings.length > 0) {
      recs.push({
        action: t(
          `Iniciar recuperacion de ${dupeFindings.length} facturas duplicadas detectadas con un potencial de recuperacion de $${dupeRecovery.toFixed(0)}. Contactar proveedores afectados para solicitar notas de credito.`,
          `Initiate recovery of ${dupeFindings.length} detected duplicate invoices with a recovery potential of $${dupeRecovery.toFixed(0)}. Contact affected vendors to request credit memos.`,
        ),
        responsible: t('Equipo AP / CFO', 'AP Team / CFO'),
        priority: 'HIGH',
        timeline: t('Inmediato', 'Immediate'),
      });
    }

    // 2. Vendor concentration
    const concFindings = analysis.findings.filter(
      (f) => f.findingType === 'VENDOR_CONCENTRATION',
    );
    if (concFindings.length > 0) {
      recs.push({
        action: t(
          `Diversificar la base de proveedores. ${concFindings.length} proveedor(es) exceden el umbral de concentracion del 25%. Evaluar alternativas competitivas y establecer limites de concentracion.`,
          `Diversify the vendor base. ${concFindings.length} vendor(s) exceed the 25% concentration threshold. Evaluate competitive alternatives and establish concentration limits.`,
        ),
        responsible: t('Oficial de Compras', 'Procurement Officer'),
        priority: 'HIGH',
        timeline: t('30 dias', '30 days'),
      });
    }

    // 3. Amount anomalies
    const amountFindings = analysis.findings.filter(
      (f) => f.findingType === 'AMOUNT_ANOMALY',
    );
    if (amountFindings.length > 0) {
      recs.push({
        action: t(
          `Investigar ${amountFindings.length} anomalias de monto detectadas. Verificar autorizaciones de pago y comparar contra ordenes de compra originales.`,
          `Investigate ${amountFindings.length} detected amount anomalies. Verify payment authorizations and compare against original purchase orders.`,
        ),
        responsible: t('Auditor Interno', 'Internal Auditor'),
        priority: 'MEDIUM',
        timeline: t('15 dias', '15 days'),
      });
    }

    // 4. LCR impact
    if (lcrImpact && lcrImpact.alertLevel !== 'SAFE') {
      recs.push({
        action: t(
          `Monitorear el impacto de las obligaciones AP en el LCR. El nivel proyectado de ${lcrImpact.projectedLcr.toFixed(1)}% esta en nivel ${lcrImpact.alertLevel}. Coordinar calendario de pagos con Tesoreria.`,
          `Monitor the AP obligations impact on LCR. The projected level of ${lcrImpact.projectedLcr.toFixed(1)}% is at ${lcrImpact.alertLevel} level. Coordinate payment schedule with Treasury.`,
        ),
        responsible: t('Tesorero / CFO', 'Treasurer / CFO'),
        priority: lcrImpact.alertLevel === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
        timeline: t('Continuo', 'Ongoing'),
      });
    }

    // 5. General controls
    recs.push({
      action: t(
        'Implementar controles automaticos de coincidencia triple (3-way match) para todas las facturas superiores a $1,000 y programar auditorias trimestrales de AP utilizando CERNIQ SpendCheck.',
        'Implement automated 3-way match controls for all invoices over $1,000 and schedule quarterly AP audits using CERNIQ SpendCheck.',
      ),
      responsible: t('Director de Finanzas', 'Finance Director'),
      priority: 'LOW',
      timeline: t('60 dias', '60 days'),
    });

    return recs;
  }
}
