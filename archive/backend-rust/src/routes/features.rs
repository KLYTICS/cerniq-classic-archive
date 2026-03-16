use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::Serialize;
use std::sync::Arc;

use crate::services::features::{ComputedFeatures, FeatureService};
use crate::services::market_data::MarketDataService;
use crate::state::AppState;

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/:ticker", get(get_features))
        .route("/:ticker/compute", post(compute_features))
}

/// GET /api/features/:ticker
/// Get latest computed features for a ticker
async fn get_features(
    State(state): State<Arc<AppState>>,
    Path(ticker): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let features = sqlx::query_as::<_, ComputedFeatures>(
        r#"
        SELECT * FROM computed_features
        WHERE ticker = $1
        ORDER BY as_of_date DESC
        LIMIT 1
        "#,
    )
    .bind(ticker.to_uppercase())
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    match features {
        Some(f) => Ok(Json(f)),
        None => Err((
            StatusCode::NOT_FOUND,
            format!("No features found for {}", ticker),
        )),
    }
}

/// POST /api/features/:ticker/compute
/// Trigger feature computation for a ticker
async fn compute_features(
    State(state): State<Arc<AppState>>,
    Path(ticker): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let feature_service = FeatureService::new(state.db.clone());

    let market_service = MarketDataService::new(
        state.db.clone(),
        state.redis.clone(),
        state.config.alphavantage_api_key.clone(),
    );

    // Compute features
    let features = feature_service
        .compute_features(&ticker.to_uppercase(), &market_service)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Store in database
    let id = feature_service
        .store_features(&features)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    #[derive(Serialize)]
    struct ComputeResponse {
        ticker: String,
        feature_id: i32,
        as_of_date: String,
        message: String,
    }

    Ok(Json(ComputeResponse {
        ticker: ticker.to_uppercase(),
        feature_id: id,
        as_of_date: features.as_of_date.to_string(),
        message: "Features computed successfully".to_string(),
    }))
}
