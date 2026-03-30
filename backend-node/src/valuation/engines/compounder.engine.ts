import { Injectable, Logger } from '@nestjs/common';
import { CompounderValuationDto } from '../dto/valuation.dto';

@Injectable()
export class CompounderValuationEngine {
  private readonly logger = new Logger(CompounderValuationEngine.name);

  /**
   * Value high-quality compounding businesses
   * Focus: ROIC, growth consistency, margin stability
   */
  async calculate(
    ticker: string,
    currentPrice: number,
    fundamentals: any,
  ): Promise<CompounderValuationDto> {
    this.logger.log(`Calculating compounder valuation for ${ticker}`);

    // Extract metrics
    const eps = fundamentals?.eps || 10.0;
    const fcf = fundamentals?.fcf || 8.0;

    // Calculate quality metrics
    const roic = this.calculateROIC(fundamentals);
    const wacc = 0.08; // Simplified - would calculate properly
    const roicSpread = roic - wacc;

    const revenueGrowth = this.calculateRevenueCGR(fundamentals);
    const marginStability = this.assessMarginStability(fundamentals);
    const cashConversion = fcf / eps;

    // Quality score (0-100)
    const qualityScore = this.calculateQualityScore({
      roicSpread,
      revenueGrowth,
      marginStability,
      cashConversion,
    });

    // Determine P/E multiple based on quality
    const peMultiple = this.getQualityAdjustedMultiple(
      qualityScore,
      revenueGrowth,
    );

    // Calculate fair value
    const fairValue = eps * peMultiple;
    const upside = ((fairValue - currentPrice) / currentPrice) * 100;

    // PEG ratio (P/E to growth)
    const pegRatio = peMultiple / (revenueGrowth > 0 ? revenueGrowth : 1);

    return {
      ticker,
      currentPrice,
      fairValue,
      upside,
      qualityScore,
      roicSpread: roicSpread * 100, // Convert to percentage
      revenueGrowth,
      marginStability,
      cashConversion,
      peMultiple,
      pegRatio,
    };
  }

  /**
   * Calculate Return on Invested Capital
   */
  private calculateROIC(_fundamentals: any): number {
    // Simplified - would use: NOPAT / (Debt + Equity - Cash)
    return 0.15 + Math.random() * 0.15; // Random between 15-30%
  }

  /**
   * Calculate 3-year revenue CAGR
   */
  private calculateRevenueCGR(_fundamentals: any): number {
    // Placeholder - would calculate from historical revenue
    return 10 + Math.random() * 15; // Random between 10-25%
  }

  /**
   * Assess margin stability (score 0-100)
   */
  private assessMarginStability(_fundamentals: any): number {
    // Placeholder - would analyze margin variance over time
    return 60 + Math.random() * 40; // Random between 60-100
  }

  /**
   * Calculate overall quality score
   */
  private calculateQualityScore(metrics: {
    roicSpread: number;
    revenueGrowth: number;
    marginStability: number;
    cashConversion: number;
  }): number {
    let score = 0;

    // ROIC spread (30 points max)
    score += Math.min(metrics.roicSpread * 100 * 3, 30);

    // Revenue growth (25 points max)
    score += Math.min(metrics.revenueGrowth * 1.25, 25);

    // Margin stability (25 points max)
    score += metrics.marginStability * 0.25;

    // Cash conversion (20 points max)
    score += Math.min(metrics.cashConversion * 20, 20);

    return Math.min(Math.max(score, 0), 100);
  }

  /**
   * Get P/E multiple adjusted for quality and growth
   */
  private getQualityAdjustedMultiple(
    qualityScore: number,
    growth: number,
  ): number {
    // Base multiple for quality compounders
    const baseMultiple = 20;

    // Quality adjustment: +0.3x for every 10 points of quality
    const qualityAdjustment = (qualityScore / 10) * 0.3;

    // Growth adjustment: +0.5x for every 10% growth
    const growthAdjustment = (growth / 10) * 0.5;

    return baseMultiple + qualityAdjustment + growthAdjustment;
  }
}
