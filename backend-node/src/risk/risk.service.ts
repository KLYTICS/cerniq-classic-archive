import { Injectable, Logger } from '@nestjs/common';
import {
  MonteCarloRequestDto,
  MonteCarloResultDto,
  VaRRequestDto,
  VaRResultDto,
  CorrelationMatrixRequestDto,
  CorrelationMatrixDto,
  PortfolioRiskDto,
  StressTestScenarioDto,
  StressTestResultDto,
} from './dto/risk.dto';
import { PortfolioService } from '../portfolio/portfolio.service';
import { MarketDataService } from '../market-data/market-data.service';

// ─── Seeded PRNG (SR 11-7 reproducibility) ───────────────────
// A Monte Carlo over the global unseeded Math.random() is non-reproducible — a
// model-validation red flag. Seed an xorshift32 stream from the request so the
// same simulation parameters always yield the same VaR / percentiles.
function createSeededRng(seed: number): () => number {
  let state = seed | 0 || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
}

/** FNV-1a hash of the request's numeric params → a stable uint32 seed. */
function seedFromParams(...nums: number[]): number {
  let h = 0x811c9dc5;
  for (const n of nums) {
    const s = String(n);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  }
  return h >>> 0;
}

@Injectable()
export class RiskService {
  private readonly logger = new Logger(RiskService.name);

  constructor(
    private readonly portfolioService: PortfolioService,
    private readonly marketDataService: MarketDataService,
  ) {}

  /**
   * Run Monte Carlo simulation
   * This is a pure TypeScript implementation
   * PERF: Rust FFI planned for high-volume simulations — see CERNIQ-PERF-002
   */
  async runMonteCarloSimulation(
    request: MonteCarloRequestDto,
  ): Promise<MonteCarloResultDto> {
    this.logger.log(
      `Running Monte Carlo simulation with ${request.numSimulations} simulations`,
    );

    const finalValues: number[] = [];

    // Seeded for reproducibility (SR 11-7): identical request → identical run.
    const rng = createSeededRng(
      seedFromParams(
        request.initialValue,
        request.meanDailyReturn,
        request.dailyVolatility,
        request.numSimulations,
        request.timeHorizon,
        request.confidenceLevel,
      ),
    );

    for (let i = 0; i < request.numSimulations; i++) {
      let value = request.initialValue;

      for (let day = 0; day < request.timeHorizon; day++) {
        // Box-Muller transform for normal distribution
        const u1 = Math.max(rng(), 1e-12); // guard against log(0)
        const u2 = rng();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

        const dailyReturn =
          request.meanDailyReturn + request.dailyVolatility * z;
        value *= 1 + dailyReturn;
      }

      finalValues.push(value);
    }

    // Sort for percentile calculations
    finalValues.sort((a, b) => a - b);

    const varIndex = Math.floor(
      (1 - request.confidenceLevel) * request.numSimulations,
    );
    const var95 = request.initialValue - finalValues[varIndex];

    // CVaR: average of all values below VaR threshold
    const valuesAtRisk = finalValues.slice(0, varIndex);
    const cvar =
      valuesAtRisk.length > 0
        ? request.initialValue -
          valuesAtRisk.reduce((sum, v) => sum + v, 0) / valuesAtRisk.length
        : var95;

    const mean =
      finalValues.reduce((sum, v) => sum + v, 0) / finalValues.length;
    const medianIndex = Math.floor(finalValues.length / 2);

    return {
      finalValues: finalValues.slice(0, 100), // Return only first 100 for response size
      var: var95,
      cvar,
      worstCase: request.initialValue - finalValues[0],
      bestCase: finalValues[finalValues.length - 1] - request.initialValue,
      median: finalValues[medianIndex],
      mean,
      percentile95: finalValues[Math.floor(0.95 * finalValues.length)],
      percentile5: finalValues[Math.floor(0.05 * finalValues.length)],
    };
  }

  /**
   * Calculate Value at Risk (VaR) using historical method
   */
  async calculateVaR(request: VaRRequestDto): Promise<VaRResultDto> {
    this.logger.log(
      `Calculating VaR at confidence level ${request.confidenceLevel}`,
    );

    if (request.returns.length === 0) {
      throw new Error('Returns array cannot be empty');
    }

    // Sort returns in ascending order
    const sortedReturns = [...request.returns].sort((a, b) => a - b);

    const varIndex = Math.max(
      1,
      Math.floor((1 - request.confidenceLevel) * sortedReturns.length),
    );
    const varReturn = sortedReturns[varIndex - 1];
    const var95 = -varReturn * request.portfolioValue;

    // CVaR (Expected Shortfall): average of returns at or below VaR threshold
    const returnsAtRisk = sortedReturns.slice(0, varIndex);
    const cvarReturn =
      returnsAtRisk.reduce((sum: number, r: number) => sum + r, 0) /
      returnsAtRisk.length;
    const cvar = -cvarReturn * request.portfolioValue;

    return {
      var: var95,
      cvar,
      confidenceLevel: request.confidenceLevel,
      timeHorizon: '1 day',
    };
  }

