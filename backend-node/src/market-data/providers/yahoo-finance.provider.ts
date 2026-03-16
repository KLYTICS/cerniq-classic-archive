import { Injectable, Logger } from '@nestjs/common';
import yahooFinance from 'yahoo-finance2';
import { QuoteDto, HistoricalPriceDto, FundamentalsDto, InstrumentProfileDto, NewsArticleDto, TickerSearchResultDto } from '../dto/quote.dto';

@Injectable()
export class YahooFinanceProvider {
    private readonly logger = new Logger(YahooFinanceProvider.name);
    // yahoo-finance2 v3+ expects an instance; this also works on older versions.
    private readonly client = new (yahooFinance as any)();

    private mapYahooQuoteType(quoteType?: string): 'stock' | 'etf' | 'crypto' | 'index' {
        switch ((quoteType || '').toUpperCase()) {
            case 'ETF':
            case 'MUTUALFUND':
            case 'FUND':
                return 'etf';
            case 'INDEX':
                return 'index';
            case 'CRYPTOCURRENCY':
            case 'CURRENCY':
                return 'crypto';
            default:
                return 'stock';
        }
    }

    async getQuote(ticker: string): Promise<QuoteDto | null> {
        try {
            this.logger.debug(`Fetching quote for ${ticker}`);
            const quote: any = await this.client.quote(ticker);

            if (!quote) {
                this.logger.warn(`No quote data found for ${ticker}`);
                return null;
            }

            return {
                ticker: quote.symbol || ticker,
                assetType: this.mapYahooQuoteType(quote.quoteType),
                shortName: quote.shortName || quote.displayName || quote.symbol || ticker,
                longName: quote.longName || quote.shortName || quote.displayName || quote.symbol || ticker,
                exchange: quote.fullExchangeName || quote.exchange,
                currency: quote.currency,
                marketState: quote.marketState,
                price: quote.regularMarketPrice || 0,
                change: quote.regularMarketChange || 0,
                changePercent: quote.regularMarketChangePercent || 0,
                volume: quote.regularMarketVolume || 0,
                marketCap: quote.marketCap,
                high: quote.regularMarketDayHigh || 0,
                low: quote.regularMarketDayLow || 0,
                open: quote.regularMarketOpen || 0,
                previousClose: quote.regularMarketPreviousClose || 0,
                timestamp: new Date(quote.regularMarketTime || Date.now()),
            };
        } catch (error: any) {
            this.logger.error(`Failed to fetch quote for ${ticker}: ${error.message}`);
            return null;
        }
    }

    async getHistoricalPrices(
        ticker: string,
        startDate: Date,
        endDate: Date,
    ): Promise<HistoricalPriceDto[]> {
        try {
            this.logger.debug(`Fetching historical prices for ${ticker} from ${startDate} to ${endDate}`);

            const queryOptions = {
                period1: startDate,
                period2: endDate,
                interval: '1d' as const,
            };

            const result: any[] = await this.client.historical(ticker, queryOptions);

            return result.map((item: any) => ({
                date: item.date.toISOString().split('T')[0],
                open: item.open,
                high: item.high,
                low: item.low,
                close: item.close,
                volume: item.volume,
                adjustedClose: item.adjClose || item.close,
            }));
        } catch (error: any) {
            this.logger.error(`Failed to fetch historical prices for ${ticker}: ${error.message}`);
            return [];
        }
    }

    async getFundamentals(ticker: string): Promise<FundamentalsDto | null> {
        try {
            this.logger.debug(`Fetching fundamentals for ${ticker}`);
            const quote: any = await this.client.quote(ticker);

            if (!quote) {
                return null;
            }

            return {
                ticker: quote.symbol || ticker,
                assetType: this.mapYahooQuoteType(quote.quoteType),
                marketCap: quote.marketCap || 0,
                peRatio: quote.trailingPE,
                forwardPE: quote.forwardPE,
                pbRatio: quote.priceToBook,
                dividendYield: quote.dividendYield,
                eps: quote.epsTrailingTwelveMonths,
                beta: quote.beta,
                fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
                fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
                averageVolume: quote.averageVolume,
                sector: quote.sector,
                industry: quote.industry,
            };
        } catch (error: any) {
            this.logger.error(`Failed to fetch fundamentals for ${ticker}: ${error.message}`);
            return null;
        }
    }

