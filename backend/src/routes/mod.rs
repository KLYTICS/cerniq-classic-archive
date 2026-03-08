pub mod analyze; // New module
pub mod auth;
pub mod features; // Feature engineering routes
pub mod filings; // SEC filings routes
pub mod findings; // SpendCheck findings
pub mod insights;
pub mod market_data;
pub mod portfolios;
pub mod reports;
pub mod reports_gen;
pub mod risk;
pub mod screener;
pub mod tickers; // Universal ticker search
pub mod uploads; // New module
pub mod valuation; // Valuation routes
pub mod waitlist; // New module
pub mod websocket;
pub mod workspaces; // SpendCheck workspaces // SpendCheck report generation

pub use auth::router as auth_router;
