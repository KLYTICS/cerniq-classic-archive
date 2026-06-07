/**
 * NEV (Net Economic Value / Valor Económico Neto) supervisory test — pure
 * helpers.
 *
 * Kept separate from `page.tsx` so the D1-critical logic (response validation,
 * the overall semáforo mapping, the +300bps supervisory-anchor selection, and
 * the honest `—` rendering for the `data_unavailable` shape) is unit-tested
 * without rendering React. The page is a thin shell over these.
 *
 * Backend contract: `GET /api/alm/{id}/stress-test/nev` → `NEVAnalysisResult`
 * (see backend-node/src/alm/stress-testing/stress-testing.service.ts). When the
 * balance sheet is empty the engine returns `overallRating: 'data_unavailable'`,
 * `baseNEV: null`, `baseNEVRatio: null`, `shocks: []`, and a `gaps[]` manifest —
 * never phantom zeros. `formatNevMillions` / `formatPct` are the frontend half
 * of that D1 contract: a `null` reads as `—`, never `0`.
 *
 * Supervisory note (COSSEC CC-2025-01 / CAMEL-S): each shock's `riskBand` is the
 * NEV-RATIO band only (>6 low · 4–6 moderate · <4 high). The two-dimensional
 * verdict — the WORSE of the NEV-ratio band and the NEV-sensitivity band
 * (<15 low · 15–25 moderate · >25 high) — is anchored on the +300bps point and
 * surfaced by the backend as `overallRating`. We render `riskBand` faithfully
 * per row and the worse-of verdict in the banner; we never re-derive bands
 * (that would diverge from the engine's deliberate per-shock choice).
 */

import type { DataGap } from '@/hooks/useReportDataGaps';

/** The instantaneous parallel shock COSSEC CC-2025-01 anchors the verdict on. */
export const SUPERVISORY_SHOCK_BPS = 300;

export type NevRiskLevel = 'low' | 'moderate' | 'high';
export type NevOverallRating = NevRiskLevel | 'data_unavailable';
export type SemaforoTone = 'green' | 'amber' | 'red' | 'gray';

export interface NevRiskBand {
  readonly level: NevRiskLevel;
  readonly label: string;
  readonly labelEs: string;
}

export interface NevShockPoint {
  readonly shockBps: number;
  /** $M post-shock net economic value (can be negative under severe shock). */
  readonly nev: number;
  /** % of post-shock asset value. */
  readonly nevRatio: number;
  /** % change in NEV vs the base — the supervisory sensitivity dimension. */
  readonly nevChangePct: number;
  readonly riskBand: NevRiskBand;
}

export interface NevAnalysisResult {
  readonly institutionId: string;
  readonly baseNEV: number | null;
  readonly baseNEVRatio: number | null;
  readonly shocks: readonly NevShockPoint[];
  readonly worstCase: NevShockPoint | null;
  readonly overallRating: NevOverallRating;
  readonly gaps?: DataGap[];
}

/**
 * Trust-but-verify the response shape. Throws (→ AlmPage error state) on a
 * structural mismatch; never silently coerces. `baseNEV`/`baseNEVRatio` are
 * `number | null` (null is the D1 honest sentinel for an empty balance sheet),
 * so both are accepted but a wrong type (string, undefined) is rejected.
 */
export function validateNev(raw: unknown): NevAnalysisResult {
  if (!raw || typeof raw !== 'object') {
    throw new Error('NEV response must be an object');
  }
  const r = raw as Record<string, unknown>;
  if (typeof r.overallRating !== 'string') {
    throw new Error('NEV: missing overallRating');
  }
  if (!Array.isArray(r.shocks)) {
    throw new Error('NEV: shocks must be an array');
  }
  if (r.baseNEV !== null && typeof r.baseNEV !== 'number') {
    throw new Error('NEV: baseNEV must be a number or null');
  }
  if (r.baseNEVRatio !== null && typeof r.baseNEVRatio !== 'number') {
    throw new Error('NEV: baseNEVRatio must be a number or null');
  }
  return r as unknown as NevAnalysisResult;
}

export interface BannerSpec {
  readonly es: string;
  readonly en: string;
  readonly tone: SemaforoTone;
}

/**
 * Overall NEV-risk semáforo banner — Spanish-first labels a Presidente
 * Ejecutivo reads without training. `data_unavailable` is its own neutral
 * state (gray) so an empty upload never reads as low risk or a breach.
 */
