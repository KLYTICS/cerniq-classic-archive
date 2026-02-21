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

// ── Color palette ──────────────────────────────────────────────────
const COLORS = {
  brand: '#f59e0b',      // amber-500
  brandDark: '#b45309',  // amber-700
  dark: '#0f172a',       // slate-900
  heading: '#1e293b',    // slate-800
  body: '#475569',       // slate-600
  muted: '#94a3b8',      // slate-400
  light: '#f1f5f9',      // slate-100
  border: '#e2e8f0',     // slate-200
  rowAlt: '#f8fafc',     // slate-50
  green: '#16a34a',
  red: '#dc2626',
  greenBg: '#f0fdf4',
  redBg: '#fef2f2',
};

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private pageNum = 0;
  private totalPages = 6; // cover + 5 content pages

  constructor(
    private readonly almEnterprise: AlmEnterpriseService,
    private readonly stressTesting: StressTestingService,
  ) {}

  async generateALMReport(institutionId: string): Promise<Buffer> {
    this.logger.log(`Generating ALM report for institution ${institutionId}`);

    const [summary, stressTest] = await Promise.all([
      this.almEnterprise.getALMSummary(institutionId),
      this.stressTesting.runFullStressTest(institutionId, {
        paths: 500,
        horizon: 12,
      }),
    ]);

    this.pageNum = 0;

    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'letter',
          margins: { top: 60, bottom: 70, left: 60, right: 60 },
          info: {
            Title: `ALM Risk Report — ${summary.institution.name}`,
            Author: 'CapexCycleOS | KLYTICS',
            Subject: 'Asset Liability Management Risk Report',
          },
          bufferPages: true,
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

  private renderCoverPage(
    doc: typeof PDFDocument,
    summary: {
      institution: { name: string; type: string; totalAssets: number; currency: string; reportingDate: string };
      riskScore: number;
      durationGap: { durationGap: number; riskProfile: string };
      niiSensitivity: { baseNII: number; riskRating: string; scenarios: Array<{ shiftBps: number; niImpact: number; niImpactPct: number }> };
      liquidity: { lcr: number; status: string };
    },
  ) {
    const pw = doc.page.width;
    const mL = doc.page.margins.left;
    const mR = doc.page.margins.right;
    const contentWidth = pw - mL - mR;

    // Dark header rectangle — 80px
    doc.rect(0, 0, pw, 80).fill(COLORS.dark);

    // Brand bar at very top
    doc.rect(0, 0, pw, 4).fill(COLORS.brand);

    // Top left: CapexCycleOS
    doc.fontSize(18).fillColor('#ffffff').text('CapexCycleOS', mL, 30, { align: 'left' });

    // Top right: KLYTICS in amber
    doc.fontSize(14).fillColor(COLORS.brand).text('KLYTICS', 0, 33, {
      align: 'right',
      width: pw - mR,
    });

    // Institution name — large
    doc.y = 120;
    doc.fontSize(28).fillColor(COLORS.heading).text(summary.institution.name, mL, 120, {
      width: contentWidth,
    });

    // Subtitle
    doc.moveDown(0.2);
    doc.fontSize(14).fillColor(COLORS.body).text('Asset Liability Management Report', {
      width: contentWidth,
    });

    // Report date
    const reportDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor(COLORS.muted).text(reportDate, { width: contentWidth });

    // Horizontal rule — amber
    doc.moveDown(1);
    const ruleY = doc.y;
    doc.moveTo(mL, ruleY).lineTo(mL + contentWidth, ruleY).lineWidth(2).stroke(COLORS.brand);

    // CONFIDENTIAL
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor(COLORS.muted).text(
      'CONFIDENTIAL — For Internal Use Only',
      mL,
      doc.y,
      { width: contentWidth, align: 'center' },
    );

    // ─── Executive Summary on page 1 ────────────────────────
    doc.moveDown(2);
    doc.fontSize(12).fillColor(COLORS.heading).text('Executive Summary', mL, doc.y);
    doc.moveDown(0.5);

    // Highlight box
    const boxY = doc.y;
    const boxH = 130;
    doc.rect(mL, boxY, contentWidth, boxH).fill('#f8fafc');
    doc.rect(mL, boxY, 4, boxH).fill(COLORS.brand);

    const scoreLabel =
      summary.riskScore >= 80 ? 'LOW RISK' :
      summary.riskScore >= 60 ? 'MODERATE' :
      summary.riskScore >= 40 ? 'ELEVATED' : 'HIGH RISK';

    const lcrStatus = summary.liquidity.status === 'compliant' ? 'COMPLIANT' : 'WARNING';

    const scenario200 = summary.niiSensitivity.scenarios?.find((s) => s.shiftBps === 200);
    const nii200 = scenario200 ? `$${scenario200.niImpact >= 0 ? '+' : ''}${scenario200.niImpact.toFixed(1)}M (${scenario200.niImpactPct >= 0 ? '+' : ''}${scenario200.niImpactPct.toFixed(1)}%)` : 'N/A';

    const summaryRows = [
      ['Overall Risk Score', `${summary.riskScore}/100 — ${scoreLabel}`],
      ['Duration Gap', `${summary.durationGap.durationGap > 0 ? '+' : ''}${summary.durationGap.durationGap} years (${summary.durationGap.riskProfile.replace(/-/g, ' ')})`],
      ['LCR (Basel III)', `${summary.liquidity.lcr.toFixed(1)}% — ${lcrStatus}`],
      ['NII at Risk (+200bps)', nii200],
      ['Total Assets', `$${summary.institution.totalAssets.toLocaleString()}M`],
      ['Report Sections', 'Interest Rate Risk, Liquidity, Stress Testing, Recommendations'],
    ];

    let rowY = boxY + 10;
    summaryRows.forEach(([label, value]) => {
      doc.fontSize(9).fillColor(COLORS.muted).text(label, mL + 16, rowY, { width: 140, continued: false });
      doc.fontSize(9).fillColor(COLORS.heading).text(value, mL + 165, rowY, { width: contentWidth - 180, continued: false });
      rowY += 19;
    });

    doc.y = boxY + boxH + 15;

    // Info block
    const infoItems = [
      ['Institution Type', summary.institution.type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())],
      ['Prepared By', 'KLYTICS | CapexCycleOS'],
      ['Reporting Period', new Date(summary.institution.reportingDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })],
    ];

    infoItems.forEach(([label, value]) => {
      const y = doc.y;
      doc.fontSize(9).fillColor(COLORS.muted).text(label, mL, y, { width: 120, continued: false });
      doc.fontSize(9).fillColor(COLORS.heading).text(value, mL + 130, y, { continued: false });
      doc.y = y + 16;
    });

    // Footer
    doc.fontSize(7).fillColor(COLORS.muted).text(
      'This document contains confidential information intended for authorized recipients only.',
      mL,
      doc.page.height - 85,
      { width: contentWidth, align: 'center' },
    );

    this.renderFooter(doc, summary.institution.name);
  }

  // ─── Executive Summary ───────────────────────────────────────

  private renderExecutiveSummary(
    doc: typeof PDFDocument,
    summary: {
      institution: { name: string; totalAssets: number };
      riskScore: number;
      durationGap: { durationGap: number; riskProfile: string; assetDuration: number; liabilityDuration: number };
      niiSensitivity: { baseNII: number; riskRating: string };
      liquidity: { lcr: number; status: string; buffer: number };
      topRisks: string[];
    },
  ) {
    this.renderSectionHeader(doc, '1', 'EXECUTIVE SUMMARY', 'Key metrics and risk assessment');

    // Risk score highlight box
    const scoreLabel =
      summary.riskScore >= 80 ? 'Low Risk' :
      summary.riskScore >= 60 ? 'Moderate' :
      summary.riskScore >= 40 ? 'Elevated' : 'High Risk';
    const scoreColor = summary.riskScore >= 80 ? COLORS.green : summary.riskScore >= 60 ? COLORS.brand : COLORS.red;

    const boxY = doc.y;
    doc.rect(doc.page.margins.left, boxY, doc.page.width - doc.page.margins.left - doc.page.margins.right, 40)
      .fill('#f8fafc');
    doc.rect(doc.page.margins.left, boxY, 4, 40).fill(scoreColor);
    doc.fontSize(11).fillColor(COLORS.heading).text(
      `Overall Risk Score: ${summary.riskScore}/100`,
      doc.page.margins.left + 16,
      boxY + 8,
    );
    doc.fontSize(10).fillColor(scoreColor).text(scoreLabel, doc.page.margins.left + 16, boxY + 24);
    doc.y = boxY + 50;

    // Narrative
    const profile = summary.durationGap.riskProfile.replace(/-/g, ' ');
    doc.fontSize(10).fillColor(COLORS.body);
    doc.text(
      `${summary.institution.name} is ${profile} with a duration gap of ` +
      `${summary.durationGap.durationGap > 0 ? '+' : ''}${summary.durationGap.durationGap} years. ` +
      `Net interest income base is $${summary.niiSensitivity.baseNII}M with a ` +
      `${summary.niiSensitivity.riskRating} risk rating. ` +
      `Liquidity coverage ratio stands at ${summary.liquidity.lcr}% (${summary.liquidity.status}).`,
    );
    doc.moveDown(1.5);

    // Key Metrics Table
    const metrics = [
      ['Overall Risk Score', `${summary.riskScore}/100 — ${scoreLabel}`],
      ['Duration Gap', `${summary.durationGap.durationGap > 0 ? '+' : ''}${summary.durationGap.durationGap} years (${profile})`],
      ['Asset Duration', `${summary.durationGap.assetDuration} years`],
      ['Liability Duration', `${summary.durationGap.liabilityDuration} years`],
      ['Base NII', `$${summary.niiSensitivity.baseNII}M`],
      ['NII Risk Rating', summary.niiSensitivity.riskRating.toUpperCase()],
      ['LCR Ratio', `${summary.liquidity.lcr}%`],
      ['LCR Status', summary.liquidity.status.toUpperCase()],
      ['LCR Buffer', `${summary.liquidity.buffer > 0 ? '+' : ''}${summary.liquidity.buffer}%`],
    ];

    this.renderStyledTable(doc, ['Metric', 'Value'], metrics);

    doc.moveDown(1.5);

    // Top Risks
    this.renderSubsectionHeader(doc, 'Top Risks');
    doc.moveDown(0.3);
    summary.topRisks.forEach((risk, i) => {
      const y = doc.y;
      doc.fontSize(9).fillColor(COLORS.red).text(`${i + 1}.`, doc.page.margins.left, y, { continued: false });
      doc.fontSize(9).fillColor(COLORS.body).text(risk, doc.page.margins.left + 20, y, { continued: false });
      doc.y = Math.max(doc.y, y + 14);
    });

    this.renderFooter(doc, summary.institution.name);
  }

  // ─── Interest Rate Risk ──────────────────────────────────────

  private renderInterestRateRisk(
    doc: typeof PDFDocument,
    summary: {
      institution: { name: string };
      durationGap: { durationGap: number; riskProfile: string; assetDuration: number; liabilityDuration: number };
      niiSensitivity: {
        scenarios: Array<{ name: string; shiftBps: number; niImpact: number; niImpactPct: number; mveImpact: number; mveImpactPct: number }>;
        baseNII: number;
        riskRating: string;
      };
    },
  ) {
    this.renderSectionHeader(doc, '2', 'INTEREST RATE RISK', 'Duration gap and NII sensitivity analysis');

    // Duration Gap narrative
    this.renderSubsectionHeader(doc, 'Duration Gap Analysis');
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor(COLORS.body);
    doc.text(
      `The institution exhibits a ${summary.durationGap.riskProfile.replace(/-/g, ' ')} profile. ` +
      `Asset-weighted duration of ${summary.durationGap.assetDuration} years versus ` +
      `liability duration of ${summary.durationGap.liabilityDuration} years, ` +
      `resulting in a duration gap of ${summary.durationGap.durationGap > 0 ? '+' : ''}${summary.durationGap.durationGap} years.`,
    );
    doc.moveDown(1.5);

    // NII Sensitivity Table
    this.renderSubsectionHeader(doc, 'NII Sensitivity Scenarios');
    doc.moveDown(0.2);
    doc.fontSize(9).fillColor(COLORS.muted).text(
      `Base NII: $${summary.niiSensitivity.baseNII}M  |  Risk Rating: ${summary.niiSensitivity.riskRating.toUpperCase()}`,
    );
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

    this.renderStyledTable(
      doc,
      ['Scenario', 'Shift', 'NII Impact', 'NII %', 'MVE Impact', 'MVE %'],
      scenarioRows,
      {
        highlightRows: sorted.map((s, i) => ({
          index: i,
          color: s.niImpact >= 0 ? COLORS.greenBg : COLORS.redBg,
        })),
        boldRows: sorted.map((s, i) => (Math.abs(s.shiftBps) === 100 ? i : -1)).filter((i) => i >= 0),
      },
    );

    this.renderFooter(doc, summary.institution.name);
  }

  // ─── Liquidity Risk ──────────────────────────────────────────

  private renderLiquidityRisk(
    doc: typeof PDFDocument,
    summary: {
      institution: { name: string };
      liquidity: { lcr: number; hqla: number; netOutflows: number; status: string; buffer: number };
    },
  ) {
    this.renderSectionHeader(doc, '3', 'LIQUIDITY RISK', 'LCR compliance and HQLA composition');

    const statusLabel =
      summary.liquidity.status === 'compliant' ? 'COMPLIANT' :
      summary.liquidity.status === 'warning' ? 'WARNING' : 'BREACH';
    const statusColor = summary.liquidity.status === 'compliant' ? COLORS.green : COLORS.red;

    // Status highlight box
    const boxY = doc.y;
    doc.rect(doc.page.margins.left, boxY, doc.page.width - doc.page.margins.left - doc.page.margins.right, 36)
      .fill(summary.liquidity.status === 'compliant' ? COLORS.greenBg : COLORS.redBg);
    doc.rect(doc.page.margins.left, boxY, 4, 36).fill(statusColor);
    doc.fontSize(10).fillColor(statusColor).text(
      `Basel III LCR: ${statusLabel} — ${summary.liquidity.lcr.toFixed(1)}%`,
      doc.page.margins.left + 16,
      boxY + 8,
    );
    doc.fontSize(9).fillColor(COLORS.body).text(
      `Buffer: ${summary.liquidity.buffer > 0 ? '+' : ''}${summary.liquidity.buffer.toFixed(1)}% over 100% minimum`,
      doc.page.margins.left + 16,
      boxY + 22,
    );
    doc.y = boxY + 46;

    doc.fontSize(10).fillColor(COLORS.body);
    doc.text(
      `LCR stands at ${summary.liquidity.lcr.toFixed(1)}%, ` +
      `calculated as HQLA ($${summary.liquidity.hqla.toFixed(1)}M) divided by ` +
      `net cash outflows ($${summary.liquidity.netOutflows.toFixed(1)}M) over a 30-day stress period.`,
    );
    doc.moveDown(1.5);

    // LCR Metrics
    this.renderSubsectionHeader(doc, 'Liquidity Coverage Ratio');
    doc.moveDown(0.3);

    const lcrRows = [
      ['Total HQLA', `$${summary.liquidity.hqla.toFixed(1)}M`],
      ['Net Cash Outflows (30-day)', `$${summary.liquidity.netOutflows.toFixed(1)}M`],
      ['LCR Ratio', `${summary.liquidity.lcr.toFixed(1)}%`],
      ['Compliance Status', statusLabel],
      ['Buffer over Minimum', `${summary.liquidity.buffer > 0 ? '+' : ''}${summary.liquidity.buffer.toFixed(1)}%`],
    ];

    this.renderStyledTable(doc, ['Metric', 'Value'], lcrRows);

    doc.moveDown(1.5);

    // HQLA Composition
    this.renderSubsectionHeader(doc, 'HQLA Composition (Estimated)');
    doc.moveDown(0.3);

    const hqla = summary.liquidity.hqla;
    const hqlaRows = [
      ['Level 1 — Cash, Government Bonds', `$${round(hqla * 0.70, 1)}M`, '70%', 'No haircut'],
      ['Level 2A — Agency MBS, High-Grade Corp', `$${round(hqla * 0.20, 1)}M`, '20%', '15% haircut'],
      ['Level 2B — Lower-rated Corporate', `$${round(hqla * 0.10, 1)}M`, '10%', '50% haircut'],
      ['Total HQLA', `$${round(hqla, 1)}M`, '100%', '—'],
    ];

    this.renderStyledTable(doc, ['Category', 'Amount', 'Share', 'Haircut'], hqlaRows, {
      boldRows: [3],
    });

    this.renderFooter(doc, summary.institution.name);
  }

  // ─── Stress Testing ──────────────────────────────────────────

  private renderStressTesting(
    doc: typeof PDFDocument,
    stressTest: {
      monteCarlo: {
        niiAtRisk: number; expectedNII: number; worstCaseNII: number;
        niiDistribution: { p5: number; p25: number; median: number; p75: number; p95: number };
        paths: number; horizon: number;
      };
      regulatory: {
        scenarios: Array<{ name: string; description: string; niImpact: number; mveImpact: number; lcrImpact: number; capitalImpact: number; passFailStatus: string }>;
        overallRating: string;
      };
    },
    summary: { institution: { name: string } },
  ) {
    this.renderSectionHeader(doc, '4', 'STRESS TESTING', 'Monte Carlo simulation and regulatory scenarios');

    // Monte Carlo section
    this.renderSubsectionHeader(doc, 'Monte Carlo Simulation (Vasicek Model)');
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor(COLORS.body);
    doc.text(
      `${stressTest.monteCarlo.paths} interest rate paths simulated over ${stressTest.monteCarlo.horizon} months ` +
      `using a Vasicek mean-reverting model. NII at Risk (expected minus 5th percentile) ` +
      `is $${stressTest.monteCarlo.niiAtRisk}M.`,
    );
    doc.moveDown(0.5);

    // Highlight box for key MC metrics
    const boxY = doc.y;
    const mL = doc.page.margins.left;
    const cw = doc.page.width - mL - doc.page.margins.right;
    doc.rect(mL, boxY, cw, 50).fill('#fffbeb');
    doc.rect(mL, boxY, 4, 50).fill(COLORS.brand);

    const col3w = cw / 3;
    doc.fontSize(8).fillColor(COLORS.muted);
    doc.text('Expected NII', mL + 16, boxY + 6, { width: col3w });
    doc.text('Worst Case (5th %ile)', mL + 16 + col3w, boxY + 6, { width: col3w });
    doc.text('NII at Risk', mL + 16 + col3w * 2, boxY + 6, { width: col3w });

    doc.fontSize(14).fillColor(COLORS.heading);
    doc.text(`$${stressTest.monteCarlo.expectedNII}M`, mL + 16, boxY + 20, { width: col3w });
    doc.text(`$${stressTest.monteCarlo.worstCaseNII}M`, mL + 16 + col3w, boxY + 20, { width: col3w });
    doc.fontSize(14).fillColor(COLORS.red);
    doc.text(`$${stressTest.monteCarlo.niiAtRisk}M`, mL + 16 + col3w * 2, boxY + 20, { width: col3w });

    doc.y = boxY + 60;

    // Distribution table
    const mcRows = [
      ['5th Percentile (Worst Case)', `$${stressTest.monteCarlo.niiDistribution.p5}M`],
      ['25th Percentile', `$${stressTest.monteCarlo.niiDistribution.p25}M`],
      ['Median (Expected)', `$${stressTest.monteCarlo.niiDistribution.median}M`],
      ['75th Percentile', `$${stressTest.monteCarlo.niiDistribution.p75}M`],
      ['95th Percentile (Best Case)', `$${stressTest.monteCarlo.niiDistribution.p95}M`],
    ];

    this.renderStyledTable(doc, ['Percentile', 'NII Value'], mcRows);

    doc.moveDown(1.5);

    // Regulatory scenarios
    this.renderSubsectionHeader(doc, 'Regulatory Stress Scenarios');
    doc.moveDown(0.2);

    const ratingColor = stressTest.regulatory.overallRating === 'resilient' ? COLORS.green :
      stressTest.regulatory.overallRating === 'adequate' ? '#2563eb' : COLORS.red;
    doc.fontSize(9).fillColor(ratingColor)
      .text(`Overall Rating: ${stressTest.regulatory.overallRating.toUpperCase()}`);
    doc.moveDown(0.5);

    const regRows = stressTest.regulatory.scenarios.map((s) => [
      s.name,
      `$${s.niImpact >= 0 ? '+' : ''}${s.niImpact}M`,
      `$${s.mveImpact >= 0 ? '+' : ''}${s.mveImpact}M`,
      `${s.lcrImpact.toFixed(1)}%`,
      `${s.capitalImpact >= 0 ? '+' : ''}${s.capitalImpact}%`,
      s.passFailStatus.toUpperCase(),
    ]);

    this.renderStyledTable(
      doc,
      ['Scenario', 'NII', 'MVE', 'LCR', 'Capital', 'Status'],
      regRows,
      {
        highlightRows: stressTest.regulatory.scenarios.map((s, i) => ({
          index: i,
          color: s.passFailStatus === 'pass' ? COLORS.greenBg : s.passFailStatus === 'warn' ? '#fffbeb' : COLORS.redBg,
        })),
        statusColumn: 5,
      },
    );

    this.renderFooter(doc, summary.institution.name);
  }

  // ─── Recommendations ─────────────────────────────────────────

  private renderRecommendations(
    doc: typeof PDFDocument,
    summary: {
      institution: { name: string };
      recommendations: string[];
      riskScore: number;
    },
  ) {
    this.renderSectionHeader(doc, '5', 'RECOMMENDATIONS', 'Actionable risk mitigation strategies');

    doc.fontSize(10).fillColor(COLORS.body);
    doc.text(`Based on the comprehensive ALM analysis for ${summary.institution.name} (Risk Score: ${summary.riskScore}/100):`);
    doc.moveDown(1);

    const priorities = ['HIGH', 'HIGH', 'MEDIUM', 'MEDIUM', 'LOW'];
    const priorityColors: Record<string, string> = { HIGH: COLORS.red, MEDIUM: COLORS.brand, LOW: COLORS.green };

    summary.recommendations.forEach((rec, i) => {
      const priority = priorities[i] || 'MEDIUM';
      const pColor = priorityColors[priority];

      if (doc.y > doc.page.height - 100) {
        doc.addPage();
        this.renderFooter(doc, summary.institution.name);
      }

      const y = doc.y;
      // Priority badge
      doc.fontSize(7).fillColor(pColor).text(`[${priority}]`, doc.page.margins.left, y, { continued: false });
      // Recommendation text
      doc.fontSize(10).fillColor(COLORS.heading).text(
        `${i + 1}. ${rec}`,
        doc.page.margins.left + 45,
        y,
        { width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 50 },
      );
      doc.moveDown(0.5);
    });

    doc.moveDown(3);

    // Disclaimer
    doc.moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .lineWidth(0.5).stroke(COLORS.border);
    doc.moveDown(1);

    doc.fontSize(8).fillColor(COLORS.muted);
    doc.text(
      'Disclaimer: This report is generated automatically by CapexCycleOS and should be reviewed by qualified ' +
      'risk management professionals before making any decisions. Past performance and simulated scenarios do not ' +
      'guarantee future results. KLYTICS is not a registered investment advisor.',
    );

    this.renderFooter(doc, summary.institution.name);
  }

  // ─── Shared Rendering Helpers ────────────────────────────────

  private renderSectionHeader(doc: typeof PDFDocument, num: string, title: string, subtitle?: string) {
    this.pageNum++;
    const mL = doc.page.margins.left;
    const mR = doc.page.margins.right;
    const contentWidth = doc.page.width - mL - mR;

    // Brand bar at top
    doc.rect(0, 0, doc.page.width, 4).fill(COLORS.brand);

    // Section X of 5 — top right
    doc.fontSize(8).fillColor(COLORS.muted).text(
      `Section ${num} of 5`,
      0,
      doc.page.margins.top + 4,
      { align: 'right', width: doc.page.width - mR },
    );

    // Left border accent + section title
    doc.y = doc.page.margins.top;
    const headerY = doc.y;

    doc.rect(mL, headerY, 4, subtitle ? 36 : 28).fill(COLORS.brand);

    doc.fontSize(16).fillColor(COLORS.heading).text(`${num}. ${title}`, mL + 16, headerY + 2);
    if (subtitle) {
      doc.fontSize(9).fillColor(COLORS.muted).text(subtitle, mL + 16, headerY + 22);
    }

    doc.y = headerY + (subtitle ? 46 : 38);

    // Subtle rule below header
    doc.moveTo(mL, doc.y).lineTo(mL + contentWidth, doc.y).lineWidth(0.5).stroke(COLORS.border);
    doc.moveDown(1);
  }

  private renderSubsectionHeader(doc: typeof PDFDocument, title: string) {
    doc.fontSize(11).fillColor(COLORS.heading).text(title, { underline: false });
    const y = doc.y + 2;
    doc.moveTo(doc.page.margins.left, y)
      .lineTo(doc.page.margins.left + 60, y)
      .lineWidth(1.5).stroke(COLORS.brand);
    doc.y = y + 6;
  }

  private renderStyledTable(
    doc: typeof PDFDocument,
    headers: string[],
    rows: string[][],
    options?: {
      highlightRows?: Array<{ index: number; color: string }>;
      boldRows?: number[];
      statusColumn?: number;
    },
  ) {
    const mL = doc.page.margins.left;
    const mR = doc.page.margins.right;
    const contentWidth = doc.page.width - mL - mR;
    const colWidth = contentWidth / headers.length;
    const rowHeight = 18;
    let y = doc.y;

    // Header background
    doc.rect(mL, y - 2, contentWidth, rowHeight + 2).fill(COLORS.dark);

    // Header text
    doc.fontSize(8).fillColor('#ffffff');
    headers.forEach((h, i) => {
      doc.text(h, mL + i * colWidth + 6, y + 2, {
        width: colWidth - 12,
        align: i === 0 ? 'left' : 'right',
        lineBreak: false,
      });
    });
    y += rowHeight + 2;

    // Data rows
    rows.forEach((row, rowIdx) => {
      // Page break check
      if (y > doc.page.height - 80) {
        doc.addPage();
        this.renderFooter(doc, '');
        y = doc.page.margins.top + 20;
      }

      // Row background
      const highlight = options?.highlightRows?.find((h) => h.index === rowIdx);
      const bgColor = highlight ? highlight.color : rowIdx % 2 === 1 ? COLORS.rowAlt : '#ffffff';
      doc.rect(mL, y - 1, contentWidth, rowHeight).fill(bgColor);

      // Row text
      const isBold = options?.boldRows?.includes(rowIdx);
      doc.fontSize(isBold ? 9 : 8.5).fillColor(COLORS.body);

      row.forEach((cell, colIdx) => {
        let cellColor = COLORS.body;

        // Color-code status column
        if (options?.statusColumn !== undefined && colIdx === options.statusColumn) {
          if (cell === 'PASS') cellColor = COLORS.green;
          else if (cell === 'FAIL') cellColor = COLORS.red;
          else if (cell === 'WARN') cellColor = COLORS.brandDark;
        }

        // Color-code values starting with + or -
        if (colIdx > 0 && cell.startsWith('+$')) cellColor = COLORS.green;
        if (colIdx > 0 && cell.startsWith('-$')) cellColor = COLORS.red;

        if (isBold) {
          doc.font('Helvetica-Bold');
        } else {
          doc.font('Helvetica');
        }

        doc.fillColor(cellColor).text(cell, mL + colIdx * colWidth + 6, y + 3, {
          width: colWidth - 12,
          align: colIdx === 0 ? 'left' : 'right',
          lineBreak: false,
        });
      });

      y += rowHeight;
    });

    // Bottom border
    doc.moveTo(mL, y).lineTo(mL + contentWidth, y).lineWidth(0.5).stroke(COLORS.border);

    doc.font('Helvetica');
    doc.y = y + 8;
  }

  private renderFooter(doc: typeof PDFDocument, institutionName: string) {
    const mL = doc.page.margins.left;
    const contentWidth = doc.page.width - mL - doc.page.margins.right;
    const bottom = doc.page.height - 45;

    // Rule
    doc.moveTo(mL, bottom - 8).lineTo(mL + contentWidth, bottom - 8).lineWidth(0.3).stroke(COLORS.border);

    // Left: institution name
    doc.fontSize(7).fillColor(COLORS.muted);
    if (institutionName) {
      doc.text(institutionName, mL, bottom, { width: contentWidth / 3, align: 'left' });
    }

    // Center: branding
    doc.text(
      'CapexCycleOS by KLYTICS | Confidential',
      mL + contentWidth / 3,
      bottom,
      { width: contentWidth / 3, align: 'center' },
    );

    // Right: date
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    doc.text(dateStr, mL + (contentWidth * 2) / 3, bottom, {
      width: contentWidth / 3,
      align: 'right',
    });
  }
}
