use axum::{
    extract::{State, Json},
    response::Json as AxumJson,
};
use serde::{Deserialize};
use serde_json::{json, Value};
use std::sync::Arc;
use uuid::Uuid;

use crate::error::{AppError, Result};
use crate::state::AppState;
use crate::models::Waitlist;

#[derive(Deserialize)]
pub struct WaitlistRequest {
    pub email: String,
    pub role: Option<String>,
    pub company_size: Option<String>,
    pub top_pain: Option<String>,
}

pub async fn join_waitlist(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<WaitlistRequest>,
) -> Result<AxumJson<Value>> {
    // Validate email
    if !payload.email.contains('@') {
        return Err(AppError::InvalidInput("Invalid email format".to_string()));
    }

    // Check if already on waitlist
    let exists = sqlx::query("SELECT 1 FROM waitlist WHERE email = $1")
        .bind(&payload.email)
        .fetch_optional(&state.db)
        .await?;

    if exists.is_some() {
        return Ok(AxumJson(json!({
            "message": "You are already on the waitlist!",
            "status": "exists"
        })));
    }

    sqlx::query(
        r#"
        INSERT INTO waitlist (id, email, role, company_size, top_pain)
        VALUES ($1, $2, $3, $4, $5)
        "#
    )
    .bind(Uuid::new_v4())
    .bind(&payload.email)
    .bind(payload.role)
    .bind(payload.company_size)
    .bind(payload.top_pain)
    .execute(&state.db)
    .await?;

    Ok(AxumJson(json!({
        "message": "Successfully joined waitlist",
        "status": "joined"
    })))
}
