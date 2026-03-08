//! Feature engineering service
//!
//! Calculates derived metrics and features from raw market data and financial statements.
//! These features power the KPI scoreboard and valuation engines.

use anyhow::{Context, Result};
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::collections::HashMap;
use tracing::info;

use crate::services::market_data::{MarketDataService, PriceData};
use crate::services::sec_filings::FinancialMetrics;

/// Computed features for a ticker at a point in time
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ComputedFeatures {
    pub id: Option<i32>,
    pub ticker: String,
    pub as_of_date: NaiveDate,

    // Growth Metrics (%)
    pub revenue_growth_qoq: Option<f64>,
    pub revenue_growth_yoy: Option<f64>,
    pub eps_growth_qoq: Option<f64>,
    pub eps_growth_yoy: Option<f64>,
    pub fcf_growth_yoy: Option<f64>,

    // Valuation Metrics
    pub price_to_earnings: Option<f64>,
    pub price_to_sales: Option<f64>,
    pub price_to_book: Option<f64>,
    pub ev_to_ebitda: Option<f64>,
    pub fcf_yield: Option<f64>,

    // Margins (%)
    pub gross_margin: Option<f64>,
    pub operating_margin: Option<f64>,
    pub net_margin: Option<f64>,

    // Capital Efficiency
    pub return_on_equity: Option<f64>,
    pub return_on_assets: Option<f64>,
    pub asset_turnover: Option<f64>,

    // Technical Indicators
    pub ma_50_day: Option<f64>,
    pub ma_200_day: Option<f64>,
    pub volatility_30_day: Option<f64>,
    pub rsi_14_day: Option<f64>,

    // Percentile Rankings (vs 5-year history)
    pub pe_percentile: Option<f64>,
    pub price_percentile: Option<f64>,
    pub volume_percentile: Option<f64>,

    pub created_at: Option<chrono::NaiveDateTime>,
}

pub struct FeatureService {
    db: PgPool,
}

impl FeatureService {
    pub fn new(db: PgPool) -> Self {
        Self { db }
    }

    /// Calculate growth rate between two values
    fn calculate_growth(current: f64, previous: f64) -> Option<f64> {
        if previous == 0.0 {
            None
        } else {
            Some(((current - previous) / previous) * 100.0)
        }
    }

    /// Calculate margin percentage
    fn calculate_margin(numerator: Option<f64>, denominator: Option<f64>) -> Option<f64> {
        match (numerator, denominator) {
            (Some(n), Some(d)) if d != 0.0 => Some((n / d) * 100.0),
            _ => None,
        }
    }

    /// Calculate growth metrics from financial statements
    pub async fn calculate_growth_metrics(
        &self,
        ticker: &str,
    ) -> Result<HashMap<String, Option<f64>>> {
        // Fetch last 8 quarters of financials (2 years)
        let metrics = sqlx::query_as::<_, FinancialMetrics>(
            r#"
            SELECT * FROM financial_metrics
            WHERE ticker = $1
            ORDER BY period_end DESC
            LIMIT 8
            "#,
        )
        .bind(ticker)
        .fetch_all(&self.db)
        .await?;

        let mut growth = HashMap::new();

        if metrics.len() >= 2 {
            let current = &metrics[0];
            let prev_quarter = &metrics[1];

            // QoQ growth
            if let (Some(rev_curr), Some(rev_prev)) = (current.revenue, prev_quarter.revenue) {
                growth.insert(
                    "revenue_growth_qoq".to_string(),
                    Self::calculate_growth(rev_curr, rev_prev),
                );
            }

            if let (Some(eps_curr), Some(eps_prev)) =
                (current.eps_diluted, prev_quarter.eps_diluted)
            {
                growth.insert(
                    "eps_growth_qoq".to_string(),
                    Self::calculate_growth(eps_curr, eps_prev),
                );
            }
        }

        if metrics.len() >= 5 {
            let current = &metrics[0];
            let prev_year = &metrics[4]; // 4 quarters ago

            // YoY growth
            if let (Some(rev_curr), Some(rev_prev)) = (current.revenue, prev_year.revenue) {
                growth.insert(
                    "revenue_growth_yoy".to_string(),
                    Self::calculate_growth(rev_curr, rev_prev),
                );
            }

            if let (Some(eps_curr), Some(eps_prev)) = (current.eps_diluted, prev_year.eps_diluted) {
                growth.insert(
                    "eps_growth_yoy".to_string(),
                    Self::calculate_growth(eps_curr, eps_prev),
                );
            }

            if let (Some(fcf_curr), Some(fcf_prev)) =
                (current.free_cash_flow, prev_year.free_cash_flow)
            {
                growth.insert(
                    "fcf_growth_yoy".to_string(),
                    Self::calculate_growth(fcf_curr, fcf_prev),
                );
            }
        }

        Ok(growth)
    }

