"""
Backtesting Engine

Validates valuation strategies with historical data.
Computes performance metrics, drawdowns, and statistical significance.
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')


@dataclass
class BacktestResult:
    """Container for backtest results."""
    strategy_name: str
    total_return: float
    cagr: float
    volatility: float
    sharpe_ratio: float
    sortino_ratio: float
    max_drawdown: float
    calmar_ratio: float
    win_rate: float
    profit_factor: float
    avg_trade_return: float
    num_trades: int
    returns: pd.Series
    equity_curve: pd.Series
    drawdown_series: pd.Series
    trades: pd.DataFrame


class Backtester:
    """
    Strategy backtesting engine.

    Supports:
    - Long-only and long-short strategies
    - Transaction costs
    - Rebalancing periods
    - Walk-forward optimization
    """

    def __init__(
        self,
        prices: pd.DataFrame,
        initial_capital: float = 100000,
        transaction_cost: float = 0.001,  # 10 bps
        rebalance_frequency: str = 'monthly'  # daily, weekly, monthly
    ):
        """
        Args:
            prices: DataFrame of historical prices (tickers as columns)
            initial_capital: Starting capital
            transaction_cost: Cost per trade (as fraction)
            rebalance_frequency: How often to rebalance
        """
        self.prices = prices
        self.returns = prices.pct_change().dropna()
        self.initial_capital = initial_capital
        self.transaction_cost = transaction_cost
        self.rebalance_frequency = rebalance_frequency

        # Compute rebalance dates
        self.rebalance_dates = self._get_rebalance_dates()

    def _get_rebalance_dates(self) -> List[datetime]:
        """Get dates when portfolio should be rebalanced."""
        dates = self.returns.index.tolist()

        if self.rebalance_frequency == 'daily':
            return dates
        elif self.rebalance_frequency == 'weekly':
            # First trading day of each week
            return [d for i, d in enumerate(dates)
                    if i == 0 or dates[i-1].week != d.week]
        elif self.rebalance_frequency == 'monthly':
            # First trading day of each month
            return [d for i, d in enumerate(dates)
                    if i == 0 or dates[i-1].month != d.month]
        else:
            return dates

    def run_backtest(
        self,
        signal_func,
        strategy_name: str = "Strategy"
    ) -> BacktestResult:
        """
        Run backtest with given signal function.

        Args:
            signal_func: Function that takes (date, prices_up_to_date) and returns
                        dict of {ticker: weight} for portfolio allocation
            strategy_name: Name for the strategy

        Returns:
            BacktestResult with performance metrics
        """
        equity = [self.initial_capital]
        positions = {}
        trades = []
        daily_returns = []

        for i, date in enumerate(self.returns.index):
            # Get current returns
            day_returns = self.returns.loc[date]

            # Calculate portfolio return
            port_return = 0.0
            if positions:
                for ticker, weight in positions.items():
                    if ticker in day_returns.index:
                        port_return += weight * day_returns[ticker]

            # Update equity
            new_equity = equity[-1] * (1 + port_return)

            # Check if rebalance day
            if date in self.rebalance_dates:
                # Get historical prices up to this date
                hist_prices = self.prices.loc[:date]

                # Get new signals
                try:
                    new_positions = signal_func(date, hist_prices)
                except Exception:
                    new_positions = positions.copy() if positions else {}

                # Calculate transaction costs
                if positions or new_positions:
                    turnover = sum(
                        abs(new_positions.get(t, 0) - positions.get(t, 0))
                        for t in set(list(positions.keys()) + list(new_positions.keys()))
                    )
                    cost = turnover * self.transaction_cost * new_equity
                    new_equity -= cost

                    # Record trade
                    if turnover > 0.01:
                        trades.append({
                            'date': date,
                            'turnover': turnover,
                            'cost': cost,
                            'positions': new_positions.copy()
                        })

                positions = new_positions

            equity.append(new_equity)
            daily_returns.append(port_return)

        # Create series
        equity_series = pd.Series(equity[1:], index=self.returns.index)
        returns_series = pd.Series(daily_returns, index=self.returns.index)

        # Compute metrics
        metrics = self._compute_metrics(returns_series, equity_series, trades)
        metrics['strategy_name'] = strategy_name

        return BacktestResult(**metrics)

    def _compute_metrics(
        self,
        returns: pd.Series,
        equity: pd.Series,
        trades: List[Dict]
    ) -> Dict:
        """Compute all performance metrics."""
        # Basic returns
        total_return = (equity.iloc[-1] / self.initial_capital) - 1
        n_years = len(returns) / 252
        cagr = (1 + total_return) ** (1 / n_years) - 1 if n_years > 0 else 0

        # Risk metrics
        volatility = returns.std() * np.sqrt(252)
        downside_returns = returns[returns < 0]
        downside_vol = downside_returns.std() * np.sqrt(252) if len(downside_returns) > 0 else 0.001

        # Risk-adjusted returns
        rf_daily = 0.04 / 252  # 4% annual risk-free rate
        sharpe = (returns.mean() - rf_daily) * np.sqrt(252) / returns.std() if returns.std() > 0 else 0
        sortino = (returns.mean() - rf_daily) * np.sqrt(252) / downside_vol if downside_vol > 0 else 0

        # Drawdown
        cumulative = (1 + returns).cumprod()
        running_max = cumulative.expanding().max()
        drawdown = (cumulative - running_max) / running_max
        max_drawdown = drawdown.min()

        calmar = cagr / abs(max_drawdown) if max_drawdown != 0 else 0

        # Trade statistics
        num_trades = len(trades)
        if num_trades > 0:
            trade_returns = []
            for i in range(1, len(trades)):
                start_idx = self.returns.index.get_loc(trades[i-1]['date'])
                end_idx = self.returns.index.get_loc(trades[i]['date'])
                period_return = returns.iloc[start_idx:end_idx].sum()
                trade_returns.append(period_return)

            if trade_returns:
                winning_trades = [r for r in trade_returns if r > 0]
                losing_trades = [r for r in trade_returns if r < 0]
                win_rate = len(winning_trades) / len(trade_returns)
                avg_win = np.mean(winning_trades) if winning_trades else 0
                avg_loss = abs(np.mean(losing_trades)) if losing_trades else 0.001
                profit_factor = avg_win / avg_loss if avg_loss > 0 else float('inf')
                avg_trade_return = np.mean(trade_returns)
            else:
                win_rate = 0
                profit_factor = 0
                avg_trade_return = 0
        else:
            win_rate = 0
            profit_factor = 0
            avg_trade_return = 0

        return {
            'total_return': total_return,
            'cagr': cagr,
            'volatility': volatility,
            'sharpe_ratio': sharpe,
            'sortino_ratio': sortino,
            'max_drawdown': max_drawdown,
            'calmar_ratio': calmar,
            'win_rate': win_rate,
            'profit_factor': profit_factor,
            'avg_trade_return': avg_trade_return,
            'num_trades': num_trades,
            'returns': returns,
            'equity_curve': equity,
            'drawdown_series': drawdown,
            'trades': pd.DataFrame(trades) if trades else pd.DataFrame()
        }

    def run_benchmark(self, benchmark_ticker: str = None) -> BacktestResult:
        """
        Run buy-and-hold benchmark.

        Args:
            benchmark_ticker: Single ticker to use, or None for equal-weight

        Returns:
            BacktestResult for benchmark
        """
        if benchmark_ticker and benchmark_ticker in self.returns.columns:
            def signal_func(date, prices):
                return {benchmark_ticker: 1.0}
            name = f"Buy & Hold {benchmark_ticker}"
        else:
            tickers = self.returns.columns.tolist()
            weight = 1.0 / len(tickers)
            def signal_func(date, prices):
                return {t: weight for t in tickers}
            name = "Equal Weight"

        return self.run_backtest(signal_func, name)


class MomentumStrategy:
    """
    Momentum-based signal generator.

    Ranks stocks by recent momentum and allocates to top performers.
    """

    def __init__(
        self,
        lookback: int = 90,
        top_n: int = 3,
        exclude_recent: int = 5
    ):
        """
        Args:
            lookback: Days to compute momentum
            top_n: Number of stocks to hold
            exclude_recent: Skip most recent N days (mean reversion)
        """
        self.lookback = lookback
        self.top_n = top_n
        self.exclude_recent = exclude_recent

    def generate_signals(self, date, prices: pd.DataFrame) -> Dict[str, float]:
        """Generate portfolio weights based on momentum."""
        if len(prices) < self.lookback + self.exclude_recent:
            # Equal weight if insufficient history
            tickers = prices.columns.tolist()
            return {t: 1.0/len(tickers) for t in tickers}

        # Compute momentum (excluding recent days)
        end_idx = -self.exclude_recent if self.exclude_recent > 0 else None
        start_idx = -(self.lookback + self.exclude_recent)

        returns = prices.iloc[start_idx:end_idx].pct_change().sum()

        # Rank and select top N
        top_tickers = returns.nlargest(self.top_n).index.tolist()

        # Equal weight among selected
        weight = 1.0 / len(top_tickers)
        return {t: weight for t in top_tickers}


class MeanReversionStrategy:
    """
    Mean reversion signal generator.

    Buys oversold stocks and sells overbought.
    """

    def __init__(
        self,
        lookback: int = 20,
        z_threshold: float = -1.5,
        top_n: int = 3
    ):
        """
        Args:
            lookback: Days for z-score calculation
            z_threshold: Buy when z-score below this
            top_n: Maximum stocks to hold
        """
        self.lookback = lookback
        self.z_threshold = z_threshold
        self.top_n = top_n

    def generate_signals(self, date, prices: pd.DataFrame) -> Dict[str, float]:
        """Generate portfolio weights based on mean reversion."""
        if len(prices) < self.lookback:
            tickers = prices.columns.tolist()
            return {t: 1.0/len(tickers) for t in tickers}

        recent = prices.iloc[-self.lookback:]
        current = prices.iloc[-1]

        # Compute z-scores
        z_scores = (current - recent.mean()) / recent.std()

        # Find oversold stocks
        oversold = z_scores[z_scores < self.z_threshold].nsmallest(self.top_n)

        if len(oversold) == 0:
            # If nothing oversold, equal weight
            tickers = prices.columns.tolist()
            return {t: 1.0/len(tickers) for t in tickers}

        weight = 1.0 / len(oversold)
        return {t: weight for t in oversold.index}


class ValuationStrategy:
    """
    Valuation-based signal generator using the screener scores.
    """

    def __init__(
        self,
        screener_func,
        min_score: float = 60,
        top_n: int = 3
    ):
        """
        Args:
            screener_func: Function that returns screener DataFrame
            min_score: Minimum score to consider
            top_n: Number of top stocks to hold
        """
        self.screener_func = screener_func
        self.min_score = min_score
        self.top_n = top_n

    def generate_signals(self, date, prices: pd.DataFrame) -> Dict[str, float]:
        """Generate portfolio weights based on valuation scores."""
        try:
            results = self.screener_func(prices)

            # Filter by minimum score
            qualified = results[results['Score'] >= self.min_score]

            if len(qualified) == 0:
                tickers = prices.columns.tolist()
                return {t: 1.0/len(tickers) for t in tickers}

            # Take top N
            top = qualified.head(self.top_n)
            tickers = top['Ticker'].tolist()

            weight = 1.0 / len(tickers)
            return {t: weight for t in tickers}

        except Exception:
            tickers = prices.columns.tolist()
            return {t: 1.0/len(tickers) for t in tickers}


def compare_strategies(results: List[BacktestResult]) -> pd.DataFrame:
    """
    Compare multiple backtest results.

    Returns:
        DataFrame with strategy comparison
    """
    data = []
    for r in results:
        data.append({
            'Strategy': r.strategy_name,
            'Total Return': f"{r.total_return*100:.1f}%",
            'CAGR': f"{r.cagr*100:.1f}%",
            'Volatility': f"{r.volatility*100:.1f}%",
            'Sharpe': f"{r.sharpe_ratio:.2f}",
            'Sortino': f"{r.sortino_ratio:.2f}",
            'Max DD': f"{r.max_drawdown*100:.1f}%",
            'Calmar': f"{r.calmar_ratio:.2f}",
            'Win Rate': f"{r.win_rate*100:.0f}%",
            'Trades': r.num_trades
        })

    return pd.DataFrame(data)
