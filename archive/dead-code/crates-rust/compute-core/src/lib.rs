mod risk;
mod options;
mod monte_carlo;

use wasm_bindgen::prelude::*;
use ndarray::{Array1, Array2};
pub use risk::{RiskCalculator, RiskMetrics, RiskParityOptimizer};
pub use options::{OptionEngine, OptionType, Greeks};
pub use monte_carlo::{MonteCarloEngine, MonteCarloParams, SimulationResult};

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
pub struct WasmRiskCalculator {
    inner: RiskCalculator,
}

#[wasm_bindgen]
pub struct WasmRiskMetrics {
    pub var_95: f64,
    pub var_99: f64,
    pub cvar_95: f64,
    pub cvar_99: f64,
    pub volatility: f64,
    pub max_drawdown: f64,
    pub sharpe_ratio: f64,
}

#[wasm_bindgen]
impl WasmRiskCalculator {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: RiskCalculator::new()
        }
    }

    /// Compute risk metrics for a set of returns and weights.
    /// `returns` should be a flattened array of size T * N (row-major).
    /// `weights` should be an array of size N.
    /// `n_assets` is N.
    pub fn compute_metrics(
        &self,
        returns: &[f64],
        weights: &[f64],
        n_assets: usize,
    ) -> Result<WasmRiskMetrics, JsValue> {
        let n_days = returns.len() / n_assets;
        
        let returns_array = Array2::from_shape_vec((n_days, n_assets), returns.to_vec())
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
            
        let weights_array = Array1::from_vec(weights.to_vec());
        
        let metrics = self.inner.compute(&returns_array, &weights_array)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
            
        Ok(WasmRiskMetrics {
            var_95: metrics.var_95,
            var_99: metrics.var_99,
            cvar_95: metrics.cvar_95,
            cvar_99: metrics.cvar_99,
            volatility: metrics.volatility,
            max_drawdown: metrics.max_drawdown,
            sharpe_ratio: metrics.sharpe_ratio,
        })
    }
}

#[wasm_bindgen]
pub struct WasmOptionEngine;

#[wasm_bindgen]
pub struct WasmGreeks {
    pub delta: f64,
    pub gamma: f64,
    pub theta: f64,
    pub vega: f64,
    pub rho: f64,
    pub price: f64,
}

#[wasm_bindgen]
pub enum WasmOptionType {
    Call,
    Put,
}

impl From<WasmOptionType> for OptionType {
    fn from(val: WasmOptionType) -> Self {
        match val {
            WasmOptionType::Call => OptionType::Call,
            WasmOptionType::Put => OptionType::Put,
        }
    }
}

#[wasm_bindgen]
impl WasmOptionEngine {
    pub fn calculate(
        s: f64,
        k: f64,
        t: f64,
        r: f64,
        sigma: f64,
        option_type: WasmOptionType,
    ) -> WasmGreeks {
        let greeks = OptionEngine::calculate(s, k, t, r, sigma, option_type.into());
        WasmGreeks {
            delta: greeks.delta,
            gamma: greeks.gamma,
            theta: greeks.theta,
            vega: greeks.vega,
            rho: greeks.rho,
            price: greeks.price,
        }
    }
}

#[wasm_bindgen]
pub struct WasmMonteCarloEngine;

#[wasm_bindgen]
pub struct WasmSimulationResult {
    pub var: f64,
    pub cvar: f64,
    pub median: f64,
}

#[wasm_bindgen]
impl WasmMonteCarloEngine {
    pub fn run(
        initial_value: f64,
        mean_daily_return: f64,
        daily_volatility: f64,
        num_simulations: usize,
        time_horizon: usize,
        confidence_level: f64,
    ) -> Result<WasmSimulationResult, JsValue> {
        let params = MonteCarloParams {
            num_simulations,
            time_horizon,
            confidence_level,
        };
        
        match MonteCarloEngine::run(initial_value, mean_daily_return, daily_volatility, &params) {
            Ok(result) => Ok(WasmSimulationResult {
                var: result.var,
                cvar: result.cvar,
                median: result.median,
            }),
            Err(e) => Err(JsValue::from_str(&e.to_string())),
        }
    }
}