    /// Calculate valuation metrics
    pub async fn calculate_valuation_metrics(
        &self,
        ticker: &str,
        current_price: f64,
        shares_outstanding: f64,
    ) -> Result<HashMap<String, Option<f64>>> {
        let mut valuations = HashMap::new();

        // Get latest financials
        let latest = sqlx::query_as::<_, FinancialMetrics>(
            r#"
            SELECT * FROM financial_metrics
            WHERE ticker = $1
            ORDER BY period_end DESC
            LIMIT 1
            "#,
        )
        .bind(ticker)
        .fetch_optional(&self.db)
        .await?;

        if let Some(metrics) = latest {
            let market_cap = current_price * shares_outstanding;

            // P/E ratio
            if let Some(eps) = metrics.eps_diluted {
                if eps > 0.0 {
                    valuations.insert("price_to_earnings".to_string(), Some(current_price / eps));
                }
            }

            // P/S ratio
            if let Some(revenue) = metrics.revenue {
                if revenue > 0.0 {
                    valuations.insert("price_to_sales".to_string(), Some(market_cap / revenue));
                }
            }

            // P/B ratio
            if let Some(equity) = metrics.shareholders_equity {
                if equity > 0.0 {
                    valuations.insert("price_to_book".to_string(), Some(market_cap / equity));
                }
            }

            // FCF Yield
            if let Some(fcf) = metrics.free_cash_flow {
                if market_cap > 0.0 {
                    valuations.insert("fcf_yield".to_string(), Some((fcf / market_cap) * 100.0));
                }
            }

            // EV/EBITDA (simplified - using operating income as proxy)
            if let Some(op_income) = metrics.operating_income {
                if let Some(debt) = metrics.total_debt {
                    if let Some(cash) = metrics.cash_and_equivalents {
                        let enterprise_value = market_cap + debt - cash;
                        let ebitda = op_income; // Simplified
                        if ebitda > 0.0 {
                            valuations.insert(
                                "ev_to_ebitda".to_string(),
                                Some(enterprise_value / ebitda),
                            );
                        }
                    }
                }
            }
        }

        Ok(valuations)
    }

    /// Calculate margin metrics
    pub async fn calculate_margins(&self, ticker: &str) -> Result<HashMap<String, Option<f64>>> {
        let mut margins = HashMap::new();

        let latest = sqlx::query_as::<_, FinancialMetrics>(
            r#"
            SELECT * FROM financial_metrics
            WHERE ticker = $1
            ORDER BY period_end DESC
            LIMIT 1
            "#,
        )
        .bind(ticker)
        .fetch_optional(&self.db)
        .await?;

        if let Some(metrics) = latest {
            margins.insert(
                "gross_margin".to_string(),
                Self::calculate_margin(metrics.gross_profit, metrics.revenue),
            );

            margins.insert(
                "operating_margin".to_string(),
                Self::calculate_margin(metrics.operating_income, metrics.revenue),
            );

            margins.insert(
                "net_margin".to_string(),
                Self::calculate_margin(metrics.net_income, metrics.revenue),
            );
        }

        Ok(margins)
    }

    /// Calculate capital efficiency metrics
    pub async fn calculate_capital_efficiency(
        &self,
        ticker: &str,
    ) -> Result<HashMap<String, Option<f64>>> {
        let mut efficiency = HashMap::new();

        let latest = sqlx::query_as::<_, FinancialMetrics>(
            r#"
            SELECT * FROM financial_metrics
            WHERE ticker = $1
            ORDER BY period_end DESC
            LIMIT 1
            "#,
        )
        .bind(ticker)
        .fetch_optional(&self.db)
        .await?;

        if let Some(metrics) = latest {
            // ROE = Net Income / Shareholders Equity
            if let (Some(ni), Some(equity)) = (metrics.net_income, metrics.shareholders_equity) {
                if equity > 0.0 {
                    efficiency.insert("return_on_equity".to_string(), Some((ni / equity) * 100.0));
                }
            }

            // ROA = Net Income / Total Assets
            if let (Some(ni), Some(assets)) = (metrics.net_income, metrics.total_assets) {
                if assets > 0.0 {
                    efficiency.insert("return_on_assets".to_string(), Some((ni / assets) * 100.0));
                }
            }

            // Asset Turnover = Revenue / Total Assets
            if let (Some(rev), Some(assets)) = (metrics.revenue, metrics.total_assets) {
                if assets > 0.0 {
                    efficiency.insert("asset_turnover".to_string(), Some(rev / assets));
                }
            }
        }

        Ok(efficiency)
    }

