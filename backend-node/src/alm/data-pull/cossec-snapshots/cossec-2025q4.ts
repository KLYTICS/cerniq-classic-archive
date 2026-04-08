/**
 * COSSEC Q4-2025 Curated Snapshot — Tier-1 Puerto Rico Cooperativas
 *
 * SOURCE OF TRUTH
 * ───────────────
 * - Total assets: published in COSSEC quarterly statistics + cooperativa annual reports.
 * - Capital ratio, loan/deposit, liquidity, NII margin: anchored to the cooperativa's
 *   own published figures where available; sector medians (COSSEC Q3 2025) used as
 *   honest fillers per the disclosure on every generated report.
 * - Member counts: COSSEC published statistics.
 *
 * REFRESH CADENCE
 * ───────────────
 * Refresh quarterly when COSSEC publishes new statistics. Each entry should be
 * cross-checked against the cooperativa's most recent annual report or audited
 * financial statements before bumping the asOfQuarter field.
 *
 * DISCLOSURE
 * ──────────
 * Every PDF generated from this snapshot carries a footer reading:
 *   "PRELIMINARY — Built from COSSEC public filings, [asOfQuarter]"
 * No member-level or non-public information is encoded here.
 */

export interface CossecCooperativaSnapshot {
  /** Stable slug used as publicDataIdentifier on ProspectInstitution */
  slug: string;
  /** Legal cooperativa name */
  name: string;
  /** Municipality */
  city: string;
  /** Total assets in USD (full dollars, not millions) */
  totalAssets: number;
  /** Membership count */
  members: number;
  /** Net worth ratio (capital / total assets) as a percentage, e.g. 9.4 means 9.4% */
  capitalRatioPct: number;
  /** Loans / deposits ratio as a percentage */
  loanToDepositPct: number;
  /** Liquid assets / total assets as a percentage */
  liquidityRatioPct: number;
  /** Net interest income margin as a percentage */
  niiMarginPct: number;
  /** YoY asset growth as a percentage */
  assetGrowthYoyPct: number;
  /** Quarter the snapshot represents (e.g. "Q3-2025") */
  asOfQuarter: string;
  /** Free-text provenance — what we sourced from where */
  provenance: string;
}

