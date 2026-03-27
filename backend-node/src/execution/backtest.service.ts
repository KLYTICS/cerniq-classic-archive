import { Injectable, Logger } from '@nestjs/common';
import { MarketDataService } from '../market-data/market-data.service';

/**
 * Backtesting Engine
 * Simulates trading strategies on historical data
 */
@Injectable()
export class BacktestService {
  private readonly logger = new Logger(BacktestService.name);

  constructor(private readonly marketDataService: MarketDataService) {}

  /**
   * Run a backtest simulation
   */
  async runBacktest(config: BacktestConfig): Promise<BacktestResult> {
    const {
      strategy,
      tickers,
      startDate,
      endDate,
      initialCapital,
      commission,
    } = config;

    this.logger.log(
      `Starting backtest: ${strategy.name} from ${startDate} to ${endDate}`,
    );

    // Initialize portfolio state
    const state: PortfolioState = {
      cash: initialCapital,
      positions: new Map(),
      trades: [],
      equity: [{ date: startDate, value: initialCapital }],
    };

    // Fetch historical data for all tickers
    const historicalData: Map<string, HistoricalBar[]> = new Map();
    for (const ticker of tickers) {
      const data = await this.marketDataService.getHistoricalPrices(
        ticker,
        new Date(startDate),
        new Date(endDate),
      );
      historicalData.set(ticker, data);
    }

    // Get all unique dates
    const allDates = new Set<string>();
    historicalData.forEach((bars) => {
      bars.forEach((bar) => allDates.add(bar.date));
    });
    const sortedDates = Array.from(allDates).sort();

    // Simulate day by day
    for (const dateStr of sortedDates) {
      const prices: Map<string, number> = new Map();
      historicalData.forEach((bars, ticker) => {
        const bar = bars.find((b) => b.date === dateStr);
        if (bar) {
          prices.set(ticker, bar.close);
        }
      });

      // Generate signals based on strategy
      const signals = this.generateSignals(
        strategy,
        historicalData,
        dateStr,
        state,
      );

      // Execute signals
      for (const signal of signals) {
        this.executeSignal(signal, prices, state, commission);
      }

      // Record equity
      const portfolioValue = this.calculatePortfolioValue(state, prices);
      state.equity.push({ date: dateStr, value: portfolioValue });
    }

    // Calculate performance metrics
    const metrics = this.calculateMetrics(state, initialCapital);

    return {
      strategyName: strategy.name,
      startDate,
      endDate,
      initialCapital,
      finalValue: state.equity[state.equity.length - 1].value,
      metrics,
      trades: state.trades,
      equityCurve: state.equity,
    };
  }

  /**
   * Generate trading signals based on strategy
   */
  private generateSignals(
    strategy: TradingStrategy,
    data: Map<string, HistoricalBar[]>,
    currentDate: string,
    state: PortfolioState,
  ): Signal[] {
    const signals: Signal[] = [];

    for (const [ticker, bars] of data) {
      const currentIdx = bars.findIndex((b) => b.date === currentDate);
      if (currentIdx < strategy.lookbackPeriod) continue;

      const lookback = bars.slice(
        currentIdx - strategy.lookbackPeriod,
        currentIdx + 1,
      );
      const prices = lookback.map((b) => b.close);

      switch (strategy.type) {
        case 'SMA_CROSSOVER':
          const smaShort = this.calculateSMA(
            prices,
            strategy.params.shortPeriod,
          );
          const smaLong = this.calculateSMA(prices, strategy.params.longPeriod);
          const prevShort = this.calculateSMA(
            prices.slice(0, -1),
            strategy.params.shortPeriod,
          );
          const prevLong = this.calculateSMA(
            prices.slice(0, -1),
            strategy.params.longPeriod,
          );

          // Bullish crossover
          if (prevShort <= prevLong && smaShort > smaLong) {
            signals.push({
              ticker,
              action: 'BUY',
              reason: 'SMA bullish crossover',
            });
          }
          // Bearish crossover
          if (prevShort >= prevLong && smaShort < smaLong) {
            signals.push({
              ticker,
              action: 'SELL',
              reason: 'SMA bearish crossover',
            });
          }
          break;

        case 'RSI_REVERSAL':
          const rsi = this.calculateRSI(prices, strategy.params.rsiPeriod);
          const position = state.positions.get(ticker);

          // RSI oversold - buy signal
          if (rsi < strategy.params.oversold && !position) {
            signals.push({
              ticker,
              action: 'BUY',
              reason: `RSI oversold (${rsi.toFixed(1)})`,
            });
          }
          // RSI overbought - sell signal
          if (rsi > strategy.params.overbought && position) {
            signals.push({
              ticker,
              action: 'SELL',
              reason: `RSI overbought (${rsi.toFixed(1)})`,
            });
          }
          break;

        case 'MOMENTUM':
          const momentum =
            ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100;
          const hasPosition = state.positions.has(ticker);

          if (momentum > strategy.params.momentumThreshold && !hasPosition) {
            signals.push({
              ticker,
              action: 'BUY',
              reason: `Momentum ${momentum.toFixed(1)}%`,
            });
          }
          if (momentum < -strategy.params.momentumThreshold && hasPosition) {
            signals.push({
              ticker,
              action: 'SELL',
              reason: `Momentum ${momentum.toFixed(1)}%`,
            });
          }
          break;
      }
    }

    return signals;
  }

