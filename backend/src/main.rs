mod auth;
mod compute;
mod config;
mod error;
mod market_data;
mod models;
mod parsers; // New module
mod routes;
mod services;  // Data pipeline services
mod state;
mod valuation;  // Valuation engines

use axum::{
    middleware,
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::config::Config;
use crate::state::AppState;
use crate::auth::auth_context;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "backend=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    let config = Config::from_env()?;
    tracing::info!("Configuration loaded successfully");

    // Initialize database connection pool
    let db_pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(config.database_pool_size)
        .connect(&config.database_url)
        .await?;
    tracing::info!("Database connection pool established");

    // Run migrations
    sqlx::migrate!("./migrations")
        .run(&db_pool)
        .await?;
    tracing::info!("Database migrations completed");

    // Initialize Redis client
    let redis_client = redis::Client::open(config.redis_url.clone())?;
    let redis_conn = redis_client.get_connection_manager().await?;
    tracing::info!("Redis connection established");

    // Create application state
    let state = Arc::new(AppState {
        db: db_pool,
        redis: redis_conn,
        config: config.clone(),
    });

    // Build CORS layer
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Build application router
    let app = Router::new()
        // Health check
        .route("/health", get(health_check))
        // Authentication routes
        .nest("/auth", routes::auth::router())
        // API routes (protected)
        .nest(
            "/api/portfolios",
            routes::portfolios::router()
                .layer(middleware::from_fn_with_state(state.clone(), auth_context)),
        )
        .nest(
            "/api/risk",
            routes::risk::router()
                .layer(middleware::from_fn_with_state(state.clone(), auth_context)),
        )
        .nest("/api/screener", routes::screener::router())
        .nest("/api/insights", routes::insights::router())
        .nest("/api/market-data", routes::market_data::router())
        .nest("/api/filings", routes::filings::router())  // SEC filings
        .nest("/api/features", routes::features::router())  // Feature engineering
        .nest("/api/valuation", routes::valuation::router())  // Valuation engines
        // Ticker search routes
        .route("/api/tickers/search", get(routes::tickers::search_tickers))
        .route("/api/tickers/popular", get(routes::tickers::get_popular_tickers))
        .route("/api/tickers/:ticker", get(routes::tickers::get_ticker_info))
        .route("/api/tickers/:ticker/price", get(routes::tickers::get_ticker_price))
        // Other API routes
        .route("/api/upload", post(routes::uploads::upload_file))
        .route("/api/analyze", post(routes::analyze::run_analysis))
        .route("/api/analyze/status/:workspace_id", get(routes::analyze::get_analysis_status))
        .route("/api/reports/generate", post(routes::reports::generate_report)) // New report routes
        .route("/api/reports/:id", get(routes::reports::get_report))
        .route("/api/waitlist", post(routes::waitlist::join_waitlist)) // New waitlist route
        // SpendCheck routes
        .route("/api/spendcheck/workspaces", post(routes::workspaces::create_workspace))
        .route("/api/spendcheck/workspaces", get(routes::workspaces::list_workspaces))
        .route("/api/spendcheck/workspaces/:id", get(routes::workspaces::get_workspace))
        .route("/api/spendcheck/workspaces/:id", axum::routing::put(routes::workspaces::update_workspace))
        .route("/api/spendcheck/workspaces/:id", axum::routing::delete(routes::workspaces::delete_workspace))
        .route("/api/spendcheck/findings", get(routes::findings::list_findings))
        .route("/api/spendcheck/findings/stats", get(routes::findings::get_findings_stats))
        .route("/api/spendcheck/findings/:id", get(routes::findings::get_finding))
        .route("/api/spendcheck/findings/:id", axum::routing::patch(routes::findings::update_finding))
        .route("/api/spendcheck/findings/:id/feedback", post(routes::findings::submit_feedback))
        // SpendCheck Reports
        .route("/api/spendcheck/reports/generate", post(routes::reports_gen::generate_report))
        .route("/api/spendcheck/reports/:id", get(routes::reports_gen::get_report))
        .route("/api/spendcheck/reports/:id/export", get(routes::reports_gen::export_report))
        .route("/api/spendcheck/reports/:id/brief", post(routes::reports_gen::create_brief))
        // Public brief (no auth)
        .route("/pub/briefs/:token", get(routes::reports_gen::get_public_brief))
        // WebSocket (now with state for market data streaming)
        .route("/ws", get(routes::websocket::handler))
        // Add state and middleware
        .with_state(state)
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    // Start server
    let addr = format!("0.0.0.0:{}", config.backend_port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    tracing::info!("Server listening on {}", addr);

    axum::serve(listener, app).await?;

    Ok(())
}

async fn health_check() -> &'static str {
    "OK"
}
