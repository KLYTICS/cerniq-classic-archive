import { Injectable, Logger } from '@nestjs/common';
import { FXRateDto } from '../dto/macro.dto';
import { QuoteDto } from '../dto/quote.dto';

/**
 * Alpha Vantage provider — free-tier US-focused market data with
 * stricter rate limits than Yahoo Finance but real-time intraday support
 * (Yahoo gives end-of-day only on the free path).
 *
 * Auth: `ALPHA_VANTAGE_API_KEY` env var. Free key from
 * https://www.alphavantage.co/support/#api-key — instant signup, 25
 * requests/day per IP, 5 requests/minute.
 *
 * Rate-limit awareness: at 25/day, this provider is a *fresh-quote* /
 * *intraday* fallback, NOT a primary feed. Cerniq's circuit-breaker
 * + cache layer (`MarketDataService.fetchWithTelemetry`) keep usage
 * well under the daily ceiling.
 *
 * Endpoints used (REST, no SDK):
 *   ?function=GLOBAL_QUOTE&symbol=...        — latest quote
 *   ?function=CURRENCY_EXCHANGE_RATE&...     — real-time FX
 *   ?function=RSI&symbol=...&interval=...    — technical indicator
 *
 * Discipline notes:
 *   - Alpha Vantage uses a sentinel response `{ "Note": "Thank you for
 *     using Alpha Vantage..." }` for rate-limit refusals (no HTTP 429).
 *     The provider detects this and returns null + logged warn — Rule 1.
 *   - Alpha Vantage also returns `{ "Error Message": "..." }` for
 *     invalid symbols. Same null-with-log treatment.
 *   - All numeric values come back as STRINGS in the response. We
 *     parseFloat defensively and reject NaN.
 */
@Injectable()
export class AlphaVantageProvider {
  private readonly logger = new Logger(AlphaVantageProvider.name);
  private readonly baseUrl = 'https://www.alphavantage.co/query';

  /** Read the API key at call time so test setup can mutate env. */
  private getApiKey(): string | null {
    const k = process.env.ALPHA_VANTAGE_API_KEY;
    return k && k.trim().length > 0 ? k.trim() : null;
  }

