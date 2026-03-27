import { Injectable, Logger } from '@nestjs/common';
import { MarketDataService } from '../market-data/market-data.service';
import { CacheService } from '../cache/cache.service';

/**
 * Stress Testing Service
 * Implements historical and hypothetical stress scenarios
 */
@Injectable()
export class StressTestService {
  private readonly logger = new Logger(StressTestService.name);

  // Historical crisis scenarios with typical market moves
  private readonly historicalScenarios: StressScenario[] = [
    {
      name: 'Black Monday (1987)',
      description: 'Single-day crash of 22.6%',
      shocks: { equity: -0.226, volatility: 2.5, rates: -0.005 },
    },
    {
      name: 'Asian Financial Crisis (1997)',
      description: 'Emerging market contagion',
      shocks: { equity: -0.15, volatility: 1.8, rates: -0.01, fx: -0.2 },
    },
    {
      name: 'LTCM Crisis (1998)',
      description: 'Hedge fund collapse and liquidity crisis',
      shocks: { equity: -0.12, volatility: 2.0, rates: -0.015, spreads: 0.03 },
    },
    {
      name: 'Dot-Com Crash (2000-2002)',
      description: 'Tech bubble burst',
      shocks: { equity: -0.35, tech: -0.65, volatility: 1.5 },
    },
    {
      name: 'Global Financial Crisis (2008)',
      description: 'Lehman collapse and credit crisis',
      shocks: { equity: -0.5, volatility: 3.0, rates: -0.02, spreads: 0.05 },
    },
    {
      name: 'COVID-19 Crash (2020)',
      description: 'Pandemic market shock',
      shocks: { equity: -0.34, volatility: 4.0, rates: -0.015 },
    },
    {
      name: 'Rate Shock (2022)',
      description: 'Fed aggressive rate hikes',
      shocks: { equity: -0.25, bonds: -0.15, rates: 0.03, volatility: 1.2 },
    },
  ];

  constructor(
    private readonly marketDataService: MarketDataService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Run stress test on portfolio
   */
  async runStressTest(
    positions: PositionDto[],
    scenarioType: 'historical' | 'hypothetical' | 'custom',
    customScenario?: StressScenario,
  ): Promise<StressTestResult> {
    const scenarios =
      scenarioType === 'historical'
        ? this.historicalScenarios
        : scenarioType === 'custom' && customScenario
          ? [customScenario]
          : this.generateHypotheticalScenarios();

    // Calculate current portfolio value
    let portfolioValue = 0;
    const positionDetails: PositionStress[] = [];

    for (const pos of positions) {
      const quote = await this.marketDataService.getQuote(pos.ticker);
      const value = pos.quantity * quote.price;
      portfolioValue += value;

      positionDetails.push({
        ticker: pos.ticker,
        quantity: pos.quantity,
        currentPrice: quote.price,
        currentValue: value,
        weight: 0, // Will calculate after total
        stressedValues: [],
      });
    }

    // Calculate weights
    for (const pos of positionDetails) {
      pos.weight = pos.currentValue / portfolioValue;
    }

    // Apply each scenario
    const scenarioResults: ScenarioResult[] = [];

    for (const scenario of scenarios) {
      let stressedPortfolioValue = 0;

      for (const pos of positionDetails) {
        // Get beta for the position (approximation)
        const beta = await this.estimateBeta(pos.ticker);

        // Calculate stressed value
        const equityShock = scenario.shocks.equity || 0;
        const stockShock = equityShock * beta;
        const stressedPrice = pos.currentPrice * (1 + stockShock);
        const stressedValue = pos.quantity * stressedPrice;

        stressedPortfolioValue += stressedValue;

        pos.stressedValues.push({
          scenario: scenario.name,
          stressedPrice,
          stressedValue,
          pnl: stressedValue - pos.currentValue,
          pnlPercent:
            ((stressedValue - pos.currentValue) / pos.currentValue) * 100,
        });
      }

      const portfolioPnL = stressedPortfolioValue - portfolioValue;
      const portfolioPnLPercent = (portfolioPnL / portfolioValue) * 100;

      scenarioResults.push({
        scenario: scenario.name,
        description: scenario.description,
        shocks: scenario.shocks,
        portfolioValueBefore: portfolioValue,
        portfolioValueAfter: stressedPortfolioValue,
        pnl: portfolioPnL,
        pnlPercent: portfolioPnLPercent,
        severity: this.categorizeSeverity(portfolioPnLPercent),
      });
    }

    // Sort by severity (worst first)
    scenarioResults.sort((a, b) => a.pnl - b.pnl);

    return {
      portfolioValue,
      positionCount: positions.length,
      scenarios: scenarioResults,
      positions: positionDetails,
      worstCase: scenarioResults[0],
      averageLoss:
        scenarioResults.reduce((sum, s) => sum + s.pnl, 0) /
        scenarioResults.length,
      timestamp: new Date(),
    };
  }

  /**
   * Run reverse stress test - find scenarios that cause target loss
   */
  async runReverseStressTest(
    positions: PositionDto[],
    targetLossPercent: number,
  ): Promise<ReverseStressResult> {
    // Binary search for the equity shock that causes target loss
    let low = 0;
    let high = -0.8;
    let iterations = 0;
    const maxIterations = 20;

    while (iterations < maxIterations) {
      const mid = (low + high) / 2;
      const scenario: StressScenario = {
        name: 'Search Scenario',
        description: 'Binary search iteration',
        shocks: { equity: mid },
      };

      const result = await this.runStressTest(positions, 'custom', scenario);
      const actualLoss = result.scenarios[0].pnlPercent;

      if (Math.abs(actualLoss - targetLossPercent) < 0.5) {
        return {
          targetLossPercent,
          requiredEquityShock: mid * 100,
          scenarioDescription: `Market decline of ${Math.abs(mid * 100).toFixed(1)}%`,
          historicalParallel: this.findHistoricalParallel(mid),
          probability: this.estimateProbability(mid),
        };
      }

      if (actualLoss > targetLossPercent) {
        high = mid;
      } else {
        low = mid;
      }

      iterations++;
    }

    return {
      targetLossPercent,
      requiredEquityShock: high * 100,
      scenarioDescription: `Market decline of ${Math.abs(high * 100).toFixed(1)}%`,
      historicalParallel: this.findHistoricalParallel(high),
      probability: this.estimateProbability(high),
    };
  }

  /**
   * Generate hypothetical scenarios
   */
  private generateHypotheticalScenarios(): StressScenario[] {
    return [
      {
        name: 'Mild Correction',
        description: '10% market pullback',
        shocks: { equity: -0.1, volatility: 1.3 },
      },
      {
        name: 'Moderate Bear Market',
        description: '20% decline',
        shocks: { equity: -0.2, volatility: 1.8 },
      },
      {
        name: 'Severe Bear Market',
        description: '35% decline',
        shocks: { equity: -0.35, volatility: 2.5 },
      },
      {
        name: 'Market Crash',
        description: '50% decline',
        shocks: { equity: -0.5, volatility: 3.5 },
      },
      {
        name: 'Rate Spike (+200bps)',
        description: 'Sudden rate increase',
        shocks: { equity: -0.15, bonds: -0.1, rates: 0.02 },
      },
      {
        name: 'Stagflation',
        description: 'High inflation + stagnant growth',
        shocks: { equity: -0.25, bonds: -0.08, rates: 0.015 },
      },
    ];
  }

  /**
   * Estimate beta for a stock
   */
  private async estimateBeta(ticker: string): Promise<number> {
    // Simplified beta estimation (would use historical correlation in production)
    const techTickers = ['AAPL', 'GOOGL', 'MSFT', 'META', 'NVDA', 'AMZN'];
    const defensiveTickers = ['JNJ', 'PG', 'KO', 'PEP', 'WMT'];

    if (techTickers.includes(ticker)) return 1.2 + Math.random() * 0.3;
    if (defensiveTickers.includes(ticker)) return 0.6 + Math.random() * 0.2;
    return 0.9 + Math.random() * 0.3; // Average stock
  }

  /**
   * Categorize severity of loss
   */
  private categorizeSeverity(
    pnlPercent: number,
  ): 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE' | 'CATASTROPHIC' {
    if (pnlPercent > -5) return 'LOW';
    if (pnlPercent > -15) return 'MODERATE';
    if (pnlPercent > -30) return 'HIGH';
    if (pnlPercent > -50) return 'SEVERE';
    return 'CATASTROPHIC';
  }

