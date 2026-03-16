use axum::{
    body::Body,
    extract::State,
    http::{header, Request},
    middleware::Next,
    response::{IntoResponse, Response},
};
use std::sync::Arc;
use uuid::Uuid;

use crate::auth::verify_request;
use crate::error::AppError;
use crate::state::AppState;

pub async fn auth_context(
    State(state): State<Arc<AppState>>,
    mut request: Request<Body>,
    next: Next,
) -> Response {
    let user_id = match extract_user_id(request.headers(), &state).await {
        Ok(user_id) => user_id,
        Err(err) => return err.into_response(),
    };

    request.extensions_mut().insert(user_id);
    next.run(request).await
}

async fn extract_user_id(
    headers: &axum::http::HeaderMap,
    state: &AppState,
) -> Result<Uuid, AppError> {
    extract_bearer_token(headers)?;

    let ctx = verify_request(headers, &state.config.jwt_secret).await?;
    Uuid::parse_str(&ctx.user_id)
        .map_err(|_| AppError::Auth("Invalid subject in token".to_string()))
}

fn extract_bearer_token<'a>(headers: &'a axum::http::HeaderMap) -> Result<&'a str, AppError> {
    let auth_header = headers
        .get(header::AUTHORIZATION)
        .ok_or_else(|| AppError::Auth("Authentication required".to_string()))?;

    let auth_header = auth_header
        .to_str()
        .map_err(|_| AppError::Auth("Invalid authorization header".to_string()))?;

    auth_header
        .strip_prefix("Bearer ")
        .ok_or_else(|| AppError::Auth("Authentication required".to_string()))
}

#[cfg(test)]
mod tests {
    use super::extract_bearer_token;
    use crate::error::AppError;
    use axum::http::{header, HeaderMap, HeaderValue};

    #[test]
    fn extract_bearer_token_rejects_legacy_user_headers() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "x-user-id",
            HeaderValue::from_static("3fa85f64-5717-4562-b3fc-2c963f66afa6"),
        );

        let err =
            extract_bearer_token(&headers).expect_err("legacy header auth should be rejected");
        match err {
            AppError::Auth(message) => assert_eq!(message, "Authentication required"),
            other => panic!("unexpected error: {other:?}"),
        }
    }

    #[test]
    fn extract_bearer_token_returns_bearer_token() {
        let mut headers = HeaderMap::new();
        headers.insert(
            header::AUTHORIZATION,
            HeaderValue::from_static("Bearer token-123"),
        );

        let token = extract_bearer_token(&headers).expect("bearer token");
        assert_eq!(token, "token-123");
    }
}
