use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    pub database_url: String,
    pub redis_url: String,
    pub jwt_secret: String,
    pub jwt_expiration: String,
    pub backend_port: u16,
    pub database_pool_size: u32,
    pub openai_api_key: Option<String>,
    pub alphavantage_api_key: Option<String>,
    pub use_local_llm: bool,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        dotenvy::dotenv().ok();

        let jwt_secret = std::env::var("SUPABASE_JWT_SECRET")
            .or_else(|_| std::env::var("JWT_SECRET"))
            .expect("SUPABASE_JWT_SECRET (or JWT_SECRET) must be set");

        Ok(Config {
            database_url: std::env::var("DATABASE_URL").expect("DATABASE_URL must be set"),
            redis_url: std::env::var("REDIS_URL")
                .unwrap_or_else(|_| "redis://localhost:6379".to_string()),
            jwt_secret,
            jwt_expiration: std::env::var("JWT_EXPIRATION").unwrap_or_else(|_| "24h".to_string()),
            backend_port: std::env::var("BACKEND_PORT")
                .unwrap_or_else(|_| "8000".to_string())
                .parse()?,
            database_pool_size: std::env::var("DATABASE_POOL_SIZE")
                .unwrap_or_else(|_| "20".to_string())
                .parse()?,
            openai_api_key: std::env::var("OPENAI_API_KEY").ok(),
            alphavantage_api_key: std::env::var("ALPHAVANTAGE_API_KEY").ok(),
            use_local_llm: std::env::var("USE_LOCAL_LLM")
                .unwrap_or_else(|_| "false".to_string())
                .parse()?,
        })
    }
}
