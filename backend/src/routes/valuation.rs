use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::services::mock_valuations::{
    compare_valuations, get_all_mock_valuations, get_mock_valuation, screen_valuations,
    MockValuation,
};
use crate::state::AppState;
use crate::valuation::cyclical::{CyclicalValuation, CyclicalValuationEngine};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/:ticker", get(get_valuation))
        .route("/compare", get(compare))
        .route("/screener", get(screener))
        .route("/cyclical/:ticker", get(get_cyclical_valuation))
        .route(
            "/cyclical/:ticker/compute",
            post(compute_cyclical_valuation),
        )
}

#[derive(Deserialize)]
pub struct ScreenerQuery {
    sector: Option<String>,
    min_upside: Option<f64>,
    max_pe: Option<f64>,
    rating: Option<String>,
}

#[derive(Deserialize)]
pub struct CompareQuery {
    tickers: String, // comma-separated
}

/// GET /api/valuation/:ticker
/// Get valuation metrics for any ticker with mock fallback
async fn get_valuation(
    State(state): State<Arc<AppState>>,
    Path(ticker): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let ticker_upper = ticker.to_uppercase();

    // First try database for real cyclical valuation
    if let Ok(Some(valuation)) = sqlx::query_as::<_, CyclicalValuation>(
        r#"
        SELECT * FROM cyclical_valuations
        WHERE ticker = $1
        ORDER BY as_of_date DESC
        LIMIT 1
        "#,
    )
    .bind(&ticker_upper)
    .fetch_optional(&state.db)
    .await
    {
        // Convert to unified response format
        return Ok(Json(ValuationResponse {
            ticker: ticker_upper.clone(),
            name: ticker_upper.clone(),
            sector: "Semiconductors".to_string(),
            current_price: valuation.current_price,
            fair_value: valuation.fair_value_base,
            pe_ratio: 0.0,
            forward_pe: 0.0,
            ps_ratio: 0.0,
            pb_ratio: 0.0,
            peg_ratio: 0.0,
            dividend_yield: 0.0,
            revenue_growth: 0.0,
            earnings_growth: 0.0,
            upside_pct: valuation.upside_downside_pct,
            rating: if valuation.upside_downside_pct > 20.0 {
                "Strong Buy"
            } else if valuation.upside_downside_pct > 10.0 {
                "Buy"
            } else if valuation.upside_downside_pct > -10.0 {
                "Hold"
            } else {
                "Sell"
            }
            .to_string(),
            cycle_position: valuation.current_cycle_position,
            source: "cyclical_valuation".to_string(),
        }));
    }

    // Fallback to mock data
    if let Some(mock) = get_mock_valuation(&ticker_upper) {
        return Ok(Json(ValuationResponse {
            ticker: mock.ticker,
            name: mock.name,
            sector: mock.sector,
            current_price: mock.current_price,
            fair_value: mock.fair_value,
            pe_ratio: mock.pe_ratio,
            forward_pe: mock.forward_pe,
            ps_ratio: mock.ps_ratio,
            pb_ratio: mock.pb_ratio,
            peg_ratio: mock.peg_ratio,
            dividend_yield: mock.dividend_yield,
            revenue_growth: mock.revenue_growth,
            earnings_growth: mock.earnings_growth,
            upside_pct: mock.upside_pct,
            rating: mock.rating,
            cycle_position: mock.cycle_position,
            source: "mock_valuation".to_string(),
        }));
    }

    Err((
        StatusCode::NOT_FOUND,
        format!("No valuation data for {}", ticker),
    ))
}

#[derive(Serialize)]
struct ValuationResponse {
    ticker: String,
    name: String,
    sector: String,
    current_price: f64,
    fair_value: f64,
    pe_ratio: f64,
    forward_pe: f64,
    ps_ratio: f64,
    pb_ratio: f64,
    peg_ratio: f64,
    dividend_yield: f64,
    revenue_growth: f64,
    earnings_growth: f64,
    upside_pct: f64,
    rating: String,
    cycle_position: String,
    source: String,
}

/// GET /api/valuation/compare?tickers=NVDA,AMD,INTC
async fn compare(Query(params): Query<CompareQuery>) -> impl IntoResponse {
    let tickers: Vec<String> = params
        .tickers
        .split(',')
        .map(|s| s.trim().to_uppercase())
        .collect();

    let valuations = compare_valuations(&tickers);
    Json(valuations)
}

/// GET /api/valuation/screener?sector=tech&min_upside=10&max_pe=30
async fn screener(Query(params): Query<ScreenerQuery>) -> impl IntoResponse {
    let valuations = screen_valuations(
        params.sector.as_deref(),
        params.min_upside,
        params.max_pe,
        params.rating.as_deref(),
    );
    Json(valuations)
}

/// GET /api/valuation/cyclical/:ticker
/// Get latest cyclical valuation for a ticker
async fn get_cyclical_valuation(
    State(state): State<Arc<AppState>>,
    Path(ticker): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let valuation = sqlx::query_as::<_, CyclicalValuation>(
        r#"
        SELECT * FROM cyclical_valuations
        WHERE ticker = $1
        ORDER BY as_of_date DESC
        LIMIT 1
        "#,
    )
    .bind(ticker.to_uppercase())
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    match valuation {
        Some(v) => Ok(Json(v)),
        None => Err((
            StatusCode::NOT_FOUND,
            format!("No cyclical valuation found for {}", ticker),
        )),
    }
}

/// POST /api/valuation/cyclical/:ticker/compute
/// Compute cyclical valuation for a ticker
async fn compute_cyclical_valuation(
    State(state): State<Arc<AppState>>,
    Path(ticker): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Get current price from mock data
    let current_price = get_mock_valuation(&ticker.to_uppercase())
        .map(|m| m.current_price)
        .unwrap_or(500.0);

    let engine = CyclicalValuationEngine::new(state.db.clone());

    // Compute valuation
    let valuation = engine
        .value_ticker(&ticker.to_uppercase(), current_price)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Store result
    let id = engine
        .store_valuation(&valuation)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    #[derive(Serialize)]
    struct ComputeResponse {
        ticker: String,
        valuation_id: i32,
        fair_value: f64,
        current_price: f64,
        upside_downside_pct: f64,
        cycle_position: String,
        message: String,
    }

    Ok(Json(ComputeResponse {
        ticker: ticker.to_uppercase(),
        valuation_id: id,
        fair_value: valuation.fair_value_base,
        current_price: valuation.current_price,
        upside_downside_pct: valuation.upside_downside_pct,
        cycle_position: valuation.current_cycle_position.clone(),
        message: format!(
            "Cyclical valuation complete. Fair value: ${:.2}, Current: ${:.2} ({:+.1}%)",
            valuation.fair_value_base, valuation.current_price, valuation.upside_downside_pct
        ),
    }))
}
