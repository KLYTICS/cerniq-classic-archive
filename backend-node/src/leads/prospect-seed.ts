/**
 * GTM pipeline seed helpers.
 *
 * Institution rows come from the committed COSSEC Anejo 9 registry
 * (`src/alm/data/registry/pr-cooperativas-q2-2025.json`). This module only
 * holds sector benchmarks and the retired legacy name list used to mark
 * pre-registry CRM rows as stale.
 */

import { listPrCooperativas } from '../alm/data/registry/pr-cooperativas.registry';

/**
 * @deprecated Use listPrCooperativas() / seedProspectPipeline registry upsert.
 * Kept only so seed can tag leftover CRM rows that were created from this list.
 */
export const LEGACY_COOPERATIVA_PROSPECT_NAMES = [
  'Cooperativa de Ahorro y Crédito de Aguada',
  'Cooperativa de Ahorro y Crédito de Caguas',
  'Cooperativa de Ahorro y Crédito de Ponce',
  'Cooperativa de Ahorro y Crédito Oriental',
  'Cooperativa de Ahorro y Crédito de Arecibo',
  'Cooperativa de Ahorro y Crédito de Bayamón',
  'Cooperativa de Ahorro y Crédito de Mayagüez',
  'Cooperativa de Ahorro y Crédito de Carolina',
  'Cooperativa de Ahorro y Crédito de Guaynabo',
  'Cooperativa de Ahorro y Crédito de Trujillo Alto',
  'Cooperativa de Ahorro y Crédito de San Germán',
  'Cooperativa de Ahorro y Crédito Roosevelt Roads',
] as const;

/** Alias retained for any external import — empty; registry is the source of truth. */
export const COOPERATIVA_PROSPECTS: never[] = [];

/**
 * COSSEC Sector Benchmark — aligned to Anejo 9 system totals (Q2 2025 extract).
 * Period label kept as "Q3 2025" historically in some UIs; we also upsert "Q2 2025".
 */
export const COSSEC_BENCHMARK_Q2_2025 = {
  period: 'Q2 2025',
  totalAssetsMedian: 101_002_407.01,
  capitalRatioMedian: 9.2,
  loanToShareMedian: 72.5,
  liquidityRatioMedian: 22.1,
  niiMarginMedian: 3.8,
  assetGrowthYoy: 4.2,
  memberCountTotal: 1_161_760,
  activeInstitutions: 91,
};

/** @deprecated Prefer COSSEC_BENCHMARK_Q2_2025 — same activeInstitutions: 91 */
export const COSSEC_BENCHMARK_Q3_2025 = {
  period: 'Q3 2025',
  totalAssetsMedian: 185_000_000,
  capitalRatioMedian: 9.2,
  loanToShareMedian: 72.5,
  liquidityRatioMedian: 22.1,
  niiMarginMedian: 3.8,
  assetGrowthYoy: 4.2,
  memberCountTotal: 1_164_046,
  activeInstitutions: 91,
};

export function registryProspectCount(): number {
  return listPrCooperativas().length;
}
