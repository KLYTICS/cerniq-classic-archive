use rand::rng;
use rand_distr::{Distribution, Normal};
use std::error::Error;

/// Monte Carlo Simulation Parameters
#[derive(Debug, Clone)]
pub struct MonteCarloParams {
    /// Number of simulations to run
    pub num_simulations: usize,
    /// Time horizon in days
    pub time_horizon: usize,
    /// Confidence level (e.g., 0.95)
    pub confidence_level: f64,
}

/// Simulation Result
#[derive(Debug, Clone)]
pub struct SimulationResult {
    /// Simulated portfolio values at horizon (num_simulations)
    pub final_values: Vec<f64>,
    /// Value at Risk (Monte Carlo)
    pub var: f64,
    /// Expected Shortfall (Monte Carlo)
    pub cvar: f64,
    /// Worst case scenario
    pub worst_case: f64,
    /// Best case scenario
    pub best_case: f64,
    /// Median outcome
    pub median: f64,
}

pub struct MonteCarloEngine;

impl MonteCarloEngine {
    /// Run Monte Carlo simulation for a portfolio
    /// Uses Geometric Brownian Motion (GBM)
    pub fn run(
        initial_value: f64,
        mean_daily_return: f64,
        daily_volatility: f64,
        params: &MonteCarloParams,
    ) -> Result<SimulationResult, Box<dyn Error>> {
        let mut rng = rng();
        let normal = Normal::new(0.0, 1.0)?;
        
        let mut final_values = Vec::with_capacity(params.num_simulations);
        let dt = 1.0; // Daily steps
        
        // Drift component: (mu - 0.5 * sigma^2) * dt
        let drift = (mean_daily_return - 0.5 * daily_volatility.powi(2)) * dt;
        // Diffusion component: sigma * sqrt(dt)
        let diffusion = daily_volatility * dt.sqrt();
        
        for _ in 0..params.num_simulations {
            // We can jump directly to horizon if parameters are constant (sum of log returns)
            // But usually we might want path dependence. 
            // For simple GBM, log_ret ~ N((mu - 0.5*sigma^2)*T, sigma*sqrt(T))
            
            let drift_t = drift * params.time_horizon as f64;
            let diffusion_t = diffusion * (params.time_horizon as f64).sqrt();
            let z = normal.sample(&mut rng);
            
            let log_return = drift_t + diffusion_t * z;
            let final_value = initial_value * log_return.exp();
            
            final_values.push(final_value);
        }
        
        final_values.sort_by(|a, b| a.partial_cmp(b).unwrap());
        
        let idx_alpha = ((1.0 - params.confidence_level) * params.num_simulations as f64) as usize;
        let worst_case = final_values[0];
        let best_case = final_values[params.num_simulations - 1];
        let median = final_values[params.num_simulations / 2];
        
        // VaR is the loss at the confidence percentile relative to initial
        let value_at_risk_level = final_values[idx_alpha];
        let var = value_at_risk_level - initial_value;
        
        // CVaR
        let tail_sum: f64 = final_values.iter().take(idx_alpha + 1).sum();
        let expected_tail_value = tail_sum / (idx_alpha + 1) as f64;
        let cvar = expected_tail_value - initial_value;
        
        Ok(SimulationResult {
            final_values,
            var,
            cvar,
            worst_case,
            best_case,
            median,
        })
    }
}
