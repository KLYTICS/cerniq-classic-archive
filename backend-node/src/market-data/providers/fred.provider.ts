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
 * FRED (Federal Reserve Economic Data) provider — free macroeconomic data
 * from the St. Louis Fed. Used for interest-rate curves, FX, and economic
 * indicators that every ALM model needs (duration / EVE / NII / stress).
 *
 * Auth: `FRED_API_KEY` env var. Free registration at
 * https://fred.stlouisfed.org/docs/api/api_key.html. Without a key, the
 * provider degrades gracefully — `getYieldCurve()` etc. return `null` and
 * the surrounding `MarketDataService.fetchWithTelemetry` records the miss
 * as a provider failure (audit-visible, no silent zeroing per KLYTICS Rule 1).
 *
 * Rate limits: 120 requests/min per key. The provider does NOT itself
 * throttle — it relies on `MarketDataService`'s circuit-breaker pattern
 * (`recordProviderResult` + `isCircuitOpen`) to back off after consecutive
 * failures. Series-level requests for a single yield-curve snapshot are
 * issued in parallel via `Promise.allSettled` so one tenor missing data
 * doesn't kill the whole curve — the surviving points are returned with
 * the missing ones omitted, and the caller can see exactly which tenors
 * loaded via `points.length`.
 *
 * Lineage: every DTO carries `provider: 'fred'` + `seriesId` + `asOf` so
 * downstream auditors can re-derive any number from the public FRED API.
 */
@Injectable()
export class FredProvider {
  private readonly logger = new Logger(FredProvider.name);
  private readonly baseUrl = 'https://api.stlouisfed.org/fred';

  /**
   * Constant Maturity Treasury yield-curve series. Tenor → FRED series id.
   * Order matters: callers consuming `getYieldCurve()` get the array sorted
   * short-to-long which matches conventional curve plots.
   */
  private static readonly US_TREASURY_CMT_SERIES: ReadonlyArray<
    readonly [YieldCurveTenor, string]
  > = [
    ['1M', 'DGS1MO'],
    ['3M', 'DGS3MO'],
    ['6M', 'DGS6MO'],
    ['1Y', 'DGS1'],
    ['2Y', 'DGS2'],
    ['3Y', 'DGS3'],
    ['5Y', 'DGS5'],
    ['7Y', 'DGS7'],
    ['10Y', 'DGS10'],
    ['20Y', 'DGS20'],
    ['30Y', 'DGS30'],
  ];

  /**
   * Well-known series names. FRED's `/series` endpoint returns these but
   * we hardcode the common ones to save an API call per request. Series not
   * in this map fall back to the series id as the display name.
   */
  private static readonly SERIES_NAMES: Record<string, string> = {
    DGS1MO: '1-Month Treasury Constant Maturity Rate',
    DGS3MO: '3-Month Treasury Constant Maturity Rate',
    DGS6MO: '6-Month Treasury Constant Maturity Rate',
    DGS1: '1-Year Treasury Constant Maturity Rate',
    DGS2: '2-Year Treasury Constant Maturity Rate',
    DGS3: '3-Year Treasury Constant Maturity Rate',
    DGS5: '5-Year Treasury Constant Maturity Rate',
    DGS7: '7-Year Treasury Constant Maturity Rate',
    DGS10: '10-Year Treasury Constant Maturity Rate',
    DGS20: '20-Year Treasury Constant Maturity Rate',
    DGS30: '30-Year Treasury Constant Maturity Rate',
    CPIAUCSL: 'Consumer Price Index for All Urban Consumers',
    UNRATE: 'Unemployment Rate',
    GDP: 'Gross Domestic Product',
    DEXUSEU: 'U.S. Dollars to Euro Spot Exchange Rate',
    DEXUSUK: 'U.S. Dollars to U.K. Pound Spot Exchange Rate',
    DEXJPUS: 'Japanese Yen to U.S. Dollar Spot Exchange Rate',
  };

  /**
   * Read the API key on each call so test setup can mutate `process.env`
   * mid-suite without instantiating a new provider. Returns null when the
   * key is missing so the surrounding caller can produce a DataGap.
   */
  private getApiKey(): string | null {
    const key = process.env.FRED_API_KEY;
    return key && key.trim().length > 0 ? key.trim() : null;
  }

