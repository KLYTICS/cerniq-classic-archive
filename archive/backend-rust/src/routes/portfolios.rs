//! Portfolio Management Routes
//! Full CRUD for portfolios, positions, and transactions with P&L calculations

use axum::{
    extract::{Json, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, get, post, put},
    Extension, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use uuid::Uuid;

use crate::error::{AppError, Result};
use crate::services::mock_valuations::get_mock_valuation;
use crate::state::AppState;

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(list_portfolios).post(create_portfolio))
        .route(
            "/:id",
            get(get_portfolio)
                .put(update_portfolio)
                .delete(delete_portfolio),
        )
        .route("/:id/positions", get(list_positions).post(add_position))
        .route(
            "/:id/positions/:pid",
            put(update_position).delete(close_position),
        )
        .route("/:id/transactions", get(list_transactions))
        .route("/:id/performance", get(get_performance))
}

// ===== Request/Response Types =====

#[derive(Deserialize)]
pub struct CreatePortfolioRequest {
    name: String,
    description: Option<String>,
    benchmark: Option<String>,
    initial_capital: Option<f64>,
}

#[derive(Deserialize)]
pub struct UpdatePortfolioRequest {
    name: Option<String>,
    description: Option<String>,
    benchmark: Option<String>,
}

#[derive(Serialize, Clone, sqlx::FromRow)]
pub struct Portfolio {
    id: Uuid,
    user_id: Uuid,
    name: String,
    description: Option<String>,
    benchmark: Option<String>,
    initial_capital: Option<f64>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Serialize)]
pub struct PortfolioWithStats {
    #[serde(flatten)]
    portfolio: Portfolio,
    total_value: f64,
    total_cost: f64,
    total_pnl: f64,
    total_pnl_pct: f64,
    positions_count: i64,
}

