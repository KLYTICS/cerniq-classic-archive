use axum::{
    body::Body,
    extract::State,
    http::{header, Request},
    middleware::Next,
    response::{IntoResponse, Response},
};
use std::sync::Arc;
use uuid::Uuid;

use crate::auth::verify_jwt;
use crate::error::AppError;
use crate::state::AppState;

pub async fn auth_context(
    State(state): State<Arc<AppState>>,
    mut request: Request<Body>,
    next: Next,
) -> Response {
    let user_id = match extract_user_id(request.headers(), &state) {
        Ok(user_id) => user_id,
        Err(err) => return err.into_response(),
    };

    request.extensions_mut().insert(user_id);
    next.run(request).await
}

fn extract_user_id(headers: &axum::http::HeaderMap, state: &AppState) -> Result<Uuid, AppError> {
    if let Some(auth_header) = headers.get(header::AUTHORIZATION) {
        let auth_str = auth_header
            .to_str()
            .map_err(|_| AppError::Auth("Invalid authorization header".to_string()))?;

        let token = auth_str
            .strip_prefix("Bearer ")
            .or_else(|| auth_str.strip_prefix("bearer "))
            .ok_or_else(|| AppError::Auth("Authorization header must use Bearer token".to_string()))?;

        let claims = verify_jwt(token, &state.config.jwt_secret)
            .map_err(|_| AppError::Auth("Invalid or expired token".to_string()))?;

        return Uuid::parse_str(&claims.sub)
            .map_err(|_| AppError::Auth("Invalid subject in token".to_string()));
    }

    // Backward-compatible header auth for existing frontend calls.
    let header_user_id = headers
        .get("x-user-id")
        .or_else(|| headers.get("user-id"))
        .ok_or_else(|| AppError::Auth("Authentication required".to_string()))?;

    let user_id_str = header_user_id
        .to_str()
        .map_err(|_| AppError::Auth("Invalid user-id header".to_string()))?;

    Uuid::parse_str(user_id_str)
        .map_err(|_| AppError::Auth("Invalid user-id format".to_string()))
}
