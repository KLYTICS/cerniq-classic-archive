//! Capex Cycle OS - High-Performance Risk Computation
//! 
//! This crate provides optimized risk calculations (VaR, CVaR, portfolio optimization)
//! that are 10-100x faster than pure Python/JavaScript implementations.

use ndarray::{Array1, Array2, Axis};
use ndarray_stats::QuantileExt;
use std::error::Error;

/// Portfolio risk metrics
#[derive(Debug, Clone)]
pub struct RiskMetrics {
    /// Value at Risk (negative number representing loss)
    pub var_95: f64,
    pub var_99: f64,
    
    /// Conditional Value at Risk (Expected Shortfall)
    pub cvar_95: f64,
    pub cvar_99: f64,
    
    /// Portfolio volatility (annualized)
    pub volatility: f64,
    
    /// Maximum drawdown
    pub max_drawdown: f64,
    
    /// Sharpe ratio
    pub sharpe_ratio: f64,
    
    /// Risk contributions per asset
    pub risk_contributions: Vec<f64>,
}

/// Risk calculator with high-performance implementations
pub struct RiskCalculator {
    /// Annualization factor (252 trading days)
    annual_factor: f64,
}

impl RiskCalculator {
    pub fn new() -> Self {
        Self {
            annual_factor: 252.0,
        }
    }
    
    /// Compute comprehensive risk metrics for a portfolio
    /// 
    /// # Arguments
    /// * `returns` - T×N matrix of returns (T days, N assets)
    /// * `weights` - N-vector of portfolio weights (must sum to 1.0)
    /// 
    /// # Returns
    /// RiskMetrics struct with all computed metrics
    pub fn compute(
        &self,
        returns: &Array2<f64>,
        weights: &Array1<f64>,
    ) -> Result<RiskMetrics, Box<dyn Error>> {
        // Validate inputs
        if returns.ncols() != weights.len() {
            return Err("Returns columns must match weights length".into());
        }
        
        let weight_sum: f64 = weights.sum();
        if (weight_sum - 1.0).abs() > 1e-6 {
            return Err(format!("Weights must sum to 1.0, got {}", weight_sum).into());
        }
        
        // Compute portfolio returns
        let port_returns = returns.dot(weights);
        
        // VaR calculations
        let var_95 = self.historical_var(&port_returns, 0.95);
        let var_99 = self.historical_var(&port_returns, 0.99);
        
        // CVaR calculations
        let cvar_95 = self.historical_cvar(&port_returns, 0.95);
        let cvar_99 = self.historical_cvar(&port_returns, 0.99);
        
        // Volatility
        let volatility = self.compute_volatility(&port_returns);
        
        // Maximum drawdown
        let max_drawdown = self.compute_max_drawdown(&port_returns);
        
        // Sharpe ratio (assuming 4% risk-free rate)
        let sharpe_ratio = self.compute_sharpe(&port_returns, 0.04);
        
        // Risk contributions
        let risk_contributions = self.compute_risk_contributions(returns, weights);
        
        Ok(RiskMetrics {
            var_95,
            var_99,
            cvar_95,
            cvar_99,
            volatility,
            max_drawdown,
            sharpe_ratio,
            risk_contributions,
        })
    }
    
    /// Historical VaR: empirical quantile of return distribution
    fn historical_var(&self, returns: &Array1<f64>, confidence: f64) -> f64 {
        let alpha = 1.0 - confidence;
        
        // Sort returns
        let mut sorted = returns.to_vec();
        sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());
        
