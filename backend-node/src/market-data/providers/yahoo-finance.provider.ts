import { Injectable, Logger } from '@nestjs/common';
import yahooFinance from 'yahoo-finance2';
import { QuoteDto, HistoricalPriceDto, FundamentalsDto } from '../dto/quote.dto';

@Injectable()
export class YahooFinanceProvider {
    private readonly logger = new Logger(YahooFinanceProvider.name);

    async getQuote(ticker: string): Promise<QuoteDto | null> {
        try {
            this.logger.debug(`Fetching quote for ${ticker}`);
            const quote: any = await yahooFinance.quote(ticker);

            if (!quote) {
                this.logger.warn(`No quote data found for ${ticker}`);
                return null;
            }

            return {
                ticker: quote.symbol || ticker,
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

            const result: any[] = await yahooFinance.historical(ticker, queryOptions);

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
            const quote: any = await yahooFinance.quote(ticker);

            if (!quote) {
                return null;
            }

            return {
                ticker: quote.symbol || ticker,
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

    async searchTickers(query: string): Promise<Array<{ symbol: string; name: string; exchange?: string }>> {
        try {
            this.logger.debug(`Searching for tickers with query: ${query}`);
            const results: any = await yahooFinance.search(query);

            return results.quotes.slice(0, 10).map((quote: any) => ({
                symbol: quote.symbol,
                name: quote.shortname || quote.longname || quote.symbol,
                exchange: quote.exchDisp,
            }));
        } catch (error: any) {
            this.logger.error(`Failed to search tickers with query ${query}: ${error.message}`);
            return [];
        }
    }
}
