import { Injectable, Logger } from '@nestjs/common';

/**
 * SEC EDGAR provider — free, public access to all SEC filings + XBRL
 * financial facts. Used by cerniq for:
 *
 *   - Portfolio holdings analysis: pull recent 10-K / 10-Q / 8-K filings
 *     for any equity held on the investment book.
 *   - Peer institution research: compare cooperativa metrics against
 *     publicly-traded community banks / credit unions for sector context.
 *   - Reg-flag detection: 8-K filings for any held company surface
 *     material events (impairments, restatements) that affect valuation.
 *
 * Auth: no API key required, but the SEC mandates a User-Agent header
 * with contact info (per https://www.sec.gov/os/accessing-edgar-data).
 * We read it from `SEC_EDGAR_USER_AGENT` env var; without it the provider
 * returns null on every call (degrades gracefully — Rule 1).
 *
 * Rate limit: 10 requests/second per IP (no API-key-based limit).
 * Far above what cerniq's cache layer needs at current scale.
 *
 * Key endpoints:
 *   - https://data.sec.gov/submissions/CIK<10-digit-zero-padded>.json
 *     → recent submissions list (filings of all types, last ~1000)
 *   - https://data.sec.gov/api/xbrl/companyconcept/CIK<padded>/us-gaap/<concept>.json
 *     → time series of a single financial concept (Assets, Liabilities, etc.)
 *
 * The CIK (Central Index Key) is the 10-digit zero-padded SEC identifier
 * for a company. Callers pass the CIK as a string; the provider does the
 * zero-padding internally so caller code can use the "natural" CIK form.
 */

export interface SECFilingDto {
  accessionNumber: string;
  filingDate: string; // ISO date
  form: string; // '10-K', '10-Q', '8-K', etc.
  primaryDocument: string; // Filename of the primary submission
  reportDate?: string; // The period the filing covers
  size?: number; // Submission size in bytes
  isXbrl?: boolean;
  isInlineXbrl?: boolean;
  provider: 'sec-edgar';
  serverTimestamp: Date;
}

export interface SECRecentFilingsDto {
  cik: string;
  name: string;
  filings: SECFilingDto[];
  asOf: Date;
  provider: 'sec-edgar';
}

export interface SECConceptDataPointDto {
  accn: string;
  end: string; // ISO date for the period-end
  val: number;
  fy?: number; // Fiscal year
  fp?: string; // Fiscal period (Q1, Q2, Q3, FY)
  form: string;
  filed: string;
}

export interface SECConceptDto {
  cik: string;
  taxonomy: string; // 'us-gaap' usually
  concept: string; // e.g. 'Assets', 'Liabilities', 'Revenues'
  label: string;
  units: Record<string, SECConceptDataPointDto[]>; // 'USD', 'shares', etc.
  provider: 'sec-edgar';
  asOf: Date;
}

@Injectable()
export class SECEdgarProvider {
  private readonly logger = new Logger(SECEdgarProvider.name);
  private readonly baseUrl = 'https://data.sec.gov';

  /**
   * Read the User-Agent at call time so env mutations in tests are picked
   * up immediately. Returns null when missing — caller produces a DataGap.
   *
   * SEC's compliance requirement is "<App Name> <contact email>" or
   * similar; we don't enforce shape because the SEC's enforcement is
   * informal (they block IPs that send poor User-Agents).
   */
  private getUserAgent(): string | null {
    const ua = process.env.SEC_EDGAR_USER_AGENT;
    return ua && ua.trim().length > 0 ? ua.trim() : null;
  }

  /** Zero-pad CIK to the 10-digit form SEC requires in URLs. */
  private padCik(cik: string): string {
    const clean = cik.trim().replace(/^CIK/i, '').replace(/^0+/, '');
    if (!/^[0-9]{1,10}$/.test(clean)) {
      throw new Error(`Invalid CIK: ${cik}`);
    }
    return clean.padStart(10, '0');
  }

  /**
   * Recent filings for a CIK (up to ~1000 most recent). Returns null on
   * any upstream failure (missing UA, network, non-2xx, malformed body).
   */
  async getRecentFilings(cik: string): Promise<SECRecentFilingsDto | null> {
    const userAgent = this.getUserAgent();
    if (!userAgent) {
      this.logger.warn(
        'SEC_EDGAR_USER_AGENT missing; cannot fetch SEC EDGAR (returning null)',
      );
      return null;
    }

    let padded: string;
    try {
      padded = this.padCik(cik);
    } catch (error: unknown) {
      // type-rationale: padCik throws Error with a known message but TS sees catch-binding as unknown
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`SEC EDGAR CIK validation failed: ${msg}`);
      return null;
    }

