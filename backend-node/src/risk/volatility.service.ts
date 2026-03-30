import { Injectable, Logger } from '@nestjs/common';
import {
  VolatilityConeResponseDto,
  VolatilityConePoint,
  VolatilityHeatmapResponseDto,
  RealizedVsImpliedResponseDto,
  RealizedVsImpliedPoint,
  VolatilityStatsDto,
} from './dto/volatility.dto';
import { MarketDataService } from '../market-data/market-data.service';

@Injectable()
export class VolatilityService {
  private readonly logger = new Logger(VolatilityService.name);

  constructor(private readonly marketDataService: MarketDataService) {}

  /**
   * Calculate volatility cone with historical percentile bands
   * Shows where current vol sits relative to historical distribution
   */
  async getVolatilityCone(ticker: string): Promise<VolatilityConeResponseDto> {
    this.logger.log(`Calculating volatility cone for ${ticker}`);

    // Fetch historical price data (1 year of daily data)
    const historicalData = await this.fetchHistoricalData(ticker, 365);

    if (!historicalData || historicalData.length < 30) {
      throw new Error(
        'Insufficient historical data for volatility cone calculation',
      );
    }

    const currentPrice = historicalData[historicalData.length - 1].close;

    // Calculate returns
    const returns = this.calculateReturns(historicalData.map((d) => d.close));

    // Calculate cone for different time horizons
    const horizons = [7, 14, 30, 60, 90, 180]; // Days to expiry
    const coneData: VolatilityConePoint[] = [];

    for (const horizon of horizons) {
      const point = this.calculateConePoint(returns, horizon);
      coneData.push(point);
    }

    return {
      ticker,
      underlyingPrice: currentPrice,
      coneData,
      timestamp: new Date(),
    };
  }

  /**
   * Get volatility surface formatted for heatmap visualization
   */
  async getVolatilityHeatmap(
    ticker: string,
  ): Promise<VolatilityHeatmapResponseDto> {
    this.logger.log(`Generating volatility heatmap for ${ticker}`);

    // Fetch IV surface data (reuse options service logic)
    // For now, generate mock data with realistic patterns
    const historicalData = await this.fetchHistoricalData(ticker, 30);
    const currentPrice = historicalData[historicalData.length - 1].close;

    // Define strikes (ATM ± 20%, 11 strikes)
    const strikes: number[] = [];
    for (let i = -5; i <= 5; i++) {
      strikes.push(Math.round(currentPrice * (1 + i * 0.04)));
    }

    // Define maturities in days
    const maturities = [7, 14, 30, 60, 90, 180];

    // Calculate base volatility from historical data
    const returns = this.calculateReturns(historicalData.map((d) => d.close));
    const baseVol = this.calculateVolatility(returns, 30);

    // Generate IV matrix with smile and term structure
    const ivMatrix: number[][] = [];

    for (let m = 0; m < maturities.length; m++) {
      const maturity = maturities[m];
      const row: number[] = [];

      for (let s = 0; s < strikes.length; s++) {
        const strike = strikes[s];
        const moneyness = strike / currentPrice;

        // Volatility smile: higher IV for OTM options
        const smileEffect = Math.abs(moneyness - 1) * 0.5;

        // Term structure: longer maturities have slightly higher IV
        const termEffect = Math.sqrt(maturity / 30) * 0.1;

        // Put skew: puts (moneyness < 1) have higher IV
        const skewEffect = moneyness < 1 ? (1 - moneyness) * 0.3 : 0;

        const iv = baseVol * (1 + smileEffect + termEffect + skewEffect);
        row.push(Number(iv.toFixed(4)));
      }

      ivMatrix.push(row);
    }

    return {
      ticker,
      strikes,
      maturities,
      ivMatrix,
      underlyingPrice: currentPrice,
      timestamp: new Date(),
    };
  }

  /**
   * Compare realized vs implied volatility over time
   */
  async getRealizedVsImplied(
    ticker: string,
    days: number = 90,
  ): Promise<RealizedVsImpliedResponseDto> {
    this.logger.log(`Calculating realized vs implied volatility for ${ticker}`);

    // Fetch historical data
    const historicalData = await this.fetchHistoricalData(ticker, days + 30);

    if (!historicalData || historicalData.length < 60) {
      throw new Error('Insufficient historical data');
    }

    const returns = this.calculateReturns(historicalData.map((d) => d.close));

    // Calculate rolling realized volatility (30-day window)
    const timeSeries: RealizedVsImpliedPoint[] = [];
    const windowSize = 30;

    for (let i = windowSize; i < historicalData.length; i++) {
      const windowReturns = returns.slice(i - windowSize, i);
      const realizedVol = this.calculateVolatility(windowReturns, windowSize);

      // Generate synthetic implied volatility (in production, fetch from options data)
      // IV typically has a premium over RV (volatility risk premium)
      const ivPremium = 0.02 + Math.random() * 0.03; // 2-5% premium
      const impliedVol = realizedVol + ivPremium;

      timeSeries.push({
        date: historicalData[i].date,
        realizedVol: Number(realizedVol.toFixed(4)),
        impliedVol: Number(impliedVol.toFixed(4)),
        spread: Number((impliedVol - realizedVol).toFixed(4)),
      });
    }

    // Current metrics (last 30 days)
    const recent30dReturns = returns.slice(-30);
    const realized30d = this.calculateVolatility(recent30dReturns, 30);
    const implied30d = realized30d + 0.025; // Mock IV premium

    // Calculate IV percentile
    const allIVs = timeSeries.map((p) => p.impliedVol);
    const percentile = this.calculatePercentile(allIVs, implied30d);

    return {
      ticker,
      timeSeries,
      current: {
        realized30d: Number(realized30d.toFixed(4)),
        implied30d: Number(implied30d.toFixed(4)),
        spread: Number((implied30d - realized30d).toFixed(4)),
        percentile: Number(percentile.toFixed(1)),
      },
      timestamp: new Date(),
    };
  }

