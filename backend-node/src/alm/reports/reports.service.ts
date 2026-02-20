import { Injectable, Logger } from '@nestjs/common';
import { AlmEnterpriseService } from '../alm-enterprise.service';
import { StressTestingService } from '../stress-testing/stress-testing.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

/** Round to n decimal places */
function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly almEnterprise: AlmEnterpriseService,
    private readonly stressTesting: StressTestingService,
  ) {}

  async generateALMReport(institutionId: string): Promise<Buffer> {
    this.logger.log(`Generating ALM report for institution ${institutionId}`);

    // Fetch all data
    const [summary, stressTest] = await Promise.all([
      this.almEnterprise.getALMSummary(institutionId),
      this.stressTesting.runFullStressTest(institutionId, {
        paths: 500, // fewer paths for report speed
        horizon: 12,
      }),
    ]);

    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'letter',
          margins: { top: 60, bottom: 60, left: 60, right: 60 },
          info: {
            Title: `ALM Risk Report — ${summary.institution.name}`,
            Author: 'CapexCycleOS | KLYTICS',
            Subject: 'Asset Liability Management Risk Report',
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // ─── COVER PAGE ────────────────────────────────
        this.renderCoverPage(doc, summary);

        // ─── SECTION 1: EXECUTIVE SUMMARY ──────────────
        doc.addPage();
        this.renderExecutiveSummary(doc, summary);

        // ─── SECTION 2: INTEREST RATE RISK ─────────────
        doc.addPage();
        this.renderInterestRateRisk(doc, summary);

        // ─── SECTION 3: LIQUIDITY RISK ─────────────────
        doc.addPage();
        this.renderLiquidityRisk(doc, summary);

        // ─── SECTION 4: STRESS TESTING ─────────────────
        doc.addPage();
        this.renderStressTesting(doc, stressTest, summary);

        // ─── SECTION 5: RECOMMENDATIONS ────────────────
        doc.addPage();
        this.renderRecommendations(doc, summary);

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  // ─── Cover Page ──────────────────────────────────────────────

  private renderCoverPage(doc: typeof PDFDocument, summary: {
    institution: { name: string; type: string; totalAssets: number; currency: string; reportingDate: string };
    riskScore: number;
  }) {
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Brand bar
    doc.rect(0, 0, doc.page.width, 8).fill('#f59e0b');

    doc.moveDown(6);

    // Logo area
    doc.fontSize(14).fillColor('#94a3b8').text('CAPEXCYCLEOS', { align: 'center' });
    doc.fontSize(10).fillColor('#64748b').text('Enterprise Risk Intelligence', { align: 'center' });

    doc.moveDown(4);

    // Title
    doc.fontSize(28).fillColor('#1e293b').text('ALM Risk Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(18).fillColor('#475569').text(summary.institution.name, { align: 'center' });

    doc.moveDown(3);

    // Divider
    const x = doc.page.margins.left + pageWidth * 0.3;
    doc.moveTo(x, doc.y).lineTo(x + pageWidth * 0.4, doc.y).stroke('#e2e8f0');
    doc.moveDown(2);

    // Info
    const reportDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    doc.fontSize(11).fillColor('#64748b');
    doc.text(`Report Date: ${reportDate}`, { align: 'center' });
    doc.text(`Institution Type: ${summary.institution.type.replace('_', ' ')}`, { align: 'center' });
    doc.text(`Total Assets: $${summary.institution.totalAssets.toLocaleString()}M`, { align: 'center' });
    doc.text(`Risk Score: ${summary.riskScore}/100`, { align: 'center' });

    doc.moveDown(6);
    doc.fontSize(9).fillColor('#94a3b8').text('CONFIDENTIAL', { align: 'center' });

    this.renderFooter(doc);
  }

  // ─── Executive Summary ───────────────────────────────────────

  private renderExecutiveSummary(doc: typeof PDFDocument, summary: {
    institution: { name: string; totalAssets: number };
    riskScore: number;
    durationGap: { durationGap: number; riskProfile: string; assetDuration: number; liabilityDuration: number };
    niiSensitivity: { baseNII: number; riskRating: string };
    liquidity: { lcr: number; status: string; buffer: number };
    topRisks: string[];
  }) {
    this.renderSectionHeader(doc, '1', 'EXECUTIVE SUMMARY');

    // Risk score
    const scoreLabel = summary.riskScore >= 80 ? 'Low Risk' :
      summary.riskScore >= 60 ? 'Moderate' :
      summary.riskScore >= 40 ? 'Elevated' : 'High Risk';
    doc.fontSize(12).fillColor('#1e293b');
    doc.text(`Overall Risk Score: ${summary.riskScore}/100 (${scoreLabel})`, { continued: false });
    doc.moveDown(0.5);

    // Narrative
    const profile = summary.durationGap.riskProfile.replace('-', ' ');
    doc.fontSize(10).fillColor('#475569');
    doc.text(
      `${summary.institution.name} is ${profile} with a duration gap of ` +
      `${summary.durationGap.durationGap > 0 ? '+' : ''}${summary.durationGap.durationGap} years. ` +
      `Net interest income base is $${summary.niiSensitivity.baseNII}M with a ` +
      `${summary.niiSensitivity.riskRating} risk rating. ` +
      `Liquidity coverage ratio stands at ${summary.liquidity.lcr}% (${summary.liquidity.status}).`,
    );
    doc.moveDown(1.5);

    // Key Metrics Table
    doc.fontSize(11).fillColor('#1e293b').text('Key Metrics', { underline: true });
    doc.moveDown(0.5);

    const metrics = [
      ['Duration Gap', `${summary.durationGap.durationGap > 0 ? '+' : ''}${summary.durationGap.durationGap} years`],
      ['Asset Duration', `${summary.durationGap.assetDuration} years`],
      ['Liability Duration', `${summary.durationGap.liabilityDuration} years`],
      ['Base NII', `$${summary.niiSensitivity.baseNII}M`],
      ['NII Risk Rating', summary.niiSensitivity.riskRating.toUpperCase()],
      ['LCR', `${summary.liquidity.lcr}%`],
      ['LCR Status', summary.liquidity.status.toUpperCase()],
      ['LCR Buffer', `${summary.liquidity.buffer > 0 ? '+' : ''}${summary.liquidity.buffer}%`],
    ];

    this.renderTable(doc, ['Metric', 'Value'], metrics);

    doc.moveDown(1.5);

    // Top Risks
    doc.fontSize(11).fillColor('#1e293b').text('Top Risks', { underline: true });
    doc.moveDown(0.5);
    summary.topRisks.forEach((risk, i) => {
      doc.fontSize(10).fillColor('#475569').text(`${i + 1}. ${risk}`);
      doc.moveDown(0.3);
    });

    this.renderFooter(doc);
  }

  // ─── Interest Rate Risk ──────────────────────────────────────

  private renderInterestRateRisk(doc: typeof PDFDocument, summary: {
    institution: { name: string };
    durationGap: { durationGap: number; riskProfile: string; assetDuration: number; liabilityDuration: number };
    niiSensitivity: { scenarios: Array<{ name: string; shiftBps: number; niImpact: number; niImpactPct: number; mveImpact: number; mveImpactPct: number }>; baseNII: number; riskRating: string };
  }) {
    this.renderSectionHeader(doc, '2', 'INTEREST RATE RISK');

    // Duration Gap
    doc.fontSize(11).fillColor('#1e293b').text('Duration Gap Analysis', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#475569');
    doc.text(
      `The institution exhibits a ${summary.durationGap.riskProfile.replace('-', ' ')} profile. ` +
      `Asset-weighted duration of ${summary.durationGap.assetDuration} years exceeds ` +
      `liability duration of ${summary.durationGap.liabilityDuration} years, ` +
      `resulting in a duration gap of ${summary.durationGap.durationGap > 0 ? '+' : ''}${summary.durationGap.durationGap} years.`,
    );
    doc.moveDown(1.5);

    // NII Sensitivity Table
    doc.fontSize(11).fillColor('#1e293b').text('NII Sensitivity Scenarios', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#64748b').text(`Base NII: $${summary.niiSensitivity.baseNII}M | Risk Rating: ${summary.niiSensitivity.riskRating.toUpperCase()}`);
    doc.moveDown(0.5);

    const sorted = [...summary.niiSensitivity.scenarios].sort((a, b) => a.shiftBps - b.shiftBps);
    const scenarioRows = sorted.map((s) => [
      s.name,
      `${s.shiftBps > 0 ? '+' : ''}${s.shiftBps} bps`,
      `$${s.niImpact >= 0 ? '+' : ''}${s.niImpact.toFixed(2)}M`,
      `${s.niImpactPct >= 0 ? '+' : ''}${s.niImpactPct.toFixed(2)}%`,
      `$${s.mveImpact >= 0 ? '+' : ''}${s.mveImpact.toFixed(2)}M`,
      `${s.mveImpactPct >= 0 ? '+' : ''}${s.mveImpactPct.toFixed(2)}%`,
    ]);

    this.renderTable(
      doc,
      ['Scenario', 'Shift', 'NII Impact', 'NII %', 'MVE Impact', 'MVE %'],
      scenarioRows,
    );

    this.renderFooter(doc);
  }

  // ─── Liquidity Risk ──────────────────────────────────────────

  private renderLiquidityRisk(doc: typeof PDFDocument, summary: {
    liquidity: { lcr: number; hqla: number; netOutflows: number; status: string; buffer: number };
  }) {
    this.renderSectionHeader(doc, '3', 'LIQUIDITY RISK');

    doc.fontSize(11).fillColor('#1e293b').text('Liquidity Coverage Ratio (LCR)', { underline: true });
    doc.moveDown(0.5);

    const statusLabel = summary.liquidity.status === 'compliant' ? 'COMPLIANT' :
      summary.liquidity.status === 'warning' ? 'WARNING' : 'BREACH';

    doc.fontSize(10).fillColor('#475569');
    doc.text(
      `LCR stands at ${summary.liquidity.lcr}% — ${statusLabel}. ` +
      `Basel III requires a minimum of 100%. ` +
      `Current buffer over minimum is ${summary.liquidity.buffer > 0 ? '+' : ''}${summary.liquidity.buffer}%.`,
    );
    doc.moveDown(1);

    const lcrRows = [
      ['Total HQLA', `$${summary.liquidity.hqla.toFixed(1)}M`],
      ['Net Cash Outflows (30-day)', `$${summary.liquidity.netOutflows.toFixed(1)}M`],
      ['LCR Ratio', `${summary.liquidity.lcr.toFixed(1)}%`],
      ['Compliance Status', statusLabel],
      ['Buffer over Minimum', `${summary.liquidity.buffer > 0 ? '+' : ''}${summary.liquidity.buffer.toFixed(1)}%`],
    ];

    this.renderTable(doc, ['Metric', 'Value'], lcrRows);

    doc.moveDown(1.5);
    doc.fontSize(11).fillColor('#1e293b').text('HQLA Composition (Estimated)', { underline: true });
    doc.moveDown(0.5);

    const hqla = summary.liquidity.hqla;
    const hqlaRows = [
      ['Level 1 (Cash, Govt Bonds)', `$${round(hqla * 0.70, 1)}M`, '70%', 'No haircut'],
      ['Level 2A (Agency MBS)', `$${round(hqla * 0.20, 1)}M`, '20%', '15% haircut'],
      ['Level 2B (Corporate)', `$${round(hqla * 0.10, 1)}M`, '10%', '50% haircut'],
    ];

    this.renderTable(doc, ['Category', 'Amount', 'Share', 'Haircut'], hqlaRows);

    this.renderFooter(doc);
  }

  // ─── Stress Testing ──────────────────────────────────────────

  private renderStressTesting(
    doc: typeof PDFDocument,
    stressTest: { monteCarlo: { niiAtRisk: number; expectedNII: number; worstCaseNII: number; niiDistribution: { p5: number; p25: number; median: number; p75: number; p95: number }; paths: number; horizon: number }; regulatory: { scenarios: Array<{ name: string; description: string; niImpact: number; mveImpact: number; lcrImpact: number; passFailStatus: string }>; overallRating: string } },
    summary: { institution: { name: string } },
  ) {
    this.renderSectionHeader(doc, '4', 'STRESS TESTING');

    // Monte Carlo
    doc.fontSize(11).fillColor('#1e293b').text('Monte Carlo Simulation (Vasicek Model)', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#475569');
    doc.text(
      `${stressTest.monteCarlo.paths} interest rate paths simulated over ${stressTest.monteCarlo.horizon} months. ` +
      `NII at Risk (expected minus 5th percentile): $${stressTest.monteCarlo.niiAtRisk}M.`,
    );
    doc.moveDown(0.5);

    const mcRows = [
      ['Expected NII (Median)', `$${stressTest.monteCarlo.expectedNII}M`],
      ['Worst Case NII (5th %ile)', `$${stressTest.monteCarlo.worstCaseNII}M`],
      ['NII at Risk', `$${stressTest.monteCarlo.niiAtRisk}M`],
      ['25th Percentile', `$${stressTest.monteCarlo.niiDistribution.p25}M`],
      ['75th Percentile', `$${stressTest.monteCarlo.niiDistribution.p75}M`],
      ['95th Percentile', `$${stressTest.monteCarlo.niiDistribution.p95}M`],
    ];

    this.renderTable(doc, ['Metric', 'Value'], mcRows);

    doc.moveDown(1.5);

    // Regulatory scenarios
    doc.fontSize(11).fillColor('#1e293b').text('Regulatory Stress Scenarios', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor('#64748b').text(`Overall Rating: ${stressTest.regulatory.overallRating.toUpperCase()}`);
    doc.moveDown(0.5);

    const regRows = stressTest.regulatory.scenarios.map((s) => [
      s.name,
      `$${s.niImpact >= 0 ? '+' : ''}${s.niImpact}M`,
      `$${s.mveImpact >= 0 ? '+' : ''}${s.mveImpact}M`,
      `${s.lcrImpact.toFixed(1)}%`,
      s.passFailStatus.toUpperCase(),
    ]);

    this.renderTable(
      doc,
      ['Scenario', 'NII Impact', 'MVE Impact', 'LCR', 'Status'],
      regRows,
    );

    this.renderFooter(doc);
  }

  // ─── Recommendations ─────────────────────────────────────────

  private renderRecommendations(doc: typeof PDFDocument, summary: {
    institution: { name: string };
    recommendations: string[];
    riskScore: number;
  }) {
    this.renderSectionHeader(doc, '5', 'RECOMMENDATIONS');

    doc.fontSize(10).fillColor('#475569');
    doc.text(`Based on the comprehensive ALM analysis for ${summary.institution.name} (Risk Score: ${summary.riskScore}/100):`);
    doc.moveDown(1);

    summary.recommendations.forEach((rec, i) => {
      doc.fontSize(10).fillColor('#1e293b').text(`${i + 1}. ${rec}`);
      doc.moveDown(0.5);
    });

    doc.moveDown(2);
    doc.fontSize(9).fillColor('#94a3b8');
    doc.text('This report is generated automatically by CapexCycleOS and should be reviewed by qualified risk management professionals before making decisions.');

    this.renderFooter(doc);
  }

  // ─── Shared Rendering Helpers ────────────────────────────────

  private renderSectionHeader(doc: typeof PDFDocument, num: string, title: string) {
    doc.rect(0, 0, doc.page.width, 8).fill('#f59e0b');
    doc.moveDown(1);
    doc.fontSize(18).fillColor('#1e293b').text(`${num}. ${title}`);
    doc.moveDown(0.3);
    doc.moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .stroke('#e2e8f0');
    doc.moveDown(1);
  }

  private renderTable(doc: typeof PDFDocument, headers: string[], rows: string[][]) {
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidth = pageWidth / headers.length;
    const startX = doc.page.margins.left;
    let y = doc.y;

    // Header row
    doc.fontSize(9).fillColor('#1e293b');
    headers.forEach((h, i) => {
      doc.text(h, startX + i * colWidth, y, {
        width: colWidth - 4,
        align: i === 0 ? 'left' : 'right',
        continued: false,
      });
    });
    y = doc.y + 4;

    // Header line
    doc.moveTo(startX, y).lineTo(startX + pageWidth, y).stroke('#cbd5e1');
    y += 6;

    // Data rows
    doc.fontSize(9).fillColor('#475569');
    rows.forEach((row) => {
      // Check for page break
      if (y > doc.page.height - 80) {
        doc.addPage();
        this.renderFooter(doc);
        y = doc.page.margins.top + 20;
      }

      row.forEach((cell, i) => {
        doc.text(cell, startX + i * colWidth, y, {
          width: colWidth - 4,
          align: i === 0 ? 'left' : 'right',
          continued: false,
        });
      });
      y = doc.y + 3;
    });

    doc.y = y + 4;
  }

  private renderFooter(doc: typeof PDFDocument) {
    const bottom = doc.page.height - 30;
    doc.fontSize(7).fillColor('#94a3b8');
    doc.text(
      'Generated by CapexCycleOS | KLYTICS | Confidential',
      doc.page.margins.left,
      bottom,
      { align: 'center', width: doc.page.width - doc.page.margins.left - doc.page.margins.right },
    );
  }
}
