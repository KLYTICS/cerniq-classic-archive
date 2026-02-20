"""
Risk Parity Portfolio Optimizer

Implements risk parity (equal risk contribution) portfolio allocation
using convex optimization and modern portfolio theory.
"""

import numpy as np
import pandas as pd
from scipy.optimize import minimize
import cvxpy as cp
from typing import Tuple, Optional


class RiskParityOptimizer:
    """
    Risk Parity Portfolio Optimizer
    
    Solves for portfolio weights where each asset contributes
    equally to the total portfolio variance.
    """
    
    def __init__(self, method: str = 'cvxpy'):
        """
        Args:
            method: Optimization method ('cvxpy' or 'scipy')
        """
        self.method = method
        self.weights = None
        self.risk_contributions = None
        
    def fit(self, returns: pd.DataFrame) -> 'RiskParityOptimizer':
        """
        Compute risk parity weights from return data.
        
        Args:
            returns: DataFrame of asset returns (rows=dates, cols=assets)
            
        Returns:
            self
        """
        # Estimate covariance matrix
        cov_matrix = returns.cov().values
        n_assets = len(returns.columns)
        
        # Solve for risk parity weights
        if self.method == 'cvxpy':
            weights = self._solve_cvxpy(cov_matrix, n_assets)
        else:
            weights = self._solve_scipy(cov_matrix, n_assets)
            
        self.weights = pd.Series(weights, index=returns.columns)
        self.risk_contributions = self._compute_risk_contributions(
            weights, cov_matrix
        )
        
        return self
        
    def _solve_cvxpy(self, cov_matrix: np.ndarray, n_assets: int) -> np.ndarray:
        """
        Solve using CVXPY (convex optimization).
        
        Risk parity formulation:
        minimize: sum of squared deviations from equal risk contribution
        subject to: weights sum to 1, weights >= 0
        """
        w = cp.Variable(n_assets)
        
        # Portfolio variance: w^T * Σ * w
        portfolio_var = cp.quad_form(w, cov_matrix)
        
        # Risk contribution for asset i: w_i * (Σw)_i
        # For risk parity: all risk contributions should be equal to 1/n of total risk
        risk_contributions = cp.multiply(w, cov_matrix @ w)
        target_risk = portfolio_var / n_assets
        
        # Minimize sum of squared deviations from target risk
        objective = cp.sum_squares(risk_contributions - target_risk)
        
        constraints = [
            cp.sum(w) == 1,  # Weights sum to 1
            w >= 0           # Long-only
        ]
        
        problem = cp.Problem(cp.Minimize(objective), constraints)
        problem.solve()
        
        return w.value
        
    def _solve_scipy(self, cov_matrix: np.ndarray, n_assets: int) -> np.ndarray:
        """
        Solve using scipy minimize (alternative method).
        """
        def risk_parity_objective(w):
            # Portfolio variance
            portfolio_var = w @ cov_matrix @ w
            
            # Risk contributions
            marginal_contrib = cov_matrix @ w
            risk_contrib = w * marginal_contrib
            
            # Target: equal risk contribution
            target = portfolio_var / n_assets
            
            # Sum of squared deviations
            return np.sum((risk_contrib - target) ** 2)
        
        # Initial guess: equal weight
        w0 = np.ones(n_assets) / n_assets
        
        # Constraints
        constraints = [
            {'type': 'eq', 'fun': lambda w: np.sum(w) - 1}  # Sum to 1
        ]
        bounds = [(0, 1) for _ in range(n_assets)]  # Long-only
        
        result = minimize(
            risk_parity_objective,
            w0,
            method='SLSQP',
            bounds=bounds,
            constraints=constraints
        )
        
        return result.x
        
    def _compute_risk_contributions(
        self, 
        weights: np.ndarray, 
        cov_matrix: np.ndarray
    ) -> pd.Series:
        """
        Compute the risk contribution of each asset.
        
        Risk contribution_i = w_i * (Σw)_i / sqrt(w^T Σ w)
        """
        portfolio_vol = np.sqrt(weights @ cov_matrix @ weights)
        marginal_contrib = cov_matrix @ weights
        risk_contrib = weights * marginal_contrib / portfolio_vol
        
        return pd.Series(risk_contrib, index=self.weights.index)
        
    def get_weights(self) -> pd.Series:
        """Return optimized weights."""
        if self.weights is None:
            raise ValueError("Must call fit() first")
        return self.weights
        
    def get_risk_contributions(self) -> pd.Series:
        """Return risk contributions (as % of total risk)."""
        if self.risk_contributions is None:
            raise ValueError("Must call fit() first")
        return self.risk_contributions / self.risk_contributions.sum()


def compute_portfolio_metrics(
    returns: pd.DataFrame,
    weights: pd.Series
) -> dict:
    """
    Compute portfolio performance metrics.
    
    Args:
        returns: Asset returns DataFrame
        weights: Portfolio weights Series
        
    Returns:
        Dictionary of metrics
    """
    # Ensure alignment
    weights = weights.reindex(returns.columns).fillna(0)
    
    # Portfolio returns
    portfolio_returns = (returns * weights).sum(axis=1)
    
    # Annualization factor (252 trading days)
    annual_factor = 252
    
    # Metrics
    total_return = (1 + portfolio_returns).prod() - 1
    cagr = (1 + total_return) ** (annual_factor / len(returns)) - 1
    volatility = portfolio_returns.std() * np.sqrt(annual_factor)
    sharpe = (portfolio_returns.mean() * annual_factor) / (portfolio_returns.std() * np.sqrt(annual_factor))
    
    # Max drawdown
    cumulative = (1 + portfolio_returns).cumprod()
    running_max = cumulative.expanding().max()
    drawdown = (cumulative - running_max) / running_max
    max_drawdown = drawdown.min()
    
    return {
        'total_return': total_return,
        'cagr': cagr,
        'volatility': volatility,
        'sharpe_ratio': sharpe,
        'max_drawdown': max_drawdown,
        'portfolio_returns': portfolio_returns
    }


def equal_weight_portfolio(tickers: list) -> pd.Series:
    """Create equal weight portfolio."""
    n = len(tickers)
    return pd.Series(1/n, index=tickers)


def market_cap_weight_portfolio(
    market_caps: pd.Series
) -> pd.Series:
    """Create market cap weighted portfolio."""
    return market_caps / market_caps.sum()
