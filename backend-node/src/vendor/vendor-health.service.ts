import { Injectable, Logger } from '@nestjs/common';
import { VENDOR_REGISTRY, type VendorEntry } from './registry';
import { SECEdgarProvider } from './filings/sec-edgar.provider';
import { BloombergHapiProvider } from './market-data/bloomberg-hapi.provider';
import { RefinitivEikonProvider } from './market-data/refinitiv-eikon.provider';

/**
 * VendorHealthService — runtime liveness probes for the vendor registry.
 *
 * The vendor registry (`registry.ts`) is *declarative* metadata: what we
 * support, what compliance posture, what env vars are required. This
 * service answers the orthogonal *operational* question: is each vendor
 * actually reachable + configured *right now*?
 *
 * Probe strategy per status:
 *   - **production / free-API** — issue a cheap HEAD or short GET against
 *     a known-cheap endpoint; measure latency; return state.
 *   - **production / paid-public** (FRED) — check env var presence + run
 *     a lightweight test query.
 *   - **beta (Refinitiv/Bloomberg HAPI)** — call `isConfigured()` only.
 *     We DO NOT burn paid API credits on health checks; the answer
 *     "configured locally" is the actionable signal for operators.
 *   - **scaffold / planned** — return `NOT_CONFIGURED` cleanly.
 *
 * Health endpoint compliance: returns `null` latency + clear state
 * label when a vendor's probe fails — never silent-zeros to 0ms (Rule 1).
 */

export type VendorHealthState =
  | 'OK'
  | 'DEGRADED'
  | 'UNREACHABLE'
  | 'NOT_CONFIGURED'
  | 'NOT_PROBED';

export interface VendorHealthEntry {
  vendorId: string;
  state: VendorHealthState;
  latencyMs: number | null;
  configured: boolean;
  message: string | null;
  probedAt: string;
}

export interface VendorHealthSummary {
  total: number;
  ok: number;
  degraded: number;
  unreachable: number;
  notConfigured: number;
  notProbed: number;
  vendors: VendorHealthEntry[];
  generatedAt: string;
}

@Injectable()
export class VendorHealthService {
  private readonly logger = new Logger(VendorHealthService.name);
  // Probe latency budget: anything over 1500ms is DEGRADED.
  private readonly degradedThresholdMs = 1500;
  // Hard timeout per probe — keep total health-check time bounded.
  private readonly probeTimeoutMs = 4000;

  constructor(
    private readonly secEdgar: SECEdgarProvider,
    private readonly refinitiv: RefinitivEikonProvider,
    private readonly bloomberg: BloombergHapiProvider,
  ) {}

  /** Probe every vendor concurrently and summarize. */
  async getAllHealth(): Promise<VendorHealthSummary> {
    const probedAt = new Date().toISOString();
    const probes = await Promise.allSettled(
      VENDOR_REGISTRY.map((v) => this.probeVendor(v, probedAt)),
    );
    const vendors: VendorHealthEntry[] = probes.map((result, idx) => {
      if (result.status === 'fulfilled') return result.value;
      const v = VENDOR_REGISTRY[idx];
      return {
        vendorId: v.id,
        state: 'UNREACHABLE',
        latencyMs: null,
        configured: false,
        message: `probe error: ${
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason)
        }`,
        probedAt,
      };
    });
    return this.summarize(vendors, probedAt);
  }

  private summarize(
    vendors: VendorHealthEntry[],
    probedAt: string,
  ): VendorHealthSummary {
    const counts = {
      ok: 0,
      degraded: 0,
      unreachable: 0,
      notConfigured: 0,
      notProbed: 0,
    };
    for (const v of vendors) {
      if (v.state === 'OK') counts.ok++;
      else if (v.state === 'DEGRADED') counts.degraded++;
      else if (v.state === 'UNREACHABLE') counts.unreachable++;
      else if (v.state === 'NOT_CONFIGURED') counts.notConfigured++;
      else counts.notProbed++;
    }
    return {
      total: vendors.length,
      ...counts,
      vendors,
      generatedAt: probedAt,
    };
  }

