//! Risk Analytics Routes
//! VaR/CVaR calculations, Risk Parity optimization, and Monte Carlo simulations

use axum::{
    extract::{Json, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Extension, Router,
};
use chrono::{DateTime, Utc};
use rand::Rng;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use uuid::Uuid;

use crate::error::{AppError, Result};
use crate::services::mock_valuations::get_mock_valuation;
use crate::state::AppState;

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/var", post(calculate_var))
        .route("/parity", post(calculate_risk_parity))
        .route("/monte-carlo", post(run_monte_carlo))
        .route("/reports", get(list_risk_reports))
        .route("/reports/:id", get(get_risk_report))
}

// ===== Request/Response Types =====

#[derive(Deserialize)]
pub struct VarRequest {
    symbols: Vec<String>,
    weights: Option<Vec<f64>>,
    portfolio_value: f64,
    confidence_level: Option<f64>, // 0.95 or 0.99
    time_horizon: Option<i32>,     // days
}

#[derive(Serialize)]
pub struct VarResponse {
    portfolio_value: f64,
    confidence_level: f64,
    time_horizon: i32,
    var_amount: f64,
    var_percent: f64,
    cvar_amount: f64,
    cvar_percent: f64,
    expected_return: f64,
    volatility: f64,
    sharpe_ratio: f64,
    symbols: Vec<String>,
    weights: Vec<f64>,
}

#[derive(Deserialize)]
pub struct RiskParityRequest {
    symbols: Vec<String>,
    target_volatility: Option<f64>, // e.g., 0.15 for 15%
}

#[derive(Serialize)]
pub struct RiskParityResponse {
    symbols: Vec<String>,
    optimal_weights: Vec<f64>,
    risk_contributions: Vec<f64>,
    equal_risk_contribution: f64,
    portfolio_volatility: f64,
    expected_return: f64,
    sharpe_ratio: f64,
}

#[derive(Deserialize)]
pub struct MonteCarloRequest {
    symbols: Vec<String>,
    weights: Option<Vec<f64>>,
    portfolio_value: f64,
    num_simulations: Option<i32>,
    time_horizon: Option<i32>,
}

#[derive(Serialize)]
pub struct MonteCarloResponse {
    simulations: i32,
    time_horizon: i32,
    mean_return: f64,
    std_return: f64,
    percentile_5: f64,
    percentile_25: f64,
    percentile_50: f64,
    percentile_75: f64,
    percentile_95: f64,
    worst_case: f64,
    best_case: f64,
    histogram: Vec<HistogramBin>,
}

#[derive(Serialize)]
pub struct HistogramBin {
    range_start: f64,
    range_end: f64,
    count: i32,
    percentage: f64,
}

// ===== VaR Calculation =====

/// POST /api/risk/var - Calculate Value at Risk
pub async fn calculate_var(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Json(payload): Json<VarRequest>,
) -> Result<Json<VarResponse>> {
    let confidence = payload.confidence_level.unwrap_or(0.95);
    let horizon = payload.time_horizon.unwrap_or(1);

    let n = payload.symbols.len();
    let weights = payload
        .weights
        .clone()
        .unwrap_or_else(|| vec![1.0 / n as f64; n]);

    // Get mock volatilities and expected returns
    let mut volatilities = Vec::new();
    let mut returns = Vec::new();

    for symbol in &payload.symbols {
        if let Some(mock) = get_mock_valuation(symbol) {
            // Estimate volatility from sector and P/E
            let vol = match mock.sector.as_str() {
                "Semiconductors" => 0.45,
                "Technology" => 0.35,
                "ETF" => 0.18,
                "Financial Services" => 0.28,
                "Healthcare" => 0.25,
                "Energy" => 0.35,
                "Consumer Cyclical" => 0.30,
                _ => 0.25,
            };
            volatilities.push(vol);
            returns.push(mock.upside_pct / 100.0 * 0.5); // Scale upside to expected return
        } else {
            volatilities.push(0.30); // Default volatility
            returns.push(0.08); // Default expected return
        }
    }

    // Calculate portfolio metrics
    let portfolio_vol = calculate_portfolio_volatility(&weights, &volatilities);
    let portfolio_return = weights
        .iter()
        .zip(returns.iter())
        .map(|(w, r)| w * r)
        .sum::<f64>();

    // VaR calculation (parametric)
    let z_score = match confidence {
        c if c >= 0.99 => 2.326,
        c if c >= 0.95 => 1.645,
        c if c >= 0.90 => 1.282,
        _ => 1.645,
    };

    let daily_vol = portfolio_vol / (252.0_f64).sqrt();
    let horizon_vol = daily_vol * (horizon as f64).sqrt();

    let var_pct = z_score * horizon_vol;
    let var_amount = payload.portfolio_value * var_pct;

    // CVaR (Expected Shortfall) - approximately 1.25x VaR for normal distribution
    let cvar_pct = var_pct * 1.25;
    let cvar_amount = payload.portfolio_value * cvar_pct;

    let sharpe = if portfolio_vol > 0.0 {
        portfolio_return / portfolio_vol
    } else {
        0.0
    };

    // Store report
    sqlx::query(
        r#"
        INSERT INTO risk_reports (user_id, report_type, var_95, cvar_95, confidence_level, time_horizon, portfolio_value)
        VALUES ($1, 'var', $2, $3, $4, $5, $6)
        "#
    )
    .bind(user_id)
    .bind(var_amount)
    .bind(cvar_amount)
    .bind(confidence)
    .bind(horizon)
    .bind(payload.portfolio_value)
    .execute(&state.db)
    .await.ok(); // Ignore errors for now

    Ok(Json(VarResponse {
        portfolio_value: payload.portfolio_value,
        confidence_level: confidence,
        time_horizon: horizon,
        var_amount,
        var_percent: var_pct * 100.0,
        cvar_amount,
        cvar_percent: cvar_pct * 100.0,
        expected_return: portfolio_return * 100.0,
        volatility: portfolio_vol * 100.0,
        sharpe_ratio: sharpe,
        symbols: payload.symbols,
        weights,
    }))
}

