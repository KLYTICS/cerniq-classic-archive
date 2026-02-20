"""
Monte Carlo Simulation Engine

Generates probabilistic forecasts for portfolio returns and risk metrics.
Uses historical return distributions and correlation structures.
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from scipy import stats
import warnings
warnings.filterwarnings('ignore')


@dataclass
class MonteCarloResult:
    """Container for Monte Carlo simulation results."""
    n_simulations: int
    horizon_days: int
    initial_value: float

    # Return statistics
    mean_return: float
    median_return: float
    std_return: float

    # Percentile outcomes
    percentile_5: float
    percentile_25: float
    percentile_50: float
    percentile_75: float
    percentile_95: float

    # Risk metrics
    var_95: float
    var_99: float
    cvar_95: float
    prob_loss: float
    prob_gain_10pct: float
    prob_gain_20pct: float

    # Full simulation data
    simulated_paths: np.ndarray
    final_values: np.ndarray


class MonteCarloSimulator:
    """
    Monte Carlo simulation for portfolio forecasting.

    Supports:
    - Geometric Brownian Motion (GBM)
    - Historical bootstrapping
    - Correlated multi-asset simulation
    """

    def __init__(
        self,
        returns: pd.DataFrame,
        weights: pd.Series = None
    ):
        """
        Args:
            returns: DataFrame of historical returns
            weights: Portfolio weights (equal weight if None)
        """
        self.returns = returns.dropna()

        if weights is None:
            n = len(returns.columns)
            self.weights = pd.Series(1/n, index=returns.columns)
        else:
            self.weights = weights.reindex(returns.columns).fillna(0)

        # Compute portfolio returns
        self.portfolio_returns = (returns * self.weights).sum(axis=1)

        # Fit distribution parameters
        self.mean = self.portfolio_returns.mean()
        self.std = self.portfolio_returns.std()

        # Compute correlation matrix for multi-asset simulation
        self.corr_matrix = returns.corr()
        self.cov_matrix = returns.cov()

    def simulate_gbm(
        self,
        n_simulations: int = 10000,
        horizon_days: int = 252,
        initial_value: float = 100000
    ) -> MonteCarloResult:
        """
        Simulate using Geometric Brownian Motion.

        Assumes log-normal returns with drift and volatility
        estimated from historical data.

        Args:
            n_simulations: Number of simulation paths
            horizon_days: Days to simulate forward
            initial_value: Starting portfolio value

        Returns:
            MonteCarloResult with simulation outcomes
        """
        # Annualized parameters
        drift = self.mean * 252 - 0.5 * (self.std ** 2) * 252
        volatility = self.std * np.sqrt(252)

        # Daily parameters
        dt = 1 / 252
        drift_daily = drift * dt
        vol_daily = volatility * np.sqrt(dt)

        # Generate random paths
        np.random.seed(42)
        random_shocks = np.random.normal(0, 1, (n_simulations, horizon_days))

        # Simulate paths
        log_returns = drift_daily + vol_daily * random_shocks
        cumulative_log_returns = np.cumsum(log_returns, axis=1)

        # Convert to price paths
        paths = initial_value * np.exp(cumulative_log_returns)

        # Prepend initial value
        paths = np.column_stack([
            np.full(n_simulations, initial_value),
            paths
        ])

        return self._compute_results(paths, n_simulations, horizon_days, initial_value)

    def simulate_bootstrap(
        self,
        n_simulations: int = 10000,
        horizon_days: int = 252,
        initial_value: float = 100000,
        block_size: int = 5
    ) -> MonteCarloResult:
        """
        Simulate using historical bootstrapping.

        Randomly samples from historical returns to generate
        future scenarios. Uses block bootstrap to preserve
        autocorrelation.

        Args:
            n_simulations: Number of simulation paths
            horizon_days: Days to simulate forward
            initial_value: Starting portfolio value
            block_size: Size of blocks for block bootstrap

        Returns:
            MonteCarloResult with simulation outcomes
        """
        np.random.seed(42)
        historical = self.portfolio_returns.values
        n_obs = len(historical)

        # Generate simulated paths
        paths = np.zeros((n_simulations, horizon_days + 1))
        paths[:, 0] = initial_value

        for sim in range(n_simulations):
            # Block bootstrap
            sampled_returns = []
            while len(sampled_returns) < horizon_days:
                start_idx = np.random.randint(0, n_obs - block_size)
                block = historical[start_idx:start_idx + block_size]
                sampled_returns.extend(block)

            sampled_returns = np.array(sampled_returns[:horizon_days])

            # Compute cumulative returns
            cumulative = np.cumprod(1 + sampled_returns)
            paths[sim, 1:] = initial_value * cumulative

        return self._compute_results(paths, n_simulations, horizon_days, initial_value)

    def simulate_correlated(
        self,
        n_simulations: int = 10000,
        horizon_days: int = 252,
        initial_value: float = 100000
    ) -> Tuple[MonteCarloResult, Dict[str, np.ndarray]]:
        """
        Simulate correlated multi-asset returns.

        Uses Cholesky decomposition to generate correlated
        random returns across assets.

        Returns:
            Tuple of (portfolio result, dict of asset paths)
        """
        np.random.seed(42)

        # Cholesky decomposition for correlation
        try:
            chol = np.linalg.cholesky(self.cov_matrix.values)
        except np.linalg.LinAlgError:
            # If not positive definite, use eigenvalue adjustment
            eigenvalues, eigenvectors = np.linalg.eigh(self.cov_matrix.values)
            eigenvalues = np.maximum(eigenvalues, 1e-8)
            adjusted_cov = eigenvectors @ np.diag(eigenvalues) @ eigenvectors.T
            chol = np.linalg.cholesky(adjusted_cov)

        n_assets = len(self.returns.columns)
        means = self.returns.mean().values

        # Generate correlated returns
        all_paths = {}
        portfolio_paths = np.zeros((n_simulations, horizon_days + 1))
        portfolio_paths[:, 0] = initial_value

        for sim in range(n_simulations):
            # Generate uncorrelated random numbers
            uncorrelated = np.random.normal(0, 1, (horizon_days, n_assets))

            # Apply correlation
            correlated_returns = uncorrelated @ chol.T + means

            # Compute portfolio returns
            port_returns = correlated_returns @ self.weights.values

            # Cumulative
            cumulative = np.cumprod(1 + port_returns)
            portfolio_paths[sim, 1:] = initial_value * cumulative

        result = self._compute_results(
            portfolio_paths, n_simulations, horizon_days, initial_value
        )

        return result, all_paths

    def _compute_results(
        self,
        paths: np.ndarray,
        n_simulations: int,
        horizon_days: int,
        initial_value: float
    ) -> MonteCarloResult:
        """Compute statistics from simulated paths."""
        final_values = paths[:, -1]
        total_returns = (final_values - initial_value) / initial_value

        # Return statistics
        mean_return = np.mean(total_returns)
        median_return = np.median(total_returns)
        std_return = np.std(total_returns)

        # Percentiles
        percentiles = np.percentile(final_values, [5, 25, 50, 75, 95])

        # VaR and CVaR
        var_95 = np.percentile(total_returns, 5)
        var_99 = np.percentile(total_returns, 1)
        cvar_95 = total_returns[total_returns <= var_95].mean()

        # Probabilities
        prob_loss = np.mean(total_returns < 0)
        prob_gain_10 = np.mean(total_returns > 0.10)
        prob_gain_20 = np.mean(total_returns > 0.20)

        return MonteCarloResult(
            n_simulations=n_simulations,
            horizon_days=horizon_days,
            initial_value=initial_value,
            mean_return=mean_return,
            median_return=median_return,
            std_return=std_return,
            percentile_5=percentiles[0],
            percentile_25=percentiles[1],
            percentile_50=percentiles[2],
            percentile_75=percentiles[3],
            percentile_95=percentiles[4],
            var_95=var_95,
            var_99=var_99,
            cvar_95=cvar_95,
            prob_loss=prob_loss,
            prob_gain_10pct=prob_gain_10,
            prob_gain_20pct=prob_gain_20,
            simulated_paths=paths,
            final_values=final_values
        )

    def scenario_analysis(
        self,
        scenarios: Dict[str, float],
        initial_value: float = 100000
    ) -> pd.DataFrame:
        """
        Analyze specific market scenarios.

        Args:
            scenarios: Dict of {scenario_name: market_return}
            initial_value: Starting value

        Returns:
            DataFrame with scenario outcomes
        """
        results = []

        # Get portfolio beta to market
        market_returns = self.portfolio_returns
        portfolio_beta = 1.0  # Assume beta = 1 if no market data

        for name, market_return in scenarios.items():
            # Estimate portfolio return under scenario
            portfolio_return = portfolio_beta * market_return

            final_value = initial_value * (1 + portfolio_return)

            results.append({
                'Scenario': name,
                'Market Return': f"{market_return*100:.1f}%",
                'Portfolio Return': f"{portfolio_return*100:.1f}%",
                'Final Value': f"${final_value:,.0f}",
                'P&L': f"${final_value - initial_value:,.0f}"
            })

        return pd.DataFrame(results)


def run_monte_carlo_analysis(
    prices: pd.DataFrame,
    weights: pd.Series = None,
    n_simulations: int = 10000,
    horizon_days: int = 252,
    initial_value: float = 100000
) -> Dict:
    """
    Run complete Monte Carlo analysis.

    Returns:
        Dictionary with GBM and Bootstrap results
    """
    returns = prices.pct_change().dropna()
    simulator = MonteCarloSimulator(returns, weights)

    # Run both methods
    gbm_result = simulator.simulate_gbm(
        n_simulations, horizon_days, initial_value
    )
    bootstrap_result = simulator.simulate_bootstrap(
        n_simulations, horizon_days, initial_value
    )

    # Scenario analysis
    scenarios = {
        'Bull Market (+20%)': 0.20,
        'Mild Growth (+10%)': 0.10,
        'Flat Market (0%)': 0.00,
        'Correction (-10%)': -0.10,
        'Bear Market (-20%)': -0.20,
        'Crash (-30%)': -0.30,
        'Black Swan (-50%)': -0.50
    }
    scenario_results = simulator.scenario_analysis(scenarios, initial_value)

    return {
        'gbm': gbm_result,
        'bootstrap': bootstrap_result,
        'scenarios': scenario_results,
        'simulator': simulator
    }
