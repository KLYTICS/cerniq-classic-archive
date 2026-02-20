use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: String,
    pub asset_type: Option<String>,
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TickerInfo {
    pub ticker: String,
    pub name: String,
    pub sector: Option<String>,
    pub industry: Option<String>,
    pub asset_type: String,
    pub exchange: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SearchResponse {
    pub results: Vec<TickerInfo>,
    pub total: usize,
}

/// Search for tickers by symbol or name
pub async fn search_tickers(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SearchQuery>,
) -> Result<Json<SearchResponse>, (StatusCode, String)> {
    let search_term = format!("%{}%", params.q.to_uppercase());
    let limit = params.limit.unwrap_or(20).min(100);

    let mut query = sqlx::QueryBuilder::new(
        "SELECT ticker, name, sector, industry, asset_type, exchange 
         FROM tickers 
         WHERE is_active = true AND ("
    );

    query.push("ticker LIKE ");
    query.push_bind(&search_term);
    query.push(" OR UPPER(name) LIKE ");
    query.push_bind(&search_term);
    query.push(")");

    if let Some(asset_type) = params.asset_type {
        query.push(" AND asset_type = ");
        query.push_bind(asset_type);
    }

    query.push(" ORDER BY 
        CASE 
            WHEN ticker = ");
    query.push_bind(params.q.to_uppercase());
    query.push(" THEN 1 
            WHEN ticker LIKE ");
    query.push_bind(format!("{}%", params.q.to_uppercase()));
    query.push(" THEN 2 
            ELSE 3 
        END,
        ticker 
        LIMIT ");
    query.push_bind(limit);

    let results = query
        .build_query_as::<TickerInfo>()
        .fetch_all(&state.db)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Database error: {}", e),
            )
        })?;

    let total = results.len();

    Ok(Json(SearchResponse { results, total }))
}

/// Get detailed info for a specific ticker
pub async fn get_ticker_info(
    State(state): State<Arc<AppState>>,
    Path(ticker): Path<String>,
) -> Result<Json<TickerInfo>, (StatusCode, String)> {
    let info = sqlx::query_as::<_, TickerInfo>(
        "SELECT ticker, name, sector, industry, asset_type, exchange 
         FROM tickers 
         WHERE ticker = $1 AND is_active = true"
    )
    .bind(ticker.to_uppercase())
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?
    .ok_or((
        StatusCode::NOT_FOUND,
        "Ticker not found".to_string(),
    ))?;

    Ok(Json(info))
}

/// Get current price for a ticker
pub async fn get_ticker_price(
    State(state): State<Arc<AppState>>,
    Path(ticker): Path<String>,
) -> Result<Json<crate::services::yahoo_finance::TickerPrice>, (StatusCode, String)> {
    use crate::services::yahoo_finance::YahooFinanceClient;

    let client = YahooFinanceClient::new(state.db.clone());
    
    let price = client
        .get_current_price(&ticker)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to fetch price: {}", e),
            )
        })?;

    Ok(Json(price))
}

/// List popular/trending tickers
pub async fn get_popular_tickers(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<TickerInfo>>, (StatusCode, String)> {
    let tickers = sqlx::query_as::<_, TickerInfo>(
        "SELECT ticker, name, sector, industry, asset_type, exchange 
         FROM tickers 
         WHERE is_active = true 
         ORDER BY 
            CASE asset_type 
                WHEN 'stock' THEN 1 
                WHEN 'etf' THEN 2 
                WHEN 'crypto' THEN 3 
                ELSE 4 
            END,
            ticker 
         LIMIT 50"
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    Ok(Json(tickers))
}