    /// Calculate moving averages from price data
    pub fn calculate_moving_average(prices: &[PriceData], window: usize) -> Option<f64> {
        if prices.len() < window {
            return None;
        }

        let sum: f64 = prices.iter().rev().take(window).map(|p| p.close).sum();
        Some(sum / window as f64)
    }

    /// Calculate volatility (standard deviation of returns)
    pub fn calculate_volatility(prices: &[PriceData], window: usize) -> Option<f64> {
        if prices.len() < window + 1 {
            return None;
        }

        let recent_prices: Vec<f64> = prices
            .iter()
            .rev()
            .take(window + 1)
            .map(|p| p.close)
            .collect();

        // Calculate daily returns
        let returns: Vec<f64> = recent_prices
            .windows(2)
            .map(|w| ((w[0] - w[1]) / w[1]) * 100.0)
            .collect();

        // Calculate standard deviation
        let mean = returns.iter().sum::<f64>() / returns.len() as f64;
        let variance =
            returns.iter().map(|r| (r - mean).powi(2)).sum::<f64>() / returns.len() as f64;

        Some(variance.sqrt())
    }

    /// Calculate RSI (Relative Strength Index)
    pub fn calculate_rsi(prices: &[PriceData], window: usize) -> Option<f64> {
        if prices.len() < window + 1 {
            return None;
        }

        let recent_prices: Vec<f64> = prices
            .iter()
            .rev()
            .take(window + 1)
            .map(|p| p.close)
            .collect();

        let mut gains = Vec::new();
        let mut losses = Vec::new();

        for i in 1..recent_prices.len() {
            let change = recent_prices[i - 1] - recent_prices[i];
            if change > 0.0 {
                gains.push(change);
                losses.push(0.0);
            } else {
                gains.push(0.0);
                losses.push(change.abs());
            }
        }

        let avg_gain = gains.iter().sum::<f64>() / gains.len() as f64;
        let avg_loss = losses.iter().sum::<f64>() / losses.len() as f64;

        if avg_loss == 0.0 {
            return Some(100.0);
        }

        let rs = avg_gain / avg_loss;
        Some(100.0 - (100.0 / (1.0 + rs)))
    }

    /// Calculate percentile rank for a value in a historical series
    pub fn calculate_percentile(value: f64, historical: &[f64]) -> Option<f64> {
        if historical.is_empty() {
            return None;
        }

        let count_below = historical.iter().filter(|&&v| v < value).count();
        Some((count_below as f64 / historical.len() as f64) * 100.0)
    }