// ===== Risk Parity Optimization =====

/// POST /api/risk/parity - Calculate risk parity weights
pub async fn calculate_risk_parity(
    Json(payload): Json<RiskParityRequest>,
) -> Result<Json<RiskParityResponse>> {
    let n = payload.symbols.len();
    let target_vol = payload.target_volatility.unwrap_or(0.15);

    // Get volatilities for each asset
    let mut volatilities = Vec::new();
    let mut returns = Vec::new();

    for symbol in &payload.symbols {
        if let Some(mock) = get_mock_valuation(symbol) {
            let vol = match mock.sector.as_str() {
                "Semiconductors" => 0.45,
                "Technology" => 0.35,
                "ETF" => 0.18,
                "Financial Services" => 0.28,
                "Healthcare" => 0.25,
                "Energy" => 0.35,
                _ => 0.25,
            };
            volatilities.push(vol);
            returns.push(mock.upside_pct / 100.0 * 0.5);
        } else {
            volatilities.push(0.30);
            returns.push(0.08);
        }
    }

    // Risk parity weights: inversely proportional to volatility
    let inv_vols: Vec<f64> = volatilities.iter().map(|v| 1.0 / v).collect();
    let sum_inv_vols: f64 = inv_vols.iter().sum();
    let mut optimal_weights: Vec<f64> = inv_vols.iter().map(|iv| iv / sum_inv_vols).collect();

    // Scale to target volatility
    let current_vol = calculate_portfolio_volatility(&optimal_weights, &volatilities);
    let scale = target_vol / current_vol;
    optimal_weights = optimal_weights.iter().map(|w| w * scale.min(1.0)).collect();

    // Normalize weights
    let sum_weights: f64 = optimal_weights.iter().sum();
    optimal_weights = optimal_weights.iter().map(|w| w / sum_weights).collect();

    // Calculate risk contributions
    let portfolio_vol = calculate_portfolio_volatility(&optimal_weights, &volatilities);
    let risk_contributions: Vec<f64> = optimal_weights
        .iter()
        .zip(volatilities.iter())
        .map(|(w, v)| (w * v * v) / (portfolio_vol * portfolio_vol) * 100.0)
        .collect();

    let equal_contribution = 100.0 / n as f64;

    let expected_return: f64 = optimal_weights
        .iter()
        .zip(returns.iter())
        .map(|(w, r)| w * r)
        .sum();

    let sharpe = if portfolio_vol > 0.0 {
        expected_return / portfolio_vol
    } else {
        0.0
    };

    Ok(Json(RiskParityResponse {
        symbols: payload.symbols,
        optimal_weights,
        risk_contributions,
        equal_risk_contribution: equal_contribution,
        portfolio_volatility: portfolio_vol * 100.0,
        expected_return: expected_return * 100.0,
        sharpe_ratio: sharpe,
    }))
}

// ===== Monte Carlo Simulation =====

