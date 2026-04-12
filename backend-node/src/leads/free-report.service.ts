import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  COSSEC_SNAPSHOT_2025Q4,
  type CossecCooperativaSnapshot,
} from '../alm/data-pull/cossec-snapshots/cossec-2025q4';
import { COSSEC_BENCHMARK_Q3_2025 } from './prospect-seed';

// ─── Types ──────────────────────────────────────────────────

export interface FreeReportParams {
  institutionName: string;
  email: string;
  firstName: string;
}

export interface FreeReportResult {
  matched: boolean;
  institutionName: string;
  /** Normalised slug if matched, null otherwise */
  slug: string | null;
  city: string | null;
  asOfQuarter: string;

  // Hook stat: "1bp in rates = $X in NII"
  niiHookDollars: number;
  niiHookFormatted: string;

  // Headline ratios
  totalAssets: number;
  netWorthRatio: number;
  netWorthRatioVsSector: number; // positive = above sector median
  lcrStatus: 'adequate' | 'watch' | 'below';
  lcrEstimate: number;
  sectorLcrMedian: number;

  // Composite health score 0-100
  healthScore: number;
  healthGrade: 'A' | 'B' | 'C' | 'D';

  // Metadata
  leadId: string;
  prospectInstitutionId: string | null;
  disclosure: string;
}

// ─── Service ────────────────────────────────────────────────

@Injectable()
export class FreeReportService {
  private readonly logger = new Logger(FreeReportService.name);

  constructor(private readonly prisma: PrismaService) {}

