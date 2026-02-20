import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { YahooFinanceProvider } from './providers/yahoo-finance.provider';
import { CoinGeckoProvider } from './providers/coingecko.provider';
import { QuoteDto, HistoricalPriceDto, FundamentalsDto, TickerSearchResultDto } from './dto/quote.dto';

@Injectable()
export class MarketDataService {
    private readonly logger = new Logger(MarketDataService.name);

    // In-memory cache for quotes (1 minute TTL)
    private quoteCache = new Map<string, { data: QuoteDto; timestamp: number }>();
    private readonly QUOTE_CACHE_TTL = 60 * 1000; // 1 minute

    // In-memory cache for fundamentals (24 hour TTL)
    private fundamentalsCache = new Map<string, { data: FundamentalsDto; timestamp: number }>();
    private readonly FUNDAMENTALS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

    constructor(
        private readonly yahooFinanceProvider: YahooFinanceProvider,
        private readonly coinGeckoProvider: CoinGeckoProvider,
    ) { }

    /**
     * Determine asset type based on ticker format
     */
    private getAssetType(ticker: string): 'crypto' | 'stock' {
        const cryptoTickers = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'MATIC', 'DOT', 'AVAX'];
        return cryptoTickers.includes(ticker.toUpperCase()) ? 'crypto' : 'stock';
    }

    /**
     * Get current quote for a ticker
     */
    async getQuote(ticker: string): Promise<QuoteDto> {
        const tickerUpper = ticker.toUpperCase();

        // Check cache first
        const cached = this.quoteCache.get(tickerUpper);
        if (cached && Date.now() - cached.timestamp < this.QUOTE_CACHE_TTL) {
            this.logger.debug(`Returning cached quote for ${tickerUpper}`);
            return cached.data;
        }

        const assetType = this.getAssetType(tickerUpper);
        let quote: QuoteDto | null;

        if (assetType === 'crypto') {
            quote = await this.coinGeckoProvider.getQuote(tickerUpper);
        } else {
            quote = await this.yahooFinanceProvider.getQuote(tickerUpper);
        }

        if (!quote) {
            throw new NotFoundException(`Quote not found for ticker: ${ticker}`);
        }

        // Cache the result
        this.quoteCache.set(tickerUpper, { data: quote, timestamp: Date.now() });

        return quote;
    }

    /**
     * Get historical prices for a ticker
     */
    async getHistoricalPrices(
        ticker: string,
        startDate: Date,
        endDate: Date,
    ): Promise<HistoricalPriceDto[]> {
        const tickerUpper = ticker.toUpperCase();
        const assetType = this.getAssetType(tickerUpper);

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
        const tickerUpper = ticker.toUpperCase();

        // Check cache first
        const cached = this.fundamentalsCache.get(tickerUpper);
        if (cached && Date.now() - cached.timestamp < this.FUNDAMENTALS_CACHE_TTL) {
            this.logger.debug(`Returning cached fundamentals for ${tickerUpper}`);
            return cached.data;
        }

        const assetType = this.getAssetType(tickerUpper);

        if (assetType === 'crypto') {
            throw new NotFoundException('Fundamentals not available for cryptocurrencies');
        }

        const fundamentals = await this.yahooFinanceProvider.getFundamentals(tickerUpper);

        if (!fundamentals) {
            throw new NotFoundException(`Fundamentals not found for ticker: ${ticker}`);
        }

        // Cache the result
        this.fundamentalsCache.set(tickerUpper, { data: fundamentals, timestamp: Date.now() });

        return fundamentals;
    }

    /**
     * Search for tickers across all asset types
     */
    async searchTickers(query: string, assetType?: 'stock' | 'crypto'): Promise<TickerSearchResultDto[]> {
        const results: TickerSearchResultDto[] = [];

        // Search stocks/ETFs if not crypto-only
        if (!assetType || assetType === 'stock') {
            const yahooResults = await this.yahooFinanceProvider.searchTickers(query);
            results.push(
                ...yahooResults.map((r) => ({
                    ticker: r.symbol,
                    name: r.name,
                    assetType: 'stock' as const,
                    exchange: r.exchange,
                })),
            );
        }

        // Search crypto if not stock-only
        if (!assetType || assetType === 'crypto') {
            const cryptoResults = await this.coinGeckoProvider.searchCrypto(query);
            results.push(
                ...cryptoResults.map((r) => ({
                    ticker: r.symbol,
                    name: r.name,
                    assetType: 'crypto' as const,
                })),
            );
        }

        return results;
    }

    /**
     * Clear caches (useful for testing or forced refresh)
     */
    clearCaches(): void {
        this.quoteCache.clear();
        this.fundamentalsCache.clear();
        this.logger.log('All caches cleared');
    }
}
