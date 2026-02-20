//! Yahoo Finance API Client
//! 
//! Fetches real-time and historical market data for stocks, ETFs, and crypto

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::collections::HashMap;
use chrono::{DateTime, Utc, NaiveDate};

const YAHOO_FINANCE_QUOTE_URL: &str = "https://query1.finance.yahoo.com/v8/finance/chart";
const YAHOO_FINANCE_FUNDAMENTALS_URL: &str = "https://query2.finance.yahoo.com/v10/finance/quoteSummary";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YahooQuoteResponse {
    pub chart: ChartData,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChartData {
    pub result: Vec<ChartResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChartResult {
    pub meta: QuoteMeta,
    pub timestamp: Option<Vec<i64>>,
    pub indicators: Indicators,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuoteMeta {
    pub currency: String,
    pub symbol: String,
    pub regular_market_price: Option<f64>,
    pub chart_previous_close: Option<f64>,
    pub previous_close: Option<f64>,
    pub regular_market_time: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Indicators {
    pub quote: Vec<QuoteData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuoteData {
    pub open: Option<Vec<Option<f64>>>,
    pub high: Option<Vec<Option<f64>>>,
    pub low: Option<Vec<Option<f64>>>,
    pub close: Option<Vec<Option<f64>>>,
    pub volume: Option<Vec<Option<i64>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TickerPrice {
    pub ticker: String,
    pub price: f64,
    pub currency: String,
    pub timestamp: DateTime<Utc>,
    pub previous_close: Option<f64>,
    pub change_percent: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoricalData {
    pub ticker: String,
    pub data_points: Vec<PricePoint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PricePoint {
    pub date: NaiveDate,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: i64,
}

pub struct YahooFinanceClient {
    client: reqwest::Client,
    db: PgPool,
}

impl YahooFinanceClient {
    pub fn new(db: PgPool) -> Self {
        let client = reqwest::Client::builder()
            .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .unwrap();

        Self { client, db }
    }

    /// Get current price for a ticker
    pub async fn get_current_price(&self, ticker: &str) -> Result<TickerPrice> {
        // Check cache first
        if let Some(cached) = self.get_cached_price(ticker).await? {
            if cached.timestamp > Utc::now() - chrono::Duration::minutes(5) {
                return Ok(cached);
            }
        }

        // Fetch from Yahoo Finance
        let url = format!("{}/{}?interval=1d&range=1d", YAHOO_FINANCE_QUOTE_URL, ticker);
        
        let response = self.client
            .get(&url)
            .send()
            .await
            .context("Failed to fetch from Yahoo Finance")?;

        let data: YahooQuoteResponse = response
            .json()
            .await
            .context("Failed to parse Yahoo Finance response")?;

        let result = data.chart.result
            .first()
            .context("No data in Yahoo Finance response")?;

        let price = result.meta.regular_market_price
            .context("No price data available")?;

        let previous_close = result.meta.previous_close.or(result.meta.chart_previous_close);
        
        let change_percent = previous_close.map(|prev| {
            ((price - prev) / prev) * 100.0
        });

        let ticker_price = TickerPrice {
            ticker: ticker.to_uppercase(),
            price,
            currency: result.meta.currency.clone(),
            timestamp: Utc::now(),
            previous_close,
            change_percent,
        };

        // Cache the result
        self.cache_price(&ticker_price).await?;

        Ok(ticker_price)
    }

    /// Get historical price data
    pub async fn get_historical_data(
        &self,
        ticker: &str,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<HistoricalData> {
        let start_ts = start_date.and_hms_opt(0, 0, 0).unwrap().timestamp();
        let end_ts = end_date.and_hms_opt(23, 59, 59).unwrap().timestamp();

        let url = format!(
            "{}/{}?period1={}&period2={}&interval=1d",
            YAHOO_FINANCE_QUOTE_URL, ticker, start_ts, end_ts
        );

        let response = self.client
            .get(&url)
            .send()
            .await
            .context("Failed to fetch historical data")?;

        let data: YahooQuoteResponse = response
            .json()
            .await
            .context("Failed to parse historical data")?;

        let result = data.chart.result
            .first()
            .context("No historical data available")?;

        let timestamps = result.timestamp
            .as_ref()
            .context("No timestamp data")?;

        let quotes = result.indicators.quote
            .first()
            .context("No quote data")?;

        let mut data_points = Vec::new();

        if let (Some(opens), Some(highs), Some(lows), Some(closes), Some(volumes)) = (
            &quotes.open,
            &quotes.high,
            &quotes.low,
            &quotes.close,
            &quotes.volume,
        ) {
            for (i, &ts) in timestamps.iter().enumerate() {
                if let (Some(Some(open)), Some(Some(high)), Some(Some(low)), Some(Some(close)), Some(Some(volume))) = (
                    opens.get(i),
                    highs.get(i),
                    lows.get(i),
                    closes.get(i),
                    volumes.get(i),
                ) {
                    let date = DateTime::from_timestamp(ts, 0)
                        .unwrap()
                        .naive_utc()
                        .date();

                    data_points.push(PricePoint {
                        date,
                        open: *open,
                        high: *high,
                        low: *low,
                        close: *close,
                        volume: *volume,
                    });
                }
            }
        }

        Ok(HistoricalData {
            ticker: ticker.to_uppercase(),
            data_points,
        })
    }

    /// Get quarterly financial data (revenue, earnings)
    pub async fn get_quarterly_financials(&self, ticker: &str) -> Result<Vec<QuarterlyFinancials>> {
        // Yahoo Finance doesn't provide great fundamental data
        // This is a placeholder - in production, use SEC EDGAR or Financial Modeling Prep API
        
        // For now, return empty and fallback to existing SEC data
        Ok(Vec::new())
    }

    // Cache helpers
    async fn get_cached_price(&self, ticker: &str) -> Result<Option<TickerPrice>> {
        let cached = sqlx::query_scalar::<_, serde_json::Value>(
            "SELECT data FROM market_data_cache 
             WHERE ticker = $1 AND data_type = 'price' 
             AND fetched_at > NOW() - INTERVAL '5 minutes'"
        )
        .bind(ticker.to_uppercase())
        .fetch_optional(&self.db)
        .await?;

        Ok(cached.and_then(|v| serde_json::from_value(v).ok()))
    }

    async fn cache_price(&self, price: &TickerPrice) -> Result<()> {
        let data = serde_json::to_value(price)?;
        
        sqlx::query(
            "INSERT INTO market_data_cache (ticker, data_type, data, source, expires_at)
             VALUES ($1, 'price', $2, 'yahoo_finance', NOW() + INTERVAL '5 minutes')
             ON CONFLICT (ticker, data_type) 
             DO UPDATE SET data = $2, fetched_at = NOW(), expires_at = NOW() + INTERVAL '5 minutes'"
        )
        .bind(&price.ticker)
        .bind(data)
        .execute(&self.db)
        .await?;

        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuarterlyFinancials {
    pub quarter_end: NaiveDate,
    pub revenue: Option<f64>,
    pub net_income: Option<f64>,
    pub eps: Option<f64>,
}