  /**
   * Calculate correlation matrix for a set of tickers
   */
  async calculateCorrelationMatrix(
    request: CorrelationMatrixRequestDto,
  ): Promise<CorrelationMatrixDto> {
    this.logger.log(
      `Calculating correlation matrix for ${request.tickers.length} tickers`,
    );

    const { tickers, startDate, endDate } = request;
    const priceData: Record<string, number[]> = {};

    // Fetch historical prices for all tickers
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    for (const ticker of tickers) {
      try {
        const history = await this.marketDataService.getHistoricalPrices(
          ticker,
          start,
          end,
        );
        priceData[ticker] = history.map((h) => h.close);
      } catch (_error) {
        this.logger.warn(`Failed to fetch data for ${ticker}`);
        priceData[ticker] = [];
      }
    }

    // Calculate returns
    const returns: Record<string, number[]> = {};
    for (const ticker of tickers) {
      const prices = priceData[ticker];
      returns[ticker] = [];
      for (let i = 1; i < prices.length; i++) {
        returns[ticker].push((prices[i] - prices[i - 1]) / prices[i - 1]);
      }
    }

    // Build correlation matrix
    const n = tickers.length;
    const matrix: number[][] = Array(n)
      .fill(0)
      .map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1.0;
        } else {
          matrix[i][j] = this.calculateCorrelation(
            returns[tickers[i]],
            returns[tickers[j]],
          );
        }
      }
    }

    return {
      tickers,
      matrix,
      computedAt: new Date(),
    };
  }

  /**
   * Get comprehensive risk metrics for a portfolio
   */
  async getPortfolioRisk(
    portfolioId: string,
    userId: string,
  ): Promise<PortfolioRiskDto> {
    this.logger.log(`Calculating risk metrics for portfolio ${portfolioId}`);

    const portfolio = await this.portfolioService.getPortfolio(
      portfolioId,
      userId,
    );

    if (!portfolio.positions || portfolio.positions.length === 0) {
      throw new Error('Portfolio has no positions');
    }

    // HONEST MINIMUM: the return-history-dependent risk metrics require a real
    // daily-return series (and benchmark/market data for beta), which is NOT
    // yet wired. We refuse to fabricate them. The previous implementation
    // computed VaR/CVaR/volatility/Sharpe from a HARDCODED mock return series
    // and pinned beta=1.0 / maxDrawdown=0 — fabricated risk numbers served from
    // a live endpoint. Those fields are now null + disclosed.
    return {
      portfolioId,
      totalValue: portfolio.totalValue,
      var95: null,
      cvar95: null,
      volatility: null,
      sharpeRatio: null,
      beta: null,
      maxDrawdown: null,
      // Crude structural proxy from the real position count — NOT a
      // correlation-based diversification ratio (disclosed below).
      diversificationRatio: Math.sqrt(portfolio.positions.length),
      status: 'data_unavailable',
      disclosures: [
        'VaR, CVaR, volatility and Sharpe ratio require a portfolio daily-return history, which is not yet wired — returned as null rather than computed from placeholder returns.',
        'Beta requires market (benchmark) data and maxDrawdown requires historical portfolio values; neither is wired — returned as null.',
        'diversificationRatio is a simplified sqrt(positionCount) proxy, not a correlation-based measure.',
      ],
    };
  }

  /**
   * Run stress test scenarios on a portfolio
   */
  async runStressTest(
    portfolioId: string,
    userId: string,
    scenarios: StressTestScenarioDto[],
  ): Promise<StressTestResultDto[]> {
    this.logger.log(
      `Running ${scenarios.length} stress test scenarios on portfolio ${portfolioId}`,
    );

    const portfolio = await this.portfolioService.getPortfolio(
      portfolioId,
      userId,
    );
    const results: StressTestResultDto[] = [];

    for (const scenario of scenarios) {
      let totalLoss = 0;
      let worstPositionLoss = 0;
      let worstPositionTicker = '';

      for (const position of portfolio.positions || []) {
        // Apply market shock
        const shock = scenario.marketShock;

        // Apply sector-specific shock if available
        // Would need to fetch ticker sector from database
        // For now, just use market shock

        const positionLoss = position.marketValue * Math.abs(shock);
        totalLoss += positionLoss;

        if (positionLoss > worstPositionLoss) {
          worstPositionLoss = positionLoss;
          worstPositionTicker = position.ticker;
        }
      }

      results.push({
        scenario: scenario.name,
        portfolioValue: portfolio.totalValue - totalLoss,
        portfolioLoss: totalLoss,
        portfolioLossPercent: (totalLoss / portfolio.totalValue) * 100,
        worstPosition: {
          ticker: worstPositionTicker,
          loss: worstPositionLoss,
        },
        recoveryTime: undefined, // Placeholder
      });
    }

    return results;
  }

  /**
   * Helper: Calculate Pearson correlation coefficient
   */
  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length === 0 || y.length === 0 || x.length !== y.length) {
      return 0;
    }

    const n = x.length;
    const meanX = x.reduce((sum, val) => sum + val, 0) / n;
    const meanY = y.reduce((sum, val) => sum + val, 0) / n;

    let numerator = 0;
    let sumSqX = 0;
    let sumSqY = 0;

    for (let i = 0; i < n; i++) {
      const diffX = x[i] - meanX;
      const diffY = y[i] - meanY;
      numerator += diffX * diffY;
      sumSqX += diffX * diffX;
      sumSqY += diffY * diffY;
    }

    const denominator = Math.sqrt(sumSqX * sumSqY);
    return denominator === 0 ? 0 : numerator / denominator;
  }
}