  /**
   * Calculate volatility statistics for a ticker
   */
  async getVolatilityStats(
    ticker: string,
    period: string = '30d',
  ): Promise<VolatilityStatsDto> {
    const days = this.parsePeriod(period);
    const historicalData = await this.fetchHistoricalData(ticker, days * 2);

    const returns = this.calculateReturns(historicalData.map((d) => d.close));
    const recentReturns = returns.slice(-days);

    const realized = this.calculateVolatility(recentReturns, days);

    // Calculate HV rank (where does current vol rank in past year?)
    const allVols: number[] = [];
    for (let i = days; i < returns.length; i++) {
      const windowReturns = returns.slice(i - days, i);
      allVols.push(this.calculateVolatility(windowReturns, days));
    }

    const hvRank = this.calculatePercentile(allVols, realized);

    return {
      ticker,
      period,
      realized: Number(realized.toFixed(4)),
      hvRank: Number(hvRank.toFixed(1)),
    };
  }

  // ============== Helper Methods ==============

  /**
   * Fetch historical data with proper date range
   * Helper to convert days count to date range for MarketDataService API
   */
  private async fetchHistoricalData(
    ticker: string,
    days: number,
  ): Promise<{ date: Date; close: number }[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const historicalPrices = await this.marketDataService.getHistoricalPrices(
      ticker,
      startDate,
      endDate,
    );

    return historicalPrices.map((price) => ({
      date: new Date(price.date),
      close: price.close,
    }));
  }

  /**
   * Calculate single cone point for a specific horizon
   */
  private calculateConePoint(
    returns: number[],
    horizon: number,
  ): VolatilityConePoint {
    // Calculate rolling volatilities for this horizon
    const rollingVols: number[] = [];
    const lookbackPeriods = Math.min(Math.floor(returns.length / horizon), 50); // Up to 50 periods

    for (let i = 0; i < lookbackPeriods; i++) {
      const start = i * horizon;
      const end = start + horizon;
      if (end <= returns.length) {
        const periodReturns = returns.slice(start, end);
        const vol = this.calculateVolatility(periodReturns, horizon);
        rollingVols.push(vol);
      }
    }

    rollingVols.sort((a, b) => a - b);

    // Calculate percentiles
    const p10 = this.getPercentileValue(rollingVols, 10);
    const p25 = this.getPercentileValue(rollingVols, 25);
    const p50 = this.getPercentileValue(rollingVols, 50);
    const p75 = this.getPercentileValue(rollingVols, 75);
    const p90 = this.getPercentileValue(rollingVols, 90);

    // Current realized volatility
    const currentReturns = returns.slice(-horizon);
    const currentRV = this.calculateVolatility(currentReturns, horizon);

    return {
      daysToExpiry: horizon,
      p10: Number(p10.toFixed(4)),
      p25: Number(p25.toFixed(4)),
      p50: Number(p50.toFixed(4)),
      p75: Number(p75.toFixed(4)),
      p90: Number(p90.toFixed(4)),
      currentRV: Number(currentRV.toFixed(4)),
    };
  }

  /**
   * Calculate log returns from price array
   */
  private calculateReturns(prices: number[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push(Math.log(prices[i] / prices[i - 1]));
    }
    return returns;
  }

  /**
   * Calculate annualized volatility from returns
   */
  private calculateVolatility(returns: number[], _windowDays: number): number {
    if (returns.length === 0) return 0;

    // Calculate mean
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;

    // Calculate variance
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) /
      returns.length;

    // Standard deviation
    const stdDev = Math.sqrt(variance);

    // Annualize (assuming 252 trading days)
    const annualizedVol = stdDev * Math.sqrt(252);

    return annualizedVol;
  }

  /**
   * Get value at specific percentile in sorted array
   */
  private getPercentileValue(
    sortedArray: number[],
    percentile: number,
  ): number {
    if (sortedArray.length === 0) return 0;

    const index = Math.floor((percentile / 100) * sortedArray.length);
    return sortedArray[Math.min(index, sortedArray.length - 1)];
  }

  /**
   * Calculate where a value ranks in an array (percentile)
   */
  private calculatePercentile(values: number[], target: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const belowCount = sorted.filter((v) => v <= target).length;
    return (belowCount / sorted.length) * 100;
  }

  /**
   * Parse period string to days
   */
  private parsePeriod(period: string): number {
    const match = period.match(/^(\d+)([dmy])$/);
    if (!match) return 30;

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'd':
        return value;
      case 'm':
        return value * 30;
      case 'y':
        return value * 365;
      default:
        return 30;
    }
  }
}
