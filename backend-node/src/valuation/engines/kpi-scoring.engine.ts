import { Injectable, Logger } from '@nestjs/common';
import { KPIScoreDto } from '../dto/valuation.dto';

@Injectable()
export class KPIScoringEngine {
  private readonly logger = new Logger(KPIScoringEngine.name);

  /**
   * Calculate comprehensive KPI score (0-100)
   * Combines fundamental, momentum, valuation, and quality metrics
   */
  async calculate(
    ticker: string,
    fundamentals: any,
    marketData: any,
  ): Promise<KPIScoreDto> {
    this.logger.log(`Calculating KPI score for ${ticker}`);

    // Individual component scores
    const fundamentalScore = this.scoreFundamentals(fundamentals);
    const momentumScore = this.scoreMomentum(marketData);
    const valuationScore = this.scoreValuation(fundamentals);
    const qualityScore = this.scoreQuality(fundamentals);

    // Weighted overall score
    const overallScore =
      fundamentalScore * 0.3 +
      momentumScore * 0.2 +
      valuationScore * 0.25 +
      qualityScore * 0.25;

    // Detailed metric breakdown
    const breakdown = {
      revenueGrowth: this.scoreRevenueGrowth(fundamentals),
      marginTrend: this.scoreMarginTrend(fundamentals),
      roic: this.scoreROIC(fundamentals),
      debtToEquity: this.scoreDebtLevel(fundamentals),
      fcfYield: this.scoreFCFYield(fundamentals),
      peRatio: this.scorePE(fundamentals),
      priceToSales: this.scorePriceToSales(fundamentals),
    };

    return {
      ticker,
      overallScore: Math.round(overallScore),
      fundamentalScore: Math.round(fundamentalScore),
      momentumScore: Math.round(momentumScore),
      valuationScore: Math.round(valuationScore),
      qualityScore: Math.round(qualityScore),
      breakdown,
    };
  }

  private scoreFundamentals(fundamentals: any): number {
    const revenueGrowth = this.scoreRevenueGrowth(fundamentals);
    const marginTrend = this.scoreMarginTrend(fundamentals);
    const roic = this.scoreROIC(fundamentals);
    return (revenueGrowth + marginTrend + roic) / 3;
  }

  private scoreMomentum(_marketData: any): number {
    // Placeholder - would analyze price momentum, volume, relative strength
    return 50 + Math.random() * 50;
  }

  private scoreValuation(fundamentals: any): number {
    const peScore = this.scorePE(fundamentals);
    const psScore = this.scorePriceToSales(fundamentals);
    const fcfYieldScore = this.scoreFCFYield(fundamentals);
    return (peScore + psScore + fcfYieldScore) / 3;
  }

  private scoreQuality(fundamentals: any): number {
    const roicScore = this.scoreROIC(fundamentals);
    const debtScore = this.scoreDebtLevel(fundamentals);
    const marginScore = this.scoreMarginTrend(fundamentals);
    return (roicScore + debtScore + marginScore) / 3;
  }

  // Individual metric scorers (0-100)
  private scoreRevenueGrowth(_fundamentals: any): number {
    const growth = 15; // Placeholder %
    return Math.min((growth / 30) * 100, 100);
  }

  private scoreMarginTrend(_fundamentals: any): number {
    return 60 + Math.random() * 40;
  }

  private scoreROIC(_fundamentals: any): number {
    const roic = 0.2; // 20% placeholder
    return Math.min((roic / 0.3) * 100, 100);
  }

  private scoreDebtLevel(_fundamentals: any): number {
    const debtToEquity = 0.5; // Placeholder
    return Math.max(0, 100 - debtToEquity * 100);
  }

  private scoreFCFYield(_fundamentals: any): number {
    const fcfYield = 0.05; // 5% placeholder
    return Math.min((fcfYield / 0.1) * 100, 100);
  }

  private scorePE(fundamentals: any): number {
    const pe = fundamentals?.peRatio || 20;
    const idealPE = 15;
    return Math.max(0, 100 - Math.abs(pe - idealPE) * 5);
  }

  private scorePriceToSales(_fundamentals: any): number {
    const ps = 3; // Placeholder
    return Math.max(0, 100 - ps * 10);
  }
}
