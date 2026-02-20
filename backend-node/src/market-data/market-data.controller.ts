import { Controller, Get, Param, Query, HttpException, HttpStatus } from '@nestjs/common';
import { MarketDataService } from './market-data.service';
import { QuoteDto, HistoricalPriceDto, FundamentalsDto, TickerSearchResultDto } from './dto/quote.dto';

import { LlmService } from '../llm/llm.service';

@Controller('api/market-data')
export class MarketDataController {
    constructor(
        private readonly marketDataService: MarketDataService,
        private readonly llmService: LlmService
    ) { }

    /**
     * Get AI insights for a ticker
     * GET /api/market-data/insights?ticker=AAPL
     */
    @Get('insights')
    async getInsights(@Query('ticker') ticker: string) {
        if (!ticker) {
            throw new HttpException('Ticker is required', HttpStatus.BAD_REQUEST);
        }

        try {
            // Get current price data to inform the insight
            const quote = await this.marketDataService.getQuote(ticker);
            const insight = await this.llmService.generateStockInsight(
                ticker,
                quote.price,
                quote.changePercent
            );

            return { ticker, insight };
        } catch (error) {
            // Fallback if quote fails
            try {
                const insight = await this.llmService.generateStockInsight(ticker, 0, 0);
                return { ticker, insight };
            } catch (e) {
                throw new HttpException(
                    'Failed to generate insights',
                    HttpStatus.INTERNAL_SERVER_ERROR,
                );
            }
        }
    }

    /**
     * Get current quote for a ticker
     * GET /api/market-data/quote/:ticker
     */
    @Get('quote/:ticker')
    async getQuote(@Param('ticker') ticker: string): Promise<QuoteDto> {
        try {
            return await this.marketDataService.getQuote(ticker);
        } catch (error) {
            throw new HttpException(
                error.message || 'Failed to fetch quote',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * Get historical prices for a ticker
     * GET /api/market-data/history/:ticker?start=YYYY-MM-DD&end=YYYY-MM-DD
     */
    @Get('history/:ticker')
    async getHistoricalPrices(
        @Param('ticker') ticker: string,
        @Query('start') startDateStr?: string,
        @Query('end') endDateStr?: string,
    ): Promise<HistoricalPriceDto[]> {
        try {
            // Default to last 3 months if not specified
            const endDate = endDateStr ? new Date(endDateStr) : new Date();
            const startDate = startDateStr
                ? new Date(startDateStr)
                : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago

            return await this.marketDataService.getHistoricalPrices(ticker, startDate, endDate);
        } catch (error) {
            throw new HttpException(
                error.message || 'Failed to fetch historical prices',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * Get fundamental data for a ticker
     * GET /api/market-data/fundamentals/:ticker
     */
    @Get('fundamentals/:ticker')
    async getFundamentals(@Param('ticker') ticker: string): Promise<FundamentalsDto> {
        try {
            return await this.marketDataService.getFundamentals(ticker);
        } catch (error) {
            throw new HttpException(
                error.message || 'Failed to fetch fundamentals',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * Search for tickers
     * GET /api/market-data/search?q=apple&assetType=stock
     */
    @Get('search')
    async searchTickers(
        @Query('q') query: string,
        @Query('assetType') assetType?: 'stock' | 'crypto',
    ): Promise<TickerSearchResultDto[]> {
        if (!query || query.trim().length === 0) {
            throw new HttpException('Query parameter is required', HttpStatus.BAD_REQUEST);
        }

        try {
            return await this.marketDataService.searchTickers(query, assetType);
        } catch (error) {
            throw new HttpException(
                error.message || 'Failed to search tickers',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * Clear all caches (admin only - add auth later)
     * GET /api/market-data/clear-cache
     */
    @Get('clear-cache')
    clearCaches(): { message: string } {
        this.marketDataService.clearCaches();
        return { message: 'Caches cleared successfully' };
    }
}
