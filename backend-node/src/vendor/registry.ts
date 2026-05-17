/**
 * KLYTICS Vendor Registry — the single source of truth for every financial
 * vendor cerniq integrates with or plans to integrate with.
 *
 * This is declarative metadata, not runtime configuration. Each entry
 * carries enough context for engineering review (compliance posture,
 * integration cost) and operator visibility (status, category, gating
 * dependency). The admin /vendor-status page consumes this list directly.
 *
 * Adding a new vendor:
 *   1. Append a VendorEntry to VENDOR_REGISTRY below
 *   2. Build the provider class under src/market-data/providers/ (for
 *      market data) or src/vendor/<category>/ (for non-market data)
 *   3. Flip status from 'planned' → 'scaffold' → 'beta' → 'production'
 *      as the integration matures
 *
 * Status semantics:
 *   - 'planned':     no code yet; this entry documents intent + cost.
 *   - 'scaffold':    provider class exists but returns DataGap with reason
 *                    CREDENTIALS_REQUIRED until contract / sandbox is set up.
 *   - 'beta':        provider wired + smoke-tested but not all surfaces stable.
 *   - 'production':  provider fully integrated, monitored, contract signed.
 *
 * Compliance-posture semantics:
 *   - 'public':      no auth, public data (FRED, SEC EDGAR, Treasury Fiscal Data).
 *   - 'free-tier':   free signup + API key, generous rate limits (Alpha Vantage).
 *   - 'paid-self':   contract with vendor, credit-card auth (Polygon.io, Stripe).
 *   - 'paid-enterprise': institutional contract + procurement (Bloomberg, Refinitiv).
 *   - 'regulator':   government-issued credentials (COSSEC, NCUA).
 *   - 'core-banking': contract via cooperativa's existing core-banking vendor (Symitar).
 *
 * Integration-cost is a rough order-of-magnitude estimate in engineer-days
 * for "first useful surface live" — covers auth setup, one endpoint mapped,
 * one cerniq page wired. Does NOT cover ongoing maintenance, monitoring,
 * compliance attestation, or scaling.
 */

export type VendorStatus = 'planned' | 'scaffold' | 'beta' | 'production';

export type VendorCompliancePosture =
  | 'public'
  | 'free-tier'
  | 'paid-self'
  | 'paid-enterprise'
  | 'regulator'
  | 'core-banking';

export type VendorCategory =
  | 'market-data'
  | 'macro-rates'
  | 'filings'
  | 'core-banking'
  | 'regulator-filing'
  | 'aml-kyc'
  | 'identity'
  | 'payments'
  | 'esg'
  | 'peer-data';

export interface VendorEntry {
  /** Stable identifier — used in logs, registry lookups, admin UI keys. */
  id: string;
  /** Display name. */
  name: string;
  /** What the vendor sells / provides. */
  description: string;
  /** Best category for grouping in admin UI. */
  category: VendorCategory;
  /** Where the integration sits in maturity. */
  status: VendorStatus;
  /** Auth + cost shape. */
  compliancePosture: VendorCompliancePosture;
  /** Engineer-days for first useful surface live (rough). */
  integrationCostDays: number;
  /** Public URL — vendor's marketing or developer-portal page. */
  url: string;
  /** Where the provider class lives (relative to backend-node/src/), if any. */
  providerPath?: string;
  /** Env vars the provider reads (for credentials / config). */
  envVars: string[];
  /** What blocks this from moving to production. */
  blockedBy?: string;
  /** PR-cooperativa relevance — why a cerniq operator should care. */
  prCooperativaRelevance: string;
}

