import {
  Controller,
  Get,
  Param,
  Query,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { MarketDataService } from './market-data.service';
import {
  QuoteDto,
  HistoricalPriceDto,
  FundamentalsDto,
  InstrumentProfileDto,
  MarketDataHealthDto,
  MarketSnapshotDto,
  NewsArticleDto,
  StreamStatusDto,
  TickerSearchResultDto,
} from './dto/quote.dto';

import { LlmService } from '../llm/llm.service';
import { MarketStreamManagerService } from './market-stream-manager.service';
import { AdminKeyGuard } from '../auth/admin-key.guard';

@Controller('api/market-data')
export class MarketDataController {
  constructor(
    private readonly marketDataService: MarketDataService,
    private readonly llmService: LlmService,
    private readonly marketStreamManager: MarketStreamManagerService,
  ) {}

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
        quote.changePercent,
      );

      return { ticker, insight };
    } catch (_error) {
      // Fallback if quote fails
      try {
        const insight = await this.llmService.generateStockInsight(
          ticker,
          0,
          0,
        );
        return { ticker, insight };
      } catch (_e) {
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
      return await this.marketDataService.getRealtimeQuote(ticker);
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

      return await this.marketDataService.getHistoricalPrices(
        ticker,
        startDate,
        endDate,
      );
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
  async getFundamentals(
    @Param('ticker') ticker: string,
  ): Promise<FundamentalsDto> {
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
   * Get instrument profile for a ticker, including ETF metadata when available
   * GET /api/market-data/instrument/:ticker
   */
  @Get('instrument/:ticker')
  async getInstrumentProfile(
    @Param('ticker') ticker: string,
  ): Promise<InstrumentProfileDto> {
    try {
      return await this.marketDataService.getInstrumentProfile(ticker);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch instrument profile',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get latest related news for a ticker
   * GET /api/market-data/news/:ticker?limit=8
   */
  @Get('news/:ticker')
  async getNews(
    @Param('ticker') ticker: string,
    @Query('limit') limit?: string,
  ): Promise<NewsArticleDto[]> {
    try {
      const parsedLimit = Number.parseInt(limit || '', 10);
      return await this.marketDataService.getNews(
        ticker,
        Number.isFinite(parsedLimit) ? parsedLimit : 8,
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch news',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get the complete market snapshot used by live surfaces
   * GET /api/market-data/snapshot/:ticker?newsLimit=8
   */
  @Get('snapshot/:ticker')
  async getMarketSnapshot(
    @Param('ticker') ticker: string,
    @Query('newsLimit') newsLimit?: string,
  ): Promise<MarketSnapshotDto> {
    try {
      const parsedLimit = Number.parseInt(newsLimit || '', 10);
      return await this.marketDataService.getMarketSnapshot(
        ticker,
        Number.isFinite(parsedLimit) ? parsedLimit : 8,
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch market snapshot',
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
    @Query('assetType') assetType?: 'stock' | 'etf' | 'crypto' | 'index',
  ): Promise<TickerSearchResultDto[]> {
    if (!query || query.trim().length === 0) {
      throw new HttpException(
        'Query parameter is required',
        HttpStatus.BAD_REQUEST,
      );
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
   * Get market-data provider and stream health
   * GET /api/market-data/health
   */
  @Get('health')
  getMarketDataHealth(): MarketDataHealthDto {
    return this.marketDataService.getHealth(
      this.marketStreamManager.getStreamStatus(),
    );
  }

  /**
   * Get active stream status for debugging and observability
   * GET /api/market-data/streams
   */
  @Get('streams')
  getActiveStreams(): StreamStatusDto[] {
    return this.marketStreamManager.getStreamStatus();
  }

  /**
   * Clear all caches (admin only)
   * GET /api/market-data/clear-cache
   *
   * Method-level `@UseGuards(AdminKeyGuard)` (not class-level) because
   * this controller mixes public market-data feeds with a single admin
   * route. AuthModule is `@Global()` (peer `6b317c44`), so no module
   * import is needed.
   */
  @Get('clear-cache')
  @UseGuards(AdminKeyGuard)
  clearCaches(): { message: string } {
    this.marketDataService.clearCaches();
    return { message: 'Caches cleared successfully' };
  }
}
