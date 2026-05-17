import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataQualityService } from '../common/data-quality.service';
import { YahooFinanceProvider } from './providers/yahoo-finance.provider';
import { CoinGeckoProvider } from './providers/coingecko.provider';
import { FredProvider } from './providers/fred.provider';
import { TreasuryFiscalDataProvider } from './providers/treasury-fiscal-data.provider';
import { AlphaVantageProvider } from './providers/alpha-vantage.provider';
import {
  AssetType,
  FreshnessState,
  FundamentalsDto,
  HistoricalPriceDto,
  InstrumentProfileDto,
  MarketDataHealthDto,
  MarketSession,
  MarketSnapshotDto,
  NewsArticleDto,
  ProviderHealthDto,
  QuoteDto,
  StreamStatusDto,
  TickerSearchResultDto,
} from './dto/quote.dto';
import {
  EconomicIndicatorDto,
  FXRateDto,
  InterestRateDto,
  YieldCurveDto,
} from './dto/macro.dto';

interface QuoteRequestOptions {
  maxCacheAgeMs?: number;
}

interface ProviderFetchResult<T> {
  payload: T | null;
  provider: string;
}

interface ProviderHealthInternal {
  provider: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalLatencyMs: number;
  avgLatencyMs: number;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
  consecutiveFailures: number;
  circuitOpenUntil?: Date;
}

