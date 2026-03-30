import { Injectable, Logger } from '@nestjs/common';
import { MarketDataService } from '../market-data/market-data.service';

/**
 * Execution Analytics Service
 * Provides institutional-grade execution quality analysis
 */
@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name);

  constructor(private readonly marketDataService: MarketDataService) {}

  /**
   * Calculate slippage for an execution
   * Slippage = (Execution Price - Mid Price) / Mid Price * 10000 (bps)
   */
  async calculateSlippage(execution: ExecutionDto): Promise<SlippageAnalysis> {
    const { ticker, executionPrice, executionTime, side, quantity } = execution;

    // Get market conditions at execution time
    // For now, use current quote as approximation
    const quote = await this.marketDataService.getQuote(ticker);

    const bid = (quote as any).bid || quote.price * 0.999;
    const ask = (quote as any).ask || quote.price * 1.001;
    const midPrice = (bid + ask) / 2;
    const spread = ask - bid;
    const spreadBps = (spread / midPrice) * 10000;

    // Calculate slippage in basis points
    const slippageBps = ((executionPrice - midPrice) / midPrice) * 10000;

    // For buys, positive slippage is bad; for sells, negative is bad
    const effectiveSlippage = side === 'BUY' ? slippageBps : -slippageBps;

    // Calculate cost in dollars
    const slippageCost = (executionPrice - midPrice) * quantity;

    // Determine execution quality
    let quality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
    if (effectiveSlippage < 0) {
      quality = 'EXCELLENT'; // Better than mid
    } else if (effectiveSlippage < spreadBps / 2) {
      quality = 'GOOD'; // Within half spread
    } else if (effectiveSlippage < spreadBps) {
      quality = 'FAIR'; // Within full spread
    } else {
      quality = 'POOR'; // Beyond spread
    }

    return {
      ticker,
      executionPrice,
      midPrice,
      bid,
      ask,
      spread,
      spreadBps: Number(spreadBps.toFixed(2)),
      slippageBps: Number(effectiveSlippage.toFixed(2)),
      slippageCost: Number(slippageCost.toFixed(2)),
      quality,
      side,
      quantity,
      notional: executionPrice * quantity,
      executionTime,
      analysisTime: new Date(),
    };
  }

  /**
   * Compare execution against VWAP
   * Measures execution quality vs volume-weighted average
   */
  async analyzeVWAP(
    execution: ExecutionDto,
    periodMinutes: number = 60,
  ): Promise<VWAPAnalysis> {
    const { ticker, executionPrice, side, quantity } = execution;

    // Calculate estimated VWAP (using historical close as approximation)
    const quote = await this.marketDataService.getQuote(ticker);

    // Simulate VWAP calculation (production would use tick data)
    // VWAP typically falls between open/close with volume weighting
    const vwapEstimate = quote.price * (0.995 + Math.random() * 0.01);

    const vwapDifference = executionPrice - vwapEstimate;
    const vwapDifferenceBps = (vwapDifference / vwapEstimate) * 10000;

    // For buys, beating VWAP means lower price
    const beatsVwap =
      side === 'BUY'
        ? executionPrice < vwapEstimate
        : executionPrice > vwapEstimate;

    const savingsVsVwap = beatsVwap
      ? Math.abs(vwapDifference) * quantity
      : -Math.abs(vwapDifference) * quantity;

    return {
      ticker,
      executionPrice,
      vwap: Number(vwapEstimate.toFixed(4)),
      vwapDifferenceBps: Number(vwapDifferenceBps.toFixed(2)),
      beatsVwap,
      savingsVsVwap: Number(savingsVsVwap.toFixed(2)),
      periodMinutes,
      side,
      quantity,
      notional: executionPrice * quantity,
    };
  }

  /**
   * Generate Best Execution Report (MiFID II / SEC compliance)
   */
  async generateBestExecutionReport(
    executions: ExecutionDto[],
    reportPeriod: { start: Date; end: Date },
  ): Promise<BestExecutionReport> {
    const analyses: SlippageAnalysis[] = [];
    let totalSlippageCost = 0;
    let totalNotional = 0;
    let excellentCount = 0;
    let goodCount = 0;
    let fairCount = 0;
    let poorCount = 0;

    for (const exec of executions) {
      const analysis = await this.calculateSlippage(exec);
      analyses.push(analysis);
      totalSlippageCost += analysis.slippageCost;
      totalNotional += analysis.notional;

      switch (analysis.quality) {
        case 'EXCELLENT':
          excellentCount++;
          break;
        case 'GOOD':
          goodCount++;
          break;
        case 'FAIR':
          fairCount++;
          break;
        case 'POOR':
          poorCount++;
          break;
      }
    }

    const avgSlippageBps =
      analyses.length > 0
        ? analyses.reduce((sum, a) => sum + a.slippageBps, 0) / analyses.length
        : 0;

    return {
      reportId: `BER-${Date.now()}`,
      periodStart: reportPeriod.start,
      periodEnd: reportPeriod.end,
      totalExecutions: executions.length,
      totalNotional,
      summary: {
        averageSlippageBps: Number(avgSlippageBps.toFixed(2)),
        totalSlippageCost: Number(totalSlippageCost.toFixed(2)),
        qualityBreakdown: {
          excellent: excellentCount,
          good: goodCount,
          fair: fairCount,
          poor: poorCount,
        },
        qualityScore: Number(
          (
            ((excellentCount * 4 +
              goodCount * 3 +
              fairCount * 2 +
              poorCount * 1) /
              (executions.length * 4)) *
            100
          ).toFixed(1),
        ),
      },
      executions: analyses,
      generatedAt: new Date(),
      complianceFlags: this.checkComplianceFlags(analyses),
    };
  }

  /**
   * Check for compliance issues
   */
  private checkComplianceFlags(analyses: SlippageAnalysis[]): string[] {
    const flags: string[] = [];

    const poorExecutions = analyses.filter((a) => a.quality === 'POOR');
    if (poorExecutions.length > analyses.length * 0.1) {
      flags.push('HIGH_POOR_EXECUTION_RATE: >10% of executions rated POOR');
    }

    const highSlippage = analyses.filter((a) => Math.abs(a.slippageBps) > 50);
    if (highSlippage.length > 0) {
      flags.push(
        `HIGH_SLIPPAGE_DETECTED: ${highSlippage.length} executions >50bps slippage`,
      );
    }

    const largeOrders = analyses.filter((a) => a.notional > 1000000);
    for (const order of largeOrders) {
      if (order.quality === 'POOR') {
        flags.push(
          `LARGE_ORDER_POOR_FILL: ${order.ticker} $${order.notional.toFixed(0)} rated POOR`,
        );
      }
    }

    return flags;
  }

  /**
   * Calculate implementation shortfall
   * Measures total cost of trading vs decision price
   */
  async calculateImplementationShortfall(
    trade: TradeAnalysisDto,
  ): Promise<ImplementationShortfall> {
    const { ticker, decisionPrice, executions } = trade;

    let totalQuantity = 0;
    let totalCost = 0;

    for (const exec of executions) {
      totalQuantity += exec.quantity;
      totalCost += exec.price * exec.quantity;
    }

    const avgExecutionPrice = totalCost / totalQuantity;
    const quote = await this.marketDataService.getQuote(ticker);
    const benchmarkPrice = quote.price;

    // Shortfall components
    const delayComponent =
      ((benchmarkPrice - decisionPrice) / decisionPrice) * 10000;
    const tradingComponent =
      ((avgExecutionPrice - benchmarkPrice) / benchmarkPrice) * 10000;
    const totalShortfall = delayComponent + tradingComponent;

    const shortfallDollars =
      (avgExecutionPrice - decisionPrice) * totalQuantity;

    return {
      ticker,
      decisionPrice,
      benchmarkPrice,
      avgExecutionPrice: Number(avgExecutionPrice.toFixed(4)),
      totalQuantity,
      totalCost: Number(totalCost.toFixed(2)),
      shortfall: {
        delayComponentBps: Number(delayComponent.toFixed(2)),
        tradingComponentBps: Number(tradingComponent.toFixed(2)),
        totalBps: Number(totalShortfall.toFixed(2)),
        totalDollars: Number(shortfallDollars.toFixed(2)),
      },
      executionCount: executions.length,
    };
  }
}

