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
  // verify:auth-skip — public AI insight on a public-ticker quote; no PII; LLM-cached
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
  // verify:auth-skip — public ticker quote feed; no PII
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
  // verify:auth-skip — public historical price feed; no PII
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
  // verify:auth-skip — public fundamentals feed (P/E, EPS, etc.); SEC-disclosed data
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
  // verify:auth-skip — public instrument metadata (name, exchange, sector); no PII
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
  // verify:auth-skip — public news headlines per ticker
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
  // verify:auth-skip — public unified snapshot (quote + fundamentals + news) for a ticker
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
  // verify:auth-skip — public ticker symbol search
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
  // verify:auth-skip — market-data service health (upstream provider up/down)
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
  // verify:auth-skip — observability snapshot of active streams (counts, subscribers); aggregate only, no PII
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

  /**
   * US Treasury Constant-Maturity yield curve.
   * GET /api/market-data/yield-curve
   *
   * Returns the full curve (1M → 30Y where available) plus an inversion flag.
   * Public-data endpoint — no PII; FRED is a public Federal Reserve API.
   * Returns 503 (with a structured body) when the upstream is unavailable
   * so the ALM page can render an explicit DataGap rather than misleading
   * zeros — KLYTICS Rule 1.
   */
  // verify:auth-skip — public macro data; no tenant-scoped fields in response
  @Get('yield-curve')
  async getYieldCurve() {
    const curve = await this.marketDataService.getYieldCurve();
    if (!curve) {
      throw new HttpException(
        {
          __dataGap: true,
          field: 'yieldCurve',
          severity: 'WARNING',
          reason: 'PROVIDER_UNAVAILABLE',
          action:
            'FRED upstream unavailable or FRED_API_KEY missing; retry shortly or check provider health at /api/market-data/health',
          provider: 'fred',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return curve;
  }

  /**
   * Single FRED interest-rate series observation.
   * GET /api/market-data/interest-rate/:seriesId
   *
   * Example seriesIds: DGS1, DGS2, DGS5, DGS10, DGS30, DGS1MO, DGS3MO.
   */
  // verify:auth-skip — public macro data
  @Get('interest-rate/:seriesId')
  async getInterestRate(@Param('seriesId') seriesId: string) {
    if (!seriesId || !/^[A-Z0-9_]{2,20}$/.test(seriesId)) {
      throw new HttpException(
        'Invalid seriesId — expected uppercase alphanumerics + underscores, 2-20 chars',
        HttpStatus.BAD_REQUEST,
      );
    }
    const rate = await this.marketDataService.getInterestRate(seriesId);
    if (!rate) {
      throw new HttpException(
        {
          __dataGap: true,
          field: 'interestRate',
          severity: 'WARNING',
          reason: 'NO_DATA',
          action: `FRED has no recent observation for ${seriesId} or the upstream is unavailable; verify the series id at https://fred.stlouisfed.org/series/${seriesId}`,
          provider: 'fred',
          seriesId,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return rate;
  }
}
