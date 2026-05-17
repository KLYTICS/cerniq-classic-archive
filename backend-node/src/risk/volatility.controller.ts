import {
  Controller,
  Get,
  Param,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { VolatilityService } from './volatility.service';
import {
  VolatilityConeResponseDto,
  VolatilityHeatmapResponseDto,
  RealizedVsImpliedResponseDto,
  VolatilityStatsDto,
} from './dto/volatility.dto';

// verify:auth-skip-controller — public volatility analytics on public market data (cones, heatmaps, RV-vs-IV, stats, health); no PII
@Controller('api/risk/volatility')
export class VolatilityController {
  constructor(private readonly volatilityService: VolatilityService) {}

  /**
   * Get volatility cone with historical percentile bands
   * GET /api/risk/volatility/cone/:ticker
   *
   * Returns volatility percentiles (10th, 25th, 50th, 75th, 90th) for different time horizons
   * Useful for identifying whether current volatility is historically cheap or expensive
   *
   * @param ticker - Stock ticker symbol
   * @returns Volatility cone data with percentile bands
   */
  @Get('cone/:ticker')
  async getVolatilityCone(
    @Param('ticker') ticker: string,
  ): Promise<VolatilityConeResponseDto> {
    try {
      return await this.volatilityService.getVolatilityCone(
        ticker.toUpperCase(),
      );
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to calculate volatility cone',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get volatility surface formatted for heatmap visualization
   * GET /api/risk/volatility/heatmap/:ticker
   *
   * Returns IV matrix (strikes x maturities) optimized for heatmap rendering
   * Shows volatility smile and term structure patterns
   *
   * @param ticker - Stock ticker symbol
   * @returns 2D IV matrix with strikes and maturities
   */
  @Get('heatmap/:ticker')
  async getVolatilityHeatmap(
    @Param('ticker') ticker: string,
  ): Promise<VolatilityHeatmapResponseDto> {
    try {
      return await this.volatilityService.getVolatilityHeatmap(
        ticker.toUpperCase(),
      );
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to generate volatility heatmap',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Compare realized vs implied volatility
   * GET /api/risk/volatility/rv-vs-iv/:ticker
   *
   * Returns time series comparing realized volatility (from historical prices)
   * vs implied volatility (from options), showing volatility risk premium
   *
   * @param ticker - Stock ticker symbol
   * @param days - Number of days to analyze (default: 90)
   * @returns Time series of RV vs IV with current spread analysis
   */
  @Get('rv-vs-iv/:ticker')
  async getRealizedVsImplied(
    @Param('ticker') ticker: string,
    @Query('days') days?: string,
  ): Promise<RealizedVsImpliedResponseDto> {
    try {
      const numDays = days ? parseInt(days) : 90;
      return await this.volatilityService.getRealizedVsImplied(
        ticker.toUpperCase(),
        numDays,
      );
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to calculate realized vs implied volatility',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get volatility statistics for a ticker
   * GET /api/risk/volatility/stats/:ticker
   *
   * Returns realized volatility and HV rank for specified period
   *
   * @param ticker - Stock ticker symbol
   * @param period - Time period (e.g., "30d", "90d", "1y")
   * @returns Volatility statistics including HV rank
   */
  @Get('stats/:ticker')
  async getVolatilityStats(
    @Param('ticker') ticker: string,
    @Query('period') period?: string,
  ): Promise<VolatilityStatsDto> {
    try {
      return await this.volatilityService.getVolatilityStats(
        ticker.toUpperCase(),
        period || '30d',
      );
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to calculate volatility stats',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Health check for volatility analytics service
   * GET /api/risk/volatility/health
   */
  @Get('health')
  healthCheck() {
    return {
      status: 'ok',
      service: 'volatility-analytics',
      features: {
        volatilityCone: true,
        heatmap: true,
        realizedVsImplied: true,
        volatilityStats: true,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