  async generateFreeReport(params: FreeReportParams): Promise<FreeReportResult> {
    const { institutionName, email, firstName } = params;

    // 1. Fuzzy-match against COSSEC snapshot data
    const match = this.fuzzyMatch(institutionName);

    // 2. Compute metrics — from match or sector averages
    const totalAssets = match ? match.totalAssets : COSSEC_BENCHMARK_Q3_2025.totalAssetsMedian;
    const capitalRatioPct = match ? match.capitalRatioPct : COSSEC_BENCHMARK_Q3_2025.capitalRatioMedian;
    const liquidityRatioPct = match ? match.liquidityRatioPct : COSSEC_BENCHMARK_Q3_2025.liquidityRatioMedian;
    const niiMarginPct = match ? match.niiMarginPct : COSSEC_BENCHMARK_Q3_2025.niiMarginMedian;
    const assetGrowthYoyPct = match ? match.assetGrowthYoyPct : COSSEC_BENCHMARK_Q3_2025.assetGrowthYoy;
    const loanToDepositPct = match ? match.loanToDepositPct : COSSEC_BENCHMARK_Q3_2025.loanToShareMedian;

    // NII hook: 1bp shift on 60% of rate-sensitive assets
    const niiHookDollars = round(totalAssets * 0.60 * 0.0001, 2);
    const niiHookFormatted = formatDollars(niiHookDollars);

    // Net worth ratio vs sector median
    const netWorthRatioVsSector = round(capitalRatioPct - COSSEC_BENCHMARK_Q3_2025.capitalRatioMedian, 2);

    // LCR estimate — simplified: liquidityRatioPct mapped to LCR scale
    // COSSEC cooperativas target >= 100% LCR; we estimate from liquidity ratio
    const lcrEstimate = round(liquidityRatioPct * 4.5, 1); // ~22% liquidity ≈ 99% LCR
    const sectorLcrMedian = round(COSSEC_BENCHMARK_Q3_2025.liquidityRatioMedian * 4.5, 1);
    const lcrStatus: FreeReportResult['lcrStatus'] =
      lcrEstimate >= 100 ? 'adequate' : lcrEstimate >= 90 ? 'watch' : 'below';

    // Health score: composite 0-100
    const healthScore = this.computeHealthScore({
      capitalRatioPct,
      liquidityRatioPct,
      niiMarginPct,
      assetGrowthYoyPct,
      loanToDepositPct,
    });

    const healthGrade: FreeReportResult['healthGrade'] =
      healthScore >= 80 ? 'A' : healthScore >= 65 ? 'B' : healthScore >= 50 ? 'C' : 'D';

    // 3. Create Lead record
    const lead = await this.prisma.lead.create({
      data: {
        name: firstName,
        email,
        role: 'CFO',
        institutionName: match ? match.name : institutionName,
        institutionType: 'cooperativa',
        source: 'free_report',
        priority: 'HIGH',
        notes: `Free ALM health check requested. Health score: ${healthScore}/100 (${healthGrade}).`,
        publicDataSnapshot: match
          ? {
              slug: match.slug,
              totalAssets: match.totalAssets,
              capitalRatioPct: match.capitalRatioPct,
              liquidityRatioPct: match.liquidityRatioPct,
              niiMarginPct: match.niiMarginPct,
              niiHookDollars,
              healthScore,
            }
          : {
              fallback: true,
              inputName: institutionName,
              healthScore,
            },
      },
    });

    // 4. Create or find ProspectInstitution record
    let prospectInstitutionId: string | null = null;
    if (match) {
      const existing = await this.prisma.prospectInstitution.findFirst({
        where: { publicDataIdentifier: match.slug },
      });
      if (existing) {
        prospectInstitutionId = existing.id;
        // Update contact info if not set
        if (!existing.contactEmail) {
          await this.prisma.prospectInstitution.update({
            where: { id: existing.id },
            data: { contactEmail: email, contactName: firstName },
          });
        }
      } else {
        const created = await this.prisma.prospectInstitution.create({
          data: {
            name: match.name,
            institutionType: 'cooperativa',
            location: match.city,
            estimatedAssets: match.totalAssets,
            publicDataSource: 'cossec',
            publicDataIdentifier: match.slug,
            contactEmail: email,
            contactName: firstName,
            contactRole: 'CFO',
            outreachStatus: 'sample_generated',
          },
        });
        prospectInstitutionId = created.id;
      }
    }

    this.logger.log({
      event: 'free_report.generated',
      matched: !!match,
      slug: match?.slug ?? null,
      inputName: institutionName,
      healthScore,
      leadId: lead.id,
    });

    return {
      matched: !!match,
      institutionName: match ? match.name : institutionName,
      slug: match?.slug ?? null,
      city: match?.city ?? null,
      asOfQuarter: match?.asOfQuarter ?? COSSEC_BENCHMARK_Q3_2025.period,
      niiHookDollars,
      niiHookFormatted,
      totalAssets,
      netWorthRatio: capitalRatioPct,
      netWorthRatioVsSector,
      lcrStatus,
      lcrEstimate,
      sectorLcrMedian,
      healthScore,
      healthGrade,
      leadId: lead.id,
      prospectInstitutionId,
      disclosure: match
        ? `PRELIMINARY — Built from COSSEC public filings, ${match.asOfQuarter}`
        : `PRELIMINARY — Based on sector averages (COSSEC ${COSSEC_BENCHMARK_Q3_2025.period}). Specific data will be used once your institution is identified.`,
    };
  }

  // ─── Fuzzy Matching ──────────────────────────────────────────

