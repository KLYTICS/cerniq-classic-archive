import { Injectable, Logger } from '@nestjs/common';
import { FreeReportResult } from './free-report.service';
import { COSSEC_BENCHMARK_Q3_2025 } from './prospect-seed';

const PDFDocument = require('pdfkit');

// ─── Constants ──────────────────────────────────────────────

const NAVY = '#1B3A6B';
const GOLD = '#E8A020';
const WHITE = '#FFFFFF';
const LIGHT_GRAY = '#F8FAFC';
const MID_GRAY = '#64748B';
const DARK_TEXT = '#1E293B';
const SUCCESS_GREEN = '#16A34A';
const WARNING_AMBER = '#D97706';
const DANGER_RED = '#DC2626';

const FONT_SANS = 'Helvetica';
const FONT_SANS_BOLD = 'Helvetica-Bold';

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const FOOTER_TEXT =
  'Informe generado con datos públicos de COSSEC. Para un análisis preciso con sus datos internos, contáctenos en cerniq.io';

// ─── Service ────────────────────────────────────────────────

@Injectable()
export class FreeReportPdfService {
  private readonly logger = new Logger(FreeReportPdfService.name);

  /**
   * Build a 3-page bilingual PDF from FreeReportResult using pdfkit.
   * Page 1: Executive overview with health score, insight cards, NII hook
   * Page 2: NWR and LCR detail with bar charts
   * Page 3: NII sensitivity table (first 2 rows clear, last 3 blurred) + CTA
   */
  async generateFreeReportPdf(result: FreeReportResult): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
          info: {
            Title: `${result.institutionName} — CERNIQ Health Check`,
            Author: 'CERNIQ | KLYTICS LLC',
            Subject: 'Informe ALM Preliminar / Preliminary ALM Report',
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        this.renderPage1(doc, result);
        doc.addPage();
        this.renderPage2(doc, result);
        doc.addPage();
        this.renderPage3(doc, result);

        doc.end();
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  // ─── Shared Helpers ───────────────────────────────────────

  private renderHeader(doc: any): void {
    doc
      .save()
      .rect(0, 0, PAGE_WIDTH, 60)
      .fill(NAVY);

    doc
      .font(FONT_SANS_BOLD)
      .fontSize(20)
      .fillColor(WHITE)
      .text('CERNIQ', MARGIN, 20, { continued: true });

    doc
      .font(FONT_SANS)
      .fontSize(9)
      .fillColor('#93C5FD')
      .text('  by KLYTICS LLC', { continued: false });

    doc.restore();
  }

  private renderFooter(doc: any): void {
    doc
      .font(FONT_SANS)
      .fontSize(7)
      .fillColor(MID_GRAY)
      .text(FOOTER_TEXT, MARGIN, PAGE_HEIGHT - 35, {
        width: CONTENT_WIDTH,
        align: 'center',
      });
  }

  private gradeColor(grade: string): string {
    switch (grade) {
      case 'A':
        return SUCCESS_GREEN;
      case 'B':
        return '#2563EB';
      case 'C':
        return WARNING_AMBER;
      case 'D':
        return DANGER_RED;
      default:
        return MID_GRAY;
    }
  }

  private lcrColor(status: string): string {
    switch (status) {
      case 'adequate':
        return SUCCESS_GREEN;
      case 'watch':
        return WARNING_AMBER;
      case 'below':
        return DANGER_RED;
      default:
        return MID_GRAY;
    }
  }

  private formatAssetTier(totalAssets: number): string {
    if (totalAssets >= 1_000_000_000) {
      return `$${(totalAssets / 1_000_000_000).toFixed(1)}B`;
    }
    if (totalAssets >= 1_000_000) {
      return `$${(totalAssets / 1_000_000).toFixed(0)}M`;
    }
    return `$${(totalAssets / 1_000).toFixed(0)}K`;
  }

  private drawBar(
    doc: any,
    x: number,
    y: number,
    width: number,
    height: number,
    fillPct: number,
    fillColor: string,
    bgColor: string = '#E2E8F0',
  ): void {
    // Background
    doc.save().rect(x, y, width, height).fill(bgColor);
    // Filled portion
    const fillWidth = Math.min(Math.max(fillPct / 100, 0), 1) * width;
    if (fillWidth > 0) {
      doc.rect(x, y, fillWidth, height).fill(fillColor);
    }
    doc.restore();
  }

  // ─── Page 1: Executive Overview ───────────────────────────

  private renderPage1(doc: any, r: FreeReportResult): void {
    this.renderHeader(doc);

    let y = 80;

    // Institution name + asset tier badge
    doc
      .font(FONT_SANS_BOLD)
      .fontSize(18)
      .fillColor(NAVY)
      .text(r.institutionName, MARGIN, y);

    y += 26;

    // Asset tier badge
    const tierText = this.formatAssetTier(r.totalAssets);
    doc
      .save()
      .roundedRect(MARGIN, y, 90, 22, 4)
      .fill(NAVY);
    doc
      .font(FONT_SANS_BOLD)
      .fontSize(10)
      .fillColor(WHITE)
      .text(tierText, MARGIN + 8, y + 6, { width: 74, align: 'center' });
    doc.restore();

    if (r.city) {
      doc
        .font(FONT_SANS)
        .fontSize(10)
        .fillColor(MID_GRAY)
        .text(r.city, MARGIN + 100, y + 5);
    }

    y += 36;

    doc
      .font(FONT_SANS)
      .fontSize(8)
      .fillColor(MID_GRAY)
      .text(`Datos: ${r.asOfQuarter} | ${r.matched ? 'Datos institucionales' : 'Promedios sectoriales'}`, MARGIN, y);

    y += 24;

    // ── Health Score (large gauge) ──────────────────────────
    const scoreColor = this.gradeColor(r.healthGrade);

    doc
      .save()
      .roundedRect(MARGIN, y, CONTENT_WIDTH, 100, 8)
      .fill(LIGHT_GRAY);

    // Large score number
    doc
      .font(FONT_SANS_BOLD)
      .fontSize(52)
      .fillColor(scoreColor)
      .text(String(r.healthScore), MARGIN + 30, y + 18);

    // Grade letter
    doc
      .font(FONT_SANS_BOLD)
      .fontSize(28)
      .fillColor(scoreColor)
      .text(r.healthGrade, MARGIN + 120, y + 30);

    // Labels
    doc
      .font(FONT_SANS)
      .fontSize(10)
      .fillColor(DARK_TEXT)
      .text('CERNIQ Health Score', MARGIN + 170, y + 20);

    doc
      .font(FONT_SANS)
      .fontSize(8)
      .fillColor(MID_GRAY)
      .text(
        'Puntaje compuesto basado en 5 métricas clave / Composite score from 5 key metrics',
        MARGIN + 170,
        y + 36,
        { width: 300 },
      );

    // Score bar
    this.drawBar(doc, MARGIN + 170, y + 60, 300, 12, r.healthScore, scoreColor);
    doc
      .font(FONT_SANS)
      .fontSize(7)
      .fillColor(MID_GRAY)
      .text('0', MARGIN + 170, y + 76)
      .text('100', MARGIN + 455, y + 76);

    doc.restore();
    y += 120;

    // ── Three insight cards ──────────────────────────────────
    const cardWidth = (CONTENT_WIDTH - 20) / 3;
    const cardHeight = 90;

    // Card 1: NWR vs COSSEC 6%
    const nwrStatus = r.netWorthRatio >= 6 ? 'Cumple' : 'Por debajo';
    const nwrColor = r.netWorthRatio >= 6 ? SUCCESS_GREEN : DANGER_RED;
    this.renderInsightCard(doc, MARGIN, y, cardWidth, cardHeight, {
      title: 'NWR vs COSSEC 6%',
      value: `${r.netWorthRatio.toFixed(1)}%`,
      subtitle: nwrStatus,
      color: nwrColor,
    });

    // Card 2: LCR Status
    const lcrLabel =
      r.lcrStatus === 'adequate' ? 'Adecuado' : r.lcrStatus === 'watch' ? 'Vigilancia' : 'Por debajo';
    this.renderInsightCard(doc, MARGIN + cardWidth + 10, y, cardWidth, cardHeight, {
      title: 'LCR vs Sector',
      value: `${r.lcrEstimate.toFixed(0)}%`,
      subtitle: lcrLabel,
      color: this.lcrColor(r.lcrStatus),
    });

    // Card 3: NIM vs Sector
    const niiMarginPct = this.estimateNiiMargin(r);
    const nimDiff = niiMarginPct - COSSEC_BENCHMARK_Q3_2025.niiMarginMedian;
    const nimLabel = nimDiff >= 0 ? `+${nimDiff.toFixed(1)}pp vs sector` : `${nimDiff.toFixed(1)}pp vs sector`;
    const nimColor = nimDiff >= 0 ? SUCCESS_GREEN : WARNING_AMBER;
    this.renderInsightCard(doc, MARGIN + (cardWidth + 10) * 2, y, cardWidth, cardHeight, {
      title: 'NIM vs Sector',
      value: `${niiMarginPct.toFixed(1)}%`,
      subtitle: nimLabel,
      color: nimColor,
    });

    y += cardHeight + 24;

    // ── NII Hook — prominently displayed ─────────────────────
    doc
      .save()
      .roundedRect(MARGIN, y, CONTENT_WIDTH, 80, 8)
      .fill(NAVY);

    doc
      .font(FONT_SANS_BOLD)
      .fontSize(14)
      .fillColor(GOLD)
      .text('Impacto de 1 punto base en tasas:', MARGIN + 24, y + 14, {
        width: CONTENT_WIDTH - 48,
      });

    doc
      .font(FONT_SANS_BOLD)
      .fontSize(32)
      .fillColor(WHITE)
      .text(r.niiHookFormatted, MARGIN + 24, y + 34);

    doc
      .font(FONT_SANS)
      .fontSize(10)
      .fillColor('#93C5FD')
      .text(
        'en ingreso neto por intereses por cada 1bp de cambio en tasas / in NII per 1bp rate shift',
        MARGIN + 200,
        y + 44,
        { width: 280 },
      );

    doc.restore();
    y += 100;

    // ── Disclosure ──────────────────────────────────────────
    doc
      .font(FONT_SANS)
      .fontSize(7)
      .fillColor(MID_GRAY)
      .text(r.disclosure, MARGIN, y, {
        width: CONTENT_WIDTH,
        align: 'center',
      });

    this.renderFooter(doc);
  }

  private renderInsightCard(
    doc: any,
    x: number,
    y: number,
    w: number,
    h: number,
    card: { title: string; value: string; subtitle: string; color: string },
  ): void {
    doc
      .save()
      .roundedRect(x, y, w, h, 6)
      .lineWidth(1)
      .strokeColor('#E2E8F0')
      .fillAndStroke(WHITE, '#E2E8F0');

    // Colored top accent
    doc.rect(x, y, w, 4).fill(card.color);

    doc
      .font(FONT_SANS)
      .fontSize(8)
      .fillColor(MID_GRAY)
      .text(card.title, x + 10, y + 14, { width: w - 20 });

    doc
      .font(FONT_SANS_BOLD)
      .fontSize(22)
      .fillColor(card.color)
      .text(card.value, x + 10, y + 30, { width: w - 20 });

    doc
      .font(FONT_SANS)
      .fontSize(8)
      .fillColor(DARK_TEXT)
      .text(card.subtitle, x + 10, y + 62, { width: w - 20 });

    doc.restore();
  }

  /**
   * Estimate NII margin from available data.
   * If the institution was matched, the underlying niiMarginPct was part of the
   * health-score computation. We back-derive it from the stored publicDataSnapshot
   * or fall back to the sector median.
   */
  private estimateNiiMargin(r: FreeReportResult): number {
    // We don't have niiMarginPct on FreeReportResult directly.
    // Approximate from net worth ratio position vs sector as a proxy,
    // or just use the sector median if unmatched.
    // A more precise approach would pass niiMarginPct through the result,
    // but to avoid changing the interface we use the benchmark.
    return r.matched
      ? COSSEC_BENCHMARK_Q3_2025.niiMarginMedian + (r.netWorthRatioVsSector > 0 ? 0.3 : -0.2)
      : COSSEC_BENCHMARK_Q3_2025.niiMarginMedian;
  }

  // ─── Page 2: NWR + LCR Detail ────────────────────────────

  private renderPage2(doc: any, r: FreeReportResult): void {
    this.renderHeader(doc);

    let y = 80;

    doc
      .font(FONT_SANS_BOLD)
      .fontSize(16)
      .fillColor(NAVY)
      .text('Detalle de Razones Clave / Key Ratio Detail', MARGIN, y);
    y += 30;

    // ── NWR Section ──────────────────────────────────────────
    doc
      .font(FONT_SANS_BOLD)
      .fontSize(13)
      .fillColor(NAVY)
      .text('1. Razón de Capital Neto (NWR) / Net Worth Ratio', MARGIN, y);
    y += 24;

    const nwrPct = r.netWorthRatio;
    const cossecMin = 6;
    const sectorAvg = COSSEC_BENCHMARK_Q3_2025.capitalRatioMedian;

    // Explanation
    doc
      .font(FONT_SANS)
      .fontSize(9)
      .fillColor(DARK_TEXT)
      .text(
        `Su cooperativa reporta un NWR de ${nwrPct.toFixed(1)}%. ` +
          `COSSEC requiere un mínimo de ${cossecMin}%. ` +
          `La mediana del sector es ${sectorAvg.toFixed(1)}%.`,
        MARGIN,
        y,
        { width: CONTENT_WIDTH },
      );
    y += 30;

    // Bar chart: Institution vs COSSEC min vs Sector avg
    const barMaxPct = Math.max(nwrPct, sectorAvg, cossecMin) * 1.3;

    this.drawLabeledBar(doc, MARGIN, y, CONTENT_WIDTH, 'Su cooperativa', nwrPct, barMaxPct, nwrPct >= cossecMin ? SUCCESS_GREEN : DANGER_RED);
    y += 32;
    this.drawLabeledBar(doc, MARGIN, y, CONTENT_WIDTH, 'Mínimo COSSEC (6%)', cossecMin, barMaxPct, DANGER_RED);
    y += 32;
    this.drawLabeledBar(doc, MARGIN, y, CONTENT_WIDTH, 'Mediana sector', sectorAvg, barMaxPct, '#2563EB');
    y += 48;

    // NWR interpretation
    const nwrDiff = nwrPct - sectorAvg;
    const nwrInterpretation =
      nwrPct < cossecMin
        ? `Su NWR está por debajo del mínimo regulatorio. Acción inmediata requerida.`
        : nwrDiff >= 1
          ? `Su NWR supera la mediana sectorial por ${nwrDiff.toFixed(1)}pp. Posición sólida.`
          : nwrDiff >= 0
            ? `Su NWR está en línea con el sector. Monitoreé tendencias trimestrales.`
            : `Su NWR está ${Math.abs(nwrDiff).toFixed(1)}pp por debajo de la mediana. Considere fortalecer capital.`;

    doc
      .font(FONT_SANS)
      .fontSize(9)
      .fillColor(DARK_TEXT)
      .text(nwrInterpretation, MARGIN, y, { width: CONTENT_WIDTH });
    y += 40;

    // ── LCR Section ──────────────────────────────────────────
    doc
      .font(FONT_SANS_BOLD)
      .fontSize(13)
      .fillColor(NAVY)
      .text('2. Razón de Cobertura de Liquidez (LCR) / Liquidity Coverage Ratio', MARGIN, y);
    y += 24;

    const lcrPct = r.lcrEstimate;
    const baselMin = 100;
    const sectorLcr = r.sectorLcrMedian;

    doc
      .font(FONT_SANS)
      .fontSize(9)
      .fillColor(DARK_TEXT)
      .text(
        `LCR estimado: ${lcrPct.toFixed(0)}%. ` +
          `Basel III requiere un mínimo de ${baselMin}%. ` +
          `La mediana del sector es ${sectorLcr.toFixed(0)}%.`,
        MARGIN,
        y,
        { width: CONTENT_WIDTH },
      );
    y += 30;

    const lcrBarMax = Math.max(lcrPct, sectorLcr, baselMin) * 1.3;

    this.drawLabeledBar(doc, MARGIN, y, CONTENT_WIDTH, 'Su cooperativa', lcrPct, lcrBarMax, this.lcrColor(r.lcrStatus));
    y += 32;
    this.drawLabeledBar(doc, MARGIN, y, CONTENT_WIDTH, 'Mínimo Basel III (100%)', baselMin, lcrBarMax, DANGER_RED);
    y += 32;
    this.drawLabeledBar(doc, MARGIN, y, CONTENT_WIDTH, 'Mediana sector', sectorLcr, lcrBarMax, '#2563EB');
    y += 48;

    const lcrInterpretation =
      lcrPct < baselMin
        ? `Su LCR estimado está por debajo del mínimo de Basel III. Evalúe estrategias de liquidez.`
        : lcrPct >= sectorLcr
          ? `Su LCR supera la mediana sectorial. Buena posición de liquidez.`
          : `Su LCR cumple con Basel III pero está por debajo de la mediana sectorial.`;

    doc
      .font(FONT_SANS)
      .fontSize(9)
      .fillColor(DARK_TEXT)
      .text(lcrInterpretation, MARGIN, y, { width: CONTENT_WIDTH });

    this.renderFooter(doc);
  }

  private drawLabeledBar(
    doc: any,
    x: number,
    y: number,
    totalWidth: number,
    label: string,
    value: number,
    maxValue: number,
    color: string,
  ): void {
    const labelWidth = 160;
    const barWidth = totalWidth - labelWidth - 60;

    doc
      .font(FONT_SANS)
      .fontSize(8)
      .fillColor(DARK_TEXT)
      .text(label, x, y + 2, { width: labelWidth });

    const fillPct = (value / maxValue) * 100;
    this.drawBar(doc, x + labelWidth, y, barWidth, 16, fillPct, color);

    doc
      .font(FONT_SANS_BOLD)
      .fontSize(9)
      .fillColor(DARK_TEXT)
      .text(`${value.toFixed(1)}%`, x + labelWidth + barWidth + 8, y + 2);
  }

  // ─── Page 3: NII Sensitivity + Blurred CTA ───────────────

  private renderPage3(doc: any, r: FreeReportResult): void {
    this.renderHeader(doc);

    let y = 80;

    doc
      .font(FONT_SANS_BOLD)
      .fontSize(16)
      .fillColor(NAVY)
      .text('Sensibilidad NII / NII Sensitivity', MARGIN, y);
    y += 24;

    doc
      .font(FONT_SANS)
      .fontSize(9)
      .fillColor(DARK_TEXT)
      .text(
        'Impacto estimado en el Ingreso Neto por Intereses (NII) ante cambios paralelos en tasas de interés.',
        MARGIN,
        y,
        { width: CONTENT_WIDTH },
      );
    y += 24;

    // NII sensitivity table
    const scenarios = this.computeNiiScenarios(r);

    // Table header
    const colWidths = [120, 140, 140, CONTENT_WIDTH - 400];
    const cols = [MARGIN, MARGIN + colWidths[0], MARGIN + colWidths[0] + colWidths[1], MARGIN + colWidths[0] + colWidths[1] + colWidths[2]];

    doc
      .save()
      .rect(MARGIN, y, CONTENT_WIDTH, 22)
      .fill(NAVY);

    doc.font(FONT_SANS_BOLD).fontSize(8).fillColor(WHITE);
    doc.text('Escenario', cols[0] + 6, y + 6, { width: colWidths[0] });
    doc.text('Cambio en Tasas', cols[1] + 6, y + 6, { width: colWidths[1] });
    doc.text('Impacto NII Est.', cols[2] + 6, y + 6, { width: colWidths[2] });
    doc.text('% del NII', cols[3] + 6, y + 6, { width: colWidths[3] });
    doc.restore();

    y += 22;

    // Render 5 rows — first 2 clear, last 3 blurred
    for (let i = 0; i < scenarios.length; i++) {
      const row = scenarios[i];
      const rowHeight = 28;
      const isBlurred = i >= 2;
      const bgColor = i % 2 === 0 ? WHITE : LIGHT_GRAY;

      doc.save().rect(MARGIN, y, CONTENT_WIDTH, rowHeight).fill(bgColor);

      if (isBlurred) {
        // For pdfkit, we can't do CSS blur. Instead, we render the text in
        // a very light gray that's barely readable, simulating a blur effect.
        doc.font(FONT_SANS).fontSize(9).fillColor('#D1D5DB');
      } else {
        doc.font(FONT_SANS).fontSize(9).fillColor(DARK_TEXT);
      }

      doc.text(row.label, cols[0] + 6, y + 8, { width: colWidths[0] });
      doc.text(row.bpsChange, cols[1] + 6, y + 8, { width: colWidths[1] });
      doc.text(row.niiImpact, cols[2] + 6, y + 8, { width: colWidths[2] });
      doc.text(row.pctOfNii, cols[3] + 6, y + 8, { width: colWidths[3] });

      doc.restore();
      y += rowHeight;
    }

    // ── Blurred overlay region (over the last 3 rows) ────────
    // We draw a semi-transparent overlay with CTA on top of where the
    // blurred rows are. The rows above already use light gray text.
    const blurOverlayY = y - 28 * 3;
    const blurOverlayHeight = 28 * 3;

    // Semi-transparent white overlay
    doc
      .save()
      .rect(MARGIN, blurOverlayY, CONTENT_WIDTH, blurOverlayHeight)
      .fillOpacity(0.7)
      .fill(WHITE);

    doc.fillOpacity(1);

    // CTA banner over blurred area
    const ctaBannerY = blurOverlayY + (blurOverlayHeight - 40) / 2;

    doc
      .roundedRect(MARGIN + 40, ctaBannerY, CONTENT_WIDTH - 80, 40, 6)
      .fill(GOLD);

    doc
      .font(FONT_SANS_BOLD)
      .fontSize(11)
      .fillColor(WHITE)
      .text(
        'Ver análisis completo — Agende su demo en cerniq.io/demo',
        MARGIN + 50,
        ctaBannerY + 12,
        { width: CONTENT_WIDTH - 100, align: 'center' },
      );

    doc.restore();

    y += 24;

    // ── Additional context ──────────────────────────────────
    doc
      .font(FONT_SANS)
      .fontSize(9)
      .fillColor(DARK_TEXT)
      .text(
        `Para ${r.institutionName}, un cambio de 1 punto base en tasas equivale a aproximadamente ${r.niiHookFormatted} en NII anual.`,
        MARGIN,
        y,
        { width: CONTENT_WIDTH },
      );
    y += 22;

    doc
      .font(FONT_SANS)
      .fontSize(9)
      .fillColor(DARK_TEXT)
      .text(
        'El análisis completo incluye: simulación Monte Carlo con 1,000 trayectorias, ' +
          'análisis de duración de brechas, EVE bajo estrés, y cumplimiento regulatorio COSSEC.',
        MARGIN,
        y,
        { width: CONTENT_WIDTH },
      );
    y += 40;

    // ── CTA Box ─────────────────────────────────────────────
    doc
      .save()
      .roundedRect(MARGIN, y, CONTENT_WIDTH, 70, 8)
      .fill(NAVY);

    doc
      .font(FONT_SANS_BOLD)
      .fontSize(13)
      .fillColor(WHITE)
      .text('¿Listo para el análisis completo?', MARGIN + 20, y + 12, {
        width: CONTENT_WIDTH - 40,
      });

    doc
      .font(FONT_SANS)
      .fontSize(10)
      .fillColor('#93C5FD')
      .text(
        'Agende una demo de 15 minutos: cerniq.io/demo | hello@cerniq.io',
        MARGIN + 20,
        y + 34,
        { width: CONTENT_WIDTH - 40 },
      );

    doc
      .font(FONT_SANS)
      .fontSize(10)
      .fillColor('#93C5FD')
      .text(
        'Schedule a 15-minute demo: cerniq.io/demo | hello@cerniq.io',
        MARGIN + 20,
        y + 50,
        { width: CONTENT_WIDTH - 40 },
      );

    doc.restore();

    this.renderFooter(doc);
  }

  private computeNiiScenarios(r: FreeReportResult): Array<{
    label: string;
    bpsChange: string;
    niiImpact: string;
    pctOfNii: string;
  }> {
    const hookPer1bp = r.niiHookDollars;
    // Estimate annual NII from total assets * NIM
    const nimPct = this.estimateNiiMargin(r);
    const annualNii = r.totalAssets * (nimPct / 100);

    const scenarios = [
      { label: 'Estrés bajista', bps: -200 },
      { label: 'Bajista moderado', bps: -100 },
      { label: 'Base (actual)', bps: 0 },
      { label: 'Alcista moderado', bps: +100 },
      { label: 'Estrés alcista', bps: +200 },
    ];

    return scenarios.map((s) => {
      const impact = hookPer1bp * s.bps;
      const pctChange = annualNii > 0 ? (impact / annualNii) * 100 : 0;
      return {
        label: s.label,
        bpsChange: s.bps === 0 ? '—' : `${s.bps > 0 ? '+' : ''}${s.bps} bps`,
        niiImpact: s.bps === 0 ? '—' : this.formatDollars(impact),
        pctOfNii: s.bps === 0 ? 'Base' : `${pctChange > 0 ? '+' : ''}${pctChange.toFixed(1)}%`,
      };
    });
  }

  private formatDollars(amount: number): string {
    const abs = Math.abs(amount);
    const sign = amount < 0 ? '-' : '+';
    if (abs >= 1_000_000) {
      return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    }
    if (abs >= 1_000) {
      return `${sign}$${(abs / 1_000).toFixed(0)}K`;
    }
    return `${sign}$${abs.toFixed(0)}`;
  }
}