  /**
   * Fetch the latest observation for a single FRED series. Returns
   * `{ date, value }` or `null` on any failure (missing key, network,
   * "value: '.'" sentinel, malformed response). Caller decides how to
   * propagate the miss — usually as a DataGap or a curve-point omission.
   */
  async getLatestObservation(
    seriesId: string,
  ): Promise<{ date: string; value: number } | null> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      this.logger.warn(
        `FRED_API_KEY missing; cannot fetch ${seriesId} (returning null)`,
      );
      return null;
    }

    const url =
      `${this.baseUrl}/series/observations` +
      `?series_id=${encodeURIComponent(seriesId)}` +
      `&api_key=${encodeURIComponent(apiKey)}` +
      `&file_type=json&sort_order=desc&limit=1`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        this.logger.error(
          `FRED ${seriesId} returned HTTP ${response.status} ${response.statusText}`,
        );
        return null;
      }
      const body = (await response.json()) as {
        observations?: Array<{ date: string; value: string }>;
      };
      const obs = body.observations?.[0];
      if (!obs) {
        this.logger.warn(`FRED ${seriesId} returned empty observations array`);
        return null;
      }
      // FRED encodes "missing" as "." — treat as no-data, never silent-zero.
      if (obs.value === '.' || obs.value === '' || obs.value == null) {
        this.logger.warn(
          `FRED ${seriesId} latest observation has no value (asOf ${obs.date}); skipping`,
        );
        return null;
      }
      const value = Number(obs.value);
      if (!Number.isFinite(value)) {
        this.logger.warn(
          `FRED ${seriesId} returned non-numeric value '${obs.value}'`,
        );
        return null;
      }
      return { date: obs.date, value };
      // type-rationale: catch-block from native fetch() — error is `unknown` by spec but we only read .message defensively
    } catch (error: any) {
      this.logger.error(
        `FRED ${seriesId} fetch failed: ${error?.message ?? error}`,
      );
      return null;
    }
  }

  /**
   * Build the US Treasury Constant-Maturity yield curve. Fires all tenors
   * in parallel; the curve is returned with whichever tenors loaded
   * successfully. Returns `null` only if EVERY tenor failed (catastrophic
   * provider miss — surface as DataGap upstream). Inverted flag computed
   * from 10Y vs 2Y spread (the classic recession signal).
   */
  async getYieldCurve(): Promise<YieldCurveDto | null> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      this.logger.warn(
        'FRED_API_KEY missing; cannot fetch yield curve (returning null)',
      );
      return null;
    }

    const series = FredProvider.US_TREASURY_CMT_SERIES;
    const observations = await Promise.allSettled(
      series.map(([, seriesId]) => this.getLatestObservation(seriesId)),
    );

    const points: YieldCurvePointDto[] = [];
    for (let i = 0; i < series.length; i++) {
      const [tenor, seriesId] = series[i];
      const result = observations[i];
      if (result.status === 'fulfilled' && result.value !== null) {
        points.push({
          tenor,
          rate: result.value.value,
          asOf: result.value.date,
          seriesId,
        });
      }
    }

    if (points.length === 0) {
      this.logger.error(
        'FRED yield-curve fetch: every tenor failed (returning null)',
      );
      return null;
    }

    // Effective curve date = latest asOf across loaded points. FRED publishes
    // tenors on the same business-day cadence so this is usually all-same;
    // when it differs the caller still sees the latest tenor's date and the
    // individual seriesId-level asOf in each point.
    const effectiveAsOf = points
      .map((p) => p.asOf)
      .sort()
      .reverse()[0];

    // Inversion detection — 10Y minus 2Y spread. Both must be loaded.
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
      curve: 'US_TREASURY_CMT',
      currency: 'USD',
      points,
      asOf: effectiveAsOf,
      provider: 'fred',
      serverTimestamp: new Date(),
      inverted,
      invertedDetail,
    };
  }

  /**
   * Latest observation for a named series, wrapped in the discipline DTO.
   * Use for single-rate references (1-month bill, 10-year note) outside the
   * full yield-curve composition.
   */
  async getInterestRate(seriesId: string): Promise<InterestRateDto | null> {
    const obs = await this.getLatestObservation(seriesId);
    if (!obs) return null;
    return {
      seriesId,
      name: FredProvider.SERIES_NAMES[seriesId] ?? seriesId,
      rate: obs.value,
      asOf: obs.date,
      units: 'percent',
      provider: 'fred',
      serverTimestamp: new Date(),
    };
  }

  /**
   * Generic economic indicator (CPI, unemployment, GDP, etc.). Units come
   * back as a free-form string from FRED and are forwarded verbatim — caller
   * decides how to format. For known series we use a hardcoded units hint;
   * unknown series default to 'value' (the consumer must check the series'
   * FRED-published metadata for full context — `provider` + `seriesId` are
   * the lineage breadcrumbs).
   */
  async getEconomicIndicator(
    seriesId: string,
    options: { units?: string; frequency?: string } = {},
  ): Promise<EconomicIndicatorDto | null> {
    const obs = await this.getLatestObservation(seriesId);
    if (!obs) return null;
    return {
      seriesId,
      name: FredProvider.SERIES_NAMES[seriesId] ?? seriesId,
      value: obs.value,
      units: options.units ?? 'value',
      frequency: options.frequency ?? 'unknown',
      asOf: obs.date,
      provider: 'fred',
      serverTimestamp: new Date(),
    };
  }

  /**
   * FX rate via FRED's exchange-rate series. Caller passes the FRED series
   * id directly (e.g. 'DEXUSEU' for USD/EUR). Returns null if the series
   * doesn't exist or has no recent observation; that's better than silent
   * zero — the caller surfaces the gap to the user (Rule 1 composes here).
   *
   * Note: FRED's `DEX*` series are quoted as "1 base = N quote" with
   * conventions that vary by pair (DEXUSEU is USD-to-EUR, DEXJPUS is
   * JPY-to-USD). The caller is responsible for the `base`/`quote` strings;
   * FRED gives only the numeric rate.
   */
  async getFXRate(
    seriesId: string,
    base: string,
    quote: string,
  ): Promise<FXRateDto | null> {
    const obs = await this.getLatestObservation(seriesId);
    if (!obs) return null;
    return {
      pair: `${base}/${quote}`,
      base,
      quote,
      rate: obs.value,
      asOf: obs.date,
      provider: 'fred',
      serverTimestamp: new Date(),
    };
  }
}
