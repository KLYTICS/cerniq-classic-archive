import { Injectable, Logger } from '@nestjs/common';
import {
  YieldCurveDto,
  YieldCurvePointDto,
  YieldCurveTenor,
} from '../dto/macro.dto';

/**
 * US Treasury Fiscal Data API provider — the official source for daily
 * Treasury yield curve rates, served directly from the Treasury Department.
 * No auth required; rate limit is generous (no documented cap as of
 * 2026-05; in practice well above what a backend cache layer needs).
 *
 * Why this exists alongside FRED:
 *   - FRED republishes Treasury data with a T+1 lag and occasional
 *     publication delays around month-end / quarter-end. The Treasury
 *     Fiscal Data API serves the Treasury's own data closer to the source.
 *   - When FRED is down (rare but happens during St. Louis Fed
 *     maintenance windows), this provider lets the yield curve surface
 *     stay live with byte-for-byte equivalent rates.
 *   - The multi-provider failover pattern (try FRED, fall back to
 *     Treasury Fiscal Data) is the canonical enterprise-grade move and
 *     reusable for any future redundancy (Bloomberg primary → Refinitiv
 *     fallback, etc.).
 *
 * Endpoint shape:
 *   GET https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/
 *       accounting/od/daily_treasury_yield_curve_rates
 *   ?fields=record_date,bc_1month,bc_3month,...
 *   &sort=-record_date
 *   &page[size]=1
 *
 * Response shape (relevant fields only):
 *   {
 *     data: [{
 *       record_date: '2026-05-15',
 *       bc_1month: '5.30',  // string, not number
 *       bc_3month: '5.28',
 *       ...
 *     }]
 *   }
 *
 * Missing values come back as null (not the FRED-style "." sentinel).
 * Numeric values are quoted strings — we parseFloat defensively.
 */
@Injectable()
export class TreasuryFiscalDataProvider {
  private readonly logger = new Logger(TreasuryFiscalDataProvider.name);
  private readonly baseUrl =
    'https://api.fiscaldata.treasury.gov/services/api/fiscal_service';

  /**
   * Treasury Fiscal Data field-name → canonical YieldCurveTenor mapping.
   * Order matters: the array order matches the conventional short-to-long
   * curve plotting order, mirroring FredProvider.US_TREASURY_CMT_SERIES.
   */
  private static readonly TENOR_FIELDS: ReadonlyArray<
    readonly [YieldCurveTenor, string]
  > = [
    ['1M', 'bc_1month'],
    ['3M', 'bc_3month'],
    ['6M', 'bc_6month'],
    ['1Y', 'bc_1year'],
    ['2Y', 'bc_2year'],
    ['3Y', 'bc_3year'],
    ['5Y', 'bc_5year'],
    ['7Y', 'bc_7year'],
    ['10Y', 'bc_10year'],
    ['20Y', 'bc_20year'],
    ['30Y', 'bc_30year'],
  ];

  /**
   * Latest daily Treasury yield curve. Same DTO shape as FredProvider so
   * the consumer (`MarketDataService.getYieldCurve`) is interchangeable.
   * Returns `null` only on catastrophic failure (every tenor missing or
   * upstream unreachable) — partial tenors render as a partial curve.
   */
  async getYieldCurve(): Promise<YieldCurveDto | null> {
    const fields = TreasuryFiscalDataProvider.TENOR_FIELDS.map(
      ([, f]) => f,
    ).join(',');
    const url =
      `${this.baseUrl}/v2/accounting/od/daily_treasury_yield_curve_rates` +
      `?fields=record_date,${fields}` +
      `&sort=-record_date` +
      `&page%5Bsize%5D=1`;

    let row: Record<string, unknown> | null = null;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        this.logger.error(
          `Treasury Fiscal Data returned HTTP ${response.status} ${response.statusText}`,
        );
        return null;
      }
      // type-rationale: Treasury Fiscal Data API response is shaped as { data: Record<string, unknown>[] } — we narrow inline
      const body = (await response.json()) as {
        data?: Array<Record<string, unknown>>;
      };
      const first = body.data?.[0];
      if (!first) {
        this.logger.warn(
          'Treasury Fiscal Data returned empty data array (no rates published yet?)',
        );
        return null;
      }
      row = first;
    } catch (error: unknown) {
      // type-rationale: fetch() throws unknown error shapes; we only read .message defensively
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Treasury Fiscal Data fetch failed: ${msg}`);
      return null;
    }

    const recordDate =
      typeof row.record_date === 'string' ? row.record_date : null;
    if (!recordDate) {
      this.logger.warn(
        'Treasury Fiscal Data row missing record_date (response shape changed?)',
      );
      return null;
    }

    const points: YieldCurvePointDto[] = [];
    for (const [tenor, field] of TreasuryFiscalDataProvider.TENOR_FIELDS) {
      const raw = row[field];
      // The API sends `null` for missing tenors (e.g. 20Y was suspended 2002-2020).
      // Treat any null / undefined / empty / unparseable as "no data" — Rule 1.
      if (raw === null || raw === undefined || raw === '') continue;
      const num = typeof raw === 'string' ? Number(raw) : Number(raw);
      if (!Number.isFinite(num)) continue;
      points.push({
        tenor,
        rate: num,
        asOf: recordDate,
        seriesId: field, // Treasury's own field name doubles as lineage breadcrumb
      });
    }

    if (points.length === 0) {
      this.logger.error(
        'Treasury Fiscal Data row had no parseable tenors (every field null?)',
      );
      return null;
    }

    // Inversion detection — mirror FredProvider for byte-for-byte parity.
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
      asOf: recordDate,
      provider: 'treasury-fiscal-data',
      serverTimestamp: new Date(),
      inverted,
      invertedDetail,
    };
  }
}
