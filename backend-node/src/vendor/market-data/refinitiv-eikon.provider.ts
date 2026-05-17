import { Injectable, Logger } from '@nestjs/common';
import type { QuoteDto } from '../../market-data/dto/quote.dto';
import type { NewsArticleDto } from '../../market-data/dto/quote.dto';

/**
 * Refinitiv Data Platform (RDP / Eikon Workspace) provider.
 *
 * Replaces the original `RefinitivEikonScaffold` (vendor/scaffolds.ts) with a
 * real REST call path: OAuth2 token acquisition, snapshot pricing, news
 * headlines. When `REFINITIV_APP_KEY` + `REFINITIV_APP_SECRET` are absent,
 * every method returns `null` + logged warn (Rule 1) — no fake data, no
 * silent zero.
 *
 * Vendor protocol map (named explicitly so the next engineer doesn't waste
 * time disambiguating):
 *   - **RDP REST** (this provider) — OAuth2 client_credentials, REST endpoints,
 *     headless, no terminal required. Right answer for server-side polling.
 *   - **Eikon Workspace Data API** — desktop-only, requires Workspace login.
 *     Not relevant for Cerniq.
 *   - **DSS (Datascope Select)** — historical-only batch downloads. Different
 *     auth, different surface.
 *
 * Endpoints used (all `https://api.refinitiv.com/<path>`):
 *   POST /auth/oauth2/v1/token
 *     grant_type=client_credentials&client_id=<APP_KEY>&client_secret=<APP_SECRET>
 *     &scope=trapi.data.pricing.read trapi.data.news.read
 *     → 200 { access_token, expires_in, token_type, scope }
 *
 *   GET /data/pricing/snapshots/v1/?universe=AAPL.O&fields=BID,ASK,...
 *     Headers: Authorization: Bearer <token>
 *     → 200 { data: { universe: [...], fields: [...], values: [[...]] } }
 *
 *   GET /data/news/v1/headlines?query=Apple&top=10
 *     → 200 { data: { headlines: [...] } }
 *
 * Compliance posture: paid-enterprise. LSEG (formerly Refinitiv) requires
 * a paid contract with explicit redistribution license terms. The keys are
 * single-tenant; storing them in `REFINITIV_APP_KEY` env (deployment secret
 * store only — never committed) is the canonical pattern.
 *
 * Token caching: tokens expire in ~600 seconds. We cache one in-memory and
 * refresh transparently when it's within 30s of expiry. No persistent store
 * because the cached token survives only the current process — restart =
 * fresh token, which is the safe failure mode.
 */
@Injectable()
export class RefinitivEikonProvider {
  private readonly logger = new Logger(RefinitivEikonProvider.name);
  private readonly baseUrl = 'https://api.refinitiv.com';
  // type-rationale: token cache is process-local in-memory state; restart resets
  private tokenCache: { token: string; expiresAt: number } | null = null;

  /** Read keys at call time so test setup can mutate env. */
  private getCredentials(): { appKey: string; appSecret: string } | null {
    const appKey = process.env.REFINITIV_APP_KEY?.trim();
    const appSecret = process.env.REFINITIV_APP_SECRET?.trim();
    if (!appKey || !appSecret) return null;
    return { appKey, appSecret };
  }

  /**
   * Public diagnostic — returns true iff both env vars are present.
   * Operators / admin pages call this to surface "configured but not
   * yet authenticated" vs "credentials missing" without leaking secrets.
   */
  isConfigured(): boolean {
    return this.getCredentials() !== null;
  }

