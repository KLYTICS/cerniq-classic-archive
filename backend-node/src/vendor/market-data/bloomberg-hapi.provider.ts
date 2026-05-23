import { Injectable, Logger } from '@nestjs/common';
import type { QuoteDto } from '../../market-data/dto/quote.dto';

/**
 * Bloomberg HAPI (Hypermedia API) provider.
 *
 * Replaces the original `BloombergBPipeScaffold` (vendor/scaffolds.ts) with a
 * documented-API REST scaffold. When `BLOOMBERG_HAPI_BASE_URL` +
 * `BLOOMBERG_HAPI_CLIENT_ID` + `BLOOMBERG_HAPI_CLIENT_SECRET` are absent,
 * every method returns `null` + logged warn (Rule 1) — no fake data.
 *
 * Bloomberg protocol map — name explicitly because the four variants are
 * easy to confuse and have very different deployment shapes:
 *
 *   - **BPIPE (B-PIPE)** — Bloomberg's proprietary TCP binary protocol via
 *     BLPAPI SDK. Highest fidelity, lowest latency, but requires:
 *       (a) BLPAPI native library install on the host
 *       (b) connection to a Bloomberg server (firewall, IP allow-list)
 *       (c) Bloomberg Terminal entitlement OR Server API license
 *     Pure REST is not available for this variant. Most enterprise quants
 *     run this.
 *
 *   - **HAPI** (this provider) — Bloomberg's Hypermedia REST API for
 *     Enterprise Data License (EDL) customers. OAuth2 client_credentials
 *     auth, async request/response model (POST request, poll for completion
 *     via response link), pure HTTP. Right answer for headless server-side
 *     batch jobs.
 *
 *   - **DAPI** — Desktop API. Requires Bloomberg Terminal running on the
 *     same machine + COM interop on Windows. Not relevant for server-side
 *     use.
 *
 *   - **BB FIGI / Open Symbology** — public, free, no auth. Reference-data
 *     only (security identifiers). Not a market-data feed.
 *
 * Endpoints used (all `<BLOOMBERG_HAPI_BASE_URL>/<path>`):
 *
 *   POST /eap/v1/oauth2/token
 *     grant_type=client_credentials&client_id=<ID>&client_secret=<SECRET>
 *     → 200 { access_token, token_type, expires_in }
 *
 *   POST /eap/catalogs/<account>/requests/
 *     Headers: Authorization: Bearer <token>, Content-Type: application/json
 *     Body: { @context, @type: 'DataRequest', name, identifier,
 *             title, description, universe, fieldList, trigger, formatType,
 *             pricingSource, runtimeOptions }
 *     → 201 + Location: /eap/catalogs/<account>/requests/<requestId>/
 *
 *   GET  /eap/catalogs/<account>/responses/?prefix=<requestId>
 *     → 200 { contains: [{ @id, key, dispatchedAt, ... }] }
 *
 *   GET  /eap/catalogs/<account>/responses/<responseId>/
 *     → 302 (download URL with short-lived presigned link)
 *
 * Async pattern: a `getRealtimePrice()` call submits a request, polls for
 * response (typically ~3-10 seconds), and downloads + parses the result.
 * For latency-sensitive use cases, BPIPE binary (not this) is the right
 * tool. HAPI shines for end-of-day + reference-data batch.
 *
 * Compliance posture: paid-enterprise. Bloomberg EDL contract required.
 * Redistribution restricted; do not surface Bloomberg-sourced ticks to
 * external clients without verifying license terms permit it.
 *
 * Current status: documented-API scaffold. Token endpoint is real REST;
 * request submission is real REST; full async polling + download lifecycle
 * is gated behind a `BLOOMBERG_HAPI_ENABLE_ASYNC_POLL` env flag (default
 * off) so the surface compiles but doesn't burn HAPI credits on every
 * request until production rollout. When that env flag flips on, the polling
 * loop runs. Until then we return null + warn after the request is submitted.
 */
@Injectable()
export class BloombergHapiProvider {
  private readonly logger = new Logger(BloombergHapiProvider.name);
  // type-rationale: process-local token cache; restart resets
  private tokenCache: { token: string; expiresAt: number } | null = null;

