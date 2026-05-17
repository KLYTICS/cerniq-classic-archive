import { Injectable, Logger } from '@nestjs/common';
import {
  EconomicIndicatorDto,
  FXRateDto,
  InterestRateDto,
  YieldCurveDto,
  YieldCurvePointDto,
  YieldCurveTenor,
} from '../dto/macro.dto';

/**
 * ECB Statistical Data Warehouse (SDW) provider — free, public, no auth.
 *
 * Complements FRED with euro-area macro data:
 *   - EUR sovereign yield curve (AAA-rated euro area governments)
 *   - HICP (Harmonised Index of Consumer Prices) — EU inflation
 *   - Euro-area key rates (deposit facility, main refinancing operations)
 *   - FX from the ECB reference-rate side (USD per EUR, etc.)
 *
 * Endpoint shape:
 *   GET https://data-api.ecb.europa.eu/service/data/{flow}/{key}?startPeriod=YYYY-MM-DD&format=csvdata
 *
 * Why CSV format instead of SDMX-JSON: SDMX-JSON is verbose (~50× the
 * payload size of CSV for a single observation) and the parsing logic is
 * non-trivial. CSV is one row per observation, columns documented at
 * https://sdw-wsrest.ecb.europa.eu/help/. The trade-off: CSV doesn't
 * carry the full dimension metadata (only the keys + observation values),
 * but we don't need it for the surfaces cerniq exposes.
 *
 * Rate limit: ECB does not publish a hard limit but the service is
 * advertised for "reasonable, non-commercial use." cerniq's cache layer
 * keeps this well within polite usage.
 *
 * Dataflows used:
 *   YC  — Yield Curve. Key shape: B.U2.EUR.4F.G_N_A.SV_C_YM.SR_<tenor>
 *         (e.g. SR_10Y, SR_2Y). 'B.U2.EUR' = daily/euro-area/EUR.
 *   ICP — Indices of Consumer Prices. Key shape: M.U2.N.000000.4.ANR
 *         (monthly/euro-area/non-SA/all-items/annual rate of change).
 *   FM  — Financial Market data. Various rate series.
 *   EXR — Exchange rates. Key shape: D.USD.EUR.SP00.A
 *         (daily/USD/quoted in EUR/spot/avg).
 */
@Injectable()
export class EcbSdwProvider {
  private readonly logger = new Logger(EcbSdwProvider.name);
  private readonly baseUrl = 'https://data-api.ecb.europa.eu/service/data';

  /** EUR area AAA sovereign yield curve — tenor → SDW key suffix. */
  private static readonly EUR_YIELD_CURVE_KEYS: ReadonlyArray<
    readonly [YieldCurveTenor, string]
  > = [
    ['3M', 'B.U2.EUR.4F.G_N_A.SV_C_YM.SR_3M'],
    ['6M', 'B.U2.EUR.4F.G_N_A.SV_C_YM.SR_6M'],
    ['1Y', 'B.U2.EUR.4F.G_N_A.SV_C_YM.SR_1Y'],
    ['2Y', 'B.U2.EUR.4F.G_N_A.SV_C_YM.SR_2Y'],
    ['3Y', 'B.U2.EUR.4F.G_N_A.SV_C_YM.SR_3Y'],
    ['5Y', 'B.U2.EUR.4F.G_N_A.SV_C_YM.SR_5Y'],
    ['7Y', 'B.U2.EUR.4F.G_N_A.SV_C_YM.SR_7Y'],
    ['10Y', 'B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y'],
    ['20Y', 'B.U2.EUR.4F.G_N_A.SV_C_YM.SR_20Y'],
    ['30Y', 'B.U2.EUR.4F.G_N_A.SV_C_YM.SR_30Y'],
  ];

