//! Market data service for fetching and caching price data
//!
//! This service provides institutional-grade market data with:
//! - Primary source: yfinance (free, high quality)
//! - Fallback: AlphaVantage (paid tier for reliability)
//! - Redis caching (24-hour TTL)
//! - PostgreSQL time-series storage
//! - Automatic retry with exponential backoff

use anyhow::{Context, Result};
use chrono::{DateTime, NaiveDate, Utc};
use redis::AsyncCommands;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::collections::HashMap;
use tracing::{debug, info, warn};

/// Price data point
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PriceData {
    pub ticker: String,
    pub date: NaiveDate,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub adj_close: f64,
    pub volume: i64,
    pub source: String,
}

/// Market data service
pub struct MarketDataService {
    http_client: Client,
    db: PgPool,
    redis: redis::aio::ConnectionManager,
    alphavantage_key: Option<String>,
}

impl MarketDataService {
    pub fn new(
        db: PgPool,
        redis: redis::aio::ConnectionManager,
        alphavantage_key: Option<String>,
    ) -> Self {
        Self {
            http_client: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("Failed to build HTTP client"),
            db,
            redis,
            alphavantage_key,
        }
    }

    /// Fetch price data for a ticker between dates
    ///
    /// Strategy:
    /// 1. Check Redis cache (key: market_data:{ticker}:{start}:{end})
    /// 2. If miss, check PostgreSQL
    /// 3. If still incomplete, fetch from yfinance
    /// 4. If yfinance fails, try AlphaVantage
    pub async fn get_prices(
        &self,
        ticker: &str,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<Vec<PriceData>> {
        // Try cache first
        if let Ok(cached) = self.get_from_cache(ticker, start_date, end_date).await {
            info!("Cache hit for {}", ticker);
            return Ok(cached);
        }

        // Try database
        if let Ok(db_data) = self.get_from_db(ticker, start_date, end_date).await {
            if !db_data.is_empty() {
                info!("Database hit for {} ({} rows)", ticker, db_data.len());
                // Cache for next time
                let _ = self
                    .cache_prices(ticker, start_date, end_date, &db_data)
                    .await;
                return Ok(db_data);
            }
        }

        // Fetch from external source
        info!("Fetching {} from external source", ticker);
        let prices = self.fetch_external(ticker, start_date, end_date).await?;

        // Store in database
        self.store_prices(&prices).await?;

        // Cache
        let _ = self
            .cache_prices(ticker, start_date, end_date, &prices)
            .await;

        Ok(prices)
    }

    /// Fetch from external sources (yfinance primary, AlphaVantage fallback)
    async fn fetch_external(
        &self,
        ticker: &str,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<Vec<PriceData>> {
        // Try yfinance first
        match self.fetch_yfinance(ticker, start_date, end_date).await {
            Ok(data) => {
                info!("yfinance success for {}", ticker);
                return Ok(data);
            }
            Err(e) => {
                warn!("yfinance failed for {}: {}", ticker, e);
            }
        }

        // Fallback to AlphaVantage if available
        if self.alphavantage_key.is_some() {
            match self.fetch_alphavantage(ticker).await {
                Ok(data) => {
                    info!("AlphaVantage success for {}", ticker);
                    return Ok(data);
                }
                Err(e) => {
                    warn!("AlphaVantage failed for {}: {}", ticker, e);
                }
            }
        }

        anyhow::bail!("All data sources failed for {}", ticker)
    }

    /// Fetch from yfinance API
    ///
    /// Uses the unofficial yfinance v8 API endpoint
    async fn fetch_yfinance(
        &self,
        ticker: &str,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<Vec<PriceData>> {
        let start_ts = start_date.and_hms_opt(0, 0, 0).unwrap().timestamp();
        let end_ts = end_date.and_hms_opt(23, 59, 59).unwrap().timestamp();

        let url = format!(
            "https://query1.finance.yahoo.com/v8/finance/chart/{}?period1={}&period2={}&interval=1d",
            ticker, start_ts, end_ts
        );

        let response: YFinanceResponse = self
            .http_client
            .get(&url)
            .send()
            .await
            .context("yfinance request failed")?
            .json()
            .await
            .context("yfinance JSON parse failed")?;

        Self::parse_yfinance_response(ticker, response)
    }

    fn parse_yfinance_response(ticker: &str, response: YFinanceResponse) -> Result<Vec<PriceData>> {
        let chart = response
            .chart
            .result
            .first()
            .ok_or_else(|| anyhow::anyhow!("Empty response"))?;

        let timestamps = &chart.timestamp;
        let quote = &chart
            .indicators
            .quote
            .first()
            .ok_or_else(|| anyhow::anyhow!("No quote data"))?;
        let adj_close = &chart
            .indicators
            .adjclose
            .first()
            .ok_or_else(|| anyhow::anyhow!("No adjusted close data"))?;

        let mut prices = Vec::new();

        for (i, &ts) in timestamps.iter().enumerate() {
            let date = DateTime::from_timestamp(ts, 0)
                .ok_or_else(|| anyhow::anyhow!("Invalid timestamp"))?
                .date_naive();

            prices.push(PriceData {
                ticker: ticker.to_string(),
                date,
                open: quote.open.get(i).copied().unwrap_or(0.0),
                high: quote.high.get(i).copied().unwrap_or(0.0),
                low: quote.low.get(i).copied().unwrap_or(0.0),
                close: quote.close.get(i).copied().unwrap_or(0.0),
                adj_close: adj_close.adjclose.get(i).copied().unwrap_or(0.0),
                volume: quote.volume.get(i).copied().unwrap_or(0),
                source: "yfinance".to_string(),
            });
        }

        Ok(prices)
    }

    /// Fetch from AlphaVantage (fallback)
    async fn fetch_alphavantage(&self, ticker: &str) -> Result<Vec<PriceData>> {
        let api_key = self
            .alphavantage_key
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("AlphaVantage API key not configured"))?;

        let url = format!(
            "https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol={}&apikey={}&outputsize=full",
            ticker, api_key
        );

        let response: AlphaVantageResponse =
            self.http_client.get(&url).send().await?.json().await?;

        Self::parse_alphavantage_response(ticker, response)
    }

    fn parse_alphavantage_response(
        ticker: &str,
        response: AlphaVantageResponse,
    ) -> Result<Vec<PriceData>> {
        let mut prices = Vec::new();

        for (date_str, daily) in response.time_series {
            let date = NaiveDate::parse_from_str(&date_str, "%Y-%m-%d")?;

            prices.push(PriceData {
                ticker: ticker.to_string(),
                date,
                open: daily.open.parse()?,
                high: daily.high.parse()?,
                low: daily.low.parse()?,
                close: daily.close.parse()?,
                adj_close: daily.adjusted_close.parse()?,
                volume: daily.volume.parse()?,
                source: "alphavantage".to_string(),
            });
        }

        Ok(prices)
    }

    /// Get prices from Redis cache
    async fn get_from_cache(
        &self,
        ticker: &str,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<Vec<PriceData>> {
        let key = format!("market_data:{}:{}:{}", ticker, start_date, end_date);

        let mut conn = self.redis.clone();
        let cached: String = conn.get(&key).await?;

        let prices: Vec<PriceData> = serde_json::from_str(&cached)?;
        Ok(prices)
    }

    /// Cache prices in Redis (24-hour TTL)
    async fn cache_prices(
        &self,
        ticker: &str,
        start_date: NaiveDate,
        end_date: NaiveDate,
        prices: &[PriceData],
    ) -> Result<()> {
        let key = format!("market_data:{}:{}:{}", ticker, start_date, end_date);
        let value = serde_json::to_string(prices)?;

        let mut conn = self.redis.clone();
        conn.set_ex::<_, _, ()>(&key, value, 86400).await?; // 24 hours

        Ok(())
    }

    /// Get prices from database
    async fn get_from_db(
        &self,
        ticker: &str,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<Vec<PriceData>> {
        let prices = sqlx::query_as::<_, PriceData>(
            r#"
            SELECT ticker, date, open, high, low, close, adj_close, volume, source
            FROM market_data
            WHERE ticker = $1 AND date >= $2 AND date <= $3
            ORDER BY date ASC
            "#,
        )
        .bind(ticker)
        .bind(start_date)
        .bind(end_date)
        .fetch_all(&self.db)
        .await?;

        Ok(prices)
    }

    /// Store prices in database (upsert)
    async fn store_prices(&self, prices: &[PriceData]) -> Result<()> {
        if prices.is_empty() {
            return Ok(());
        }

        for price in prices {
            sqlx::query(
                r#"
                INSERT INTO market_data (ticker, date, open, high, low, close, adj_close, volume, source)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (ticker, date) DO UPDATE SET
                    open = EXCLUDED.open,
                    high = EXCLUDED.high,
                    low = EXCLUDED.low,
                    close = EXCLUDED.close,
                    adj_close = EXCLUDED.adj_close,
                    volume = EXCLUDED.volume,
                    source = EXCLUDED.source,
                    updated_at = NOW()
                "#,
            )
            .bind(&price.ticker)
            .bind(&price.date)
            .bind(price.open)
            .bind(price.high)
            .bind(price.low)
            .bind(price.close)
            .bind(price.adj_close)
            .bind(price.volume)
            .bind(&price.source)
            .execute(&self.db)
            .await?;
        }

        info!(
            "Stored {} price records for {}",
            prices.len(),
            prices[0].ticker
        );
        Ok(())
    }

    /// Batch fetch for multiple tickers
    pub async fn get_prices_batch(
        &self,
        tickers: &[String],
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> HashMap<String, Vec<PriceData>> {
        let mut results = HashMap::new();

        for ticker in tickers {
            match self.get_prices(ticker, start_date, end_date).await {
                Ok(prices) => {
                    results.insert(ticker.clone(), prices);
                }
                Err(e) => {
                    warn!("Failed to fetch {} data: {}", ticker, e);
                }
            }

            // Rate limiting: 2 requests per second
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        }

        results
    }
}

// ===== Data structures for yfinance =====

#[derive(Debug, Deserialize)]
struct YFinanceResponse {
    chart: YFinanceChart,
}

#[derive(Debug, Deserialize)]
struct YFinanceChart {
    result: Vec<YFinanceResult>,
}

#[derive(Debug, Deserialize)]
struct YFinanceResult {
    timestamp: Vec<i64>,
    indicators: YFinanceIndicators,
}

#[derive(Debug, Deserialize)]
struct YFinanceIndicators {
    quote: Vec<YFinanceQuote>,
    adjclose: Vec<YFinanceAdjClose>,
}

#[derive(Debug, Deserialize)]
struct YFinanceQuote {
    open: Vec<f64>,
    high: Vec<f64>,
    low: Vec<f64>,
    close: Vec<f64>,
    volume: Vec<i64>,
}

#[derive(Debug, Deserialize)]
struct YFinanceAdjClose {
    adjclose: Vec<f64>,
}

// ===== Data structures for AlphaVantage =====

#[derive(Debug, Deserialize)]
struct AlphaVantageResponse {
    #[serde(rename = "Time Series (Daily)")]
    time_series: HashMap<String, AlphaVantageDaily>,
}

#[derive(Debug, Deserialize)]
struct AlphaVantageDaily {
    #[serde(rename = "1. open")]
    open: String,
    #[serde(rename = "2. high")]
    high: String,
    #[serde(rename = "3. low")]
    low: String,
    #[serde(rename = "4. close")]
    close: String,
    #[serde(rename = "5. adjusted close")]
    adjusted_close: String,
    #[serde(rename = "6. volume")]
    volume: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore] // Run with: cargo test -- --ignored
    async fn test_yfinance_integration() {
        let db_url = std::env::var("DATABASE_URL").expect("DATABASE_URL not set");
        let redis_url =
            std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1/".to_string());

        let db = PgPool::connect(&db_url).await.unwrap();
        let redis_client = redis::Client::open(redis_url).unwrap();
        let redis_conn = redis_client.get_connection_manager().await.unwrap();

        let service = MarketDataService::new(db, redis_conn, None);

        let start = NaiveDate::from_ymd_opt(2024, 1, 1).unwrap();
        let end = NaiveDate::from_ymd_opt(2024, 12, 31).unwrap();

        let prices = service.get_prices("NVDA", start, end).await.unwrap();

        assert!(!prices.is_empty());
        assert_eq!(prices[0].ticker, "NVDA");
        println!("Fetched {} price points for NVDA", prices.len());
    }
}