  /**
   * Fuzzy-match an institution name against the COSSEC snapshot list.
   * Strategy:
   *   1. Exact slug match
   *   2. Normalized substring match (city name or slug in input)
   *   3. Levenshtein distance on normalized names (threshold <= 0.35 of target length)
   */
  fuzzyMatch(input: string): CossecCooperativaSnapshot | null {
    const normalized = this.normalize(input);

    // Pass 1: exact slug match
    for (const entry of COSSEC_SNAPSHOT_2025Q4) {
      if (entry.slug === normalized) return entry;
    }

    // Pass 2: normalized input contains slug or slug contains normalized input
    for (const entry of COSSEC_SNAPSHOT_2025Q4) {
      if (normalized.includes(entry.slug) || entry.slug.includes(normalized)) {
        return entry;
      }
    }

    // Pass 3: check if any keyword from the input matches a city/slug
    const inputWords = normalized.split(/[\s\-]+/).filter((w) => w.length >= 3);
    for (const entry of COSSEC_SNAPSHOT_2025Q4) {
      const entryNorm = this.normalize(entry.name);
      for (const word of inputWords) {
        if (entry.slug === word) return entry;
        if (entryNorm.includes(word) && word.length >= 4) return entry;
      }
    }

    // Pass 4: Levenshtein on full normalized names
    let bestMatch: CossecCooperativaSnapshot | null = null;
    let bestDistance = Infinity;
    for (const entry of COSSEC_SNAPSHOT_2025Q4) {
      const entryNorm = this.normalize(entry.name);
      const distance = this.levenshtein(normalized, entryNorm);
      const threshold = Math.floor(entryNorm.length * 0.35);
      if (distance < bestDistance && distance <= threshold) {
        bestDistance = distance;
        bestMatch = entry;
      }
    }

    return bestMatch;
  }

  // ─── Health Score ───────────────────────────────────────────

  /**
   * Composite health score 0-100 from five key ratios.
   * Each ratio is scored 0-20 based on how it compares to COSSEC sector norms.
   */
  computeHealthScore(metrics: {
    capitalRatioPct: number;
    liquidityRatioPct: number;
    niiMarginPct: number;
    assetGrowthYoyPct: number;
    loanToDepositPct: number;
  }): number {
    const { capitalRatioPct, liquidityRatioPct, niiMarginPct, assetGrowthYoyPct, loanToDepositPct } = metrics;

    // Capital adequacy (0-20): 7% is floor (COSSEC minimum), 12%+ is excellent
    const capitalScore = clamp(((capitalRatioPct - 7) / 5) * 20, 0, 20);

    // Liquidity (0-20): 15% is floor, 30%+ is excellent
    const liquidityScore = clamp(((liquidityRatioPct - 15) / 15) * 20, 0, 20);

    // NII margin (0-20): 2.5% is floor, 4.5%+ is excellent
    const niiScore = clamp(((niiMarginPct - 2.5) / 2) * 20, 0, 20);

    // Asset growth (0-20): 0% is floor, 6%+ is excellent
    const growthScore = clamp((assetGrowthYoyPct / 6) * 20, 0, 20);

    // Loan/deposit balance (0-20): optimal range 65-80%, penalise extremes
    const loanBalance = loanToDepositPct;
    const loanScore =
      loanBalance >= 65 && loanBalance <= 80
        ? 20
        : loanBalance >= 55 && loanBalance <= 85
          ? 14
          : loanBalance >= 45 && loanBalance <= 90
            ? 8
            : 4;

    return Math.round(capitalScore + liquidityScore + niiScore + growthScore + loanScore);
  }

  // ─── String Utilities ─────────────────────────────────────

  private normalize(input: string): string {
    return input
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // strip diacritics
      .replace(/cooperativa\s+de\s+ahorro\s+y\s+credito\s+(de\s+)?/g, '')
      .replace(/cooperativa\s+/g, '')
      .replace(/[^a-z0-9\s\-]/g, '')
      .trim();
  }

  /**
   * Classic Levenshtein distance — O(n*m) DP.
   * No external dependencies.
   */
  private levenshtein(a: string, b: string): number {
    const la = a.length;
    const lb = b.length;
    if (la === 0) return lb;
    if (lb === 0) return la;

    // Use single-row optimisation
    let prev = Array.from({ length: lb + 1 }, (_, i) => i);
    let curr = new Array<number>(lb + 1);

    for (let i = 1; i <= la; i++) {
      curr[0] = i;
      for (let j = 1; j <= lb; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(
          prev[j] + 1, // deletion
          curr[j - 1] + 1, // insertion
          prev[j - 1] + cost, // substitution
        );
      }
      [prev, curr] = [curr, prev];
    }

    return prev[lb];
  }
}

// ─── Helpers ──────────────────────────────────────────────────

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatDollars(amount: number): string {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
}