    async getInstrumentProfile(ticker: string): Promise<InstrumentProfileDto | null> {
        try {
            this.logger.debug(`Fetching instrument profile for ${ticker}`);
            const summary: any = await this.client.quoteSummary(ticker, {
                modules: ['price', 'quoteType', 'summaryProfile', 'fundProfile', 'summaryDetail', 'topHoldings', 'defaultKeyStatistics'],
            });

            if (!summary) {
                return null;
            }

            const quoteType = summary.quoteType?.quoteType;
            const assetType = this.mapYahooQuoteType(quoteType);
            const price = summary.price || {};
            const summaryProfile = summary.summaryProfile || {};
            const fundProfile = summary.fundProfile || {};
            const summaryDetail = summary.summaryDetail || {};
            const defaultKeyStatistics = summary.defaultKeyStatistics || {};
            const topHoldings = Array.isArray(summary.topHoldings?.holdings)
                ? summary.topHoldings.holdings
                : [];

            return {
                ticker: price.symbol || summary.quoteType?.symbol || ticker.toUpperCase(),
                assetType,
                shortName: summary.quoteType?.shortName || price.shortName || price.displayName,
                longName: summary.quoteType?.longName || price.longName || summary.quoteType?.shortName || price.shortName,
                exchange: summary.quoteType?.exchange || price.exchangeName,
                currency: price.currency || summaryDetail.currency,
                marketState: price.marketState,
                sector: summaryProfile.sector || summaryProfile.sectorDisp,
                industry: summaryProfile.industry || summaryProfile.industryDisp,
                categoryName: fundProfile.categoryName || defaultKeyStatistics.category || undefined,
                family: fundProfile.family || defaultKeyStatistics.fundFamily || undefined,
                description: summaryProfile.longBusinessSummary || summaryProfile.description || fundProfile.categoryName || undefined,
                website: summaryProfile.website,
                marketCap: summaryDetail.marketCap,
                totalAssets: summaryDetail.totalAssets || fundProfile.feesExpensesInvestment?.totalNetAssets,
                expenseRatio: fundProfile.feesExpensesInvestment?.annualReportExpenseRatio,
                yield: summaryDetail.yield,
                ytdReturn: summaryDetail.ytdReturn || defaultKeyStatistics.ytdReturn,
                topHoldings: topHoldings.slice(0, 8).map((holding: any) => ({
                    symbol: holding.symbol,
                    name: holding.holdingName,
                    weight: holding.holdingPercent,
                })),
            };
        } catch (error: any) {
            this.logger.error(`Failed to fetch instrument profile for ${ticker}: ${error.message}`);
            return null;
        }
    }

    async getNews(ticker: string, limit: number = 8): Promise<NewsArticleDto[]> {
        try {
            this.logger.debug(`Fetching news for ${ticker}`);
            const results: any = await this.client.search(ticker, {
                quotesCount: 0,
                newsCount: Math.max(1, Math.min(limit, 20)),
                enableFuzzyQuery: true,
            });

            const newsItems = Array.isArray(results?.news) ? results.news : [];

            return newsItems.map((article: any) => ({
                id: article.uuid || article.link || `${ticker}-${article.title}`,
                title: article.title,
                publisher: article.publisher,
                link: article.link,
                publishedAt: article.providerPublishTime ? new Date(article.providerPublishTime) : new Date(),
                relatedTickers: article.relatedTickers,
                thumbnailUrl: article.thumbnail?.resolutions?.[0]?.url,
            }));
        } catch (error: any) {
            this.logger.error(`Failed to fetch news for ${ticker}: ${error.message}`);
            return [];
        }
    }

    async searchTickers(query: string): Promise<TickerSearchResultDto[]> {
        try {
            this.logger.debug(`Searching for tickers with query: ${query}`);
            const results: any = await this.client.search(query, {
                quotesCount: 12,
                newsCount: 0,
                enableFuzzyQuery: true,
            });

            return (results.quotes || []).slice(0, 12).map((quote: any) => ({
                ticker: quote.symbol,
                name: quote.shortname || quote.longname || quote.symbol,
                assetType: this.mapYahooQuoteType(quote.quoteType),
                exchange: quote.exchDisp,
                sector: quote.sectorDisp || quote.sector,
            }));
        } catch (error: any) {
            this.logger.error(`Failed to search tickers with query ${query}: ${error.message}`);
            return [];
        }
    }
}
