import { Injectable, Logger } from '@nestjs/common';
import { CyclicalValuationDto } from '../dto/valuation.dto';

@Injectable()
export class CyclicalValuationEngine {
  private readonly logger = new Logger(CyclicalValuationEngine.name);

  /**
   * Value cyclical businesses using mid-cycle normalization
   * Key principle: Don't value at peak earnings, normalize to mid-cycle
   */
  async calculate(
    ticker: string,
    currentPrice: number,
    fundamentals: any,
  ): Promise<CyclicalValuationDto> {
    this.logger.log(`Calculating cyclical valuation for ${ticker}`);

    // Extract metrics (placeholders - would come from fundamentals API)
    const currentEPS = fundamentals?.eps || 5.0;
    const revenueGrowth = this.estimateRevenueGrowth(fundamentals);
    const cycleStage = this.identifyCycleStage(revenueGrowth);
    const marginTrend = this.analyzeMarginTrend(fundamentals);

    // Normalize earnings to mid-cycle
    const normalizedEPS = this.normalizeToCycle(currentEPS, cycleStage);

    // Determine appropriate P/E multiple based on cycle stage
    const peMultiple = this.getMidCycleMultiple(ticker, cycleStage);

    // Calculate fair value range
    const fairValue = normalizedEPS * peMultiple;
    const fairValueLow = normalizedEPS * (peMultiple * 0.8);
    const fairValueHigh = normalizedEPS * (peMultiple * 1.2);

    const upside = ((fairValue - currentPrice) / currentPrice) * 100;

    return {
      ticker,
      currentPrice,
      fairValue,
      fairValueLow,
      fairValueHigh,
      upside,
      normalizedEarnings: normalizedEPS,
      peMultiple,
      cycleStage,
      revenueGrowth,
      marginTrend,
    };
  }

  /**
   * Identify current stage in the business cycle
   */
  private identifyCycleStage(
    revenueGrowth: number,
  ): 'early' | 'mid' | 'late' | 'peak' | 'trough' {
    if (revenueGrowth < -10) return 'trough';
    if (revenueGrowth < 0) return 'late';
    if (revenueGrowth < 10) return 'early';
    if (revenueGrowth < 25) return 'mid';
    return 'peak';
  }

  /**
   * Normalize earnings to mid-cycle levels
   */
  private normalizeToCycle(currentEPS: number, cycleStage: string): number {
    const adjustmentFactors: Record<string, number> = {
      trough: 1.5, // Earnings artificially low
      early: 1.2,
      mid: 1.0, // No adjustment needed
      late: 0.9,
      peak: 0.7, // Earnings artificially high
    };

    return currentEPS * (adjustmentFactors[cycleStage] || 1.0);
  }

  /**
   * Get appropriate P/E multiple for mid-cycle
   */
  private getMidCycleMultiple(ticker: string, cycleStage: string): number {
    // Industry-specific multiples (simplified)
    const baseMultiple = 12; // Conservative for cyclicals

    const cycleAdjustments: Record<string, number> = {
      trough: 1.2, // Higher forward multiple at trough
      early: 1.1,
      mid: 1.0,
      late: 0.9,
      peak: 0.8, // Lower multiple at peak
    };

    return baseMultiple * (cycleAdjustments[cycleStage] || 1.0);
  }

  /**
   * Estimate revenue growth trend
   */
  private estimateRevenueGrowth(fundamentals: any): number {
    // Placeholder - would calculate from historical data
    return Math.random() * 30 - 10; // Random between -10% and +20%
  }

  /**
   * Analyze margin trend
   */
  private analyzeMarginTrend(
    fundamentals: any,
  ): 'expanding' | 'stable' | 'contracting' {
    const marginChange = Math.random() - 0.5;
    if (marginChange > 0.2) return 'expanding';
    if (marginChange < -0.2) return 'contracting';
    return 'stable';
  }
}