export const VENDOR_REGISTRY: ReadonlyArray<VendorEntry> = [
  // ─── Market data — securities pricing ──────────────────────────────────
  {
    id: 'yahoo-finance',
    name: 'Yahoo Finance',
    description:
      'End-of-day equity, ETF, and index quotes; fundamentals; historical prices',
    category: 'market-data',
    status: 'production',
    compliancePosture: 'public',
    integrationCostDays: 0,
    url: 'https://finance.yahoo.com',
    providerPath: 'market-data/providers/yahoo-finance.provider.ts',
    envVars: [],
    prCooperativaRelevance:
      'Primary securities pricing for any equity holdings on the investment book.',
  },
  {
    id: 'coingecko',
    name: 'CoinGecko',
    description: 'Crypto asset quotes + historical prices',
    category: 'market-data',
    status: 'production',
    compliancePosture: 'free-tier',
    integrationCostDays: 0,
    url: 'https://www.coingecko.com/api',
    providerPath: 'market-data/providers/coingecko.provider.ts',
    envVars: ['COINGECKO_API_KEY'],
    prCooperativaRelevance:
      'Crypto pricing for any reserve / hedging position (rare for PR cooperativas but supported).',
  },
  {
    id: 'alpha-vantage',
    name: 'Alpha Vantage',
    description:
      'Intraday equity quotes + FX + technical indicators (RSI, MACD, etc.)',
    category: 'market-data',
    status: 'production',
    compliancePosture: 'free-tier',
    integrationCostDays: 0.5,
    url: 'https://www.alphavantage.co',
    providerPath: 'market-data/providers/alpha-vantage.provider.ts',
    envVars: ['ALPHA_VANTAGE_API_KEY'],
    prCooperativaRelevance:
      'Intraday quote refresh for at-close monitoring (Yahoo gives end-of-day only); real-time FX; technical indicators (RSI) for any equity holding. Free-tier rate limit (25 req/day per IP) keeps it as a fresh-quote fallback, not a primary feed.',
  },
  {
    id: 'polygon-io',
    name: 'Polygon.io',
    description: 'Real-time + historical equity, options, crypto, FX',
    category: 'market-data',
    status: 'planned',
    compliancePosture: 'paid-self',
    integrationCostDays: 2,
    url: 'https://polygon.io',
    envVars: ['POLYGON_API_KEY'],
    prCooperativaRelevance:
      'Options chain data — Yahoo lacks reliable options pricing; useful for any structured hedging.',
    blockedBy: 'Needs paid plan + cost-tracking integration.',
  },
  // ─── Macro-rates — interest rates, yield curves, indicators, FX ────────
  {
    id: 'fred',
    name: 'FRED (St. Louis Fed)',
    description:
      'US Treasury yield curve, interest rates, economic indicators, FX',
    category: 'macro-rates',
    status: 'production',
    compliancePosture: 'public',
    integrationCostDays: 0,
    url: 'https://fred.stlouisfed.org',
    providerPath: 'market-data/providers/fred.provider.ts',
    envVars: ['FRED_API_KEY'],
    prCooperativaRelevance:
      'Primary source for Treasury CMT curve, Fed Funds rate, Prime rate, CPI — every ALM model references these.',
  },
  {
    id: 'treasury-fiscal-data',
    name: 'US Treasury Fiscal Data API',
    description:
      'Official Treasury rates direct from the source (yield curve, debt, average rates)',
    category: 'macro-rates',
    status: 'production',
    compliancePosture: 'public',
    integrationCostDays: 1,
    url: 'https://fiscaldata.treasury.gov',
    providerPath: 'market-data/providers/treasury-fiscal-data.provider.ts',
    envVars: [],
    prCooperativaRelevance:
      'Authoritative fallback for FRED yield curve — same Treasury data, different source. Proves multi-provider failover.',
  },
  {
    id: 'ecb-sdw',
    name: 'ECB Statistical Data Warehouse',
    description:
      'EUR-area sovereign yield curve, HICP inflation, ECB key rates, reference FX',
    category: 'macro-rates',
    status: 'production',
    compliancePosture: 'public',
    integrationCostDays: 1.5,
    url: 'https://data.ecb.europa.eu',
    providerPath: 'market-data/providers/ecb-sdw.provider.ts',
    envVars: [],
    prCooperativaRelevance:
      'EUR-area rate reference (AAA sovereign curve), HICP inflation reading, ECB reference FX — useful for any EUR exposure or cross-currency stress scenarios. Complements FRED on the USD side.',
  },
  {
    id: 'bloomberg-bpipe',
    name: 'Bloomberg BPIPE',
    description:
      'Institutional-grade market data: rates, securities, derivatives',
    category: 'macro-rates',
    status: 'scaffold',
    compliancePosture: 'paid-enterprise',
    integrationCostDays: 14,
    url: 'https://www.bloomberg.com/professional/product/market-data/',
    providerPath: 'vendor/macro-rates/bloomberg-bpipe.provider.ts',
    envVars: [
      'BLOOMBERG_BPIPE_HOST',
      'BLOOMBERG_BPIPE_PORT',
      'BLOOMBERG_BPIPE_AUTH_TOKEN',
    ],
    prCooperativaRelevance:
      'Tier-1 institutional rate source — most PR cooperativas do not use Bloomberg directly; useful if cerniq grows upmarket.',
    blockedBy:
      'Bloomberg license + dedicated Server API connection required. ~$24k/yr per terminal.',
  },
  {
    id: 'refinitiv-eikon',
    name: 'Refinitiv Eikon',
    description:
      'Institutional market data + news + analytics (LSEG / Reuters)',
    category: 'macro-rates',
    status: 'scaffold',
    compliancePosture: 'paid-enterprise',
    integrationCostDays: 14,
    url: 'https://www.lseg.com/en/data-analytics',
    providerPath: 'vendor/macro-rates/refinitiv-eikon.provider.ts',
    envVars: ['REFINITIV_EIKON_HOST', 'REFINITIV_EIKON_APP_KEY'],
    prCooperativaRelevance:
      'Tier-1 alternative to Bloomberg; some cooperativas have Refinitiv via their broker relationships.',
    blockedBy: 'Eikon license + workspace API access required.',
  },
  {
    id: 'ice-bofa',
    name: 'ICE Bank of America Bond Indices',
    description: 'Corporate bond indices, sector spreads, yield benchmarks',
    category: 'macro-rates',
    status: 'scaffold',
    compliancePosture: 'paid-enterprise',
    integrationCostDays: 7,
    url: 'https://indices.ice.com',
    providerPath: 'vendor/macro-rates/ice-bofa.provider.ts',
    envVars: ['ICE_BOFA_LICENSE_KEY'],
    prCooperativaRelevance:
      'Sector-specific spread benchmarks for any corporate bond holdings on the investment book.',
    blockedBy: 'ICE Data Services license required.',
  },
  // ─── Filings ──────────────────────────────────────────────────────────
  {
    id: 'sec-edgar',
    name: 'SEC EDGAR',
    description:
      'Company filings (10-K, 10-Q, 8-K), financial statements, insider transactions',
    category: 'filings',
    status: 'production',
    compliancePosture: 'public',
    integrationCostDays: 1,
    url: 'https://www.sec.gov/edgar',
    providerPath: 'vendor/filings/sec-edgar.provider.ts',
    envVars: ['SEC_EDGAR_USER_AGENT'],
    prCooperativaRelevance:
      'Filings for any portfolio holdings; comparable-institution data when researching peer cooperativas or banks.',
  },
  // ─── Core banking ─────────────────────────────────────────────────────
  {
    id: 'symitar-jack-henry',
    name: 'Symitar (Jack Henry)',
    description: 'Core banking platform used by most PR cooperativas',
    category: 'core-banking',
    status: 'scaffold',
    compliancePosture: 'core-banking',
    integrationCostDays: 21,
    url: 'https://www.jackhenry.com/credit-unions/symitar',
    providerPath: 'vendor/core-banking/symitar.provider.ts',
    envVars: [
      'SYMITAR_HOST',
      'SYMITAR_USER',
      'SYMITAR_PASSWORD',
      'SYMITAR_CHARTER_ID',
    ],
    prCooperativaRelevance:
      'CRITICAL: most PR cooperativas run on Symitar. Direct integration enables real-time loan / share / GL data flow into ALM models without manual export.',
    blockedBy:
      "Per-cooperativa contract via cooperativa's Jack Henry account; PowerOn API access; sandbox provisioning.",
  },
  {
    id: 'corelation-keystone',
    name: 'KeyStone (Corelation)',
    description: 'Credit-union core banking platform',
    category: 'core-banking',
    status: 'planned',
    compliancePosture: 'core-banking',
    integrationCostDays: 21,
    url: 'https://www.corelationinc.com',
    envVars: ['KEYSTONE_HOST', 'KEYSTONE_API_KEY'],
    prCooperativaRelevance:
      'Smaller share of PR cooperativa market than Symitar but still significant.',
    blockedBy:
      'Lower priority than Symitar given install base; awaiting first cooperativa on KeyStone.',
  },
  // ─── Regulator filing ─────────────────────────────────────────────────
  {
    id: 'cossec-efiling',
    name: 'COSSEC e-filing',
    description:
      'Puerto Rico regulator (Corporación para Supervisión y Seguro de Cooperativas) submission portal',
    category: 'regulator-filing',
    status: 'scaffold',
    compliancePosture: 'regulator',
    integrationCostDays: 10,
    url: 'https://www.cossec.pr.gov',
    providerPath: 'vendor/regulator/cossec.provider.ts',
    envVars: [
      'COSSEC_PORTAL_USER',
      'COSSEC_PORTAL_PASSWORD',
      'COSSEC_INSTITUTION_ID',
    ],
    prCooperativaRelevance:
      'CRITICAL: every PR cooperativa files with COSSEC. Automation here eliminates the most error-prone step in the compliance workflow.',
    blockedBy:
      'COSSEC API documentation; per-institution portal credentials; sandbox availability.',
  },
  {
    id: 'ncua-5300',
    name: 'NCUA 5300 call reports',
    description:
      'National Credit Union Administration quarterly call report filing',
    category: 'regulator-filing',
    status: 'scaffold',
    compliancePosture: 'regulator',
    integrationCostDays: 10,
    url: 'https://www.ncua.gov/regulation-supervision/regulatory-reporting',
    providerPath: 'vendor/regulator/ncua-5300.provider.ts',
    envVars: [
      'NCUA_CUOnline_USER',
      'NCUA_CUOnline_PASSWORD',
      'NCUA_CHARTER_ID',
    ],
    prCooperativaRelevance:
      'CRITICAL for any federally-insured cooperativa; quarterly 5300 filing is mandatory.',
    blockedBy:
      'CUOnline portal credentials; XSD schema for the current 5300 form revision.',
  },
  // ─── AML / KYC ────────────────────────────────────────────────────────
  {
    id: 'verafin',
    name: 'Verafin (Nasdaq)',
    description: 'BSA/AML transaction monitoring + fraud detection',
    category: 'aml-kyc',
    status: 'scaffold',
    compliancePosture: 'paid-enterprise',
    integrationCostDays: 14,
    url: 'https://verafin.com',
    providerPath: 'vendor/aml-kyc/verafin.provider.ts',
    envVars: ['VERAFIN_HOST', 'VERAFIN_API_KEY', 'VERAFIN_INSTITUTION_ID'],
    prCooperativaRelevance:
      'BSA compliance — most cooperativas with $50M+ assets use Verafin. Integration unlocks SAR / CTR feed.',
    blockedBy: 'Per-cooperativa Verafin contract; sandbox provisioning.',
  },
  {
    id: 'lexisnexis-risk',
    name: 'LexisNexis Risk Solutions',
    description: 'KYC, OFAC, PEP, sanctions screening',
    category: 'aml-kyc',
    status: 'planned',
    compliancePosture: 'paid-self',
    integrationCostDays: 7,
    url: 'https://risk.lexisnexis.com',
    envVars: ['LEXISNEXIS_API_KEY', 'LEXISNEXIS_USER'],
    prCooperativaRelevance:
      'Member onboarding KYC for new cooperativa applications.',
    blockedBy:
      'Awaiting prioritization; cerniq is not currently in the member-onboarding flow.',
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────

/** All vendor entries grouped by category, in registry order. */
export function groupVendorsByCategory(): Record<
  VendorCategory,
  VendorEntry[]
> {
  const out = {} as Record<VendorCategory, VendorEntry[]>;
  for (const v of VENDOR_REGISTRY) {
    if (!out[v.category]) out[v.category] = [];
    out[v.category].push(v);
  }
  return out;
}

/** Look up a vendor by id; returns undefined if missing. */
export function findVendor(id: string): VendorEntry | undefined {
  return VENDOR_REGISTRY.find((v) => v.id === id);
}

/** Count vendors by status — for the admin dashboard's top-line stats. */
export function vendorStatusCounts(): Record<VendorStatus, number> {
  const out: Record<VendorStatus, number> = {
    planned: 0,
    scaffold: 0,
    beta: 0,
    production: 0,
  };
  for (const v of VENDOR_REGISTRY) out[v.status]++;
  return out;
}