  /**
   * Latest global quote (price, volume, change) for a symbol.
   * GLOBAL_QUOTE is the most rate-limit-friendly endpoint (one observation
   * per call vs. TIME_SERIES which returns ~100 bars per call).
   */
  async getQuote(symbol: string): Promise<QuoteDto | null> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      this.logger.warn(
        'ALPHA_VANTAGE_API_KEY missing; cannot fetch quote (returning null)',
      );
      return null;
    }
    if (!/^[A-Z0-9.\-]{1,15}$/.test(symbol)) {
      this.logger.warn(`Invalid Alpha Vantage symbol: ${symbol}`);
      return null;
    }
    const url =
      `${this.baseUrl}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}` +
      `&apikey=${encodeURIComponent(apiKey)}`;

    let body: Record<string, unknown> | null = null;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        this.logger.error(
          `Alpha Vantage HTTP ${response.status} for ${symbol}`,
        );
        return null;
      }
      body = (await response.json()) as Record<string, unknown>;
    } catch (error: unknown) {
      // type-rationale: fetch error shapes are unknown per spec
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Alpha Vantage fetch failed for ${symbol}: ${msg}`);
      return null;
    }

    if (this.isRateLimitedOrError(body, symbol)) return null;

    // type-rationale: Alpha Vantage uses dynamic keyed shape we narrow inline
    const quote = (body['Global Quote'] ?? body['GlobalQuote']) as
      | Record<string, string>
      | undefined;
    if (
      !quote ||
      typeof quote !== 'object' ||
      Object.keys(quote).length === 0
    ) {
      this.logger.warn(
        `Alpha Vantage returned empty Global Quote for ${symbol}`,
      );
      return null;
    }

    const price = this.parseNumber(quote['05. price']);
    const change = this.parseNumber(quote['09. change']);
    const changePctRaw = quote['10. change percent']?.replace('%', '');
    const changePct = changePctRaw ? this.parseNumber(changePctRaw) : null;
    const volume = this.parseNumber(quote['06. volume']);
    const high = this.parseNumber(quote['03. high']);
    const low = this.parseNumber(quote['04. low']);
    const open = this.parseNumber(quote['02. open']);
    const previousClose = this.parseNumber(quote['08. previous close']);
    const latestTradingDay = quote['07. latest trading day'];

    // If essential fields are missing, surface as null per Rule 1.
    if (price === null || latestTradingDay === undefined) {
      this.logger.warn(
        `Alpha Vantage Global Quote for ${symbol} missing essential fields`,
      );
      return null;
    }

    return {
      ticker: quote['01. symbol'] ?? symbol,
      assetType: 'stock',
      price,
      change: change ?? 0,
      changePercent: changePct ?? 0,
      volume: volume ?? 0,
      high: high ?? 0,
      low: low ?? 0,
      open: open ?? 0,
      previousClose: previousClose ?? 0,
      timestamp: new Date(latestTradingDay),
      provider: 'alpha-vantage',
    };
  }

  /**
   * Real-time FX pair. Alpha Vantage quotes the rate as 1 unit of FROM
   * = N units of TO. Caller specifies both currencies as ISO codes.
   */
  async getFXRate(
    fromCurrency: string,
    toCurrency: string,
  ): Promise<FXRateDto | null> {
    const apiKey = this.getApiKey();
    if (!apiKey) return null;
    if (!/^[A-Z]{3}$/.test(fromCurrency) || !/^[A-Z]{3}$/.test(toCurrency)) {
      this.logger.warn(
        `Invalid FX currency pair: ${fromCurrency}/${toCurrency}`,
      );
      return null;
    }
    const url =
      `${this.baseUrl}?function=CURRENCY_EXCHANGE_RATE` +
      `&from_currency=${fromCurrency}&to_currency=${toCurrency}` +
      `&apikey=${encodeURIComponent(apiKey)}`;

    let body: Record<string, unknown> | null = null;
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      body = (await response.json()) as Record<string, unknown>;
    } catch (error: unknown) {
      // type-rationale: fetch error shapes are unknown per spec
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Alpha Vantage FX fetch failed: ${msg}`);
      return null;
    }

    if (this.isRateLimitedOrError(body, `${fromCurrency}/${toCurrency}`))
      return null;

    // type-rationale: Alpha Vantage nests data under a long string key
    const fx = body['Realtime Currency Exchange Rate'] as
      | Record<string, string>
      | undefined;
    if (!fx) return null;
    const rate = this.parseNumber(fx['5. Exchange Rate']);
    const asOf = fx['6. Last Refreshed'];
    if (rate === null || !asOf) return null;
    return {
      pair: `${fromCurrency}/${toCurrency}`,
      base: fromCurrency,
      quote: toCurrency,
      rate,
      asOf,
      provider: 'alpha-vantage',
      serverTimestamp: new Date(),
    };
  }

  /**
   * Relative Strength Index — a momentum technical indicator. Returns
   * the most recent RSI value for the symbol at the given interval.
   *
   * Interval valid values: 1min, 5min, 15min, 30min, 60min, daily, weekly, monthly.
   * timePeriod is the lookback window in bars (default 14, the canonical Wilder period).
   */
  async getRSI(
    symbol: string,
    interval: string = 'daily',
    timePeriod: number = 14,
  ): Promise<{
    symbol: string;
    interval: string;
    timePeriod: number;
    rsi: number;
    asOf: string;
    provider: 'alpha-vantage';
  } | null> {
    const apiKey = this.getApiKey();
    if (!apiKey) return null;
    if (!/^[A-Z0-9.\-]{1,15}$/.test(symbol)) return null;
    if (
      ![
        '1min',
        '5min',
        '15min',
        '30min',
        '60min',
        'daily',
        'weekly',
        'monthly',
      ].includes(interval)
    ) {
      this.logger.warn(`Invalid Alpha Vantage interval: ${interval}`);
      return null;
    }
    if (!Number.isInteger(timePeriod) || timePeriod < 2 || timePeriod > 200) {
      this.logger.warn(`Invalid RSI time period: ${timePeriod}`);
      return null;
    }
    const url =
      `${this.baseUrl}?function=RSI&symbol=${encodeURIComponent(symbol)}` +
      `&interval=${interval}&time_period=${timePeriod}&series_type=close` +
      `&apikey=${encodeURIComponent(apiKey)}`;

    let body: Record<string, unknown> | null = null;
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      body = (await response.json()) as Record<string, unknown>;
    } catch (error: unknown) {
      // type-rationale: fetch error shapes are unknown per spec
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Alpha Vantage RSI fetch failed for ${symbol}: ${msg}`);
      return null;
    }

    if (this.isRateLimitedOrError(body, `RSI:${symbol}`)) return null;

    // type-rationale: Alpha Vantage nests technical indicator data under a string key
    const data = body['Technical Analysis: RSI'] as
      | Record<string, { RSI: string }>
      | undefined;
    if (!data || typeof data !== 'object') return null;
    const dates = Object.keys(data).sort().reverse();
    if (dates.length === 0) return null;
    const latestDate = dates[0];
    const rsi = this.parseNumber(data[latestDate]?.RSI);
    if (rsi === null) return null;
    return {
      symbol,
      interval,
      timePeriod,
      rsi,
      asOf: latestDate,
      provider: 'alpha-vantage',
    };
  }

  /** Defensive number parse; returns null on NaN or non-numeric input. */
  private parseNumber(raw: string | undefined): number | null {
    if (raw === undefined || raw === null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  /**
   * Detect Alpha Vantage's rate-limit-or-error sentinel responses.
   * These are HTTP-200 + JSON body with a "Note" or "Information" or
   * "Error Message" key explaining the refusal.
   */
  private isRateLimitedOrError(
    body: Record<string, unknown> | null,
    context: string,
  ): boolean {
    if (!body) return true;
    if (typeof body['Note'] === 'string') {
      this.logger.warn(
        `Alpha Vantage rate-limit Note for ${context}: ${body['Note']}`,
      );
      return true;
    }
    if (typeof body['Information'] === 'string') {
      this.logger.warn(
        `Alpha Vantage Information for ${context}: ${body['Information']}`,
      );
      return true;
    }
    if (typeof body['Error Message'] === 'string') {
      this.logger.warn(
        `Alpha Vantage Error for ${context}: ${body['Error Message']}`,
      );
      return true;
    }
    return false;
  }
}
