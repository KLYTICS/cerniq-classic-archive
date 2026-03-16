use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::services::sec_filings::{FinancialMetrics, SecFiling, SecFilingService};
use crate::state::AppState;

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/:ticker", get(get_filings))
        .route("/:ticker/process", post(process_ticker))
        .route("/metrics/:ticker", get(get_metrics))
}

#[derive(Debug, Deserialize)]
struct FilingQueryParams {
    form_type: Option<String>, // 10-K or 10-Q
    limit: Option<usize>,
}

/// GET /api/filings/:ticker?form_type=10-K&limit=5
async fn get_filings(
    State(state): State<Arc<AppState>>,
    Path(ticker): Path<String>,
    Query(params): Query<FilingQueryParams>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let form_types = if let Some(form) = params.form_type {
        vec![form]
    } else {
        vec!["10-K".to_string(), "10-Q".to_string()]
    };

    let limit = params.limit.unwrap_or(10);

    // Query database for stored filings
    let filings = sqlx::query_as::<_, SecFiling>(
        r#"
        SELECT * FROM sec_filings
        WHERE ticker = $1 AND form_type = ANY($2)
        ORDER BY filing_date DESC
        LIMIT $3
        "#,
    )
    .bind(ticker.to_uppercase())
    .bind(&form_types)
    .bind(limit as i64)
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(filings))
}

/// POST /api/filings/:ticker/process
/// Trigger processing of SEC filings for a ticker
async fn process_ticker(
    State(state): State<Arc<AppState>>,
    Path(ticker): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let user_agent = format!(
        "CERNIQ/1.0 ({})",
        state.config.jwt_secret.chars().take(10).collect::<String>()
    );

    let service = SecFilingService::new(state.db.clone(), user_agent);

    let processed = service
        .process_ticker(&ticker.to_uppercase())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    #[derive(Serialize)]
    struct ProcessResponse {
        ticker: String,
        filings_processed: usize,
        message: String,
    }

    Ok(Json(ProcessResponse {
        ticker: ticker.to_uppercase(),
        filings_processed: processed,
        message: format!("Successfully processed {} filings", processed),
    }))
}

/// GET /api/filings/metrics/:ticker
/// Get financial metrics for a ticker
async fn get_metrics(
    State(state): State<Arc<AppState>>,
    Path(ticker): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let metrics = sqlx::query_as::<_, FinancialMetrics>(
        r#"
        SELECT * FROM financial_metrics
        WHERE ticker = $1
        ORDER BY period_end DESC
        LIMIT 20
        "#,
    )
    .bind(ticker.to_uppercase())
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(metrics))
}