// DTOs
export interface ExecutionDto {
  ticker: string;
  executionPrice: number;
  executionTime: Date;
  side: 'BUY' | 'SELL';
  quantity: number;
  orderId?: string;
  venue?: string;
}

export interface SlippageAnalysis {
  ticker: string;
  executionPrice: number;
  midPrice: number;
  bid: number;
  ask: number;
  spread: number;
  spreadBps: number;
  slippageBps: number;
  slippageCost: number;
  quality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  side: 'BUY' | 'SELL';
  quantity: number;
  notional: number;
  executionTime: Date;
  analysisTime: Date;
}

export interface VWAPAnalysis {
  ticker: string;
  executionPrice: number;
  vwap: number;
  vwapDifferenceBps: number;
  beatsVwap: boolean;
  savingsVsVwap: number;
  periodMinutes: number;
  side: 'BUY' | 'SELL';
  quantity: number;
  notional: number;
}

export interface BestExecutionReport {
  reportId: string;
  periodStart: Date;
  periodEnd: Date;
  totalExecutions: number;
  totalNotional: number;
  summary: {
    averageSlippageBps: number;
    totalSlippageCost: number;
    qualityBreakdown: {
      excellent: number;
      good: number;
      fair: number;
      poor: number;
    };
    qualityScore: number;
  };
  executions: SlippageAnalysis[];
  generatedAt: Date;
  complianceFlags: string[];
}

export interface TradeAnalysisDto {
  ticker: string;
  decisionPrice: number;
  executions: { price: number; quantity: number; time: Date }[];
}

export interface ImplementationShortfall {
  ticker: string;
  decisionPrice: number;
  benchmarkPrice: number;
  avgExecutionPrice: number;
  totalQuantity: number;
  totalCost: number;
  shortfall: {
    delayComponentBps: number;
    tradingComponentBps: number;
    totalBps: number;
    totalDollars: number;
  };
  executionCount: number;
}