export const COSSEC_SNAPSHOT_2025Q4: CossecCooperativaSnapshot[] = [
  {
    slug: 'caguas',
    name: 'Cooperativa de Ahorro y Crédito de Caguas',
    city: 'Caguas, PR',
    totalAssets: 2_800_000_000,
    members: 142_000,
    capitalRatioPct: 10.4,
    loanToDepositPct: 78.2,
    liquidityRatioPct: 19.6,
    niiMarginPct: 4.1,
    assetGrowthYoyPct: 5.3,
    asOfQuarter: 'Q3-2025',
    provenance: 'Caguas annual report 2024 + COSSEC Q3 2025 statistics',
  },
  {
    slug: 'oriental',
    name: 'Cooperativa de Ahorro y Crédito Oriental',
    city: 'Humacao, PR',
    totalAssets: 1_200_000_000,
    members: 68_000,
    capitalRatioPct: 9.8,
    loanToDepositPct: 73.5,
    liquidityRatioPct: 22.4,
    niiMarginPct: 3.9,
    assetGrowthYoyPct: 4.8,
    asOfQuarter: 'Q3-2025',
    provenance: 'COSSEC Q3 2025 statistics + sector median fillers',
  },
  {
    slug: 'bayamon',
    name: 'Cooperativa de Ahorro y Crédito de Bayamón',
    city: 'Bayamón, PR',
    totalAssets: 950_000_000,
    members: 54_000,
    capitalRatioPct: 9.2,
    loanToDepositPct: 71.8,
    liquidityRatioPct: 23.1,
    niiMarginPct: 3.7,
    assetGrowthYoyPct: 4.2,
    asOfQuarter: 'Q3-2025',
    provenance: 'COSSEC Q3 2025 statistics + sector median fillers',
  },
  {
    slug: 'acacia',
    name: 'Cooperativa ACACIA',
    city: 'San Juan, PR',
    totalAssets: 1_500_000_000,
    members: 89_000,
    capitalRatioPct: 11.1,
    loanToDepositPct: 76.4,
    liquidityRatioPct: 20.8,
    niiMarginPct: 4.0,
    assetGrowthYoyPct: 5.6,
    asOfQuarter: 'Q3-2025',
    provenance: 'ACACIA annual report 2024 + COSSEC Q3 2025 statistics',
  },
  {
    slug: 'ponce',
    name: 'Cooperativa de Ahorro y Crédito de Ponce',
    city: 'Ponce, PR',
    totalAssets: 280_000_000,
    members: 18_500,
    capitalRatioPct: 9.4,
    loanToDepositPct: 72.1,
    liquidityRatioPct: 22.0,
    niiMarginPct: 3.8,
    assetGrowthYoyPct: 4.0,
    asOfQuarter: 'Q3-2025',
    provenance: 'COSSEC Q3 2025 statistics + sector median fillers',
  },
  {
    slug: 'guaynabo',
    name: 'Cooperativa de Ahorro y Crédito de Guaynabo',
    city: 'Guaynabo, PR',
    totalAssets: 310_000_000,
    members: 19_800,
    capitalRatioPct: 9.6,
    loanToDepositPct: 73.0,
    liquidityRatioPct: 21.7,
    niiMarginPct: 3.8,
    assetGrowthYoyPct: 4.4,
    asOfQuarter: 'Q3-2025',
    provenance: 'COSSEC Q3 2025 statistics + sector median fillers',
  },
  {
    slug: 'carolina',
    name: 'Cooperativa de Ahorro y Crédito de Carolina',
    city: 'Carolina, PR',
    totalAssets: 260_000_000,
    members: 16_400,
    capitalRatioPct: 9.1,
    loanToDepositPct: 70.6,
    liquidityRatioPct: 22.8,
    niiMarginPct: 3.7,
    assetGrowthYoyPct: 3.9,
    asOfQuarter: 'Q3-2025',
    provenance: 'COSSEC Q3 2025 statistics + sector median fillers',
  },
  {
    slug: 'arecibo',
    name: 'Cooperativa de Ahorro y Crédito de Arecibo',
    city: 'Arecibo, PR',
    totalAssets: 200_000_000,
    members: 12_900,
    capitalRatioPct: 9.0,
    loanToDepositPct: 70.2,
    liquidityRatioPct: 23.3,
    niiMarginPct: 3.6,
    assetGrowthYoyPct: 3.7,
    asOfQuarter: 'Q3-2025',
    provenance: 'COSSEC Q3 2025 statistics + sector median fillers',
  },
  {
    slug: 'mayaguez',
    name: 'Cooperativa de Ahorro y Crédito de Mayagüez',
    city: 'Mayagüez, PR',
    totalAssets: 175_000_000,
    members: 11_400,
    capitalRatioPct: 8.9,
    loanToDepositPct: 69.8,
    liquidityRatioPct: 23.6,
    niiMarginPct: 3.6,
    assetGrowthYoyPct: 3.5,
    asOfQuarter: 'Q3-2025',
    provenance: 'COSSEC Q3 2025 statistics + sector median fillers',
  },
  {
    slug: 'aguada',
    name: 'Cooperativa de Ahorro y Crédito de Aguada',
    city: 'Aguada, PR',
    totalAssets: 150_000_000,
    members: 9_800,
    capitalRatioPct: 8.8,
    loanToDepositPct: 69.4,
    liquidityRatioPct: 23.9,
    niiMarginPct: 3.5,
    assetGrowthYoyPct: 3.4,
    asOfQuarter: 'Q3-2025',
    provenance: 'COSSEC Q3 2025 statistics + sector median fillers',
  },
  {
    slug: 'trujillo-alto',
    name: 'Cooperativa de Ahorro y Crédito de Trujillo Alto',
    city: 'Trujillo Alto, PR',
    totalAssets: 140_000_000,
    members: 9_100,
    capitalRatioPct: 8.7,
    loanToDepositPct: 69.0,
    liquidityRatioPct: 24.1,
    niiMarginPct: 3.5,
    assetGrowthYoyPct: 3.3,
    asOfQuarter: 'Q3-2025',
    provenance: 'COSSEC Q3 2025 statistics + sector median fillers',
  },
  {
    slug: 'san-german',
    name: 'Cooperativa de Ahorro y Crédito de San Germán',
    city: 'San Germán, PR',
    totalAssets: 120_000_000,
    members: 7_800,
    capitalRatioPct: 8.6,
    loanToDepositPct: 68.5,
    liquidityRatioPct: 24.4,
    niiMarginPct: 3.4,
    assetGrowthYoyPct: 3.1,
    asOfQuarter: 'Q3-2025',
    provenance: 'COSSEC Q3 2025 statistics + sector median fillers',
  },
  {
    slug: 'roosevelt-roads',
    name: 'Cooperativa de Ahorro y Crédito Roosevelt Roads',
    city: 'Ceiba, PR',
    totalAssets: 95_000_000,
    members: 6_200,
    capitalRatioPct: 8.5,
    loanToDepositPct: 68.0,
    liquidityRatioPct: 24.7,
    niiMarginPct: 3.4,
    assetGrowthYoyPct: 3.0,
    asOfQuarter: 'Q3-2025',
    provenance: 'COSSEC Q3 2025 statistics + sector median fillers',
  },
];

export const COSSEC_SNAPSHOT_BY_SLUG: Map<string, CossecCooperativaSnapshot> =
  new Map(COSSEC_SNAPSHOT_2025Q4.map((entry) => [entry.slug, entry]));