#[derive(Deserialize)]
pub struct AddPositionRequest {
    symbol: String,
    quantity: f64,
    price: f64,
    notes: Option<String>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct Position {
    id: Uuid,
    portfolio_id: Uuid,
    symbol: String,
    quantity: f64,
    avg_cost: f64,
    current_price: Option<f64>,
    opened_at: DateTime<Utc>,
    closed_at: Option<DateTime<Utc>>,
}

#[derive(Serialize)]
pub struct PositionWithPnL {
    #[serde(flatten)]
    position: Position,
    market_value: f64,
    cost_basis: f64,
    unrealized_pnl: f64,
    unrealized_pnl_pct: f64,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct Transaction {
    id: Uuid,
    portfolio_id: Uuid,
    position_id: Option<Uuid>,
    symbol: String,
    action: String,
    quantity: f64,
    price: f64,
    fees: Option<f64>,
    notes: Option<String>,
    executed_at: DateTime<Utc>,
}

#[derive(Serialize)]
pub struct PerformanceStats {
    portfolio_id: Uuid,
    total_value: f64,
    total_cost: f64,
    total_pnl: f64,
    total_pnl_pct: f64,
    day_change: f64,
    day_change_pct: f64,
    positions: Vec<PositionWithPnL>,
}

// ===== Portfolio CRUD =====

/// GET /api/portfolios - List user's portfolios
pub async fn list_portfolios(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
) -> Result<Json<Vec<PortfolioWithStats>>> {
    let portfolios: Vec<Portfolio> =
        sqlx::query_as("SELECT * FROM portfolios WHERE user_id = $1 ORDER BY created_at DESC")
            .bind(user_id)
            .fetch_all(&state.db)
            .await?;

    let mut result = Vec::new();
    for portfolio in portfolios {
        let stats = calculate_portfolio_stats(&state, &portfolio).await?;
        result.push(stats);
    }

    Ok(Json(result))
}

/// POST /api/portfolios - Create a new portfolio
pub async fn create_portfolio(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Json(payload): Json<CreatePortfolioRequest>,
) -> Result<Json<Portfolio>> {
    let portfolio: Portfolio = sqlx::query_as(
        r#"
        INSERT INTO portfolios (user_id, name, description, benchmark, initial_capital)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        "#,
    )
    .bind(user_id)
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(payload.benchmark.as_deref().unwrap_or("SPY"))
    .bind(payload.initial_capital.unwrap_or(0.0))
    .fetch_one(&state.db)
    .await?;

    Ok(Json(portfolio))
}

/// GET /api/portfolios/:id - Get portfolio with stats
pub async fn get_portfolio(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Path(portfolio_id): Path<Uuid>,
) -> Result<Json<PortfolioWithStats>> {
    let portfolio: Portfolio =
        sqlx::query_as("SELECT * FROM portfolios WHERE id = $1 AND user_id = $2")
            .bind(portfolio_id)
            .bind(user_id)
            .fetch_optional(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound("Portfolio not found".to_string()))?;

    let stats = calculate_portfolio_stats(&state, &portfolio).await?;
    Ok(Json(stats))
}

/// PUT /api/portfolios/:id - Update portfolio
pub async fn update_portfolio(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Path(portfolio_id): Path<Uuid>,
    Json(payload): Json<UpdatePortfolioRequest>,
) -> Result<Json<Portfolio>> {
    let portfolio: Portfolio = sqlx::query_as(
        r#"
        UPDATE portfolios SET
            name = COALESCE($1, name),
            description = COALESCE($2, description),
            benchmark = COALESCE($3, benchmark),
            updated_at = NOW()
        WHERE id = $4 AND user_id = $5
        RETURNING *
        "#,
    )
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(&payload.benchmark)
    .bind(portfolio_id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Portfolio not found".to_string()))?;

    Ok(Json(portfolio))
}

/// DELETE /api/portfolios/:id - Delete portfolio
pub async fn delete_portfolio(
    State(state): State<Arc<AppState>>,
    Extension(user_id): Extension<Uuid>,
    Path(portfolio_id): Path<Uuid>,
) -> Result<Json<Value>> {
    let result = sqlx::query("DELETE FROM portfolios WHERE id = $1 AND user_id = $2")
        .bind(portfolio_id)
        .bind(user_id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Portfolio not found".to_string()));
    }

    Ok(Json(json!({"message": "Portfolio deleted"})))
}

// ===== Position Management =====

/// GET /api/portfolios/:id/positions - List positions
pub async fn list_positions(
    State(state): State<Arc<AppState>>,
    Path(portfolio_id): Path<Uuid>,
) -> Result<Json<Vec<PositionWithPnL>>> {
    let positions: Vec<Position> = sqlx::query_as(
        r#"
        SELECT id, portfolio_id, symbol, quantity::float8, avg_cost::float8, 
               current_price::float8, opened_at, closed_at
        FROM positions 
        WHERE portfolio_id = $1 AND closed_at IS NULL
        ORDER BY symbol
        "#,
    )
    .bind(portfolio_id)
    .fetch_all(&state.db)
    .await?;

    let result: Vec<PositionWithPnL> = positions
        .into_iter()
        .map(|p| {
            let current_price = p
                .current_price
                .or_else(|| get_mock_valuation(&p.symbol).map(|m| m.current_price))
                .unwrap_or(p.avg_cost);

            let market_value = p.quantity * current_price;
            let cost_basis = p.quantity * p.avg_cost;
            let unrealized_pnl = market_value - cost_basis;
            let unrealized_pnl_pct = if cost_basis > 0.0 {
                (unrealized_pnl / cost_basis) * 100.0
            } else {
                0.0
            };

            PositionWithPnL {
                position: Position {
                    current_price: Some(current_price),
                    ..p
                },
                market_value,
                cost_basis,
                unrealized_pnl,
                unrealized_pnl_pct,
            }
        })
        .collect();

    Ok(Json(result))
}

/// POST /api/portfolios/:id/positions - Add/buy position
pub async fn add_position(
    State(state): State<Arc<AppState>>,
    Path(portfolio_id): Path<Uuid>,
    Json(payload): Json<AddPositionRequest>,
) -> Result<Json<Position>> {
    let symbol = payload.symbol.to_uppercase();

    // Check if position exists
    let existing: Option<Position> = sqlx::query_as(
        r#"
        SELECT id, portfolio_id, symbol, quantity::float8, avg_cost::float8, 
               current_price::float8, opened_at, closed_at
        FROM positions 
        WHERE portfolio_id = $1 AND symbol = $2 AND closed_at IS NULL
        "#,
    )
    .bind(portfolio_id)
    .bind(&symbol)
    .fetch_optional(&state.db)
    .await?;

    let position: Position = if let Some(existing) = existing {
        // Average up/down existing position
        let new_quantity = existing.quantity + payload.quantity;
        let new_avg_cost = ((existing.quantity * existing.avg_cost)
            + (payload.quantity * payload.price))
            / new_quantity;

        sqlx::query_as(
            r#"
            UPDATE positions SET quantity = $1, avg_cost = $2
            WHERE id = $3
            RETURNING id, portfolio_id, symbol, quantity::float8, avg_cost::float8, 
                      current_price::float8, opened_at, closed_at
            "#,
        )
        .bind(new_quantity)
        .bind(new_avg_cost)
        .bind(existing.id)
        .fetch_one(&state.db)
        .await?
    } else {
        // Create new position
        sqlx::query_as(
            r#"
            INSERT INTO positions (portfolio_id, symbol, ticker, quantity, avg_cost, current_price)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, portfolio_id, symbol, quantity::float8, avg_cost::float8, 
                      current_price::float8, opened_at, closed_at
            "#,
        )
        .bind(portfolio_id)
        .bind(&symbol)
        .bind(&symbol)
        .bind(payload.quantity)
        .bind(payload.price)
        .bind(payload.price)
        .fetch_one(&state.db)
        .await?
    };

    // Record transaction
    sqlx::query(
        r#"
        INSERT INTO transactions (portfolio_id, position_id, symbol, action, quantity, price, notes)
        VALUES ($1, $2, $3, 'buy', $4, $5, $6)
        "#,
    )
    .bind(portfolio_id)
    .bind(position.id)
    .bind(&symbol)
    .bind(payload.quantity)
    .bind(payload.price)
    .bind(&payload.notes)
    .execute(&state.db)
    .await?;

    Ok(Json(position))
}

/// PUT /api/portfolios/:id/positions/:pid - Update position (partial sell)
pub async fn update_position(
    State(state): State<Arc<AppState>>,
    Path((portfolio_id, position_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<AddPositionRequest>,
) -> Result<Json<Position>> {
    // This is a sell action - reduce quantity
    let position: Position = sqlx::query_as(
        r#"
        UPDATE positions SET quantity = quantity - $1
        WHERE id = $2 AND portfolio_id = $3
        RETURNING id, portfolio_id, symbol, quantity::float8, avg_cost::float8, 
                  current_price::float8, opened_at, closed_at
        "#,
    )
    .bind(payload.quantity)
    .bind(position_id)
    .bind(portfolio_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Position not found".to_string()))?;

    // Record sell transaction
    sqlx::query(
        r#"
        INSERT INTO transactions (portfolio_id, position_id, symbol, action, quantity, price, notes)
        VALUES ($1, $2, $3, 'sell', $4, $5, $6)
        "#,
    )
    .bind(portfolio_id)
    .bind(position_id)
    .bind(&position.symbol)
    .bind(payload.quantity)
    .bind(payload.price)
    .bind(&payload.notes)
    .execute(&state.db)
    .await?;

    Ok(Json(position))
}

/// DELETE /api/portfolios/:id/positions/:pid - Close position entirely
pub async fn close_position(
    State(state): State<Arc<AppState>>,
    Path((portfolio_id, position_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Value>> {
    let position: Position = sqlx::query_as(
        r#"
        UPDATE positions SET closed_at = NOW()
        WHERE id = $1 AND portfolio_id = $2
        RETURNING id, portfolio_id, symbol, quantity::float8, avg_cost::float8, 
                  current_price::float8, opened_at, closed_at
        "#,
    )
    .bind(position_id)
    .bind(portfolio_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Position not found".to_string()))?;

    // Get current price for P&L calculation
    let current_price = get_mock_valuation(&position.symbol)
        .map(|m| m.current_price)
        .unwrap_or(position.avg_cost);

    // Record sell transaction for full position
    sqlx::query(
        r#"
        INSERT INTO transactions (portfolio_id, position_id, symbol, action, quantity, price)
        VALUES ($1, $2, $3, 'sell', $4, $5)
        "#,
    )
    .bind(portfolio_id)
    .bind(position_id)
    .bind(&position.symbol)
    .bind(position.quantity)
    .bind(current_price)
    .execute(&state.db)
    .await?;

    let realized_pnl = position.quantity * (current_price - position.avg_cost);

    Ok(Json(json!({
        "message": "Position closed",
        "symbol": position.symbol,
        "quantity": position.quantity,
        "realized_pnl": realized_pnl
    })))
}

// ===== Transactions & Performance =====

/// GET /api/portfolios/:id/transactions - List transactions
pub async fn list_transactions(
    State(state): State<Arc<AppState>>,
    Path(portfolio_id): Path<Uuid>,
) -> Result<Json<Vec<Transaction>>> {
    let transactions: Vec<Transaction> = sqlx::query_as(
        r#"
        SELECT id, portfolio_id, position_id, symbol, action, 
               quantity::float8, price::float8, fees::float8, notes, executed_at
        FROM transactions 
        WHERE portfolio_id = $1
        ORDER BY executed_at DESC
        LIMIT 100
        "#,
    )
    .bind(portfolio_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(transactions))
}

/// GET /api/portfolios/:id/performance - Get performance stats
pub async fn get_performance(
    State(state): State<Arc<AppState>>,
    Path(portfolio_id): Path<Uuid>,
) -> Result<Json<PerformanceStats>> {
    let positions: Vec<Position> = sqlx::query_as(
        r#"
        SELECT id, portfolio_id, symbol, quantity::float8, avg_cost::float8, 
               current_price::float8, opened_at, closed_at
        FROM positions 
        WHERE portfolio_id = $1 AND closed_at IS NULL
        "#,
    )
    .bind(portfolio_id)
    .fetch_all(&state.db)
    .await?;

    let mut total_value = 0.0;
    let mut total_cost = 0.0;
    let mut positions_with_pnl = Vec::new();

    for p in positions {
        let current_price = p
            .current_price
            .or_else(|| get_mock_valuation(&p.symbol).map(|m| m.current_price))
            .unwrap_or(p.avg_cost);

        let market_value = p.quantity * current_price;
        let cost_basis = p.quantity * p.avg_cost;
        let unrealized_pnl = market_value - cost_basis;
        let unrealized_pnl_pct = if cost_basis > 0.0 {
            (unrealized_pnl / cost_basis) * 100.0
        } else {
            0.0
        };

        total_value += market_value;
        total_cost += cost_basis;

        positions_with_pnl.push(PositionWithPnL {
            position: Position {
                current_price: Some(current_price),
                ..p
            },
            market_value,
            cost_basis,
            unrealized_pnl,
            unrealized_pnl_pct,
        });
    }

    let total_pnl = total_value - total_cost;
    let total_pnl_pct = if total_cost > 0.0 {
        (total_pnl / total_cost) * 100.0
    } else {
        0.0
    };

    Ok(Json(PerformanceStats {
        portfolio_id,
        total_value,
        total_cost,
        total_pnl,
        total_pnl_pct,
        day_change: total_pnl * 0.01, // Mock: assume 1% of P&L is today
        day_change_pct: total_pnl_pct * 0.01,
        positions: positions_with_pnl,
    }))
}

// ===== Helper Functions =====

async fn calculate_portfolio_stats(
    state: &Arc<AppState>,
    portfolio: &Portfolio,
) -> Result<PortfolioWithStats> {
    let positions: Vec<Position> = sqlx::query_as(
        r#"
        SELECT id, portfolio_id, symbol, quantity::float8, avg_cost::float8, 
               current_price::float8, opened_at, closed_at
        FROM positions 
        WHERE portfolio_id = $1 AND closed_at IS NULL
        "#,
    )
    .bind(portfolio.id)
    .fetch_all(&state.db)
    .await?;

    let mut total_value = 0.0;
    let mut total_cost = 0.0;

    for p in &positions {
        let current_price = p
            .current_price
            .or_else(|| get_mock_valuation(&p.symbol).map(|m| m.current_price))
            .unwrap_or(p.avg_cost);
        total_value += p.quantity * current_price;
        total_cost += p.quantity * p.avg_cost;
    }

    let total_pnl = total_value - total_cost;
    let total_pnl_pct = if total_cost > 0.0 {
        (total_pnl / total_cost) * 100.0
    } else {
        0.0
    };

    Ok(PortfolioWithStats {
        portfolio: portfolio.clone(),
        total_value,
        total_cost,
        total_pnl,
        total_pnl_pct,
        positions_count: positions.len() as i64,
    })
}