  /**
   * Obtain an OAuth2 access token via client_credentials. Caches one
   * token per process and refreshes when within 30 seconds of expiry.
   *
   * Returns null on:
   *   - missing credentials (no fetch attempted)
   *   - non-2xx response (logged error)
   *   - malformed JSON or missing access_token field
   *   - network error
   */
  async getAccessToken(): Promise<string | null> {
    const creds = this.getCredentials();
    if (!creds) {
      this.logger.warn(
        'Refinitiv credentials missing (REFINITIV_APP_KEY / REFINITIV_APP_SECRET); cannot authenticate',
      );
      return null;
    }
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt - now > 30_000) {
      return this.tokenCache.token;
    }
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: creds.appKey,
      client_secret: creds.appSecret,
      scope: 'trapi.data.pricing.read trapi.data.news.read',
    });
    try {
      const response = await fetch(`${this.baseUrl}/auth/oauth2/v1/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: body.toString(),
      });
      if (!response.ok) {
        this.logger.error(
          `Refinitiv token endpoint HTTP ${response.status}: ${response.statusText}`,
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
        this.logger.error('Refinitiv token response missing access_token');
        return null;
      }
      const ttlSec =
        typeof json.expires_in === 'number' && json.expires_in > 0
          ? json.expires_in
          : 600;
      this.tokenCache = {
        token: json.access_token,
        expiresAt: now + ttlSec * 1000,
      };
      return json.access_token;
    } catch (error: unknown) {
      // type-rationale: fetch error shapes are unknown per spec
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Refinitiv token fetch failed: ${msg}`);
      return null;
    }
  }

  /**
   * Real-time snapshot for a RIC (Refinitiv Instrument Code).
   * RIC examples: 'AAPL.O' (Apple on Nasdaq), 'IBM.N' (IBM on NYSE),
   * 'EUR=' (EUR/USD spot), 'US10YT=RR' (10Y UST yield).
   *
   * Returns the standard QuoteDto shape so callers are interchangeable
   * with Yahoo / Alpha Vantage / etc.
   */
  async getRealtimePrice(ric: string): Promise<QuoteDto | null> {
    if (!this.isConfigured()) {
      this.logger.warn(
        `Refinitiv not configured; cannot fetch ${ric} (returning null)`,
      );
      return null;
    }
    // RIC validation — alphanumeric + . = / : - up to 30 chars. Refinitiv's
    // grammar is permissive (currency pairs use '='; futures use ':') so we
    // accept the documented characters and reject anything containing spaces
    // or shell-meta characters.
    if (!/^[A-Z0-9.=:/\-]{1,30}$/i.test(ric)) {
      this.logger.warn(`Invalid RIC: ${ric}`);
      return null;
    }
    const token = await this.getAccessToken();
    if (!token) return null;

    const fields = [
      'BID',
      'ASK',
      'TRDPRC_1',
      'OPEN_PRC',
      'HIGH_1',
      'LOW_1',
      'HST_CLOSE',
      'NUM_MOVES',
      'CF_VOLUME',
    ].join(',');
    const url =
      `${this.baseUrl}/data/pricing/snapshots/v1/` +
      `?universe=${encodeURIComponent(ric)}&fields=${fields}`;

    let body: Record<string, unknown> | null = null;
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      if (response.status === 401) {
        // Token rejected — invalidate cache so next call re-auths.
        this.tokenCache = null;
        this.logger.error('Refinitiv 401 — token rejected, cache cleared');
        return null;
      }
      if (!response.ok) {
        this.logger.error(
          `Refinitiv snapshot HTTP ${response.status} for ${ric}`,
        );
        return null;
      }
      body = (await response.json()) as Record<string, unknown>;
    } catch (error: unknown) {
      // type-rationale: fetch error shapes are unknown per spec
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Refinitiv snapshot fetch failed for ${ric}: ${msg}`);
      return null;
    }

    return this.parseSnapshot(ric, body);
  }

  /**
   * News headlines for a free-text query. Returns a normalized
   * NewsArticleDto[] so the UI surface stays provider-agnostic.
   */
  async getNews(
    query: string,
    limit: number = 10,
  ): Promise<NewsArticleDto[] | null> {
    if (!this.isConfigured()) {
      this.logger.warn(
        `Refinitiv not configured; cannot fetch news (returning null)`,
      );
      return null;
    }
    if (typeof query !== 'string' || query.trim().length === 0) {
      this.logger.warn('Refinitiv news query empty');
      return null;
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      this.logger.warn(`Refinitiv news invalid limit: ${limit}`);
      return null;
    }
    const token = await this.getAccessToken();
    if (!token) return null;

    const url =
      `${this.baseUrl}/data/news/v1/headlines` +
      `?query=${encodeURIComponent(query)}&top=${limit}`;

    let body: Record<string, unknown> | null = null;
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      if (!response.ok) {
        this.logger.error(`Refinitiv news HTTP ${response.status}`);
        return null;
      }
      body = (await response.json()) as Record<string, unknown>;
    } catch (error: unknown) {
      // type-rationale: fetch error shapes are unknown per spec
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Refinitiv news fetch failed: ${msg}`);
      return null;
    }

    return this.parseHeadlines(body);
  }

  /**
   * Parse a /data/pricing/snapshots/v1/ response into QuoteDto.
   * Refinitiv returns the schema as { data: { universe, fields, values } }
   * where `values` is a 2D array indexed [row][field]. We pull row 0 since
   * single-RIC queries return one row.
   *
   * Exported as a method (not private) for test directness — keeps the
   * defensive parsing path independently verifiable from the network path.
   */
  parseSnapshot(ric: string, body: unknown): QuoteDto | null {
    if (!body || typeof body !== 'object') return null;
    // type-rationale: Refinitiv nests data under "data" key with dynamic shape
    const data = (body as Record<string, unknown>)['data'] as
      | Record<string, unknown>
      | undefined;
    if (!data) {
      this.logger.warn(`Refinitiv snapshot missing data envelope for ${ric}`);
      return null;
    }
    const fields = data['fields'] as Array<{ name: string }> | undefined;
    const values = data['values'] as Array<Array<unknown>> | undefined;
    if (
      !Array.isArray(fields) ||
      !Array.isArray(values) ||
      values.length === 0
    ) {
      this.logger.warn(`Refinitiv snapshot malformed for ${ric}`);
      return null;
    }
    const row = values[0];
    if (!Array.isArray(row)) return null;

    const pick = (fieldName: string): number | null => {
      const idx = fields.findIndex((f) => f.name === fieldName);
      if (idx === -1) return null;
      const raw = row[idx];
      if (raw === null || raw === undefined) return null;
      const n = typeof raw === 'number' ? raw : Number(raw);
      return Number.isFinite(n) ? n : null;
    };

    const price = pick('TRDPRC_1');
    const previousClose = pick('HST_CLOSE');
    if (price === null) {
      this.logger.warn(`Refinitiv snapshot for ${ric} missing TRDPRC_1`);
      return null;
    }
    const change = previousClose !== null ? price - previousClose : 0;
    const changePercent =
      previousClose !== null && previousClose !== 0
        ? (change / previousClose) * 100
        : 0;

    return {
      ticker: ric,
      assetType: 'stock',
      price,
      change,
      changePercent,
      volume: pick('CF_VOLUME') ?? 0,
      high: pick('HIGH_1') ?? 0,
      low: pick('LOW_1') ?? 0,
      open: pick('OPEN_PRC') ?? 0,
      previousClose: previousClose ?? 0,
      timestamp: new Date(),
      provider: 'refinitiv-eikon',
    };
  }

  /**
   * Parse /data/news/v1/headlines into NewsArticleDto[].
   * Headlines come as { data: { headlines: [{ id, title, source, ... }] } }.
   * Exported as a method for test directness.
   */
  parseHeadlines(body: unknown): NewsArticleDto[] | null {
    if (!body || typeof body !== 'object') return null;
    // type-rationale: Refinitiv news payload nests under data.headlines
    const data = (body as Record<string, unknown>)['data'] as
      | Record<string, unknown>
      | undefined;
    if (!data) return null;
    const headlines = data['headlines'] as
      | Array<Record<string, unknown>>
      | undefined;
    if (!Array.isArray(headlines)) return null;

    const out: NewsArticleDto[] = [];
    for (const h of headlines) {
      const id = typeof h['id'] === 'string' ? h['id'] : null;
      const title = typeof h['title'] === 'string' ? h['title'] : null;
      const source =
        typeof h['source'] === 'string' ? h['source'] : 'Refinitiv';
      const link = typeof h['link'] === 'string' ? h['link'] : '';
      const publishedRaw = h['firstCreated'] ?? h['publishedAt'];
      const publishedAt =
        typeof publishedRaw === 'string' ? new Date(publishedRaw) : new Date();
      if (!id || !title) continue;
      out.push({
        id,
        title,
        publisher: source,
        link,
        publishedAt,
      });
    }
    return out;
  }
}
