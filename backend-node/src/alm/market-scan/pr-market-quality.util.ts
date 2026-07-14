/**
 * Pure PR cooperativa market quality scoring (offline / CLI).
 *
 * Health score matches FreeReportService.computeHealthScore weights so
 * free-report and market-scan stay consistent. D1: no silent zeros —
 * institutions without COSSEC snapshot ratios are data_unavailable.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  COSSEC_SNAPSHOT_2025Q4,
  type CossecCooperativaSnapshot,
} from '../data-pull/cossec-snapshots/cossec-2025q4';
import { COSSEC_BENCHMARK_Q3_2025 } from '../../leads/prospect-seed';

export type HealthGrade = 'A' | 'B' | 'C' | 'D';

export type MarketScanCoverage =
  | 'snapshot_scored'
  | 'universe_only'
  | 'data_unavailable';

export type MarketScanRow = {
  slug: string | null;
  name: string;
  city: string | null;
  region: string | null;
  estimatedAssets: number | null;
  coverage: MarketScanCoverage;
  healthScore: number | null;
  healthGrade: HealthGrade | null;
  capitalRatioPct: number | null;
  liquidityRatioPct: number | null;
  niiMarginPct: number | null;
  loanToDepositPct: number | null;
  assetGrowthYoyPct: number | null;
  lcrEstimate: number | null;
  gaps: Array<{
    field: string;
    reason: string;
    severity: 'CRITICAL' | 'WARNING';
  }>;
  asOfQuarter: string | null;
  disclosure: string;
};

export type MarketScanReport = {
  generatedAt: string;
  asOfQuarter: string;
  universeSource: string;
  snapshotSource: string;
  universeCount: number;
  scoredCount: number;
  uncoveredCount: number;
  coveragePct: number;
  gradeHistogram: Record<HealthGrade | 'UNAVAILABLE', number>;
  sectorBenchmarks: {
    capitalRatioMedian: number;
    liquidityRatioMedian: number;
    niiMarginMedian: number;
    provisional: true;
  };
  rows: MarketScanRow[];
  disclosures: string[];
};

export type UniverseSeedRow = {
  name: string;
  location: string;
  estimatedAssets: number;
  region: string;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function computeCooperativaHealthScore(metrics: {
  capitalRatioPct: number;
  liquidityRatioPct: number;
  niiMarginPct: number;
  assetGrowthYoyPct: number;
  loanToDepositPct: number;
}): number {
  const {
    capitalRatioPct,
    liquidityRatioPct,
    niiMarginPct,
    assetGrowthYoyPct,
    loanToDepositPct,
  } = metrics;

  const capitalScore = clamp(((capitalRatioPct - 7) / 5) * 20, 0, 20);
  const liquidityScore = clamp(((liquidityRatioPct - 15) / 15) * 20, 0, 20);
  const niiScore = clamp(((niiMarginPct - 2.5) / 2) * 20, 0, 20);
  const growthScore = clamp((assetGrowthYoyPct / 6) * 20, 0, 20);
  const loanBalance = loanToDepositPct;
  const loanScore =
    loanBalance >= 65 && loanBalance <= 80
      ? 20
      : loanBalance >= 55 && loanBalance <= 85
        ? 14
        : loanBalance >= 45 && loanBalance <= 90
          ? 8
          : 4;

  return Math.round(
    capitalScore + liquidityScore + niiScore + growthScore + loanScore,
  );
}

export function gradeFromScore(score: number): HealthGrade {
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  return 'D';
}

export function scoreSnapshot(
  snapshot: CossecCooperativaSnapshot,
): MarketScanRow {
  const healthScore = computeCooperativaHealthScore({
    capitalRatioPct: snapshot.capitalRatioPct,
    liquidityRatioPct: snapshot.liquidityRatioPct,
    niiMarginPct: snapshot.niiMarginPct,
    assetGrowthYoyPct: snapshot.assetGrowthYoyPct,
    loanToDepositPct: snapshot.loanToDepositPct,
  });
  const lcrEstimate = round(snapshot.liquidityRatioPct * 4.5, 1);

  return {
    slug: snapshot.slug,
    name: snapshot.name,
    city: snapshot.city,
    region: null,
    estimatedAssets: snapshot.totalAssets,
    coverage: 'snapshot_scored',
    healthScore,
    healthGrade: gradeFromScore(healthScore),
    capitalRatioPct: snapshot.capitalRatioPct,
    liquidityRatioPct: snapshot.liquidityRatioPct,
    niiMarginPct: snapshot.niiMarginPct,
    loanToDepositPct: snapshot.loanToDepositPct,
    assetGrowthYoyPct: snapshot.assetGrowthYoyPct,
    lcrEstimate,
    gaps: [],
    asOfQuarter: snapshot.asOfQuarter,
    disclosure: `PRELIMINARY — Built from COSSEC public filings, ${snapshot.asOfQuarter}`,
  };
}

export function uncoveredUniverseRow(seed: UniverseSeedRow): MarketScanRow {
  return {
    slug: null,
    name: seed.name,
    city: seed.location,
    region: seed.region,
    estimatedAssets: seed.estimatedAssets,
    coverage: 'universe_only',
    healthScore: null,
    healthGrade: null,
    capitalRatioPct: null,
    liquidityRatioPct: null,
    niiMarginPct: null,
    loanToDepositPct: null,
    assetGrowthYoyPct: null,
    lcrEstimate: null,
    gaps: [
      {
        field: 'cossec.snapshot_ratios',
        reason: 'NO_CURATED_COSSEC_SNAPSHOT',
        severity: 'WARNING',
      },
    ],
    asOfQuarter: null,
    disclosure:
      'DATA_UNAVAILABLE — listed in GTM universe seed; no curated COSSEC ratio snapshot for scoring',
  };
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function parseUniverseCsv(csvText: string): UniverseSeedRow[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const rows: UniverseSeedRow[] = [];
  for (const line of lines.slice(1)) {
    // Simple CSV split that respects quoted fields
    const cols: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === ',' && !inQuotes) {
        cols.push(cur);
        cur = '';
        continue;
      }
      cur += ch;
    }
    cols.push(cur);
    const [name, , location, assets, , , region] = cols;
    if (!name) continue;
    rows.push({
      name: name.trim(),
      location: (location || '').trim(),
      estimatedAssets: Number(assets) || 0,
      region: (region || '').trim(),
    });
  }
  return rows;
}

export function loadDefaultUniverseCsv(
  repoRoot = resolve(__dirname, '../../../../'),
): UniverseSeedRow[] {
  const path = resolve(
    repoRoot,
    'services/outbound/data/puerto_rico_cooperativas_seed.csv',
  );
  return parseUniverseCsv(readFileSync(path, 'utf8'));
}

export function buildMarketScanReport(options?: {
  universe?: UniverseSeedRow[];
  snapshots?: CossecCooperativaSnapshot[];
  nowIso?: string;
}): MarketScanReport {
  const universe = options?.universe ?? loadDefaultUniverseCsv();
  const snapshots = options?.snapshots ?? COSSEC_SNAPSHOT_2025Q4;
  const scored = snapshots.map(scoreSnapshot);

  const scoredNames = new Set(scored.map((r) => normalizeName(r.name)));
  const uncovered = universe
    .filter((u) => !scoredNames.has(normalizeName(u.name)))
    .map(uncoveredUniverseRow);

  const rows = [...scored, ...uncovered].sort((a, b) => {
    const as = a.healthScore ?? -1;
    const bs = b.healthScore ?? -1;
    if (bs !== as) return bs - as;
    return a.name.localeCompare(b.name);
  });

  const gradeHistogram: Record<HealthGrade | 'UNAVAILABLE', number> = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    UNAVAILABLE: 0,
  };
  for (const row of rows) {
    if (row.healthGrade) gradeHistogram[row.healthGrade] += 1;
    else gradeHistogram.UNAVAILABLE += 1;
  }

  const scoredCount = scored.length;
  const universeCount = rows.length;
  const uncoveredCount = uncovered.length;

  return {
    generatedAt: options?.nowIso ?? new Date().toISOString(),
    asOfQuarter: snapshots[0]?.asOfQuarter ?? 'unknown',
    universeSource: 'services/outbound/data/puerto_rico_cooperativas_seed.csv',
    snapshotSource: 'alm/data-pull/cossec-snapshots/cossec-2025q4.ts',
    universeCount,
    scoredCount,
    uncoveredCount,
    coveragePct: universeCount
      ? round((scoredCount / universeCount) * 100, 1)
      : 0,
    gradeHistogram,
    sectorBenchmarks: {
      capitalRatioMedian: COSSEC_BENCHMARK_Q3_2025.capitalRatioMedian,
      liquidityRatioMedian: COSSEC_BENCHMARK_Q3_2025.liquidityRatioMedian,
      niiMarginMedian: COSSEC_BENCHMARK_Q3_2025.niiMarginMedian,
      provisional: true,
    },
    rows,
    disclosures: [
      'Sector peer quartiles are provisional (not official COSSEC per-ratio distributions).',
      'Scored rows use curated COSSEC public-filing snapshots; uncovered rows are DATA_UNAVAILABLE (D1).',
      'Health score is a GTM composite — not a CAEL/COSSEC regulatory grade.',
      `Universe coverage: ${scoredCount}/${universeCount} institutions with ratio snapshots.`,
    ],
  };
}