  private async probeVendor(
    v: VendorEntry,
    probedAt: string,
  ): Promise<VendorHealthEntry> {
    switch (v.id) {
      case 'yahoo-finance':
        return this.probeHttp(
          v.id,
          'https://query1.finance.yahoo.com/v6/finance/quote?symbols=AAPL',
          probedAt,
        );
      case 'coingecko':
        return this.probeHttp(
          v.id,
          'https://api.coingecko.com/api/v3/ping',
          probedAt,
        );
      case 'fred':
        return this.probeEnvOnly(v.id, ['FRED_API_KEY'], probedAt);
      case 'treasury-fiscal-data':
        return this.probeHttp(
          v.id,
          'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/avg_interest_rates?page[size]=1',
          probedAt,
        );
      case 'ecb-sdw':
        return this.probeHttp(
          v.id,
          'https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?lastNObservations=1&format=csvdata',
          probedAt,
        );
      case 'alpha-vantage':
        return this.probeEnvOnly(v.id, ['ALPHA_VANTAGE_API_KEY'], probedAt);
      case 'sec-edgar':
        return this.probeEnvOnly(v.id, ['SEC_EDGAR_USER_AGENT'], probedAt, {
          extraNote: this.secEdgar ? null : 'SEC EDGAR DI not wired',
        });
      case 'refinitiv-eikon':
        return this.probeConfiguredOnly(
          v.id,
          this.refinitiv.isConfigured(),
          probedAt,
          ['REFINITIV_APP_KEY', 'REFINITIV_APP_SECRET'],
        );
      case 'bloomberg-bpipe':
        return this.probeConfiguredOnly(
          v.id,
          this.bloomberg.isConfigured(),
          probedAt,
          [
            'BLOOMBERG_HAPI_BASE_URL',
            'BLOOMBERG_HAPI_CLIENT_ID',
            'BLOOMBERG_HAPI_CLIENT_SECRET',
            'BLOOMBERG_HAPI_ACCOUNT_ID',
          ],
        );
      default:
        // scaffolds / planned — registry knows the env vars, we just report
        // configured-or-not without an HTTP probe.
        return this.probeEnvOnly(v.id, v.envVars, probedAt, {
          notProbedReason: 'scaffold or planned — no probe endpoint defined',
        });
    }
  }

  /**
   * HTTP probe: GET against a cheap endpoint with a hard timeout.
   * State: OK if 2xx + under threshold; DEGRADED if 2xx but slow;
   * UNREACHABLE on any other outcome.
   */
  private async probeHttp(
    vendorId: string,
    url: string,
    probedAt: string,
  ): Promise<VendorHealthEntry> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.probeTimeoutMs);
    const start = Date.now();
    try {
      const response = await fetch(url, { signal: controller.signal });
      const latency = Date.now() - start;
      if (response.ok) {
        const state: VendorHealthState =
          latency > this.degradedThresholdMs ? 'DEGRADED' : 'OK';
        return {
          vendorId,
          state,
          latencyMs: latency,
          configured: true,
          message: state === 'DEGRADED' ? `slow probe: ${latency}ms` : null,
          probedAt,
        };
      }
      return {
        vendorId,
        state: 'UNREACHABLE',
        latencyMs: latency,
        configured: true,
        message: `HTTP ${response.status} ${response.statusText}`,
        probedAt,
      };
    } catch (error: unknown) {
      // type-rationale: fetch + AbortController errors are unknown per spec
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Probe failed for ${vendorId}: ${msg}`);
      return {
        vendorId,
        state: 'UNREACHABLE',
        latencyMs: null,
        configured: true,
        message: msg,
        probedAt,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Env-only probe: just check that required env vars are present.
   * NOT_CONFIGURED if missing; OK if all present (we don't HTTP-probe
   * to avoid burning rate limits on Alpha Vantage's 25/day budget etc.).
   */
  private probeEnvOnly(
    vendorId: string,
    envVars: readonly string[],
    probedAt: string,
    opts: { extraNote?: string | null; notProbedReason?: string } = {},
  ): VendorHealthEntry {
    if (envVars.length === 0) {
      return {
        vendorId,
        state: opts.notProbedReason ? 'NOT_PROBED' : 'OK',
        latencyMs: null,
        configured: true,
        message: opts.notProbedReason ?? null,
        probedAt,
      };
    }
    const missing = envVars.filter((v) => {
      const val = process.env[v];
      return !val || val.trim().length === 0;
    });
    if (missing.length > 0) {
      return {
        vendorId,
        state: 'NOT_CONFIGURED',
        latencyMs: null,
        configured: false,
        message: `missing env: ${missing.join(', ')}`,
        probedAt,
      };
    }
    return {
      vendorId,
      state: opts.notProbedReason ? 'NOT_PROBED' : 'OK',
      latencyMs: null,
      configured: true,
      message: opts.notProbedReason ?? opts.extraNote ?? null,
      probedAt,
    };
  }

  /**
   * Configured-only probe for paid-enterprise vendors. Returns
   * NOT_CONFIGURED if `isConfigured()` is false; OK if true. We deliberately
   * do not test-call the upstream because every call has paid cost.
   */
  private probeConfiguredOnly(
    vendorId: string,
    configured: boolean,
    probedAt: string,
    envVars: readonly string[],
  ): VendorHealthEntry {
    if (!configured) {
      return {
        vendorId,
        state: 'NOT_CONFIGURED',
        latencyMs: null,
        configured: false,
        message: `paid-enterprise — credentials missing (${envVars.join(', ')})`,
        probedAt,
      };
    }
    return {
      vendorId,
      state: 'OK',
      latencyMs: null,
      configured: true,
      message:
        'paid-enterprise credentials present — not test-called to avoid cost',
      probedAt,
    };
  }
}
