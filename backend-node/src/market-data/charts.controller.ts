import {
  Controller,
  Get,
  Param,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { MarketDataService } from './market-data.service';
import { TechnicalIndicatorsService } from './technical-indicators.service';
import { CacheService } from '../cache/cache.service';

@Controller('api/charts')
export class ChartsController {
  constructor(
    private readonly marketDataService: MarketDataService,
    private readonly technicalService: TechnicalIndicatorsService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Get OHLCV data with technical indicators
   * GET /api/charts/technical/:ticker?timeframe=1M&indicators=sma20,rsi,macd
   */
  @Get('technical/:ticker')
  async getTechnicalData(
    @Param('ticker') ticker: string,
    @Query('timeframe') timeframe: string = '1M',
    @Query('indicators') indicatorsQuery?: string,
  ): Promise<any> {
    try {
      const cacheKey = `chart:${ticker}:${timeframe}:${indicatorsQuery || 'default'}`;

      return await this.cacheService.getOrSet(
        cacheKey,
        async () => {
          // Calculate date range based on timeframe
          const endDate = new Date();
          const startDate = new Date();

          switch (timeframe) {
            case '1D':
              startDate.setDate(startDate.getDate() - 1);
              break;
            case '1W':
              startDate.setDate(startDate.getDate() - 7);
              break;
            case '1M':
              startDate.setMonth(startDate.getMonth() - 1);
              break;
            case '3M':
              startDate.setMonth(startDate.getMonth() - 3);
              break;
            case '1Y':
              startDate.setFullYear(startDate.getFullYear() - 1);
              break;
            case 'ALL':
              startDate.setFullYear(startDate.getFullYear() - 5);
              break;
            default:
              startDate.setMonth(startDate.getMonth() - 1);
          }

          // Fetch historical data
          const historical = await this.marketDataService.getHistoricalPrices(
            ticker,
            startDate,
            endDate,
          );

          if (!historical || historical.length === 0) {
            throw new Error('No historical data available');
          }

          // Extract price arrays
          const closes = historical.map((h) => h.close);
          const highs = historical.map((h) => h.high);
          const lows = historical.map((h) => h.low);
          const volumes = historical.map((h) => h.volume);

          // Parse requested indicators
          const requestedIndicators = indicatorsQuery
            ? indicatorsQuery.split(',').map((i) => i.trim())
            : ['sma20', 'sma50', 'rsi', 'macd'];

          // Calculate indicators
          const indicators: any = {};

          if (requestedIndicators.includes('sma20')) {
            indicators.sma20 = this.technicalService.calculateSMA(closes, 20);
          }
          if (requestedIndicators.includes('sma50')) {
            indicators.sma50 = this.technicalService.calculateSMA(closes, 50);
          }
          if (requestedIndicators.includes('sma200')) {
            indicators.sma200 = this.technicalService.calculateSMA(closes, 200);
          }
          if (requestedIndicators.includes('ema12')) {
            indicators.ema12 = this.technicalService.calculateEMA(closes, 12);
          }
          if (requestedIndicators.includes('ema26')) {
            indicators.ema26 = this.technicalService.calculateEMA(closes, 26);
          }
          if (requestedIndicators.includes('rsi')) {
            indicators.rsi = this.technicalService.calculateRSI(closes);
          }
          if (requestedIndicators.includes('macd')) {
            indicators.macd = this.technicalService.calculateMACD(closes);
          }
          if (requestedIndicators.includes('bollinger')) {
            indicators.bollingerBands =
              this.technicalService.calculateBollingerBands(closes);
          }
          if (requestedIndicators.includes('vwap')) {
            indicators.vwap = this.technicalService.calculateVWAP(
              closes,
              volumes,
            );
          }
          if (requestedIndicators.includes('atr')) {
            indicators.atr = this.technicalService.calculateATR(
              highs,
              lows,
              closes,
            );
          }
          if (requestedIndicators.includes('stochastic')) {
            indicators.stochastic = this.technicalService.calculateStochastic(
              highs,
              lows,
              closes,
            );
          }

          return {
            ohlcv: historical.map((h) => ({
              date: h.date,
              open: h.open,
              high: h.high,
              low: h.low,
              close: h.close,
              volume: h.volume,
            })),
            indicators,
          };
        },
        900, // 15 minutes TTL
      );
    } catch (error: any) {
      throw new HttpException(
        `Failed to fetch technical data: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get OHLCV candle data only
   * GET /api/charts/ohlcv/:ticker?timeframe=1M
   */
  @Get('ohlcv/:ticker')
  async getOHLCVData(
    @Param('ticker') ticker: string,
    @Query('timeframe') timeframe: string = '1M',
  ) {
    try {
      const cacheKey = `ohlcv:${ticker}:${timeframe}`;

      return await this.cacheService.getOrSet(
        cacheKey,
        async () => {
          const endDate = new Date();
          const startDate = new Date();

          switch (timeframe) {
            case '1D':
              startDate.setDate(startDate.getDate() - 1);
              break;
            case '1W':
              startDate.setDate(startDate.getDate() - 7);
              break;
            case '1M':
              startDate.setMonth(startDate.getMonth() - 1);
              break;
            case '3M':
              startDate.setMonth(startDate.getMonth() - 3);
              break;
            case '1Y':
              startDate.setFullYear(startDate.getFullYear() - 1);
              break;
            case 'ALL':
              startDate.setFullYear(startDate.getFullYear() - 5);
              break;
            default:
              startDate.setMonth(startDate.getMonth() - 1);
          }

          const historical = await this.marketDataService.getHistoricalPrices(
            ticker,
            startDate,
            endDate,
          );

          return {
            ticker,
            timeframe,
            data: historical.map((h) => ({
              date: h.date,
              open: h.open,
              high: h.high,
              low: h.low,
              close: h.close,
              volume: h.volume,
            })),
          };
        },
        900, // 15 minutes TTL
      );
    } catch (error: any) {
      throw new HttpException(
        `Failed to fetch OHLCV data: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
