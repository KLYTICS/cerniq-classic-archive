import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AlmEnterpriseService } from '../alm/alm-enterprise.service';
import { VendorIntelligenceService, VendorReport } from './vendor-intelligence/vendor-intelligence.service';
import { createHash, randomUUID } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export interface AnomalyFinding {
  id: string;
  findingType:
    | 'DUPLICATE_INVOICE'
    | 'AMOUNT_ANOMALY'
    | 'SPLIT_BILLING'
    | 'VENDOR_CONCENTRATION'
    | 'FREQUENCY_ANOMALY'
    | 'DORMANT_VENDOR_REACTIVATED'
    | 'UNAUTHORIZED_CATEGORY';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  affectedInvoiceIds: string[];
  affectedVendor: string;
  estimatedRecovery: number;
  explanation: string;
  explanationEs: string;
  detectedAt: Date;
}

export interface APAnalysisResult {
  findings: AnomalyFinding[];
  healthScore: number;
  totalExpenses: number;
  totalVendors: number;
  topVendorName: string;
  topVendorPct: number;
  duplicatesFound: number;
  estimatedTotalRecovery: number;
  analysisDate: Date;
  vendorReport: VendorReport[];
}

export interface ApLcrImpact {
  currentLcr: number;
  projectedLcr: number;
  hqla: number;
  currentNetOutflows: number;
  apProjected30Day: number;
  delta: number;
  alertLevel: 'SAFE' | 'ADEQUATE' | 'WATCH' | 'CRITICAL';
  quarterlyAPTotal: number;
  vsLastQuarter: number;
}

// Internal normalized expense used by detectors
interface NormalizedExpense {
  id: string;
  merchantName: string;
  amount: number;
  category: string | null;
  description: string | null;
  transactionDate: Date;
  invoiceHash: string;
  reviewStatus: string;
  createdAt: Date;
}

// ── Service ────────────────────────────────────────────────────────────────

@Injectable()
export class AnomalyDetectionService {
  private readonly logger = new Logger(AnomalyDetectionService.name);

  constructor(
    private prisma: PrismaService,
    private almEnterprise: AlmEnterpriseService,
    private vendorIntelligence: VendorIntelligenceService,
  ) {}

  // ── Public entry point ────────────────────────────────────────────────