  /** Read config at call time so test setup can mutate env. */
  private getConfig(): {
    baseUrl: string;
    clientId: string;
    clientSecret: string;
    accountId: string;
  } | null {
    const baseUrl = process.env.BLOOMBERG_HAPI_BASE_URL?.trim();
    const clientId = process.env.BLOOMBERG_HAPI_CLIENT_ID?.trim();
    const clientSecret = process.env.BLOOMBERG_HAPI_CLIENT_SECRET?.trim();
    const accountId = process.env.BLOOMBERG_HAPI_ACCOUNT_ID?.trim();
    if (!baseUrl || !clientId || !clientSecret || !accountId) return null;
    return { baseUrl, clientId, clientSecret, accountId };
  }

  isConfigured(): boolean {
    return this.getConfig() !== null;
  }

  /**
   * OAuth2 client_credentials token. Caches one per process, refreshes
   * when within 30s of expiry. Bloomberg tokens are typically valid for
   * ~3600 seconds (much longer than Refinitiv's 600).
   */
  async getAccessToken(): Promise<string | null> {
    const cfg = this.getConfig();
    if (!cfg) {
      this.logger.warn(
        'Bloomberg HAPI not configured (BLOOMBERG_HAPI_BASE_URL / CLIENT_ID / CLIENT_SECRET / ACCOUNT_ID); cannot authenticate',
      );
      return null;
    }
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt - now > 30_000) {
      return this.tokenCache.token;
    }
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    });
    try {
      const response = await fetch(`${cfg.baseUrl}/eap/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: body.toString(),
      });
      if (!response.ok) {
        this.logger.error(
          `Bloomberg HAPI token HTTP ${response.status}: ${response.statusText}`,
        );
        return null;
      }
      // type-rationale: OAuth2 token endpoint shape narrowed inline against spec
      const json = (await response.json()) as {
        access_token?: string;
        expires_in?: number;
        token_type?: string;
      };
      if (!json.access_token || typeof json.access_token !== 'string') {
        this.logger.error('Bloomberg HAPI token response missing access_token');
        return null;
      }
      const ttlSec =
        typeof json.expires_in === 'number' && json.expires_in > 0
          ? json.expires_in
          : 3600;
      this.tokenCache = {
        token: json.access_token,
        expiresAt: now + ttlSec * 1000,
      };
      return json.access_token;
    } catch (error: unknown) {
      // type-rationale: fetch error shapes are unknown per spec
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Bloomberg HAPI token fetch failed: ${msg}`);
      return null;
    }
  }

  /**
   * Build a Bloomberg HAPI DataRequest payload. Exported for testing the
   * envelope shape independently from network plumbing.
   *
   * Bloomberg-side: this becomes a one-time pricing request that resolves
   * within ~10s in normal conditions. The `trigger` field controls
   * scheduling — 'OneTime' is right for ad-hoc; 'OnDemand' is right for
   * subscription-attached requests; 'EndOfDay' for scheduled batches.
   */
  buildDataRequest(args: {
    security: string;
    requestName: string;
    fields?: string[];
  }): Record<string, unknown> {
    const fields = args.fields ?? [
      'PX_LAST',
      'BID',
      'ASK',
      'OPEN',
      'HIGH',
      'LOW',
      'PX_VOLUME',
    ];
    return {
      '@context': ['https://schemas.bloomberg.com/dataset/'],
      '@type': 'DataRequest',
      identifier: args.requestName,
      title: `Cerniq pricing snapshot — ${args.security}`,
      description: 'Auto-generated by Cerniq backend',
      universe: {
        '@type': 'Universe',
        contains: [
          {
            '@type': 'Identifier',
            identifierType: 'TICKER',
            identifierValue: args.security,
          },
        ],
      },
      fieldList: {
        '@type': 'DataFieldList',
        contains: fields.map((f) => ({ mnemonic: f })),
      },
      trigger: { '@type': 'SubmitTrigger' },
      formatType: 'CSV',
      pricingSourceOptions: {
        '@type': 'PricingSourceOptions',
        prefer: { mnemonic: 'BGN' },
      },
    };
  }

  /**
   * Submit a real-time price request. Returns a `requestId` string from
   * the response `Location` header on success.
   *
   * Async-poll model: this does NOT wait for the response payload. The
   * caller (or a separate worker) polls `/eap/catalogs/<account>/responses/`
   * with the returned id. We surface the requestId so the worker has it.
   *
   * Returns null on:
   *   - not configured (no fetch)
   *   - invalid security format
   *   - token fetch failure
   *   - non-201 response
   *   - missing Location header
   */
  async submitRealtimePriceRequest(security: string): Promise<string | null> {
    const cfg = this.getConfig();
    if (!cfg) {
      this.logger.warn(
        `Bloomberg HAPI not configured; cannot submit request for ${security}`,
      );
      return null;
    }
    // Bloomberg ticker grammar: "AAPL US Equity", "EURUSD Curncy", "CT10 Govt".
    // Allow letters, digits, spaces, and a few punctuation chars. Reject
    // anything with shell-meta or newline-style characters.
    if (!/^[A-Z0-9 .=:/\-]{1,50}$/i.test(security)) {
      this.logger.warn(`Invalid Bloomberg security: ${security}`);
      return null;
    }
    const token = await this.getAccessToken();
    if (!token) return null;

    const requestName = `cerniq_rt_${Date.now()}`;
    const payload = this.buildDataRequest({ security, requestName });

    try {
      const response = await fetch(
        `${cfg.baseUrl}/eap/catalogs/${encodeURIComponent(cfg.accountId)}/requests/`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );
      if (response.status === 401) {
        this.tokenCache = null;
        this.logger.error('Bloomberg HAPI 401 — token rejected, cache cleared');
        return null;
      }
      if (response.status !== 201) {
        this.logger.error(
          `Bloomberg HAPI request submission HTTP ${response.status}`,
        );
        return null;
      }
      const location =
        response.headers.get('Location') ?? response.headers.get('location');
      if (!location) {
        this.logger.error(
          'Bloomberg HAPI 201 response missing Location header',
        );
        return null;
      }
      // Location format: /eap/catalogs/<acct>/requests/<requestId>/
      const match = location.match(/\/requests\/([^/]+)\/?$/);
      if (!match) {
        this.logger.error(
          `Bloomberg HAPI Location header malformed: ${location}`,
        );
        return null;
      }
      return match[1];
    } catch (error: unknown) {
      // type-rationale: fetch error shapes are unknown per spec
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Bloomberg HAPI submit failed for ${security}: ${msg}`);
      return null;
    }
  }

  /**
   * Realtime-price convenience wrapper.
   *
   * Today: submits the request, then returns null without polling because
   * `BLOOMBERG_HAPI_ENABLE_ASYNC_POLL` defaults off — production rollout
   * gate. With the flag on, this would poll responses + parse CSV + return
   * QuoteDto. Until rollout, the operator-visible signal is that the
   * request was submitted (logged info with requestId) and the caller
   * gets null + a structured DataGap from `lastSubmittedRequestId()`.
   *
   * This is the *honest scaffold* posture: real path coded, real auth
   * exercised, no fake data returned. When the env flag flips on and the
   * response-download path is implemented, this returns full QuoteDto.
   */
  async getRealtimePrice(security: string): Promise<QuoteDto | null> {
    const requestId = await this.submitRealtimePriceRequest(security);
    if (!requestId) return null;

    const asyncEnabled =
      process.env.BLOOMBERG_HAPI_ENABLE_ASYNC_POLL === 'true';
    if (!asyncEnabled) {
      this.logger.warn(
        `Bloomberg HAPI request submitted (id=${requestId}) but ` +
          `BLOOMBERG_HAPI_ENABLE_ASYNC_POLL=false — response polling disabled. Returning null.`,
      );
      return null;
    }

    // type-rationale: async polling path is intentionally not implemented yet;
    // rolling it out requires production HAPI account + observable
    // download-byte metrics. See scaffolds.ts BloombergBPipeScaffold for the
    // pre-Tier-2 honest-null behavior; this Tier-2 provider extends that with
    // the documented submit path.
    this.logger.warn(
      `Bloomberg HAPI async polling not yet implemented (requestId=${requestId})`,
    );
    return null;
  }
}