    /// Compute all features for a ticker
    pub async fn compute_features(
        &self,
        ticker: &str,
        market_service: &MarketDataService,
    ) -> Result<ComputedFeatures> {
        info!("Computing features for {}", ticker);

        let today = chrono::Utc::now().naive_utc().date();
        let one_year_ago = today - chrono::Duration::days(365);
        let five_years_ago = today - chrono::Duration::days(365 * 5);

        // Fetch price data
        let prices = market_service
            .get_prices(ticker, one_year_ago, today)
            .await
            .context("Failed to fetch prices")?;

        if prices.is_empty() {
            anyhow::bail!("No price data available for {}", ticker);
        }

        let current_price = prices.last().unwrap().close;

        // Get shares outstanding (simplified - using placeholder)
        let shares_outstanding = 2_500_000_000.0; // TODO: Extract from financials

        // Calculate all feature groups
        let growth = self.calculate_growth_metrics(ticker).await?;
        let valuations = self
            .calculate_valuation_metrics(ticker, current_price, shares_outstanding)
            .await?;
        let margins = self.calculate_margins(ticker).await?;
        let efficiency = self.calculate_capital_efficiency(ticker).await?;

        // Technical indicators
        let ma_50 = Self::calculate_moving_average(&prices, 50);
        let ma_200 = Self::calculate_moving_average(&prices, 200);
        let volatility_30 = Self::calculate_volatility(&prices, 30);
        let rsi = Self::calculate_rsi(&prices, 14);

        // Percentiles (5-year history)
        let historical_prices = market_service
            .get_prices(ticker, five_years_ago, today)
            .await
            .unwrap_or_default();

        let historical_closes: Vec<f64> = historical_prices.iter().map(|p| p.close).collect();
        let price_percentile = Self::calculate_percentile(current_price, &historical_closes);

        let pe = valuations.get("price_to_earnings").and_then(|v| *v);
        let pe_percentile = if let Some(pe_val) = pe {
            // TODO: Calculate historical P/E values for percentile
            Some(50.0) // Placeholder
        } else {
            None
        };

        Ok(ComputedFeatures {
            id: None,
            ticker: ticker.to_uppercase(),
            as_of_date: today,

            revenue_growth_qoq: growth.get("revenue_growth_qoq").and_then(|v| *v),
            revenue_growth_yoy: growth.get("revenue_growth_yoy").and_then(|v| *v),
            eps_growth_qoq: growth.get("eps_growth_qoq").and_then(|v| *v),
            eps_growth_yoy: growth.get("eps_growth_yoy").and_then(|v| *v),
            fcf_growth_yoy: growth.get("fcf_growth_yoy").and_then(|v| *v),

            price_to_earnings: pe,
            price_to_sales: valuations.get("price_to_sales").and_then(|v| *v),
            price_to_book: valuations.get("price_to_book").and_then(|v| *v),
            ev_to_ebitda: valuations.get("ev_to_ebitda").and_then(|v| *v),
            fcf_yield: valuations.get("fcf_yield").and_then(|v| *v),

            gross_margin: margins.get("gross_margin").and_then(|v| *v),
            operating_margin: margins.get("operating_margin").and_then(|v| *v),
            net_margin: margins.get("net_margin").and_then(|v| *v),

            return_on_equity: efficiency.get("return_on_equity").and_then(|v| *v),
            return_on_assets: efficiency.get("return_on_assets").and_then(|v| *v),
            asset_turnover: efficiency.get("asset_turnover").and_then(|v| *v),

            ma_50_day: ma_50,
            ma_200_day: ma_200,
            volatility_30_day: volatility_30,
            rsi_14_day: rsi,

            pe_percentile,
            price_percentile,
            volume_percentile: None, // TODO: Calculate

            created_at: None,
        })
    }

    /// Store computed features in database
    pub async fn store_features(&self, features: &ComputedFeatures) -> Result<i32> {
        let id = sqlx::query_scalar::<_, i32>(
            r#"
            INSERT INTO computed_features (
                ticker, as_of_date,
                revenue_growth_qoq, revenue_growth_yoy,
                eps_growth_qoq, eps_growth_yoy, fcf_growth_yoy,
                price_to_earnings, price_to_sales, price_to_book,
                ev_to_ebitda, fcf_yield,
                gross_margin, operating_margin, net_margin,
                return_on_equity, return_on_assets, asset_turnover,
                ma_50_day, ma_200_day, volatility_30_day, rsi_14_day,
                pe_percentile, price_percentile, volume_percentile
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18,
                $19, $20, $21, $22, $23, $24, $25
            )
            ON CONFLICT (ticker, as_of_date) DO UPDATE SET
                revenue_growth_yoy = EXCLUDED.revenue_growth_yoy,
                price_to_earnings = EXCLUDED.price_to_earnings,
                ma_50_day = EXCLUDED.ma_50_day
            RETURNING id
            "#,
        )
        .bind(&features.ticker)
        .bind(features.as_of_date)
        .bind(features.revenue_growth_qoq)
        .bind(features.revenue_growth_yoy)
        .bind(features.eps_growth_qoq)
        .bind(features.eps_growth_yoy)
        .bind(features.fcf_growth_yoy)
        .bind(features.price_to_earnings)
        .bind(features.price_to_sales)
        .bind(features.price_to_book)
        .bind(features.ev_to_ebitda)
        .bind(features.fcf_yield)
        .bind(features.gross_margin)
        .bind(features.operating_margin)
        .bind(features.net_margin)
        .bind(features.return_on_equity)
        .bind(features.return_on_assets)
        .bind(features.asset_turnover)
        .bind(features.ma_50_day)
        .bind(features.ma_200_day)
        .bind(features.volatility_30_day)
        .bind(features.rsi_14_day)
        .bind(features.pe_percentile)
        .bind(features.price_percentile)
        .bind(features.volume_percentile)
        .fetch_one(&self.db)
        .await?;

        Ok(id)
    }
}
