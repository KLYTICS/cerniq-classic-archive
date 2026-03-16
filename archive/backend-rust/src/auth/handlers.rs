use axum::{
    extract::State,
    http::{header, HeaderMap},
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::auth::{create_jwt, fetch_user_orgs, hash_password, verify_password, verify_request};
use crate::error::{AppError, Result};
use crate::models::User;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserResponse,
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: String,
    pub email: String,
}

#[derive(Debug, Serialize)]
pub struct WhoAmIResponse {
    pub user_id: String,
    pub email: Option<String>,
    pub orgs: Vec<crate::auth::WhoAmIOrg>,
    pub app: String,
    pub issuer_ok: bool,
    pub aud_ok: bool,
}

pub async fn register(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>> {
    // Validate email format
    if !payload.email.contains('@') {
        return Err(AppError::InvalidInput("Invalid email format".to_string()));
    }

    // Validate password strength
    if payload.password.len() < 8 {
        return Err(AppError::InvalidInput(
            "Password must be at least 8 characters".to_string(),
        ));
    }

    // Check if user already exists
    let existing_user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
        .bind(&payload.email)
        .fetch_optional(&state.db)
        .await?;

    if existing_user.is_some() {
        return Err(AppError::InvalidInput(
            "Email already registered".to_string(),
        ));
    }

    // Hash password
    let password_hash = hash_password(&payload.password)
        .map_err(|e| AppError::Internal(format!("Failed to hash password: {}", e)))?;

    // Create user
    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING *",
    )
    .bind(&payload.email)
    .bind(&password_hash)
    .fetch_one(&state.db)
    .await?;

    // Generate JWT
    let token = create_jwt(user.id, &state.config.jwt_secret, 24)
        .map_err(|e| AppError::Internal(format!("Failed to create token: {}", e)))?;

    Ok(Json(AuthResponse {
        token,
        user: UserResponse {
            id: user.id.to_string(),
            email: user.email,
        },
    }))
}

pub async fn login(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<AuthResponse>> {
    // Find user by email
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
        .bind(&payload.email)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::Auth("Invalid credentials".to_string()))?;

    // Verify password
    let is_valid = verify_password(&payload.password, &user.password_hash)
        .map_err(|e| AppError::Internal(format!("Password verification failed: {}", e)))?;

    if !is_valid {
        return Err(AppError::Auth("Invalid credentials".to_string()));
    }

    // Generate JWT
    let token = create_jwt(user.id, &state.config.jwt_secret, 24)
        .map_err(|e| AppError::Internal(format!("Failed to create token: {}", e)))?;

    Ok(Json(AuthResponse {
        token,
        user: UserResponse {
            id: user.id.to_string(),
            email: user.email,
        },
    }))
}

pub async fn me(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<UserResponse>> {
    let auth_header = headers
        .get(header::AUTHORIZATION)
        .ok_or_else(|| AppError::Auth("Missing authorization header".to_string()))?;

    let auth_str = auth_header
        .to_str()
        .map_err(|_| AppError::Auth("Invalid authorization header".to_string()))?;

    let token = auth_str
        .strip_prefix("Bearer ")
        .or_else(|| auth_str.strip_prefix("bearer "))
        .ok_or_else(|| AppError::Auth("Authorization header must use Bearer token".to_string()))?;

    let claims = crate::auth::verify_jwt(token, &state.config.jwt_secret)
        .map_err(|_| AppError::Auth("Invalid or expired token".to_string()))?;

    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::Auth("Invalid token subject".to_string()))?;

    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::Auth("User not found".to_string()))?;

    Ok(Json(UserResponse {
        id: user.id.to_string(),
        email: user.email,
    }))
}

pub async fn whoami(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<WhoAmIResponse>> {
    let ctx = verify_request(&headers, &state.config.jwt_secret).await?;
    let orgs = fetch_user_orgs(&ctx.user_id).await?;
    Ok(Json(WhoAmIResponse {
        user_id: ctx.user_id,
        email: ctx.email,
        orgs,
        app: std::env::var("KLYTICS_APP_ID").unwrap_or_else(|_| "cerniq".to_string()),
        issuer_ok: ctx.issuer_ok,
        aud_ok: ctx.aud_ok,
    }))
}
