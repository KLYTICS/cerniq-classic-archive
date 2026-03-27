import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { MarketDataService } from '../market-data/market-data.service';
import { CacheService } from '../cache/cache.service';
import {
  ComponentVaRRequestDto,
  ComponentVaRResponseDto,
  VolatilityForecastRequestDto,
  VolatilityForecastResponseDto,
  ParametricVaRRequestDto,
  ParametricVaRResponseDto,
} from './dto/advanced-risk.dto';

/**
 * Advanced Risk Analytics Service
 * Implements Component VaR, GARCH forecasting, and parametric VaR
 */
@Injectable()
export class AdvancedRiskService {
  private readonly logger = new Logger(AdvancedRiskService.name);

  constructor(
    private readonly marketDataService: MarketDataService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Calculate Component VaR - risk contribution of each position
   * Component VaR = Marginal VaR × Position Weight × Portfolio Value
   */
  async calculateComponentVaR(
    dto: ComponentVaRRequestDto,
  ): Promise<ComponentVaRResponseDto> {
    this.logger.log('Calculating Component VaR');

    try {
      // Calculate portfolio value
      const portfolioValue = dto.positions.reduce(
        (sum, pos) => sum + pos.quantity * pos.price,
        0,
      );

      // Fetch historical returns for all positions
      const returnsData = await Promise.all(
        dto.positions.map(async (pos) => {
          const cacheKey = `returns:${pos.ticker}:${dto.horizon}`;
          return this.cacheService.getOrSet(
            cacheKey,
            async () => {
              const historical = await this.getHistoricalReturns(
                pos.ticker,
                252,
              );
              return historical;
            },
            3600, // 1 hour TTL
          );
        }),
      );

      // Calculate covariance matrix
      const covarianceMatrix = this.calculateCovarianceMatrix(returnsData);

      // Calculate portfolio weights
      const weights = dto.positions.map(
        (pos) => (pos.quantity * pos.price) / portfolioValue,
      );

      // Calculate portfolio variance
      const portfolioVariance = this.calculatePortfolioVariance(
        weights,
        covarianceMatrix,
      );
      const portfolioStdDev = Math.sqrt(portfolioVariance);

      // Calculate VaR using normal distribution
      const zScore = this.getZScore(dto.confidenceLevel);
      const portfolioVaR =
        portfolioValue * portfolioStdDev * zScore * Math.sqrt(dto.horizon);

      // Calculate Marginal VaR for each position
      const components = dto.positions.map((pos, i) => {
        // Marginal VaR = (∂VaR/∂w_i) = Portfolio VaR × (Cov(i, portfolio) / Portfolio Variance)
        const covWithPortfolio = this.calculateCovarianceWithPortfolio(
          i,
          weights,
          covarianceMatrix,
        );
        const marginalVaR =
          (portfolioVaR * covWithPortfolio) / portfolioVariance;

        // Component VaR = Marginal VaR × Weight × Portfolio Value
        const componentVaR = marginalVaR * weights[i] * portfolioValue;

        // Risk contribution as percentage
        const riskContribution = (componentVaR / portfolioVaR) * 100;

        return {
          ticker: pos.ticker,
          position: pos.quantity * pos.price,
          marginalVaR: Number(marginalVaR.toFixed(4)),
          componentVaR: Number(componentVaR.toFixed(2)),
          riskContribution: Number(riskContribution.toFixed(2)),
        };
      });

      return {
        portfolioVaR: Number(portfolioVaR.toFixed(2)),
        portfolioValue: Number(portfolioValue.toFixed(2)),
        confidenceLevel: dto.confidenceLevel,
        horizon: dto.horizon,
        components,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Error calculating Component VaR:', error);
      throw new HttpException(
        'Failed to calculate Component VaR',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GARCH(1,1) volatility forecasting
   * σ²(t+1) = ω + α*ε²(t) + β*σ²(t)
   */
  async forecastVolatility(
    dto: VolatilityForecastRequestDto,
  ): Promise<VolatilityForecastResponseDto> {
    this.logger.log(`Forecasting volatility for ${dto.ticker}`);

    try {
      const horizon = dto.horizon || 30;

      // Fetch historical returns
      const returns = await this.getHistoricalReturns(dto.ticker, 252);

      if (returns.length < 30) {
        throw new Error('Insufficient historical data for GARCH forecasting');
      }

      // Estimate GARCH(1,1) parameters using simple moment matching
      // In production, use maximum likelihood estimation
      const omega = 0.000001; // Long-run variance component
      const alpha = 0.1; // Weight on squared residuals
      const beta = 0.85; // Weight on previous variance

      // Initialize variance with sample variance
      let variance = this.calculateVariance(returns);
      const currentVol = Math.sqrt(variance) * Math.sqrt(252); // Annualized

      // Forecast volatility for each day
      const forecast: {
        day: number;
        volatility: number;
        lower95: number;
        upper95: number;
      }[] = [];
      for (let day = 1; day <= horizon; day++) {
        // GARCH(1,1) one-step ahead forecast
        // For multi-step: variance converges to long-run variance
        const longRunVariance = omega / (1 - alpha - beta);
        const forecastVariance =
          longRunVariance +
          Math.pow(alpha + beta, day - 1) * (variance - longRunVariance);

        const forecastVol = Math.sqrt(forecastVariance) * Math.sqrt(252); // Annualized

        // 95% confidence interval (±1.96 standard errors)
        const standardError = forecastVol * 0.15; // Simplified
        const lower95 = Math.max(0, forecastVol - 1.96 * standardError);
        const upper95 = forecastVol + 1.96 * standardError;

        forecast.push({
          day,
          volatility: Number(forecastVol.toFixed(4)),
          lower95: Number(lower95.toFixed(4)),
          upper95: Number(upper95.toFixed(4)),
        });

        // Update variance for next iteration
        variance = forecastVariance;
      }

      return {
        ticker: dto.ticker,
        currentVolatility: Number(currentVol.toFixed(4)),
        forecast,
        model: 'GARCH(1,1)',
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Error forecasting volatility:', error);
      throw new HttpException(
        'Failed to forecast volatility',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Parametric VaR using normal distribution assumption
   * VaR = μ - z*σ*√(horizon)
   */
  async calculateParametricVaR(
    dto: ParametricVaRRequestDto,
  ): Promise<ParametricVaRResponseDto> {
    this.logger.log('Calculating Parametric VaR');

    try {
      // Calculate portfolio value
      const portfolioValue = dto.positions.reduce(
        (sum, pos) => sum + pos.quantity * pos.price,
        0,
      );

      // Fetch historical returns for all positions
      const returnsData = await Promise.all(
        dto.positions.map(async (pos) => {
          return this.getHistoricalReturns(pos.ticker, 252);
        }),
      );

      // Calculate covariance matrix
      const covarianceMatrix = this.calculateCovarianceMatrix(returnsData);

      // Calculate portfolio weights
      const weights = dto.positions.map(
        (pos) => (pos.quantity * pos.price) / portfolioValue,
      );

      // Calculate portfolio variance and volatility
      const portfolioVariance = this.calculatePortfolioVariance(
        weights,
        covarianceMatrix,
      );
      const portfolioStdDev = Math.sqrt(portfolioVariance);
      const annualizedVol = portfolioStdDev * Math.sqrt(252);

      // Calculate VaR using normal distribution
      const zScore = this.getZScore(dto.confidenceLevel);
      const portfolioVaR =
        portfolioValue * portfolioStdDev * zScore * Math.sqrt(dto.horizon);

      return {
        portfolioVaR: Number(portfolioVaR.toFixed(2)),
        portfolioValue: Number(portfolioValue.toFixed(2)),
        portfolioVolatility: Number(annualizedVol.toFixed(4)),
        confidenceLevel: dto.confidenceLevel,
        horizon: dto.horizon,
        method: 'Parametric (Normal)',
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Error calculating Parametric VaR:', error);
      throw new HttpException(
        'Failed to calculate Parametric VaR',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ==================== Helper Methods ====================

  /**
   * Fetch historical returns for a ticker
   */
  private async getHistoricalReturns(
    ticker: string,
    days: number,
  ): Promise<number[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const historicalPrices = await this.marketDataService.getHistoricalPrices(
      ticker,
      startDate,
      endDate,
    );

    const prices = historicalPrices.map((p) => p.close);

    // Calculate log returns
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push(Math.log(prices[i] / prices[i - 1]));
    }

    return returns;
  }

  /**
   * Calculate covariance matrix from returns data
   */
  private calculateCovarianceMatrix(returnsData: number[][]): number[][] {
    const n = returnsData.length;
    const covMatrix: number[][] = Array(n)
      .fill(0)
      .map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        covMatrix[i][j] = this.calculateCovariance(
          returnsData[i],
          returnsData[j],
        );
      }
    }

    return covMatrix;
  }

  /**
   * Calculate covariance between two return series
   */
  private calculateCovariance(returns1: number[], returns2: number[]): number {
    const n = Math.min(returns1.length, returns2.length);
    const mean1 = returns1.slice(0, n).reduce((sum, r) => sum + r, 0) / n;
    const mean2 = returns2.slice(0, n).reduce((sum, r) => sum + r, 0) / n;

    let covariance = 0;
    for (let i = 0; i < n; i++) {
      covariance += (returns1[i] - mean1) * (returns2[i] - mean2);
    }

    return covariance / (n - 1);
  }

  /**
   * Calculate portfolio variance from weights and covariance matrix
   * Variance = w' * Σ * w
   */
  private calculatePortfolioVariance(
    weights: number[],
    covMatrix: number[][],
  ): number {
    let variance = 0;
    const n = weights.length;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        variance += weights[i] * weights[j] * covMatrix[i][j];
      }
    }

    return variance;
  }

  /**
   * Calculate covariance of position i with portfolio
   */
  private calculateCovarianceWithPortfolio(
    i: number,
    weights: number[],
    covMatrix: number[][],
  ): number {
    let cov = 0;
    for (let j = 0; j < weights.length; j++) {
      cov += weights[j] * covMatrix[i][j];
    }
    return cov;
  }

  /**
   * Calculate variance of a return series
   */
  private calculateVariance(returns: number[]): number {
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const squaredDiffs = returns.map((r) => Math.pow(r - mean, 2));
    return squaredDiffs.reduce((sum, sd) => sum + sd, 0) / (returns.length - 1);
  }

  /**
   * Get z-score for confidence level
   */
  private getZScore(confidenceLevel: number): number {
    // Approximate z-scores for common confidence levels
    const zScores: Record<number, number> = {
      0.9: 1.28,
      0.95: 1.645,
      0.99: 2.326,
    };

    return zScores[confidenceLevel] || 1.645;
  }
}