    const url = `${this.baseUrl}/submissions/CIK${padded}.json`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': userAgent,
          Accept: 'application/json',
        },
      });
      if (!response.ok) {
        this.logger.error(
          `SEC EDGAR submissions returned HTTP ${response.status} for CIK ${padded}`,
        );
        return null;
      }
      // type-rationale: SEC submissions schema is large + partially documented; we narrow inline
      const body = (await response.json()) as {
        cik?: string;
        name?: string;
        filings?: {
          recent?: {
            accessionNumber?: string[];
            filingDate?: string[];
            reportDate?: string[];
            form?: string[];
            primaryDocument?: string[];
            size?: number[];
            isXBRL?: number[];
            isInlineXBRL?: number[];
          };
        };
      };

      const recent = body.filings?.recent;
      if (
        !recent ||
        !recent.accessionNumber ||
        !recent.filingDate ||
        !recent.form
      ) {
        this.logger.warn(
          `SEC EDGAR submissions for CIK ${padded} lacks recent filings array`,
        );
        return null;
      }

      const count = recent.accessionNumber.length;
      const filings: SECFilingDto[] = [];
      const serverTimestamp = new Date();
      for (let i = 0; i < count; i++) {
        const accn = recent.accessionNumber[i];
        const filingDate = recent.filingDate[i];
        const form = recent.form[i];
        if (!accn || !filingDate || !form) continue;
        filings.push({
          accessionNumber: accn,
          filingDate,
          form,
          primaryDocument: recent.primaryDocument?.[i] ?? '',
          reportDate: recent.reportDate?.[i] || undefined,
          size: recent.size?.[i],
          isXbrl: recent.isXBRL?.[i] === 1,
          isInlineXbrl: recent.isInlineXBRL?.[i] === 1,
          provider: 'sec-edgar',
          serverTimestamp,
        });
      }

      if (filings.length === 0) {
        this.logger.warn(`SEC EDGAR returned zero filings for CIK ${padded}`);
        return null;
      }

      return {
        cik: padded,
        name: body.name ?? '',
        filings,
        asOf: new Date(),
        provider: 'sec-edgar',
      };
    } catch (error: unknown) {
      // type-rationale: fetch() throws unknown shapes; defensive narrowing
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`SEC EDGAR fetch failed for CIK ${padded}: ${msg}`);
      return null;
    }
  }

  /**
   * Time series of a single financial concept for a company (e.g. Assets,
   * Revenues, NetIncome). Returns the full history SEC has on record;
   * caller filters / aggregates as needed.
   */
  async getCompanyConcept(
    cik: string,
    concept: string,
    taxonomy: string = 'us-gaap',
  ): Promise<SECConceptDto | null> {
    const userAgent = this.getUserAgent();
    if (!userAgent) {
      this.logger.warn(
        'SEC_EDGAR_USER_AGENT missing; cannot fetch SEC EDGAR (returning null)',
      );
      return null;
    }
    if (!/^[A-Za-z][A-Za-z0-9]{1,100}$/.test(concept)) {
      this.logger.warn(`Invalid concept name: ${concept}`);
      return null;
    }
    let padded: string;
    try {
      padded = this.padCik(cik);
    } catch {
      return null;
    }

    const url = `${this.baseUrl}/api/xbrl/companyconcept/CIK${padded}/${taxonomy}/${concept}.json`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': userAgent,
          Accept: 'application/json',
        },
      });
      if (response.status === 404) {
        // 404 here means "this CIK doesn't report this concept" — common
        // and not an error. Surface as null (caller renders DataGap).
        this.logger.debug(
          `SEC EDGAR concept ${concept} not reported by CIK ${padded}`,
        );
        return null;
      }
      if (!response.ok) {
        this.logger.error(
          `SEC EDGAR concept returned HTTP ${response.status} for CIK ${padded}/${concept}`,
        );
        return null;
      }
      // type-rationale: SEC concept schema is large; we narrow to fields we use
      const body = (await response.json()) as {
        cik?: number;
        taxonomy?: string;
        tag?: string;
        label?: string;
        units?: Record<
          string,
          Array<{
            accn?: string;
            end?: string;
            val?: number;
            fy?: number;
            fp?: string;
            form?: string;
            filed?: string;
          }>
        >;
      };

      const units: Record<string, SECConceptDataPointDto[]> = {};
      for (const [unit, points] of Object.entries(body.units ?? {})) {
        units[unit] = points
          .filter(
            (p) =>
              typeof p.val === 'number' &&
              typeof p.end === 'string' &&
              typeof p.accn === 'string' &&
              typeof p.form === 'string' &&
              typeof p.filed === 'string',
          )
          .map((p) => ({
            accn: p.accn!,
            end: p.end!,
            val: p.val!,
            fy: p.fy,
            fp: p.fp,
            form: p.form!,
            filed: p.filed!,
          }));
      }

      // If every unit's filtered array is empty, the concept exists but
      // has no usable data points — surface that as null (Rule 1).
      const hasAnyPoints = Object.values(units).some((arr) => arr.length > 0);
      if (!hasAnyPoints) {
        this.logger.warn(
          `SEC EDGAR concept ${concept} for CIK ${padded} has no parseable data points`,
        );
        return null;
      }

      return {
        cik: padded,
        taxonomy: body.taxonomy ?? taxonomy,
        concept: body.tag ?? concept,
        label: body.label ?? concept,
        units,
        provider: 'sec-edgar',
        asOf: new Date(),
      };
    } catch (error: unknown) {
      // type-rationale: fetch error shapes are unknown by spec
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`SEC EDGAR concept fetch failed: ${msg}`);
      return null;
    }
  }
}