  async analyzeOrganization(orgId: string): Promise<APAnalysisResult> {
    const rawExpenses = await this.prisma.expense.findMany({
      where: { organizationId: orgId },
      orderBy: { transactionDate: 'asc' },
    });

    // Normalize Prisma Decimal → number and compute hashes
    const expenses: NormalizedExpense[] = rawExpenses.map((e) => ({
      id: e.id,
      merchantName: e.merchantName,
      amount: Number(e.amount),
      category: e.category,
      description: e.description,
      transactionDate: new Date(e.transactionDate),
      invoiceHash: this.hashInvoice(e.merchantName, Number(e.amount), new Date(e.transactionDate)),
      reviewStatus: (e as any).reviewStatus ?? 'PENDING',
      createdAt: new Date(e.createdAt),
    }));

    // Run all 7 detectors concurrently — one failing must not break the rest
    const [
      duplicateResult,
      amountResult,
      splitResult,
      concentrationResult,
      frequencyResult,
      dormantResult,
      categoryResult,
    ] = await Promise.allSettled([
      this.detectDuplicates(expenses),
      this.detectAmountAnomalies(expenses),
      this.detectSplitBilling(expenses),
      this.detectVendorConcentration(expenses),
      this.detectFrequencyAnomalies(expenses),
      this.detectDormantVendorReactivated(expenses),
      this.detectUnauthorizedCategory(expenses),
    ]);

    const findings: AnomalyFinding[] = [];
    const settled = [
      duplicateResult,
      amountResult,
      splitResult,
      concentrationResult,
      frequencyResult,
      dormantResult,
      categoryResult,
    ];

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        findings.push(...result.value);
      } else {
        this.logger.error(`Detector failed: ${result.reason}`);
      }
    }

    // Compute aggregate stats
    const totalExpenses = expenses.length;
    const vendorMap = this.groupByVendor(expenses);
    const totalVendors = Object.keys(vendorMap).length;
    const totalSpend = expenses.reduce((sum, e) => sum + e.amount, 0);

    let topVendorName = 'N/A';
    let topVendorPct = 0;
    for (const [vendor, items] of Object.entries(vendorMap)) {
      const vendorSpend = items.reduce((s, e) => s + e.amount, 0);
      const pct = totalSpend > 0 ? (vendorSpend / totalSpend) * 100 : 0;
      if (pct > topVendorPct) {
        topVendorPct = pct;
        topVendorName = vendor;
      }
    }

    const duplicatesFound = findings.filter((f) => f.findingType === 'DUPLICATE_INVOICE').length;
    const estimatedTotalRecovery = findings.reduce((s, f) => s + f.estimatedRecovery, 0);

    const healthScore = this.calculateHealthScore(findings, expenses, vendorMap, totalSpend);

    // Generate vendor intelligence report
    const vendorReport = this.vendorIntelligence.generateVendorReport(
      expenses.map((e) => ({
        merchantName: e.merchantName,
        amount: e.amount,
        transactionDate: e.transactionDate,
      })),
    );

    // Persist invoice hashes and anomaly flags back to DB (best-effort)
    try {
      await this.persistFlags(expenses, findings);
    } catch (err) {
      this.logger.error('Failed to persist anomaly flags', err);
    }

    return {
      findings,
      healthScore,
      totalExpenses,
      totalVendors,
      topVendorName,
      topVendorPct: Math.round(topVendorPct * 100) / 100,
      duplicatesFound,
      estimatedTotalRecovery: Math.round(estimatedTotalRecovery * 100) / 100,
      analysisDate: new Date(),
      vendorReport,
    };
  }

  // ── Detector 1: Duplicates ────────────────────────────────────────────

  private async detectDuplicates(expenses: NormalizedExpense[]): Promise<AnomalyFinding[]> {
    try {
      const findings: AnomalyFinding[] = [];

      // Exact duplicates: same hash
      const hashGroups = new Map<string, NormalizedExpense[]>();
      for (const e of expenses) {
        const existing = hashGroups.get(e.invoiceHash) || [];
        existing.push(e);
        hashGroups.set(e.invoiceHash, existing);
      }

      for (const [, group] of hashGroups) {
        if (group.length >= 2) {
          findings.push({
            id: randomUUID(),
            findingType: 'DUPLICATE_INVOICE',
            severity: 'HIGH',
            affectedInvoiceIds: group.map((e) => e.id),
            affectedVendor: group[0].merchantName,
            estimatedRecovery: group.slice(1).reduce((s, e) => s + e.amount, 0),
            explanation: `Exact duplicate: ${group.length} invoices with identical vendor, amount ($${group[0].amount.toFixed(2)}), and date.`,
            explanationEs: `Duplicado exacto: ${group.length} facturas con proveedor, monto ($${group[0].amount.toFixed(2)}) y fecha idénticos.`,
            detectedAt: new Date(),
          });
        }
      }

      // Near-duplicates: same vendor, |amount diff| < $0.50, |date diff| < 7 days
      const vendorGroups = this.groupByVendor(expenses);
      for (const [vendor, items] of Object.entries(vendorGroups)) {
        const sorted = [...items].sort((a, b) => a.transactionDate.getTime() - b.transactionDate.getTime());
        for (let i = 0; i < sorted.length; i++) {
          for (let j = i + 1; j < sorted.length; j++) {
            const amountDiff = Math.abs(sorted[i].amount - sorted[j].amount);
            const daysDiff = Math.abs(sorted[i].transactionDate.getTime() - sorted[j].transactionDate.getTime()) / (1000 * 60 * 60 * 24);

            // Skip if they are already an exact-duplicate pair
            if (sorted[i].invoiceHash === sorted[j].invoiceHash) continue;

            if (amountDiff < 0.5 && daysDiff < 7) {
              findings.push({
                id: randomUUID(),
                findingType: 'DUPLICATE_INVOICE',
                severity: 'MEDIUM',
                affectedInvoiceIds: [sorted[i].id, sorted[j].id],
                affectedVendor: vendor,
                estimatedRecovery: Math.min(sorted[i].amount, sorted[j].amount),
                explanation: `Near-duplicate: ${vendor} — $${sorted[i].amount.toFixed(2)} and $${sorted[j].amount.toFixed(2)} within ${daysDiff.toFixed(0)} days.`,
                explanationEs: `Cuasi-duplicado: ${vendor} — $${sorted[i].amount.toFixed(2)} y $${sorted[j].amount.toFixed(2)} dentro de ${daysDiff.toFixed(0)} días.`,
                detectedAt: new Date(),
              });
            }
          }
        }
      }

      return findings;
    } catch (err) {
      this.logger.error('detectDuplicates failed', err);
      return [];
    }
  }

  // ── Detector 2: Amount Anomalies ──────────────────────────────────────

  private async detectAmountAnomalies(expenses: NormalizedExpense[]): Promise<AnomalyFinding[]> {
    try {
      const findings: AnomalyFinding[] = [];
      const now = new Date();
      const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

      const vendorGroups = this.groupByVendor(expenses);

      for (const [vendor, items] of Object.entries(vendorGroups)) {
        const recent = items.filter((e) => e.transactionDate >= sixMonthsAgo);
        if (recent.length < 4) continue;

        const amounts = recent.map((e) => e.amount);
        const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        const variance = amounts.reduce((s, v) => s + (v - mean) ** 2, 0) / amounts.length;
        const stdDev = Math.sqrt(variance);

        if (stdDev === 0) continue;

        const threshold = mean + 2 * stdDev;

        for (const e of recent) {
          if (e.amount > threshold) {
            findings.push({
              id: randomUUID(),
              findingType: 'AMOUNT_ANOMALY',
              severity: e.amount > mean + 3 * stdDev ? 'HIGH' : 'MEDIUM',
              affectedInvoiceIds: [e.id],
              affectedVendor: vendor,
              estimatedRecovery: e.amount - mean,
              explanation: `Amount outlier: $${e.amount.toFixed(2)} vs. vendor average $${mean.toFixed(2)} (threshold $${threshold.toFixed(2)}).`,
              explanationEs: `Monto atípico: $${e.amount.toFixed(2)} vs. promedio del proveedor $${mean.toFixed(2)} (umbral $${threshold.toFixed(2)}).`,
              detectedAt: new Date(),
            });
          }
        }
      }

      return findings;
    } catch (err) {
      this.logger.error('detectAmountAnomalies failed', err);
      return [];
    }
  }

  // ── Detector 3: Split Billing ─────────────────────────────────────────

  private async detectSplitBilling(expenses: NormalizedExpense[]): Promise<AnomalyFinding[]> {
    try {
      const findings: AnomalyFinding[] = [];
      const vendorGroups = this.groupByVendor(expenses);

      for (const [vendor, items] of Object.entries(vendorGroups)) {
        const sorted = [...items].sort((a, b) => a.transactionDate.getTime() - b.transactionDate.getTime());

        // Sliding 14-day windows
        for (let i = 0; i < sorted.length; i++) {
          const windowStart = sorted[i].transactionDate.getTime();
          const windowEnd = windowStart + 14 * 24 * 60 * 60 * 1000;
          const windowItems: NormalizedExpense[] = [];

          for (let j = i; j < sorted.length; j++) {
            if (sorted[j].transactionDate.getTime() <= windowEnd) {
              windowItems.push(sorted[j]);
            } else {
              break;
            }
          }

          if (windowItems.length >= 3) {
            const sum = windowItems.reduce((s, e) => s + e.amount, 0);
            // Check if the sum is a round thousand (within $5 tolerance)
            if (sum >= 1000 && Math.abs(sum - Math.round(sum / 1000) * 1000) < 5) {
              // Avoid duplicate findings for overlapping windows by using a composite key
              const ids = windowItems.map((e) => e.id).sort().join(',');
              const alreadyFound = findings.some(
                (f) => f.findingType === 'SPLIT_BILLING' && f.affectedInvoiceIds.sort().join(',') === ids,
              );

              if (!alreadyFound) {
                findings.push({
                  id: randomUUID(),
                  findingType: 'SPLIT_BILLING',
                  severity: 'MEDIUM',
                  affectedInvoiceIds: windowItems.map((e) => e.id),
                  affectedVendor: vendor,
                  estimatedRecovery: 0, // Split billing is about policy, not direct recovery
                  explanation: `Potential split billing: ${windowItems.length} invoices from ${vendor} in 14 days totaling $${sum.toFixed(2)} (a round thousand).`,
                  explanationEs: `Posible facturación fraccionada: ${windowItems.length} facturas de ${vendor} en 14 días totalizando $${sum.toFixed(2)} (millar redondo).`,
                  detectedAt: new Date(),
                });
              }
            }
          }
        }
      }

      return findings;
    } catch (err) {
      this.logger.error('detectSplitBilling failed', err);
      return [];
    }
  }

  // ── Detector 4: Vendor Concentration ──────────────────────────────────

  private async detectVendorConcentration(expenses: NormalizedExpense[]): Promise<AnomalyFinding[]> {
    try {
      const findings: AnomalyFinding[] = [];
      const totalSpend = expenses.reduce((s, e) => s + e.amount, 0);
      if (totalSpend === 0) return findings;

      const vendorGroups = this.groupByVendor(expenses);

      for (const [vendor, items] of Object.entries(vendorGroups)) {
        const vendorSpend = items.reduce((s, e) => s + e.amount, 0);
        const pct = (vendorSpend / totalSpend) * 100;

        if (pct > 35) {
          findings.push({
            id: randomUUID(),
            findingType: 'VENDOR_CONCENTRATION',
            severity: 'HIGH',
            affectedInvoiceIds: items.map((e) => e.id),
            affectedVendor: vendor,
            estimatedRecovery: 0,
            explanation: `High vendor concentration: ${vendor} accounts for ${pct.toFixed(1)}% of total spend ($${vendorSpend.toFixed(2)} of $${totalSpend.toFixed(2)}).`,
            explanationEs: `Alta concentración de proveedor: ${vendor} representa el ${pct.toFixed(1)}% del gasto total ($${vendorSpend.toFixed(2)} de $${totalSpend.toFixed(2)}).`,
            detectedAt: new Date(),
          });
        } else if (pct > 25) {
          findings.push({
            id: randomUUID(),
            findingType: 'VENDOR_CONCENTRATION',
            severity: 'MEDIUM',
            affectedInvoiceIds: items.map((e) => e.id),
            affectedVendor: vendor,
            estimatedRecovery: 0,
            explanation: `Elevated vendor concentration: ${vendor} accounts for ${pct.toFixed(1)}% of total spend.`,
            explanationEs: `Concentración elevada de proveedor: ${vendor} representa el ${pct.toFixed(1)}% del gasto total.`,
            detectedAt: new Date(),
          });
        }
      }

      return findings;
    } catch (err) {
      this.logger.error('detectVendorConcentration failed', err);
      return [];
    }
  }

  // ── Detector 5: Frequency Anomalies ───────────────────────────────────

  private async detectFrequencyAnomalies(expenses: NormalizedExpense[]): Promise<AnomalyFinding[]> {
    try {
      const findings: AnomalyFinding[] = [];
      const vendorGroups = this.groupByVendor(expenses);

      for (const [vendor, items] of Object.entries(vendorGroups)) {
        // Group invoices by YYYY-MM
        const monthBuckets = new Map<string, NormalizedExpense[]>();
        for (const e of items) {
          const key = `${e.transactionDate.getFullYear()}-${String(e.transactionDate.getMonth() + 1).padStart(2, '0')}`;
          const bucket = monthBuckets.get(key) || [];
          bucket.push(e);
          monthBuckets.set(key, bucket);
        }

        const sortedMonths = [...monthBuckets.keys()].sort();
        if (sortedMonths.length < 3) continue; // Need at least 3 months for a rolling average

        // Rolling average of all months except the latest
        const historicalMonths = sortedMonths.slice(0, -1);
        const historicalCounts = historicalMonths.map((m) => monthBuckets.get(m)!.length);
        const rollingAvg = historicalCounts.reduce((a, b) => a + b, 0) / historicalCounts.length;

        if (rollingAvg === 0) continue;

        const latestMonth = sortedMonths[sortedMonths.length - 1];
        const latestItems = monthBuckets.get(latestMonth)!;
        const latestCount = latestItems.length;

        if (latestCount > 2.5 * rollingAvg) {
          findings.push({
            id: randomUUID(),
            findingType: 'FREQUENCY_ANOMALY',
            severity: latestCount > 4 * rollingAvg ? 'HIGH' : 'MEDIUM',
            affectedInvoiceIds: latestItems.map((e) => e.id),
            affectedVendor: vendor,
            estimatedRecovery: 0,
            explanation: `Frequency spike: ${latestCount} invoices from ${vendor} in ${latestMonth} vs. rolling average of ${rollingAvg.toFixed(1)}.`,
            explanationEs: `Pico de frecuencia: ${latestCount} facturas de ${vendor} en ${latestMonth} vs. promedio histórico de ${rollingAvg.toFixed(1)}.`,
            detectedAt: new Date(),
          });
        }
      }

      return findings;
    } catch (err) {
      this.logger.error('detectFrequencyAnomalies failed', err);
      return [];
    }
  }

  // ── Detector 6: Dormant Vendor Reactivated ────────────────────────────

  private async detectDormantVendorReactivated(expenses: NormalizedExpense[]): Promise<AnomalyFinding[]> {
    try {
      const findings: AnomalyFinding[] = [];
      const vendorGroups = this.groupByVendor(expenses);

      for (const [vendor, items] of Object.entries(vendorGroups)) {
        if (items.length < 2) continue;

        const sorted = [...items].sort((a, b) => a.transactionDate.getTime() - b.transactionDate.getTime());

        for (let i = 1; i < sorted.length; i++) {
          const gapDays =
            (sorted[i].transactionDate.getTime() - sorted[i - 1].transactionDate.getTime()) / (1000 * 60 * 60 * 24);

          if (gapDays > 90) {
            findings.push({
              id: randomUUID(),
              findingType: 'DORMANT_VENDOR_REACTIVATED',
              severity: gapDays > 180 ? 'HIGH' : 'MEDIUM',
              affectedInvoiceIds: [sorted[i].id],
              affectedVendor: vendor,
              estimatedRecovery: 0,
              explanation: `Dormant vendor reactivated: ${vendor} had no invoices for ${Math.round(gapDays)} days before invoice on ${sorted[i].transactionDate.toISOString().slice(0, 10)}.`,
              explanationEs: `Proveedor inactivo reactivado: ${vendor} no tuvo facturas por ${Math.round(gapDays)} días antes de la factura del ${sorted[i].transactionDate.toISOString().slice(0, 10)}.`,
              detectedAt: new Date(),
            });
            // Only flag the first reactivation gap per vendor
            break;
          }
        }
      }

      return findings;
    } catch (err) {
      this.logger.error('detectDormantVendorReactivated failed', err);
      return [];
    }
  }

  // ── Detector 7: Unauthorized Category ─────────────────────────────────

  private async detectUnauthorizedCategory(expenses: NormalizedExpense[]): Promise<AnomalyFinding[]> {
    try {
      const findings: AnomalyFinding[] = [];

      // Category → keywords that should NOT appear in description
      const mismatchRules: Record<string, string[]> = {
        IT: ['catering', 'food', 'restaurant', 'travel', 'hotel', 'flight'],
        'Information Technology': ['catering', 'food', 'restaurant', 'travel', 'hotel', 'flight'],
        Technology: ['catering', 'food', 'restaurant', 'travel', 'hotel'],
        Marketing: ['server', 'hardware', 'license', 'maintenance', 'repair'],
        'Office Supplies': ['catering', 'hotel', 'flight', 'airfare', 'software'],
        Travel: ['software', 'license', 'server', 'printer', 'toner'],
        'Human Resources': ['server', 'hardware', 'marketing', 'advertising'],
        Facilities: ['software', 'license', 'marketing', 'advertising', 'flight'],
      };

      for (const e of expenses) {
        if (!e.category || !e.description) continue;

        const categoryKey = Object.keys(mismatchRules).find(
          (k) => k.toLowerCase() === e.category!.toLowerCase(),
        );
        if (!categoryKey) continue;

        const forbidden = mismatchRules[categoryKey];
        const descLower = e.description.toLowerCase();
        const matched = forbidden.filter((kw) => descLower.includes(kw));

        if (matched.length > 0) {
          findings.push({
            id: randomUUID(),
            findingType: 'UNAUTHORIZED_CATEGORY',
            severity: 'LOW',
            affectedInvoiceIds: [e.id],
            affectedVendor: e.merchantName,
            estimatedRecovery: 0,
            explanation: `Category mismatch: "${e.category}" category contains keywords [${matched.join(', ')}] in description.`,
            explanationEs: `Categoría incompatible: la categoría "${e.category}" contiene palabras clave [${matched.join(', ')}] en la descripción.`,
            detectedAt: new Date(),
          });
        }
      }

      return findings;
    } catch (err) {
      this.logger.error('detectUnauthorizedCategory failed', err);
      return [];
    }
  }

  // ── AP Health Score ───────────────────────────────────────────────────

  private calculateHealthScore(
    findings: AnomalyFinding[],
    expenses: NormalizedExpense[],
    vendorMap: Record<string, NormalizedExpense[]>,
    totalSpend: number,
  ): number {
    const totalCount = expenses.length || 1;

    // 1. Duplicate rate (40 pts)
    const dupeFindings = findings.filter((f) => f.findingType === 'DUPLICATE_INVOICE');
    const dupeInvoiceIds = new Set(dupeFindings.flatMap((f) => f.affectedInvoiceIds));
    const dupeRate = (dupeInvoiceIds.size / totalCount) * 100;
    let dupePts = 0;
    if (dupeRate === 0) dupePts = 40;
    else if (dupeRate <= 2) dupePts = 20;
    else if (dupeRate <= 5) dupePts = 10;
    else dupePts = 0;

    // 2. Anomaly density (30 pts) — count of HIGH-severity findings
    const highFindings = findings.filter((f) => f.severity === 'HIGH');
    const highRate = (highFindings.length / totalCount) * 100;
    let anomalyPts = 0;
    if (highFindings.length === 0) anomalyPts = 30;
    else if (highRate <= 3) anomalyPts = 15;
    else if (highRate <= 5) anomalyPts = 7;
    else anomalyPts = 0;

    // 3. Vendor concentration (20 pts)
    let maxPct = 0;
    for (const [, items] of Object.entries(vendorMap)) {
      const pct = totalSpend > 0 ? (items.reduce((s, e) => s + e.amount, 0) / totalSpend) * 100 : 0;
      if (pct > maxPct) maxPct = pct;
    }
    let concentrationPts = 0;
    if (maxPct < 20) concentrationPts = 20;
    else if (maxPct <= 35) concentrationPts = 10;
    else concentrationPts = 0;

    // 4. Unresolved age (10 pts)
    const now = new Date();
    const unresolvedFindings = expenses.filter((e) => e.reviewStatus === 'PENDING');
    const oldestUnresolved = unresolvedFindings.reduce((oldest, e) => {
      const age = (now.getTime() - e.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      return age > oldest ? age : oldest;
    }, 0);
    let unresolvedPts = 0;
    if (unresolvedFindings.length === 0) unresolvedPts = 10;
    else if (oldestUnresolved <= 30) unresolvedPts = 8;
    else if (oldestUnresolved <= 60) unresolvedPts = 5;
    else if (oldestUnresolved <= 90) unresolvedPts = 2;
    else unresolvedPts = 0;

    return Math.min(100, Math.max(0, dupePts + anomalyPts + concentrationPts + unresolvedPts));
  }

  // ── AP-to-LCR Cash Flow Bridge ──────────────────────────────

  async calculateApLcrImpact(orgId: string, institutionId: string): Promise<ApLcrImpact> {
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const oneEightyDaysAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    // 1. Sum last 90 days of expenses
    const recentExpenses = await this.prisma.expense.findMany({
      where: {
        organizationId: orgId,
        transactionDate: { gte: ninetyDaysAgo },
      },
      select: { amount: true },
    });

    const quarterlyAPTotal = recentExpenses.reduce((s, e) => s + Number(e.amount), 0);

    // 2. Project 30-day outflow from AP
    const apProjected30Day = (quarterlyAPTotal / 90) * 30;

    // 3. Fetch prior quarter for comparison (days 90-180 ago)
    const priorExpenses = await this.prisma.expense.findMany({
      where: {
        organizationId: orgId,
        transactionDate: { gte: oneEightyDaysAgo, lt: ninetyDaysAgo },
      },
      select: { amount: true },
    });

    const priorQuarterlyTotal = priorExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const vsLastQuarter = priorQuarterlyTotal > 0
      ? Math.round(((quarterlyAPTotal - priorQuarterlyTotal) / priorQuarterlyTotal) * 10000) / 100
      : 0;

    // 4. Fetch current LCR from ALM engine
    let currentLcr = 0;
    let hqla = 0;
    let currentNetOutflows = 0;

    try {
      const lcrResult = await this.almEnterprise.calculateLCR(institutionId);
      currentLcr = lcrResult.lcr;
      hqla = lcrResult.hqla;
      currentNetOutflows = lcrResult.netOutflows;
    } catch (err) {
      this.logger.warn(`LCR lookup failed for institution ${institutionId}: ${err}`);
    }

    // 5. Calculate projected LCR = hqla / (netOutflows + projectedAP)
    // Note: hqla and netOutflows from ALM are in millions; apProjected30Day is in dollars
    const apProjected30DayMillions = apProjected30Day / 1_000_000;
    const adjustedNetOutflows = currentNetOutflows + apProjected30DayMillions;
    const projectedLcr = adjustedNetOutflows > 0
      ? Math.round((hqla / adjustedNetOutflows) * 10000) / 100
      : currentLcr;

    const delta = Math.round((projectedLcr - currentLcr) * 100) / 100;

    // 6. Determine alert level based on projected LCR
    let alertLevel: ApLcrImpact['alertLevel'];
    if (projectedLcr >= 120) {
      alertLevel = 'SAFE';
    } else if (projectedLcr >= 100) {
      alertLevel = 'ADEQUATE';
    } else if (projectedLcr >= 85) {
      alertLevel = 'WATCH';
    } else {
      alertLevel = 'CRITICAL';
    }

    return {
      currentLcr,
      projectedLcr,
      hqla,
      currentNetOutflows,
      apProjected30Day: Math.round(apProjected30Day * 100) / 100,
      delta,
      alertLevel,
      quarterlyAPTotal: Math.round(quarterlyAPTotal * 100) / 100,
      vsLastQuarter,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private hashInvoice(vendor: string, amount: number, date: Date): string {
    const normalizedVendor = vendor.trim().toLowerCase();
    const normalizedAmount = amount.toFixed(2);
    const normalizedDate = date.toISOString().slice(0, 10);
    return createHash('md5').update(`${normalizedVendor}|${normalizedAmount}|${normalizedDate}`).digest('hex');
  }

  private groupByVendor(expenses: NormalizedExpense[]): Record<string, NormalizedExpense[]> {
    const groups: Record<string, NormalizedExpense[]> = {};
    for (const e of expenses) {
      const key = e.merchantName.trim().toLowerCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    }
    return groups;
  }

  private async persistFlags(expenses: NormalizedExpense[], findings: AnomalyFinding[]): Promise<void> {
    // Build a map of expense ID → finding types
    const flagMap = new Map<string, Set<string>>();
    for (const f of findings) {
      for (const eid of f.affectedInvoiceIds) {
        if (!flagMap.has(eid)) flagMap.set(eid, new Set());
        flagMap.get(eid)!.add(f.findingType);
      }
    }

    // Batch update — up to 50 at a time to avoid overloading DB
    const entries = [...flagMap.entries()];
    const batchSize = 50;
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      await Promise.all(
        batch.map(([id, types]) => {
          const flags = [...types];
          const score = this.riskScoreFromFlags(flags);
          return this.prisma.expense.update({
            where: { id },
            data: {
              invoiceHash: expenses.find((e) => e.id === id)?.invoiceHash ?? null,
              anomalyFlags: flags,
              riskScore: score,
            },
          });
        }),
      );
    }

    // Also persist hashes for clean expenses
    const flaggedIds = new Set(flagMap.keys());
    const cleanExpenses = expenses.filter((e) => !flaggedIds.has(e.id));
    for (let i = 0; i < cleanExpenses.length; i += batchSize) {
      const batch = cleanExpenses.slice(i, i + batchSize);
      await Promise.all(
        batch.map((e) =>
          this.prisma.expense.update({
            where: { id: e.id },
            data: { invoiceHash: e.invoiceHash },
          }),
        ),
      );
    }
  }

  private riskScoreFromFlags(flags: string[]): number {
    const weights: Record<string, number> = {
      DUPLICATE_INVOICE: 30,
      AMOUNT_ANOMALY: 20,
      SPLIT_BILLING: 15,
      VENDOR_CONCENTRATION: 10,
      FREQUENCY_ANOMALY: 10,
      DORMANT_VENDOR_REACTIVATED: 10,
      UNAUTHORIZED_CATEGORY: 5,
    };
    const total = flags.reduce((s, f) => s + (weights[f] ?? 0), 0);
    return Math.min(100, total);
  }
}