@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);
  private readonly cryptoTickers = new Set([
    'BTC',
    'ETH',
    'BNB',
    'SOL',
    'XRP',
    'ADA',
    'DOGE',
    'MATIC',
    'DOT',
    'AVAX',
  ]);
  private readonly providerHealth = new Map<string, ProviderHealthInternal>();

  // In-memory cache for quotes (1 minute TTL)
  private quoteCache = new Map<string, { data: QuoteDto; timestamp: number }>();
  private readonly QUOTE_CACHE_TTL = 60 * 1000; // 1 minute
  private readonly REALTIME_QUOTE_CACHE_TTL = this.parseCacheTtl(
    process.env.MARKET_REALTIME_QUOTE_CACHE_TTL_MS,
    5000,
  );

  // In-memory cache for fundamentals (24 hour TTL)
  private fundamentalsCache = new Map<
    string,
    { data: FundamentalsDto; timestamp: number }
  >();
  private readonly FUNDAMENTALS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  // Instrument profile cache (15 minutes)
  private instrumentCache = new Map<
    string,
    { data: InstrumentProfileDto; timestamp: number }
  >();
  private readonly INSTRUMENT_CACHE_TTL = 15 * 60 * 1000;

  // News cache (5 minutes)
  private newsCache = new Map<
    string,
    { data: NewsArticleDto[]; timestamp: number }
  >();
  private readonly NEWS_CACHE_TTL = 5 * 60 * 1000;

  // Macro-data caches — yield curves + rate observations refresh on a daily
  // FRED publication cadence; cache aggressively to stay inside the 120/min
  // free-tier limit + keep ALM page renders snappy.
  private yieldCurveCache = new Map<
    string,
    { data: YieldCurveDto; timestamp: number }
  >();
  private readonly YIELD_CURVE_CACHE_TTL = 60 * 60 * 1000; // 1h
  private interestRateCache = new Map<
    string,
    { data: InterestRateDto; timestamp: number }
  >();
  private readonly INTEREST_RATE_CACHE_TTL = 60 * 60 * 1000; // 1h
  private indicatorCache = new Map<
    string,
    { data: EconomicIndicatorDto; timestamp: number }
  >();
  private readonly INDICATOR_CACHE_TTL = 6 * 60 * 60 * 1000; // 6h (CPI/GDP move slow)
  private fxRateCache = new Map<
    string,
    { data: FXRateDto; timestamp: number }
  >();
  private readonly FX_RATE_CACHE_TTL = 60 * 60 * 1000; // 1h

  constructor(
    private readonly yahooFinanceProvider: YahooFinanceProvider,
    private readonly coinGeckoProvider: CoinGeckoProvider,
    private readonly fredProvider: FredProvider,
    private readonly treasuryFiscalDataProvider: TreasuryFiscalDataProvider,
    private readonly alphaVantageProvider: AlphaVantageProvider,
    private readonly dataQualityService: DataQualityService,
  ) {}

  /**
   * Determine asset type based on ticker format
   */
  private getProviderRouteAssetType(ticker: string): 'crypto' | 'stock' {
    return this.cryptoTickers.has(ticker.toUpperCase()) ? 'crypto' : 'stock';
  }

  private parseCacheTtl(
    rawValue: string | undefined,
    fallbackMs: number,
  ): number {
    const parsed = Number.parseInt(rawValue || '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMs;
  }

  normalizeTicker(rawTicker: string): string {
    const input = (rawTicker || '').trim().toUpperCase();
    if (!input) {
      throw new NotFoundException('Ticker is required');
    }

    let normalized = input
      .replace(/\s+/g, '')
      .replace(/^([A-Z]+):/, '')
      .replace(/\.US$/, '')
      .replace(/\//g, '-');

    if (normalized.includes('.')) {
      normalized = normalized.replace(/\./g, '-');
    }

    for (const cryptoTicker of this.cryptoTickers) {
      if (
        normalized === `${cryptoTicker}-USD` ||
        normalized === `${cryptoTicker}USD`
      ) {
        return cryptoTicker;
      }
    }

    return normalized;
  }

  private computeSession(
    assetType: AssetType,
    marketState?: string,
  ): MarketSession {
    if (assetType === 'crypto') {
      return 'CRYPTO';
    }

    switch ((marketState || '').toUpperCase()) {
      case 'PRE':
      case 'PREPRE':
      case 'PREMARKET':
        return 'PREMARKET';
      case 'REGULAR':
        return 'REGULAR';
      case 'POST':
      case 'POSTPOST':
      case 'POSTMARKET':
      case 'AFTER_HOURS':
        return 'AFTER_HOURS';
      case 'CLOSED':
        return 'CLOSED';
      default:
        return 'UNKNOWN';
    }
  }

  private computeFreshnessState(ageMs: number): FreshnessState {
    if (ageMs <= 15_000) {
      return 'NEAR_REALTIME';
    }
    if (ageMs <= 60_000) {
      return 'DELAYED';
    }
    return 'STALE';
  }

  private decorateQuoteForDelivery(quote: QuoteDto): QuoteDto {
    const quoteTimestamp =
      quote.quoteTimestamp || quote.timestamp || new Date();
    const ageMs = Math.max(0, Date.now() - new Date(quoteTimestamp).getTime());
    const assetType =
      quote.assetType ||
      (this.getProviderRouteAssetType(quote.ticker) === 'crypto'
        ? 'crypto'
        : 'stock');

    return {
      ...quote,
      assetType,
      session: this.computeSession(assetType, quote.marketState),
      quoteTimestamp: new Date(quoteTimestamp),
      serverTimestamp: new Date(),
      ageMs,
      freshnessState: this.computeFreshnessState(ageMs),
    };
  }

  private normalizeQuote(ticker: string, quote: QuoteDto): QuoteDto {
    const price = Number.isFinite(quote.price) ? quote.price : 0;
    const change = Number.isFinite(quote.change) ? quote.change : 0;
    const derivedPreviousClose = price - change;
    const previousClose =
      quote.previousClose > 0
        ? quote.previousClose
        : derivedPreviousClose > 0
          ? derivedPreviousClose
          : price;
    const changePercent = Number.isFinite(quote.changePercent)
      ? quote.changePercent
      : previousClose > 0
        ? (change / previousClose) * 100
        : 0;

    return {
      ...quote,
      ticker: ticker.toUpperCase(),
      assetType:
        quote.assetType ??
        (this.getProviderRouteAssetType(ticker) === 'crypto'
          ? 'crypto'
          : 'stock'),
      price,
      change,
      changePercent,
      previousClose,
      volume: Number.isFinite(quote.volume) ? quote.volume : 0,
      high: Number.isFinite(quote.high) ? quote.high : price,
      low: Number.isFinite(quote.low) ? quote.low : price,
      open: Number.isFinite(quote.open) ? quote.open : previousClose,
      timestamp: quote.timestamp ? new Date(quote.timestamp) : new Date(),
      quoteTimestamp: quote.quoteTimestamp
        ? new Date(quote.quoteTimestamp)
        : quote.timestamp
          ? new Date(quote.timestamp)
          : new Date(),
    };
  }

  private getProviderHealthEntry(provider: string): ProviderHealthInternal {
    const existing = this.providerHealth.get(provider);
    if (existing) {
      return existing;
    }

    const next: ProviderHealthInternal = {
      provider,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalLatencyMs: 0,
      avgLatencyMs: 0,
      consecutiveFailures: 0,
    };
    this.providerHealth.set(provider, next);
    return next;
  }

  private isCircuitOpen(provider: string): boolean {
    const entry = this.getProviderHealthEntry(provider);
    return Boolean(
      entry.circuitOpenUntil && entry.circuitOpenUntil.getTime() > Date.now(),
    );
  }

  private recordProviderResult(
    provider: string,
    latencyMs: number,
    success: boolean,
  ) {
    const entry = this.getProviderHealthEntry(provider);
    entry.totalRequests += 1;
    entry.totalLatencyMs += latencyMs;
    entry.avgLatencyMs = Number(
      (entry.totalLatencyMs / entry.totalRequests).toFixed(2),
    );

    if (success) {
      entry.successfulRequests += 1;
      entry.lastSuccessAt = new Date();
      entry.consecutiveFailures = 0;
      entry.circuitOpenUntil = undefined;
    } else {
      entry.failedRequests += 1;
      entry.lastFailureAt = new Date();
      entry.consecutiveFailures += 1;
      if (entry.consecutiveFailures >= 5) {
        entry.circuitOpenUntil = new Date(Date.now() + 30_000);
      }
    }

    this.dataQualityService.recordMetric(provider, {
      successfulRequests: entry.successfulRequests,
      failedRequests: entry.failedRequests,
      avgLatencyMs: entry.avgLatencyMs,
    });
  }

  private toProviderHealthDto(
    entry: ProviderHealthInternal,
  ): ProviderHealthDto {
    const successRate =
      entry.totalRequests > 0
        ? Number(
            ((entry.successfulRequests / entry.totalRequests) * 100).toFixed(2),
          )
        : 100;

    let status: ProviderHealthDto['status'] = 'healthy';
    if (entry.consecutiveFailures >= 3 || successRate < 99) {
      status = 'degraded';
    }
    if (entry.consecutiveFailures >= 5 || successRate < 95) {
      status = 'unhealthy';
    }

    return {
      provider: entry.provider,
      status,
      totalRequests: entry.totalRequests,
      successfulRequests: entry.successfulRequests,
      failedRequests: entry.failedRequests,
      successRate,
      avgLatencyMs: entry.avgLatencyMs,
      lastSuccessAt: entry.lastSuccessAt,
      lastFailureAt: entry.lastFailureAt,
      consecutiveFailures: entry.consecutiveFailures,
    };
  }

  private async fetchWithTelemetry<T>(
    provider: string,
    fetcher: () => Promise<T | null>,
  ): Promise<T | null> {
    if (this.isCircuitOpen(provider)) {
      this.logger.warn(
        `Provider circuit open for ${provider}; skipping upstream call`,
      );
      return null;
    }

    const startedAt = Date.now();
    try {
      const payload = await fetcher();
      this.recordProviderResult(
        provider,
        Date.now() - startedAt,
        Boolean(payload),
      );
      return payload;
    } catch (error) {
      this.recordProviderResult(provider, Date.now() - startedAt, false);
      this.logger.error(`Provider request failed for ${provider}:`, error);
      return null;
    }
  }

  private async fetchQuoteFromProvider(
    ticker: string,
  ): Promise<ProviderFetchResult<QuoteDto>> {
    const assetType = this.getProviderRouteAssetType(ticker);

    if (assetType === 'crypto') {
      return {
        provider: 'coingecko',
        payload: await this.fetchWithTelemetry('coingecko', () =>
          this.coinGeckoProvider.getQuote(ticker),
        ),
      };
    }

    // Stock quote ladder: Yahoo → Alpha Vantage → null (stale-cache decided by caller).
    // Alpha Vantage is the fresh-quote fallback; its 25 req/day budget keeps it
    // OK as a Yahoo-outage backstop but never the primary path.
    const yahooQuote = await this.fetchWithTelemetry('yahoo-finance', () =>
      this.yahooFinanceProvider.getQuote(ticker),
    );
    if (yahooQuote) {
      return { provider: 'yahoo-finance', payload: yahooQuote };
    }

    const alphaQuote = await this.fetchWithTelemetry('alpha-vantage', () =>
      this.alphaVantageProvider.getQuote(ticker),
    );
    if (alphaQuote) {
      this.logger.warn(
        `Yahoo unavailable for ${ticker}; served from Alpha Vantage fallback`,
      );
      return { provider: 'alpha-vantage', payload: alphaQuote };
    }

    return { provider: 'yahoo-finance', payload: null };
  }

  /**
   * Get current quote for a ticker
   */
  async getQuote(
    ticker: string,
    options: QuoteRequestOptions = {},
  ): Promise<QuoteDto> {
    const tickerUpper = this.normalizeTicker(ticker);
    const cacheTtl = options.maxCacheAgeMs ?? this.QUOTE_CACHE_TTL;

    // Check cache first
    const cached = this.quoteCache.get(tickerUpper);
    if (cached && Date.now() - cached.timestamp < cacheTtl) {
      this.logger.debug(`Returning cached quote for ${tickerUpper}`);
      return this.decorateQuoteForDelivery(cached.data);
    }

    const quoteResult = await this.fetchQuoteFromProvider(tickerUpper);
    const quote = quoteResult.payload;

    if (!quote) {
      if (cached) {
        this.logger.warn(
          `Using stale cached quote for ${tickerUpper}; upstream ${quoteResult.provider} unavailable`,
        );
        return this.decorateQuoteForDelivery(cached.data);
      }
      throw new NotFoundException(`Quote not found for ticker: ${ticker}`);
    }

    const normalizedQuote = this.normalizeQuote(tickerUpper, {
      ...quote,
      provider: quote.provider || quoteResult.provider,
    });

    // Cache the result
    this.quoteCache.set(tickerUpper, {
      data: normalizedQuote,
      timestamp: Date.now(),
    });

    return this.decorateQuoteForDelivery(normalizedQuote);
  }

  /**
   * Get a fresher quote for streaming surfaces without fully disabling caching.
   */
  async getRealtimeQuote(ticker: string): Promise<QuoteDto> {
    return this.getQuote(ticker, {
      maxCacheAgeMs: this.REALTIME_QUOTE_CACHE_TTL,
    });
  }

  /**
   * Get historical prices for a ticker
   */
  async getHistoricalPrices(
    ticker: string,
    startDate: Date,
    endDate: Date,
  ): Promise<HistoricalPriceDto[]> {
    const tickerUpper = this.normalizeTicker(ticker);
    const assetType = this.getProviderRouteAssetType(tickerUpper);

    if (assetType === 'crypto') {
      return this.coinGeckoProvider.getHistoricalPrices(
        tickerUpper,
        startDate,
        endDate,
      );
    } else {
      return this.yahooFinanceProvider.getHistoricalPrices(
        tickerUpper,
        startDate,
        endDate,
      );
    }
  }

  /**
   * Get fundamental data for a ticker (stocks/ETFs only)
   */
  async getFundamentals(ticker: string): Promise<FundamentalsDto> {
    const tickerUpper = this.normalizeTicker(ticker);

    // Check cache first
    const cached = this.fundamentalsCache.get(tickerUpper);
    if (cached && Date.now() - cached.timestamp < this.FUNDAMENTALS_CACHE_TTL) {
      this.logger.debug(`Returning cached fundamentals for ${tickerUpper}`);
      return cached.data;
    }

    const assetType = this.getProviderRouteAssetType(tickerUpper);

    if (assetType === 'crypto') {
      throw new NotFoundException(
        'Fundamentals not available for cryptocurrencies',
      );
    }

    const fundamentals = await this.fetchWithTelemetry('yahoo-finance', () =>
      this.yahooFinanceProvider.getFundamentals(tickerUpper),
    );

    if (!fundamentals) {
      throw new NotFoundException(
        `Fundamentals not found for ticker: ${ticker}`,
      );
    }

    // Cache the result
    this.fundamentalsCache.set(tickerUpper, {
      data: fundamentals,
      timestamp: Date.now(),
    });

    return fundamentals;
  }

  async getInstrumentProfile(ticker: string): Promise<InstrumentProfileDto> {
    const tickerUpper = this.normalizeTicker(ticker);
    const cached = this.instrumentCache.get(tickerUpper);
    if (cached && Date.now() - cached.timestamp < this.INSTRUMENT_CACHE_TTL) {
      return cached.data;
    }

    const assetType = this.getProviderRouteAssetType(tickerUpper);
    let profile: InstrumentProfileDto | null = null;

    if (assetType === 'crypto') {
      const quote = await this.getQuote(tickerUpper);
      profile = {
        ticker: tickerUpper,
        assetType: 'crypto',
        shortName: quote.shortName || tickerUpper,
        longName: quote.longName || quote.shortName || tickerUpper,
        currency: quote.currency || 'USD',
        marketState: quote.marketState,
        marketCap: quote.marketCap,
      };
    } else {
      profile = await this.fetchWithTelemetry('yahoo-finance', () =>
        this.yahooFinanceProvider.getInstrumentProfile(tickerUpper),
      );
    }

    if (!profile) {
      if (cached) {
        return cached.data;
      }
      throw new NotFoundException(
        `Instrument profile not found for ticker: ${ticker}`,
      );
    }

    this.instrumentCache.set(tickerUpper, {
      data: profile,
      timestamp: Date.now(),
    });
    return profile;
  }

  async getNews(ticker: string, limit = 8): Promise<NewsArticleDto[]> {
    const tickerUpper = this.normalizeTicker(ticker);
    const cacheKey = `${tickerUpper}:${limit}`;
    const cached = this.newsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.NEWS_CACHE_TTL) {
      return cached.data;
    }

    const news = await this.fetchWithTelemetry('yahoo-finance', () =>
      this.yahooFinanceProvider.getNews(tickerUpper, limit),
    );
    if (!news) {
      if (cached) {
        return cached.data;
      }
      return [];
    }
    this.newsCache.set(cacheKey, { data: news, timestamp: Date.now() });
    return news;
  }

  async getMarketSnapshot(
    ticker: string,
    newsLimit = 8,
  ): Promise<MarketSnapshotDto> {
    const tickerUpper = this.normalizeTicker(ticker);
    const [quote, profile, news] = await Promise.all([
      this.getRealtimeQuote(tickerUpper),
      this.getInstrumentProfile(tickerUpper),
      this.getNews(tickerUpper, newsLimit),
    ]);

    return {
      quote,
      profile,
      news,
    };
  }

  getProviderHealth(): ProviderHealthDto[] {
    return Array.from(this.providerHealth.values())
      .map((entry) => this.toProviderHealthDto(entry))
      .sort((a, b) => a.provider.localeCompare(b.provider));
  }

  getHealth(streams: StreamStatusDto[] = []): MarketDataHealthDto {
    const decoratedQuotes = streams.map((stream) =>
      stream.lastQuoteAt
        ? this.computeFreshnessState(
            Date.now() - new Date(stream.lastQuoteAt).getTime(),
          )
        : 'STALE',
    );
    const delayedStreams = decoratedQuotes.filter(
      (state) => state === 'DELAYED',
    ).length;
    const staleStreams = decoratedQuotes.filter(
      (state) => state === 'STALE',
    ).length;

    const providers = this.getProviderHealth();
    let status: MarketDataHealthDto['status'] = 'healthy';
    if (
      providers.some((provider) => provider.status === 'degraded') ||
      staleStreams > 0
    ) {
      status = 'degraded';
    }
    if (providers.some((provider) => provider.status === 'unhealthy')) {
      status = 'unhealthy';
    }

    return {
      status,
      freshnessSummary: {
        activeStreams: streams.length,
        staleStreams,
        delayedStreams,
      },
      providers,
      streams,
      generatedAt: new Date(),
    };
  }

  /**
   * Search for tickers across all asset types
   */
  async searchTickers(
    query: string,
    assetType?: AssetType,
  ): Promise<TickerSearchResultDto[]> {
    const results: TickerSearchResultDto[] = [];
    const seen = new Set<string>();

    // Search equities/ETFs/indices in Yahoo if not crypto-only
    if (!assetType || assetType !== 'crypto') {
      const yahooResults = await this.yahooFinanceProvider.searchTickers(query);
      for (const result of yahooResults) {
        if (assetType && result.assetType !== assetType) {
          continue;
        }
        if (seen.has(result.ticker)) {
          continue;
        }
        seen.add(result.ticker);
        results.push(result);
      }
    }

    // Search crypto if not stock-only
    if (!assetType || assetType === 'crypto') {
      const cryptoResults = await this.coinGeckoProvider.searchCrypto(query);
      for (const result of cryptoResults) {
        if (seen.has(result.symbol)) {
          continue;
        }
        seen.add(result.symbol);
        results.push({
          ticker: result.symbol,
          name: result.name,
          assetType: 'crypto',
        });
      }
    }

    return results;
  }

  /**
   * ─── Macro-data surface (FRED) ────────────────────────────────────────
   *
   * Yield curve, interest-rate observations, economic indicators, and FX
   * pairs. All routed through `fetchWithTelemetry` so the provider-health
   * tracker, circuit breaker, and provider-failure log apply uniformly with
   * the securities-pricing path above.
   *
   * Each method returns a DataGap-aware DTO or `null`; `null` here means
   * "we don't have the data right now, surface it as missing to the user"
   * — never silent-zero per KLYTICS Rule 1. The cache key includes only
   * stable inputs so callers can deduplicate without worrying about
   * timestamp drift.
   */

  /**
   * US Treasury Constant-Maturity yield curve (the curve every ALM model
   * needs for duration / EVE / NII). Cached for 1h (FRED publishes daily).
   *
   * Multi-provider failover ladder:
   *   1. Live cache (≤1h fresh) — return immediately.
   *   2. FRED (primary; richest metadata, longest history).
   *   3. Treasury Fiscal Data (fallback; same Treasury source, no auth).
   *   4. Stale cache (<24h old) — last-resort graceful degrade with a warn.
   *   5. null — UI surfaces a DataGap (Rule 1, never silent-zero).
   */
  async getYieldCurve(): Promise<YieldCurveDto | null> {
    const cacheKey = 'US_TREASURY_CMT';
    const cached = this.yieldCurveCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.YIELD_CURVE_CACHE_TTL) {
      return cached.data;
    }

    // Primary: FRED
    let curve = await this.fetchWithTelemetry('fred', () =>
      this.fredProvider.getYieldCurve(),
    );

    // Fallback: Treasury Fiscal Data — same underlying source (US Treasury
    // Dept), different distribution endpoint. Used when FRED is down or
    // FRED_API_KEY is missing. Logged at info so operators see the failover
    // happen rather than discovering it via metrics.
    if (!curve) {
      this.logger.warn(
        'FRED yield-curve unavailable; trying Treasury Fiscal Data fallback',
      );
      curve = await this.fetchWithTelemetry('treasury-fiscal-data', () =>
        this.treasuryFiscalDataProvider.getYieldCurve(),
      );
    }

    if (!curve) {
      // Honor stale cache as a graceful fallback ONLY if the data is fresh
      // enough to still be meaningful (24h). Otherwise return null so the
      // UI surfaces a DataGap rather than misleading the user.
      if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
        this.logger.warn(
          'Yield-curve fetch failed across all providers; returning stale cache (<24h old)',
        );
        return cached.data;
      }
      return null;
    }
    this.yieldCurveCache.set(cacheKey, { data: curve, timestamp: Date.now() });
    return curve;
  }

  /**
   * Latest observation for a named FRED series (e.g. 'DGS10', 'DGS2'). Use
   * for single-rate references outside the full yield-curve composition.
   */
  async getInterestRate(seriesId: string): Promise<InterestRateDto | null> {
    const cached = this.interestRateCache.get(seriesId);
    if (
      cached &&
      Date.now() - cached.timestamp < this.INTEREST_RATE_CACHE_TTL
    ) {
      return cached.data;
    }
    const rate = await this.fetchWithTelemetry('fred', () =>
      this.fredProvider.getInterestRate(seriesId),
    );
    if (!rate) return null;
    this.interestRateCache.set(seriesId, { data: rate, timestamp: Date.now() });
    return rate;
  }

  /**
   * Generic economic indicator (CPI, unemployment, GDP). Units + frequency
   * forwarded verbatim from FRED metadata when the caller supplies them;
   * otherwise consumer-supplied hints stick to the DTO.
   */
  async getEconomicIndicator(
    seriesId: string,
    options: { units?: string; frequency?: string } = {},
  ): Promise<EconomicIndicatorDto | null> {
    const cacheKey = `${seriesId}::${options.units ?? ''}::${options.frequency ?? ''}`;
    const cached = this.indicatorCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.INDICATOR_CACHE_TTL) {
      return cached.data;
    }
    const indicator = await this.fetchWithTelemetry('fred', () =>
      this.fredProvider.getEconomicIndicator(seriesId, options),
    );
    if (!indicator) return null;
    this.indicatorCache.set(cacheKey, {
      data: indicator,
      timestamp: Date.now(),
    });
    return indicator;
  }

  /**
   * FX rate via FRED's `DEX*` exchange-rate series. Caller passes the FRED
   * series id and the base/quote currency codes (FRED's quoting convention
   * varies by pair; the caller knows which side is which).
   */
  async getFXRate(
    seriesId: string,
    base: string,
    quote: string,
  ): Promise<FXRateDto | null> {
    const cacheKey = `${seriesId}::${base}::${quote}`;
    const cached = this.fxRateCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.FX_RATE_CACHE_TTL) {
      return cached.data;
    }
    const rate = await this.fetchWithTelemetry('fred', () =>
      this.fredProvider.getFXRate(seriesId, base, quote),
    );
    if (!rate) return null;
    this.fxRateCache.set(cacheKey, { data: rate, timestamp: Date.now() });
    return rate;
  }

  /**
   * Clear caches (useful for testing or forced refresh)
   */
  clearCaches(): void {
    this.quoteCache.clear();
    this.fundamentalsCache.clear();
    this.instrumentCache.clear();
    this.newsCache.clear();
    this.yieldCurveCache.clear();
    this.interestRateCache.clear();
    this.indicatorCache.clear();
    this.fxRateCache.clear();
    this.logger.log('All caches cleared');
  }
}