        // Get quantile
        let idx = (alpha * sorted.len() as f64) as usize;
        sorted[idx.min(sorted.len() - 1)]
    }
    
    /// Historical CVaR: mean of returns worse than VaR
    fn historical_cvar(&self, returns: &Array1<f64>, confidence: f64) -> f64 {
        let var = self.historical_var(returns, confidence);
        
        // Mean of all returns <= VaR
        let tail_returns: Vec<f64> = returns.iter()
            .filter(|&&r| r <= var)
            .copied()
            .collect();
        
        if tail_returns.is_empty() {
            return var;
        }
        
        tail_returns.iter().sum::<f64>() / tail_returns.len() as f64
    }
    
    /// Compute annualized volatility
    fn compute_volatility(&self, returns: &Array1<f64>) -> f64 {
        let mean = returns.mean().unwrap();
        let variance = returns.iter()
            .map(|&r| (r - mean).powi(2))
            .sum::<f64>() / (returns.len() - 1) as f64;
        
        variance.sqrt() * self.annual_factor.sqrt()
    }
    
    /// Compute maximum drawdown
    fn compute_max_drawdown(&self, returns: &Array1<f64>) -> f64 {
        let mut cumulative: f64 = 1.0;
        let mut running_max: f64 = 1.0;
        let mut max_dd: f64 = 0.0;
        
        for &ret in returns.iter() {
            cumulative *= 1.0 + ret;
            running_max = running_max.max(cumulative);
            let drawdown = (cumulative - running_max) / running_max;
            max_dd = max_dd.min(drawdown);
        }
        
        max_dd
    }
    
    /// Compute Sharpe ratio
    fn compute_sharpe(&self, returns: &Array1<f64>, risk_free_rate: f64) -> f64 {
        let mean_return = returns.mean().unwrap() * self.annual_factor;
        let volatility = self.compute_volatility(returns);
        
        if volatility == 0.0 {
            return 0.0;
        }
        
        (mean_return - risk_free_rate) / volatility
    }
    
    /// Compute risk contributions (component VaR)
    fn compute_risk_contributions(
        &self,
        returns: &Array2<f64>,
        weights: &Array1<f64>,
    ) -> Vec<f64> {
        // Covariance matrix
        let cov = Self::covariance_matrix(returns);
        
        // Portfolio variance
        let port_var = weights.dot(&cov.dot(weights));
        let port_vol = port_var.sqrt();
        
        if port_vol == 0.0 {
            return vec![0.0; weights.len()];
        }
        
        // Marginal contributions: (Σw)_i
        let marginal = cov.dot(weights);
        
        // Component contributions: w_i * (Σw)_i / σ_p
        weights.iter()
            .zip(marginal.iter())
            .map(|(&w, &m)| w * m / port_vol)
            .collect()
    }
    
    /// Compute covariance matrix from returns
    fn covariance_matrix(returns: &Array2<f64>) -> Array2<f64> {
        let _n_assets = returns.ncols();
        let n_days = returns.nrows();
        
        // Center returns
        let means = returns.mean_axis(Axis(0)).unwrap();
        let centered = returns - &means;
        
        // Covariance = (X^T × X) / (n - 1)
        let cov = centered.t().dot(&centered) / (n_days - 1) as f64;
        
        cov
    }
}

/// Risk parity optimizer
pub struct RiskParityOptimizer;

impl RiskParityOptimizer {
    /// Solve for risk parity weights (equal risk contribution)
    /// 
    /// Uses iterative algorithm:
    /// 1. Start with equal weights
    /// 2. Adjust each weight to equalize risk contribution
    /// 3. Renormalize to sum to 1
    /// 4. Repeat until convergence
    pub fn optimize(returns: &Array2<f64>, max_iter: usize) -> Array1<f64> {
        let n_assets = returns.ncols();
        let mut weights = Array1::from_elem(n_assets, 1.0 / n_assets as f64);
        
        let calculator = RiskCalculator::new();
        
        for _iter in 0..max_iter {
            let risk_contrib = calculator.compute_risk_contributions(returns, &weights);
            
            // Target: equal risk contribution
            let target = risk_contrib.iter().sum::<f64>() / n_assets as f64;
            
            // Adjust weights
            for i in 0..n_assets {
                if risk_contrib[i] > 0.0 {
                    let adjustment = target / risk_contrib[i];
                    weights[i] *= adjustment.sqrt();
                }
            }
            
            // Renormalize
            let sum = weights.sum();
            weights /= sum;
            
            // Check convergence
            let max_deviation = risk_contrib.iter()
                .map(|&rc| (rc - target).abs() / target)
                .fold(0.0f64, f64::max);
            
            if max_deviation < 0.01 {
                break;
            }
        }
        
        weights
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ndarray::arr1;
    
    #[test]
    fn test_var_calculation() {
        let returns = arr1(&[-0.02, -0.01, 0.0, 0.01, 0.02, 0.03]);
        let calculator = RiskCalculator::new();
        
        let var_95 = calculator.historical_var(&returns, 0.95);
        assert!(var_95 < 0.0, "VaR should be negative (loss)");
    }
    
    #[test]
    fn test_risk_parity() {
        // Simple 2-asset example
        let returns = Array2::from_shape_vec(
            (100, 2),
            (0..200).map(|i| if i % 2 == 0 { 0.01 } else { -0.01 }).collect()
        ).unwrap();
        
        let weights = RiskParityOptimizer::optimize(&returns, 100);
        
        // Weights should sum to 1
        assert!((weights.sum() - 1.0).abs() < 1e-6);
        
        // Weights should be positive
        assert!(weights.iter().all(|&w| w > 0.0));
    }
}
