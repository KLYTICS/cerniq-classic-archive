use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;

use crate::state::AppState;

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/register", post(crate::auth::handlers::register))
        .route("/login", post(crate::auth::handlers::login))
        .route("/me", get(crate::auth::handlers::me))
        .route("/whoami", get(crate::auth::handlers::whoami))
}