  /**
   * Fetch the latest observation for an SDW series. The CSV response has
   * a documented column order; we parse defensively because the ECB
   * service has historically appended new columns without versioning.
   *
   * Returns `{ date, value }` or `null` on any failure (network, non-2xx,
   * empty body, unparseable rate).
   */
  async getLatestObservation(
    dataflow: string,
    seriesKey: string,
    options: { lookbackDays?: number } = {},
  ): Promise<{ date: string; value: number } | null> {
    const lookback = options.lookbackDays ?? 14;
    const start = new Date(Date.now() - lookback * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const url =
      `${this.baseUrl}/${encodeURIComponent(dataflow)}/${encodeURIComponent(seriesKey)}` +
      `?startPeriod=${start}&format=csvdata&detail=dataonly`;

    try {
      const response = await fetch(url, {
        headers: { Accept: 'text/csv' },
      });
      if (response.status === 404) {
        this.logger.warn(
          `ECB SDW returned 404 for ${dataflow}/${seriesKey} — series id likely changed or no observations in window`,
        );
        return null;
      }
      if (!response.ok) {
        this.logger.error(
          `ECB SDW returned HTTP ${response.status} ${response.statusText} for ${dataflow}/${seriesKey}`,
        );
        return null;
      }
      const text = await response.text();
      return this.parseLatestFromCsv(text);
    } catch (error: unknown) {
      // type-rationale: fetch() throws unknown shapes per spec
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `ECB SDW fetch failed for ${dataflow}/${seriesKey}: ${msg}`,
      );
      return null;
    }
  }

  /**
   * Parse a CSV body, return the most recent (date, value) row. Exported
   * for unit testing. The first row is the header; column names we care
   * about are TIME_PERIOD (date) and OBS_VALUE (numeric reading).
   */
  parseLatestFromCsv(csv: string): { date: string; value: number } | null {
    const lines = csv.split(/\r?\n/).filter((l) => l.length > 0);
    if (lines.length < 2) return null;
    const headers = this.splitCsvRow(lines[0]).map((h) =>
      h.replace(/^"|"$/g, ''),
    );
    const timeIdx = headers.indexOf('TIME_PERIOD');
    const valIdx = headers.indexOf('OBS_VALUE');
    if (timeIdx === -1 || valIdx === -1) {
      this.logger.warn(
        'ECB SDW CSV response missing expected columns (TIME_PERIOD / OBS_VALUE) — header drift?',
      );
      return null;
    }
    // ECB returns rows sorted ascending by TIME_PERIOD. Walk from the end
    // backwards so we pick the most recent row that has a numeric value;
    // ECB sometimes leaves trailing blank-value rows for unpublished periods.
    for (let i = lines.length - 1; i >= 1; i--) {
      const cols = this.splitCsvRow(lines[i]).map((c) =>
        c.replace(/^"|"$/g, ''),
      );
      const date = cols[timeIdx];
      const rawValue = cols[valIdx];
      if (!date || !rawValue) continue;
      const num = Number(rawValue);
      if (!Number.isFinite(num)) continue;
      return { date, value: num };
    }
    return null;
  }

  /** Minimal CSV row splitter — handles double-quoted fields with commas. */
  private splitCsvRow(row: string): string[] {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
        cur += ch;
      } else if (ch === ',' && !inQuotes) {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  }

  /**
   * EUR sovereign yield curve (AAA-rated euro area governments). Mirrors
   * `FredProvider.getYieldCurve()` so consumers can swap providers via
   * the orchestrator failover.
   */
  async getYieldCurve(): Promise<YieldCurveDto | null> {
    const observations = await Promise.allSettled(
      EcbSdwProvider.EUR_YIELD_CURVE_KEYS.map(([, key]) =>
        this.getLatestObservation('YC', key),
      ),
    );
    const points: YieldCurvePointDto[] = [];
    for (let i = 0; i < EcbSdwProvider.EUR_YIELD_CURVE_KEYS.length; i++) {
      const [tenor, key] = EcbSdwProvider.EUR_YIELD_CURVE_KEYS[i];
      const result = observations[i];
      if (result.status === 'fulfilled' && result.value !== null) {
        points.push({
          tenor,
          rate: result.value.value,
          asOf: result.value.date,
          seriesId: key,
        });
      }
    }
    if (points.length === 0) {
      this.logger.error('ECB SDW yield-curve fetch: every tenor failed');
      return null;
    }
    const effectiveAsOf = points
      .map((p) => p.asOf)
      .sort()
      .reverse()[0];
    const tenYear = points.find((p) => p.tenor === '10Y');
    const twoYear = points.find((p) => p.tenor === '2Y');
    let inverted = false;
    let invertedDetail: string | undefined;
    if (tenYear && twoYear) {
      const spread = tenYear.rate - twoYear.rate;
      inverted = spread < 0;
      invertedDetail = `10Y−2Y spread = ${spread.toFixed(2)}%`;
    }
    return {
      curve: 'EUR_AAA_SOVEREIGN',
      currency: 'EUR',
      points,
      asOf: effectiveAsOf,
      provider: 'ecb-sdw',
      serverTimestamp: new Date(),
      inverted,
      invertedDetail,
    };
  }

