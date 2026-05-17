// Macro-data DTOs — interest rates, yield curves, FX, economic indicators.
//
// These complement the security-pricing DTOs in quote.dto.ts: those describe
// what a single instrument is worth right now; the types below describe the
// macroeconomic surface every ALM model needs (curves for duration / EVE,
// indicators for stress testing, FX for any multi-currency reporting).
//
// Provider-agnostic by design — populated today from FRED (US Treasury rates)
// but the shape stays stable as new vendors are added (Bloomberg BPIPE,
// Refinitiv, ICE Bank of America, etc.). Lineage is carried in `provider` +
// `asOf` so consumers can audit the source of every number.

/** Tenor / maturity classification for yield-curve points. */
export type YieldCurveTenor =
  | '1M'
  | '3M'
  | '6M'
  | '1Y'
  | '2Y'
  | '3Y'
  | '5Y'
  | '7Y'
  | '10Y'
  | '20Y'
  | '30Y';

/** Single point on a yield curve. */
export class YieldCurvePointDto {
  tenor: YieldCurveTenor;
  rate: number; // annual percentage (e.g. 4.35 means 4.35%)
  asOf: string; // ISO date — the observation date from the provider
  seriesId: string; // provider-specific series identifier (e.g. 'DGS10' for FRED)
}

/** Full yield curve snapshot. */
export class YieldCurveDto {
  curve: string; // e.g. 'US_TREASURY_CMT' (Constant Maturity Treasury)
  currency: string; // e.g. 'USD'
  points: YieldCurvePointDto[];
  asOf: string; // ISO date — the effective curve date (latest common date across tenors)
  provider: string; // 'fred', 'bloomberg', etc.
  serverTimestamp: Date; // when cerniq fetched this
  // Inversion flag: true when the spread between a long tenor and a shorter
  // one goes negative (classic recession signal). Computed eagerly so callers
  // don't need to re-derive.
  inverted: boolean;
  invertedDetail?: string; // e.g. '10Y-2Y spread = -0.18%'
}

/** Single interest-rate observation (single series, latest value). */
export class InterestRateDto {
  seriesId: string; // e.g. 'DGS10'
  name: string; // human-readable, e.g. '10-Year Treasury Constant Maturity Rate'
  rate: number; // annual percentage
  asOf: string; // ISO date of the observation
  units: 'percent'; // future-proof: could expand to 'basis_points' etc.
  provider: string;
  serverTimestamp: Date;
}

/** Generic economic indicator (CPI, unemployment, GDP, etc.). */
export class EconomicIndicatorDto {
  seriesId: string;
  name: string;
  value: number;
  units: string; // FRED carries this verbatim — e.g. 'Index 1982-1984=100', 'Percent', 'Billions of Dollars'
  frequency: string; // 'Monthly' | 'Quarterly' | 'Annual' | 'Weekly'
  asOf: string;
  provider: string;
  serverTimestamp: Date;
}

/** FX rate (currency pair). */
export class FXRateDto {
  pair: string; // e.g. 'USD/EUR'
  base: string; // 'USD'
  quote: string; // 'EUR'
  rate: number; // 1 base = `rate` quote units
  asOf: string;
  provider: string;
  serverTimestamp: Date;
}
