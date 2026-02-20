"""
Risk Calculation Engine

Implements VaR (Value at Risk) and CVaR (Conditional Value at Risk)
calculations using historical simulation and parametric methods.
"""

import numpy as np
import pandas as pd
from scipy import stats
from typing import Dict, Tuple, Optional


class RiskEngine:
    """
    Portfolio risk calculation engine.
    
    Computes VaR, CVaR, drawdown, volatility, and other risk metrics
    for a given portfolio of assets.
    """
    
    def __init__(
        self,
        returns: pd.DataFrame,
        weights: pd.Series,
        confidence_levels: list = [0.95, 0.99]
    ):
        """
        Args:
            returns: DataFrame of asset returns (rows=dates, cols=assets)
            weights: Series of portfolio weights (must sum to 1)
            confidence_levels: List of confidence levels for VaR/CVaR
        """
        self.returns = returns
        self.weights = weights.reindex(returns.columns).fillna(0)
        self.confidence_levels = confidence_levels
        
        # Validate weights
        if not np.isclose(self.weights.sum(), 1.0, atol=1e-3):
            raise ValueError(f"Weights must sum to 1.0, got {self.weights.sum():.4f}")
        
        # Compute portfolio returns
        self.portfolio_returns = (returns * self.weights).sum(axis=1)
        
    def compute_var_historical(self, confidence: float = 0.95) -> float:
        """
        Historical VaR: empirical quantile of return distribution.
        
        Args:
            confidence: Confidence level (e.g., 0.95 for 95%)
            
        Returns:
            VaR as a negative number (loss)
        """
        alpha = 1 - confidence
        var = np.percentile(self.portfolio_returns, alpha * 100)
        return var
        
    def compute_cvar_historical(self, confidence: float = 0.95) -> float:
        """
        Historical CVaR (Expected Shortfall): mean of returns below VaR.
        
        Args:
            confidence: Confidence level
            
        Returns:
            CVaR as a negative number (loss)
        """
        var = self.compute_var_historical(confidence)
        # CVaR is the mean of all returns worse than VaR
        cvar = self.portfolio_returns[self.portfolio_returns <= var].mean()
        return cvar
        
    def compute_var_parametric(self, confidence: float = 0.95) -> float:
        """
        Parametric VaR: assumes returns are normally distributed.
        
        Args:
            confidence: Confidence level
            
        Returns:
            VaR as a negative number
        """
        alpha = 1 - confidence
        mu = self.portfolio_returns.mean()
        sigma = self.portfolio_returns.std()
        
        # z-score for given confidence level
        z = stats.norm.ppf(alpha)
        
        var = mu + z * sigma
        return var
        
    def compute_volatility(self, annualize: bool = True) -> float:
        """
        Compute portfolio volatility.
        
        Args:
            annualize: If True, annualize using sqrt(252)
            
        Returns:
            Volatility (standard deviation of returns)
        """
        vol = self.portfolio_returns.std()
        if annualize:
            vol *= np.sqrt(252)
        return vol
        
    def compute_max_drawdown(self) -> Dict[str, float]:
        """
        Compute maximum drawdown and related metrics.
        
        Returns:
            Dictionary with max_drawdown, peak_date, trough_date
        """
        cumulative = (1 + self.portfolio_returns).cumprod()
        running_max = cumulative.expanding().max()
        drawdown = (cumulative - running_max) / running_max
        
        max_dd = drawdown.min()
        trough_date = drawdown.idxmin()
        peak_date = cumulative[:trough_date].idxmax()
        
        return {
            'max_drawdown': max_dd,
            'peak_date': peak_date,
            'trough_date': trough_date,
            'drawdown_series': drawdown
        }
        
    def compute_sharpe_ratio(self, risk_free_rate: float = 0.02) -> float:
        """
        Compute Sharpe ratio (annualized).
        
        Args:
            risk_free_rate: Annual risk-free rate (e.g., 0.02 for 2%)
            
        Returns:
            Sharpe ratio
        """
        excess_return = self.portfolio_returns.mean() * 252 - risk_free_rate
        volatility = self.portfolio_returns.std() * np.sqrt(252)
        
        if volatility == 0:
            return 0.0
        
        return excess_return / volatility
        
    def get_worst_days(self, n: int = 10) -> pd.DataFrame:
        """
        Get the N worst return days.
        
        Args:
            n: Number of worst days to return
            
        Returns:
            DataFrame with date and return for worst days
        """
        worst = self.portfolio_returns.nsmallest(n)
        return pd.DataFrame({
            'Date': worst.index,
            'Return (%)': worst.values * 100
        })
        
    def get_rolling_volatility(
        self,
        windows: list = [30, 60, 90],
        annualize: bool = True
    ) -> pd.DataFrame:
        """
        Compute rolling volatility for different windows.
        
        Args:
            windows: List of window sizes in days
            annualize: If True, annualize volatility
            
        Returns:
            DataFrame with rolling volatility for each window
        """
        rolling_vols = {}
        
        for window in windows:
            vol = self.portfolio_returns.rolling(window).std()
            if annualize:
                vol *= np.sqrt(252)
            rolling_vols[f'{window}d'] = vol
            
        return pd.DataFrame(rolling_vols)
        
    def compute_marginal_var(
        self,
        confidence: float = 0.95,
        method: str = 'historical'
    ) -> pd.Series:
        """
        Compute marginal VaR: change in portfolio VaR from small position change.
        
        Args:
            confidence: Confidence level
            method: 'historical' or 'parametric'
            
        Returns:
            Series of marginal VaR for each asset
        """
        delta = 0.01  # 1% position change
        base_var = (
            self.compute_var_historical(confidence) if method == 'historical'
            else self.compute_var_parametric(confidence)
        )
        
        marginal_vars = {}
        
        for asset in self.weights.index:
            # Increase weight by delta, decrease others proportionally
            new_weights = self.weights.copy()
            new_weights[asset] += delta
            
            # Renormalize (decrease others proportionally)
            other_assets = self.weights.index != asset
            adjustment = delta * self.weights[other_assets].sum() / (1 - self.weights[asset])
            new_weights[other_assets] -= adjustment
            
            # Compute new VaR
            temp_engine = RiskEngine(self.returns, new_weights, [confidence])
            new_var = (
                temp_engine.compute_var_historical(confidence) if method == 'historical'
                else temp_engine.compute_var_parametric(confidence)
            )
            
            # Marginal VaR = (new_var - base_var) / delta
            marginal_vars[asset] = (new_var - base_var) / delta
            
        return pd.Series(marginal_vars)
        
    def generate_risk_report(self) -> Dict:
        """
        Generate comprehensive risk report with all metrics.
        
        Returns:
            Dictionary with all risk metrics
        """
        report = {
            'summary': {
                'start_date': self.returns.index[0].strftime('%Y-%m-%d'),
                'end_date': self.returns.index[-1].strftime('%Y-%m-%d'),
                'n_days': len(self.returns),
                'n_assets': len(self.weights[self.weights > 0])
            },
            'weights': self.weights[self.weights > 0].to_dict(),
            'var_cvar': {},
            'volatility': {
                'daily': self.compute_volatility(annualize=False),
                'annual': self.compute_volatility(annualize=True)
            },
            'performance': {
                'total_return': (1 + self.portfolio_returns).prod() - 1,
                'sharpe_ratio': self.compute_sharpe_ratio(),
                'mean_return_daily': self.portfolio_returns.mean(),
                'mean_return_annual': self.portfolio_returns.mean() * 252
            }
        }
        
        # VaR and CVaR for each confidence level
        for conf in self.confidence_levels:
            var_hist = self.compute_var_historical(conf)
            cvar_hist = self.compute_cvar_historical(conf)
            var_param = self.compute_var_parametric(conf)
            
            report['var_cvar'][f'{int(conf*100)}%'] = {
                'var_historical': var_hist,
                'cvar_historical': cvar_hist,
                'var_parametric': var_param
            }
        
        # Drawdown metrics
        dd_metrics = self.compute_max_drawdown()
        report['drawdown'] = {
            'max_drawdown': dd_metrics['max_drawdown'],
            'peak_date': dd_metrics['peak_date'].strftime('%Y-%m-%d'),
            'trough_date': dd_metrics['trough_date'].strftime('%Y-%m-%d')
        }
        
        # Worst days
        worst_days = self.get_worst_days(10)
        report['worst_days'] = worst_days.to_dict('records')
        
        return report
        
    def compute_component_var(
        self,
        confidence: float = 0.95
    ) -> pd.Series:
        """
        Decompose portfolio VaR into asset contributions.
        
        Returns:
            Series of VaR contributions by asset
        """
        # Covariance matrix
        cov = self.returns.cov().values
        
        # Portfolio variance
        port_var = self.weights.values @ cov @ self.weights.values
        port_vol = np.sqrt(port_var)
        
        # Marginal contribution to portfolio variance
        marginal_contrib = cov @ self.weights.values
        
        # Component contributions
        contrib = self.weights.values * marginal_contrib / port_vol
        
        # Scale by VaR multiplier (z-score)
        alpha = 1 - confidence
        z = stats.norm.ppf(alpha)
        
        var_contrib = contrib * abs(z)
        
        return pd.Series(var_contrib, index=self.weights.index)
