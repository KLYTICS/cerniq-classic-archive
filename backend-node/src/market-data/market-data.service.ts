import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataQualityService } from '../common/data-quality.service';
import { YahooFinanceProvider } from './providers/yahoo-finance.provider';
import { CoinGeckoProvider } from './providers/coingecko.provider';
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
    private readonly cryptoTickers = new Set(['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'MATIC', 'DOT', 'AVAX']);
    private readonly providerHealth = new Map<string, ProviderHealthInternal>();

    // In-memory cache for quotes (1 minute TTL)
    private quoteCache = new Map<string, { data: QuoteDto; timestamp: number }>();
    private readonly QUOTE_CACHE_TTL = 60 * 1000; // 1 minute
    private readonly REALTIME_QUOTE_CACHE_TTL = this.parseCacheTtl(
        process.env.MARKET_REALTIME_QUOTE_CACHE_TTL_MS,
        5000,
    );

    // In-memory cache for fundamentals (24 hour TTL)
    private fundamentalsCache = new Map<string, { data: FundamentalsDto; timestamp: number }>();
    private readonly FUNDAMENTALS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

    // Instrument profile cache (15 minutes)
    private instrumentCache = new Map<string, { data: InstrumentProfileDto; timestamp: number }>();
    private readonly INSTRUMENT_CACHE_TTL = 15 * 60 * 1000;

    // News cache (5 minutes)
    private newsCache = new Map<string, { data: NewsArticleDto[]; timestamp: number }>();
    private readonly NEWS_CACHE_TTL = 5 * 60 * 1000;

    constructor(
        private readonly yahooFinanceProvider: YahooFinanceProvider,
        private readonly coinGeckoProvider: CoinGeckoProvider,
        private readonly dataQualityService: DataQualityService,
    ) { }

    /**
     * Determine asset type based on ticker format
     */
    private getProviderRouteAssetType(ticker: string): 'crypto' | 'stock' {
        return this.cryptoTickers.has(ticker.toUpperCase()) ? 'crypto' : 'stock';
    }

    private parseCacheTtl(rawValue: string | undefined, fallbackMs: number): number {
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
            if (normalized === `${cryptoTicker}-USD` || normalized === `${cryptoTicker}USD`) {
                return cryptoTicker;
            }
        }

        return normalized;
    }

    private computeSession(assetType: AssetType, marketState?: string): MarketSession {
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
        const quoteTimestamp = quote.quoteTimestamp || quote.timestamp || new Date();
        const ageMs = Math.max(0, Date.now() - new Date(quoteTimestamp).getTime());
        const assetType = quote.assetType || (this.getProviderRouteAssetType(quote.ticker) === 'crypto' ? 'crypto' : 'stock');

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
        const previousClose = quote.previousClose > 0
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
            assetType: quote.assetType ?? (this.getProviderRouteAssetType(ticker) === 'crypto' ? 'crypto' : 'stock'),
            price,
            change,
            changePercent,
            previousClose,
            volume: Number.isFinite(quote.volume) ? quote.volume : 0,
            high: Number.isFinite(quote.high) ? quote.high : price,
            low: Number.isFinite(quote.low) ? quote.low : price,
            open: Number.isFinite(quote.open) ? quote.open : previousClose,
            timestamp: quote.timestamp ? new Date(quote.timestamp) : new Date(),
            quoteTimestamp: quote.quoteTimestamp ? new Date(quote.quoteTimestamp) : (quote.timestamp ? new Date(quote.timestamp) : new Date()),
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
        return Boolean(entry.circuitOpenUntil && entry.circuitOpenUntil.getTime() > Date.now());
    }

    private recordProviderResult(provider: string, latencyMs: number, success: boolean) {
        const entry = this.getProviderHealthEntry(provider);
        entry.totalRequests += 1;
        entry.totalLatencyMs += latencyMs;
        entry.avgLatencyMs = Number((entry.totalLatencyMs / entry.totalRequests).toFixed(2));

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

    private toProviderHealthDto(entry: ProviderHealthInternal): ProviderHealthDto {
        const successRate = entry.totalRequests > 0
            ? Number(((entry.successfulRequests / entry.totalRequests) * 100).toFixed(2))
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

    private async fetchWithTelemetry<T>(provider: string, fetcher: () => Promise<T | null>): Promise<T | null> {
        if (this.isCircuitOpen(provider)) {
            this.logger.warn(`Provider circuit open for ${provider}; skipping upstream call`);
            return null;
        }

        const startedAt = Date.now();
        try {
            const payload = await fetcher();
            this.recordProviderResult(provider, Date.now() - startedAt, Boolean(payload));
            return payload;
        } catch (error) {
            this.recordProviderResult(provider, Date.now() - startedAt, false);
            this.logger.error(`Provider request failed for ${provider}:`, error);
            return null;
        }
    }

    private async fetchQuoteFromProvider(ticker: string): Promise<ProviderFetchResult<QuoteDto>> {
        const assetType = this.getProviderRouteAssetType(ticker);

        if (assetType === 'crypto') {
            return {
                provider: 'coingecko',
                payload: await this.fetchWithTelemetry('coingecko', () => this.coinGeckoProvider.getQuote(ticker)),
            };
        }

        return {
            provider: 'yahoo-finance',
            payload: await this.fetchWithTelemetry('yahoo-finance', () => this.yahooFinanceProvider.getQuote(ticker)),
        };
    }

    /**
     * Get current quote for a ticker
     */
    async getQuote(ticker: string, options: QuoteRequestOptions = {}): Promise<QuoteDto> {
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
                this.logger.warn(`Using stale cached quote for ${tickerUpper}; upstream ${quoteResult.provider} unavailable`);
                return this.decorateQuoteForDelivery(cached.data);
            }
            throw new NotFoundException(`Quote not found for ticker: ${ticker}`);
        }

        const normalizedQuote = this.normalizeQuote(tickerUpper, {
            ...quote,
            provider: quote.provider || quoteResult.provider,
        });

        // Cache the result
        this.quoteCache.set(tickerUpper, { data: normalizedQuote, timestamp: Date.now() });

        return this.decorateQuoteForDelivery(normalizedQuote);
    }

    /**
     * Get a fresher quote for streaming surfaces without fully disabling caching.
     */
    async getRealtimeQuote(ticker: string): Promise<QuoteDto> {
        return this.getQuote(ticker, { maxCacheAgeMs: this.REALTIME_QUOTE_CACHE_TTL });
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
            return this.coinGeckoProvider.getHistoricalPrices(tickerUpper, startDate, endDate);
        } else {
            return this.yahooFinanceProvider.getHistoricalPrices(tickerUpper, startDate, endDate);
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
            throw new NotFoundException('Fundamentals not available for cryptocurrencies');
        }

        const fundamentals = await this.fetchWithTelemetry(
            'yahoo-finance',
            () => this.yahooFinanceProvider.getFundamentals(tickerUpper),
        );

        if (!fundamentals) {
            throw new NotFoundException(`Fundamentals not found for ticker: ${ticker}`);
        }

        // Cache the result
        this.fundamentalsCache.set(tickerUpper, { data: fundamentals, timestamp: Date.now() });

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
            profile = await this.fetchWithTelemetry(
                'yahoo-finance',
                () => this.yahooFinanceProvider.getInstrumentProfile(tickerUpper),
            );
        }

        if (!profile) {
            if (cached) {
                return cached.data;
            }
            throw new NotFoundException(`Instrument profile not found for ticker: ${ticker}`);
        }

        this.instrumentCache.set(tickerUpper, { data: profile, timestamp: Date.now() });
        return profile;
    }

    async getNews(ticker: string, limit = 8): Promise<NewsArticleDto[]> {
        const tickerUpper = this.normalizeTicker(ticker);
        const cacheKey = `${tickerUpper}:${limit}`;
        const cached = this.newsCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.NEWS_CACHE_TTL) {
            return cached.data;
        }

        const news = await this.fetchWithTelemetry(
            'yahoo-finance',
            () => this.yahooFinanceProvider.getNews(tickerUpper, limit),
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

    async getMarketSnapshot(ticker: string, newsLimit = 8): Promise<MarketSnapshotDto> {
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
        const decoratedQuotes = streams
            .map((stream) => stream.lastQuoteAt ? this.computeFreshnessState(Date.now() - new Date(stream.lastQuoteAt).getTime()) : 'STALE');
        const delayedStreams = decoratedQuotes.filter((state) => state === 'DELAYED').length;
        const staleStreams = decoratedQuotes.filter((state) => state === 'STALE').length;

        const providers = this.getProviderHealth();
        let status: MarketDataHealthDto['status'] = 'healthy';
        if (providers.some((provider) => provider.status === 'degraded') || staleStreams > 0) {
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
    async searchTickers(query: string, assetType?: AssetType): Promise<TickerSearchResultDto[]> {
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
     * Clear caches (useful for testing or forced refresh)
     */
    clearCaches(): void {
        this.quoteCache.clear();
        this.fundamentalsCache.clear();
        this.instrumentCache.clear();
        this.newsCache.clear();
        this.logger.log('All caches cleared');
    }
}