export function overallBanner(rating: NevOverallRating): BannerSpec {
  switch (rating) {
    case 'low':
      return { es: 'RIESGO BAJO', en: 'LOW RISK', tone: 'green' };
    case 'moderate':
      return { es: 'RIESGO MODERADO', en: 'MODERATE RISK', tone: 'amber' };
    case 'high':
      return { es: 'RIESGO ALTO', en: 'HIGH RISK', tone: 'red' };
    case 'data_unavailable':
      return { es: 'DATOS INSUFICIENTES', en: 'INSUFFICIENT DATA', tone: 'gray' };
  }
}

/** Per-shock band semáforo tone. */
export function bandTone(level: NevRiskLevel): SemaforoTone {
  switch (level) {
    case 'low':
      return 'green';
    case 'moderate':
      return 'amber';
    case 'high':
      return 'red';
  }
}

/** Terse bilingual band label for the dense shock-ladder table. */
export function bandLabel(level: NevRiskLevel, es: boolean): string {
  switch (level) {
    case 'low':
      return es ? 'Bajo' : 'Low';
    case 'moderate':
      return es ? 'Moderado' : 'Moderate';
    case 'high':
      return es ? 'Alto' : 'High';
  }
}

/** Format a shock magnitude: `+300 pb` (es) / `−100 bps` (en). */
export function formatShockLabel(shockBps: number, es: boolean): string {
  const unit = es ? 'pb' : 'bps';
  const sign = shockBps > 0 ? '+' : shockBps < 0 ? '−' : '';
  return `${sign}${Math.abs(shockBps)} ${unit}`;
}

/**
 * Render an NEV $M value honestly. D1: `null` is the empty-balance-sheet
 * sentinel — show `—`, never `$0M`. A NEGATIVE post-shock NEV (technical
 * insolvency under a severe shock) is shown with a leading minus, e.g.
 * `−$5.0M`.
 */
export function formatNevMillions(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—';
  const sign = v < 0 ? '−' : '';
  const abs = Math.abs(v).toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${sign}$${abs}M`;
}

/** Render a percentage honestly: `null` → `—`, else fixed-precision `%`. */
export function formatPct(v: number | null | undefined, digits = 2): string {
  if (v == null || Number.isNaN(v)) return '—';
  return `${v.toFixed(digits)}%`;
}

/**
 * NEV sensitivity at a shock = the MAGNITUDE of the NEV change (the COSSEC
 * CC-2025-01 sensitivity dimension is `|ΔNEV/NEV|`). `null` → `—`.
 */
export function formatSensitivity(
  nevChangePct: number | null | undefined,
): string {
  if (nevChangePct == null || Number.isNaN(nevChangePct)) return '—';
  return `${Math.abs(nevChangePct).toFixed(2)}%`;
}

/** True for the +300bps supervisory-anchor row. */
export function isSupervisoryAnchor(shockBps: number): boolean {
  return shockBps === SUPERVISORY_SHOCK_BPS;
}

/**
 * The +300bps supervisory anchor point COSSEC classifies the institution on,
 * or `null` when the grid is empty (`data_unavailable`).
 */
export function supervisoryShock(
  shocks: readonly NevShockPoint[],
): NevShockPoint | null {
  return shocks.find((s) => isSupervisoryAnchor(s.shockBps)) ?? null;
}

/**
 * Shock ladder in ascending order (−300 → +300) for a natural top-to-bottom
 * read. Copies the array so the caller's data is never mutated; tolerant of
 * any backend ordering.
 */
export function orderedShocks(
  shocks: readonly NevShockPoint[],
): readonly NevShockPoint[] {
  return [...shocks].sort((a, b) => a.shockBps - b.shockBps);
}

/**
 * Class set for a shock-ladder cell. The +300bps anchor row uses a full-bleed
 * background (negative margins cancel the `<td>`'s padding, then re-pad inside)
 * so every cell paints one contiguous highlighted stripe WITHOUT touching the
 * shared `DataTable` — there is no per-row className API and `DataTable.tsx` is
 * outside this feature's edit scope.
 */
export function anchorCellClass(isAnchor: boolean): string {
  return isAnchor
    ? 'block -mx-3 -my-1.5 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-slate-900'
    : 'text-xs text-slate-700';
}