  /**
   * Find historical parallel for a given shock
   */
  private findHistoricalParallel(equityShock: number): string {
    const shock = Math.abs(equityShock);
    if (shock < 0.15) return 'Similar to typical corrections';
    if (shock < 0.25)
      return 'Similar to Asian Crisis (1997) or Rate Shock (2022)';
    if (shock < 0.4) return 'Similar to COVID Crash (2020) or Dot-Com Crash';
    return 'Similar to Global Financial Crisis (2008)';
  }

  /**
   * Estimate probability of scenario (simplified)
   */
  private estimateProbability(equityShock: number): string {
    const shock = Math.abs(equityShock);
    if (shock < 0.1) return '~20% per year (common)';
    if (shock < 0.2) return '~5% per year (once per decade)';
    if (shock < 0.35) return '~2% per year (rare)';
    return '<1% per year (tail event)';
  }
}

// Types
interface StressScenario {
  name: string;
  description: string;
  shocks: {
    equity?: number;
    volatility?: number;
    rates?: number;
    fx?: number;
    spreads?: number;
    tech?: number;
    bonds?: number;
  };
}

interface PositionDto {
  ticker: string;
  quantity: number;
}

interface PositionStress {
  ticker: string;
  quantity: number;
  currentPrice: number;
  currentValue: number;
  weight: number;
  stressedValues: {
    scenario: string;
    stressedPrice: number;
    stressedValue: number;
    pnl: number;
    pnlPercent: number;
  }[];
}

interface ScenarioResult {
  scenario: string;
  description: string;
  shocks: StressScenario['shocks'];
  portfolioValueBefore: number;
  portfolioValueAfter: number;
  pnl: number;
  pnlPercent: number;
  severity: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE' | 'CATASTROPHIC';
}

interface StressTestResult {
  portfolioValue: number;
  positionCount: number;
  scenarios: ScenarioResult[];
  positions: PositionStress[];
  worstCase: ScenarioResult;
  averageLoss: number;
  timestamp: Date;
}

interface ReverseStressResult {
  targetLossPercent: number;
  requiredEquityShock: number;
  scenarioDescription: string;
  historicalParallel: string;
  probability: string;
}

export type {
  StressScenario,
  StressTestResult,
  ReverseStressResult,
  PositionDto,
};