  /**
   * Execute a trading signal
   */
  private executeSignal(
    signal: Signal,
    prices: Map<string, number>,
    state: PortfolioState,
    commission: number,
  ): void {
    const price = prices.get(signal.ticker);
    if (!price) return;

    if (signal.action === 'BUY') {
      // Position sizing: use 10% of available cash per position
      const positionSize = state.cash * 0.1;
      const shares = Math.floor(positionSize / price);
      if (shares <= 0) return;

      const cost = shares * price + commission;
      if (cost > state.cash) return;

      state.cash -= cost;
      const existing = state.positions.get(signal.ticker) || 0;
      state.positions.set(signal.ticker, existing + shares);

      state.trades.push({
        ticker: signal.ticker,
        action: 'BUY',
        shares,
        price,
        commission,
        date: new Date().toISOString(),
        reason: signal.reason,
      });
    } else if (signal.action === 'SELL') {
      const shares = state.positions.get(signal.ticker);
      if (!shares || shares <= 0) return;

      const proceeds = shares * price - commission;
      state.cash += proceeds;
      state.positions.delete(signal.ticker);

      state.trades.push({
        ticker: signal.ticker,
        action: 'SELL',
        shares,
        price,
        commission,
        date: new Date().toISOString(),
        reason: signal.reason,
      });
    }
  }

  /**
   * Calculate portfolio value
   */
  private calculatePortfolioValue(
    state: PortfolioState,
    prices: Map<string, number>,
  ): number {
    let value = state.cash;
    state.positions.forEach((shares, ticker) => {
      const price = prices.get(ticker);
      if (price) {
        value += shares * price;
      }
    });
    return Number(value.toFixed(2));
  }

  /**
   * Calculate performance metrics
   */
  private calculateMetrics(
    state: PortfolioState,
    initialCapital: number,
  ): BacktestMetrics {
    const equity = state.equity;
    const finalValue = equity[equity.length - 1].value;
    const totalReturn = ((finalValue - initialCapital) / initialCapital) * 100;

    // Calculate daily returns
    const dailyReturns: number[] = [];
    for (let i = 1; i < equity.length; i++) {
      dailyReturns.push(
        (equity[i].value - equity[i - 1].value) / equity[i - 1].value,
      );
    }

    // Sharpe Ratio (assuming 252 trading days, 2% risk-free rate)
    const avgReturn =
      dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const stdDev = Math.sqrt(
      dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) /
        dailyReturns.length,
    );
    const sharpeRatio =
      stdDev > 0 ? (avgReturn * 252 - 0.02) / (stdDev * Math.sqrt(252)) : 0;

    // Maximum Drawdown
    let maxDrawdown = 0;
    let peak = equity[0].value;
    for (const point of equity) {
      if (point.value > peak) peak = point.value;
      const drawdown = (peak - point.value) / peak;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    // Win rate
    const winningTrades = state.trades.filter((t, i, arr) => {
      if (t.action !== 'SELL') return false;
      const buyTrade = arr
        .slice(0, i)
        .reverse()
        .find((bt) => bt.ticker === t.ticker && bt.action === 'BUY');
      return buyTrade && t.price > buyTrade.price;
    });
    const sellTrades = state.trades.filter((t) => t.action === 'SELL');
    const winRate =
      sellTrades.length > 0
        ? (winningTrades.length / sellTrades.length) * 100
        : 0;

    // Profit factor
    let grossProfit = 0;
    let grossLoss = 0;
    for (const trade of state.trades) {
      if (trade.action === 'SELL') {
        const buyTrade = state.trades.find(
          (t) => t.ticker === trade.ticker && t.action === 'BUY',
        );
        if (buyTrade) {
          const pnl = (trade.price - buyTrade.price) * trade.shares;
          if (pnl > 0) grossProfit += pnl;
          else grossLoss += Math.abs(pnl);
        }
      }
    }
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;

    return {
      totalReturn: Number(totalReturn.toFixed(2)),
      sharpeRatio: Number(sharpeRatio.toFixed(2)),
      maxDrawdown: Number((maxDrawdown * 100).toFixed(2)),
      winRate: Number(winRate.toFixed(1)),
      profitFactor: Number(profitFactor.toFixed(2)),
      totalTrades: state.trades.length,
      avgTradesPerMonth: state.trades.length / (equity.length / 21), // ~21 trading days/month
    };
  }

  // Helper functions
  private calculateSMA(prices: number[], period: number): number {
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  }

  private calculateRSI(prices: number[], period: number = 14): number {
    const gains: number[] = [];
    const losses: number[] = [];

    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? -change : 0);
    }

    const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }
}

// Types
export interface BacktestConfig {
  strategy: TradingStrategy;
  tickers: string[];
  startDate: string;
  endDate: string;
  initialCapital: number;
  commission: number;
}

export interface TradingStrategy {
  name: string;
  type: 'SMA_CROSSOVER' | 'RSI_REVERSAL' | 'MOMENTUM';
  lookbackPeriod: number;
  params: Record<string, number>;
}

interface PortfolioState {
  cash: number;
  positions: Map<string, number>;
  trades: Trade[];
  equity: { date: string; value: number }[];
}

interface Signal {
  ticker: string;
  action: 'BUY' | 'SELL';
  reason: string;
}

interface Trade {
  ticker: string;
  action: 'BUY' | 'SELL';
  shares: number;
  price: number;
  commission: number;
  date: string;
  reason: string;
}

interface HistoricalBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BacktestResult {
  strategyName: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  finalValue: number;
  metrics: BacktestMetrics;
  trades: Trade[];
  equityCurve: { date: string; value: number }[];
}

export interface BacktestMetrics {
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  avgTradesPerMonth: number;
}