/// POST /api/risk/monte-carlo - Run Monte Carlo simulation
pub async fn run_monte_carlo(
    Json(payload): Json<MonteCarloRequest>,
) -> Result<Json<MonteCarloResponse>> {
    let num_sims = payload.num_simulations.unwrap_or(10000).min(50000);
    let horizon = payload.time_horizon.unwrap_or(252);

    let n = payload.symbols.len();
    let weights = payload
        .weights
        .clone()
        .unwrap_or_else(|| vec![1.0 / n as f64; n]);

    // Get parameters
    let mut volatilities = Vec::new();
    let mut returns = Vec::new();

    for symbol in &payload.symbols {
        if let Some(mock) = get_mock_valuation(symbol) {
            let vol = match mock.sector.as_str() {
                "Semiconductors" => 0.45,
                "Technology" => 0.35,
                "ETF" => 0.18,
                _ => 0.25,
            };
            volatilities.push(vol);
            returns.push(mock.upside_pct / 100.0 * 0.3);
        } else {
            volatilities.push(0.30);
            returns.push(0.08);
        }
    }

    let portfolio_vol = calculate_portfolio_volatility(&weights, &volatilities);
    let portfolio_return: f64 = weights.iter().zip(returns.iter()).map(|(w, r)| w * r).sum();

    // Run simulations
    let mut rng = rand::thread_rng();
    let mut final_values: Vec<f64> = Vec::with_capacity(num_sims as usize);

    let daily_return = portfolio_return / 252.0;
    let daily_vol = portfolio_vol / (252.0_f64).sqrt();

    for _ in 0..num_sims {
        let mut value = payload.portfolio_value;
        for _ in 0..horizon {
            let random_return = daily_return + daily_vol * rng.gen::<f64>() * 2.0 - daily_vol;
            value *= 1.0 + random_return;
        }
        final_values.push(value);
    }

    final_values.sort_by(|a, b| a.partial_cmp(b).unwrap());

    let mean_val: f64 = final_values.iter().sum::<f64>() / num_sims as f64;
    let variance: f64 = final_values
        .iter()
        .map(|v| (v - mean_val).powi(2))
        .sum::<f64>()
        / num_sims as f64;
    let std_val = variance.sqrt();

    // Percentiles
    let p5 = final_values[(num_sims as f64 * 0.05) as usize];
    let p25 = final_values[(num_sims as f64 * 0.25) as usize];
    let p50 = final_values[(num_sims as f64 * 0.50) as usize];
    let p75 = final_values[(num_sims as f64 * 0.75) as usize];
    let p95 = final_values[(num_sims as f64 * 0.95) as usize];

    // Create histogram
    let min_val = *final_values.first().unwrap();
    let max_val = *final_values.last().unwrap();
    let bin_width = (max_val - min_val) / 20.0;

    let mut histogram: Vec<HistogramBin> = Vec::new();
    for i in 0..20 {
        let range_start = min_val + i as f64 * bin_width;
        let range_end = range_start + bin_width;
        let count = final_values
            .iter()
            .filter(|v| **v >= range_start && **v < range_end)
            .count() as i32;
        histogram.push(HistogramBin {
            range_start,
            range_end,
            count,
            percentage: count as f64 / num_sims as f64 * 100.0,
        });
    }

    Ok(Json(MonteCarloResponse {
        simulations: num_sims,
        time_horizon: horizon,
        mean_return: (mean_val / payload.portfolio_value - 1.0) * 100.0,
        std_return: (std_val / payload.portfolio_value) * 100.0,
        percentile_5: p5,
        percentile_25: p25,
        percentile_50: p50,
        percentile_75: p75,
        percentile_95: p95,
        worst_case: min_val,
        best_case: max_val,
        histogram,
    }))
}

// ===== Risk Reports =====

#[derive(Serialize, sqlx::FromRow)]
pub struct RiskReport {
    id: Uuid,
    user_id: Uuid,
    portfolio_id: Option<Uuid>,
    report_type: String,
    var_95: Option<f64>,
    cvar_95: Option<f64>,
    var_99: Option<f64>,
    cvar_99: Option<f64>,
    confidence_level: Option<f64>,
    time_horizon: Option<i32>,
    portfolio_value: Option<f64>,
    created_at: DateTime<Utc>,
}

/// GET /api/risk/reports - List risk reports
pub async fn list_risk_reports(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
) -> Result<Json<Vec<RiskReport>>> {
    let reports: Vec<RiskReport> = sqlx::query_as(
        r#"
        SELECT id, user_id, portfolio_id, report_type, 
               var_95::float8, cvar_95::float8, var_99::float8, cvar_99::float8,
               confidence_level::float8, time_horizon, portfolio_value::float8, created_at
        FROM risk_reports 
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 50
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(reports))
}

/// GET /api/risk/reports/:id - Get specific report
pub async fn get_risk_report(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Path(report_id): Path<Uuid>,
) -> Result<Json<RiskReport>> {
    let report: RiskReport = sqlx::query_as(
        r#"
        SELECT id, user_id, portfolio_id, report_type, 
               var_95::float8, cvar_95::float8, var_99::float8, cvar_99::float8,
               confidence_level::float8, time_horizon, portfolio_value::float8, created_at
        FROM risk_reports 
        WHERE id = $1 AND user_id = $2
        "#,
    )
    .bind(report_id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Report not found".to_string()))?;

    Ok(Json(report))
}

// ===== Helper Functions =====

fn calculate_portfolio_volatility(weights: &[f64], volatilities: &[f64]) -> f64 {
    // Simplified: assume low correlation (0.3) between assets
    let correlation = 0.3;

    let mut variance = 0.0;
    for (i, (wi, vi)) in weights.iter().zip(volatilities.iter()).enumerate() {
        // Diagonal term
        variance += wi * wi * vi * vi;

        // Off-diagonal terms
        for (j, (wj, vj)) in weights.iter().zip(volatilities.iter()).enumerate() {
            if i != j {
                variance += wi * wj * vi * vj * correlation;
            }
        }
    }

    variance.sqrt()
}
