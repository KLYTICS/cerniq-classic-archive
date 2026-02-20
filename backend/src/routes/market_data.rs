use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::services::market_data::MarketDataService;
use crate::state::AppState;

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/:ticker", get(get_ticker_prices))
        .route("/batch", get(get_batch_prices))
}

#[derive(Debug, Deserialize)]
struct PriceQueryParams {
    start: Option<String>,  // YYYY-MM-DD
    end: Option<String>,    // YYYY-MM-DD
}

#[derive(Debug, Deserialize)]
struct BatchQueryParams {
    tickers: String,  // Comma-separated tickers
    start: Option<String>,
    end: Option<String>,
}

#[derive(Debug, Serialize)]
struct PriceResponse {
    ticker: String,
    data: Vec<PriceDataPoint>,
}

#[derive(Debug, Serialize)]
struct PriceDataPoint {
    date: String,
    open: f64,
    high: f64,
    low: f64,
    close: f64,
    adj_close: f64,
    volume: i64,
}

/// GET /api/market-data/:ticker?start=YYYY-MM-DD&end=YYYY-MM-DD
async fn get_ticker_prices(
    State(state): State<Arc<AppState>>,
    Path(ticker): Path<String>,
    Query(params): Query<PriceQueryParams>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Parse dates or use defaults
    let end_date = params.end
        .and_then(|s| NaiveDate::parse_from_str(&s, "%Y-%m-%d").ok())
        .unwrap_or_else(|| chrono::Utc::now().naive_utc().date());
    
    let start_date = params.start
        .and_then(|s| NaiveDate::parse_from_str(&s, "%Y-%m-%d").ok())
        .unwrap_or_else(|| end_date - chrono::Duration::days(365));

    // Create service
    let service = MarketDataService::new(
        state.db.clone(),
        state.redis.clone(),
        state.config.alphavantage_api_key.clone(),
    );

    // Fetch prices
    let prices = service
        .get_prices(&ticker.to_uppercase(), start_date, end_date)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Convert to response format
    let data: Vec<PriceDataPoint> = prices
        .into_iter()
        .map(|p| PriceDataPoint {
            date: p.date.to_string(),
            open: p.open,
            high: p.high,
            low: p.low,
            close: p.close,
            adj_close: p.adj_close,
            volume: p.volume,
        })
        .collect();

    Ok(Json(PriceResponse {
        ticker: ticker.to_uppercase(),
        data,
    }))
}

/// GET /api/market-data/batch?tickers=NVDA,LRCX,AMAT&start=...&end=...
async fn get_batch_prices(
    State(state): State<Arc<AppState>>,
    Query(params): Query<BatchQueryParams>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Parse tickers
    let tickers: Vec<String> = params.tickers
        .split(',')
        .map(|s| s.trim().to_uppercase())
        .collect();

    // Parse dates
    let end_date = params.end
        .and_then(|s| NaiveDate::parse_from_str(&s, "%Y-%m-%d").ok())
        .unwrap_or_else(|| chrono::Utc::now().naive_utc().date());
    
    let start_date = params.start
        .and_then(|s| NaiveDate::parse_from_str(&s, "%Y-%m-%d").ok())
        .unwrap_or_else(|| end_date - chrono::Duration::days(90));

    // Create service
    let service = MarketDataService::new(
        state.db.clone(),
        state.redis.clone(),
        state.config.alphavantage_api_key.clone(),
    );

    // Fetch batch
    let results = service.get_prices_batch(&tickers, start_date, end_date).await;

    // Convert to response
    let responses: Vec<PriceResponse> = results
        .into_iter()
        .map(|(ticker, prices)| {
            let data = prices
                .into_iter()
                .map(|p| PriceDataPoint {
                    date: p.date.to_string(),
                    open: p.open,
                    high: p.high,
                    low: p.low,
                    close: p.close,
                    adj_close: p.adj_close,
                    volume: p.volume,
                })
                .collect();
            
            PriceResponse { ticker, data }
        })
        .collect();

    Ok(Json(responses))
}