  /**
   * HICP (Harmonised Index of Consumer Prices) — the euro-area inflation
   * benchmark. Returns annual rate of change in percent.
   */
  async getHICP(): Promise<EconomicIndicatorDto | null> {
    const obs = await this.getLatestObservation('ICP', 'M.U2.N.000000.4.ANR', {
      lookbackDays: 90,
    });
    if (!obs) return null;
    return {
      seriesId: 'M.U2.N.000000.4.ANR',
      name: 'Euro-area HICP — All items, annual rate of change',
      value: obs.value,
      units: 'Percent',
      frequency: 'Monthly',
      asOf: obs.date,
      provider: 'ecb-sdw',
      serverTimestamp: new Date(),
    };
  }

  /**
   * ECB reference exchange rate. Caller supplies the foreign-currency ISO
   * code; the pair is always quoted "X per EUR" per ECB convention.
   *
   * Example: getECBReferenceRate('USD') returns USD per 1 EUR.
   */
  async getECBReferenceRate(
    foreignCurrency: string,
  ): Promise<FXRateDto | null> {
    if (!/^[A-Z]{3}$/.test(foreignCurrency)) {
      this.logger.warn(`Invalid currency code: ${foreignCurrency}`);
      return null;
    }
    // ECB EXR key: D.<CCY>.EUR.SP00.A — daily/<currency>/EUR/spot/average
    const key = `D.${foreignCurrency}.EUR.SP00.A`;
    const obs = await this.getLatestObservation('EXR', key);
    if (!obs) return null;
    return {
      pair: `EUR/${foreignCurrency}`,
      base: 'EUR',
      quote: foreignCurrency,
      rate: obs.value,
      asOf: obs.date,
      provider: 'ecb-sdw',
      serverTimestamp: new Date(),
    };
  }

  /**
   * ECB key policy rates — deposit facility, main refinancing operations,
   * marginal lending facility. Caller supplies the FM-dataflow key.
   *
   * Common keys:
   *   D.U2.EUR.4F.KR.DFR.LEV — Deposit facility rate
   *   D.U2.EUR.4F.KR.MRR_FR.LEV — Main refinancing operations
   *   D.U2.EUR.4F.KR.MLFR.LEV — Marginal lending facility
   */
  async getKeyRate(key: string): Promise<InterestRateDto | null> {
    if (!/^[A-Z0-9_.]{6,80}$/.test(key)) {
      this.logger.warn(`Invalid SDW key shape: ${key}`);
      return null;
    }
    const obs = await this.getLatestObservation('FM', key);
    if (!obs) return null;
    return {
      seriesId: key,
      name: this.keyRateLabel(key),
      rate: obs.value,
      asOf: obs.date,
      units: 'percent',
      provider: 'ecb-sdw',
      serverTimestamp: new Date(),
    };
  }

  private keyRateLabel(key: string): string {
    if (key.includes('DFR')) return 'ECB Deposit Facility Rate';
    if (key.includes('MRR_FR')) return 'ECB Main Refinancing Operations';
    if (key.includes('MLFR')) return 'ECB Marginal Lending Facility';
    return key;
  }
}
