//! SEC EDGAR filing ingestion and parsing service
//!
//! This service fetches and parses SEC filings (10-K, 10-Q) to extract
//! fundamental financial metrics needed for valuation and KPI scoring.

use anyhow::{Context, Result};
use chrono::NaiveDate;
use regex::Regex;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::collections::HashMap;
use tracing::{info, warn};

/// SEC filing metadata
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SecFiling {
    pub id: Option<i32>,
    pub ticker: String,
    pub cik: String,
    pub form_type: String,
    pub filing_date: NaiveDate,
    pub fiscal_period: String,
    pub fiscal_year: i32,
    pub accession_number: String,
    pub filing_url: String,
    pub processed: bool,
}

/// Extracted financial metrics
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct FinancialMetrics {
    pub filing_id: i32,
    pub ticker: String,
    pub period_end: NaiveDate,

    // Income Statement
    pub revenue: Option<f64>,
    pub cost_of_revenue: Option<f64>,
    pub gross_profit: Option<f64>,
    pub operating_income: Option<f64>,
    pub net_income: Option<f64>,
    pub eps_basic: Option<f64>,
    pub eps_diluted: Option<f64>,

    // Balance Sheet
    pub total_assets: Option<f64>,
    pub total_liabilities: Option<f64>,
    pub shareholders_equity: Option<f64>,
    pub cash_and_equivalents: Option<f64>,
    pub total_debt: Option<f64>,

    // Cash Flow
    pub operating_cash_flow: Option<f64>,
    pub investing_cash_flow: Option<f64>,
    pub financing_cash_flow: Option<f64>,
    pub free_cash_flow: Option<f64>,
    pub capex: Option<f64>,

    // Other
    pub shares_outstanding: Option<f64>,
    pub rd_expense: Option<f64>,
    pub backlog: Option<f64>,
}

/// SEC EDGAR service
pub struct SecFilingService {
    http_client: Client,
    db: PgPool,
    user_agent: String,
}

impl SecFilingService {
    pub fn new(db: PgPool, user_agent: String) -> Self {
        Self {
            http_client: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("Failed to build HTTP client"),
            db,
            user_agent,
        }
    }

    /// Get CIK (Central Index Key) for a ticker
    pub async fn get_cik(&self, ticker: &str) -> Result<String> {
        // SEC maintains a ticker to CIK mapping
        let url = format!(
            "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={}&type=&dateb=&owner=exclude&count=1&output=json",
            ticker
        );

        let response: serde_json::Value = self
            .http_client
            .get(&url)
            .header("User-Agent", &self.user_agent)
            .send()
            .await?
            .json()
            .await?;

        let cik = response["CIK"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("CIK not found for {}", ticker))?
            .to_string();

        Ok(cik)
    }

    /// Fetch recent filings for a ticker
    pub async fn fetch_filings(
        &self,
        ticker: &str,
        form_types: &[&str],
        limit: usize,
    ) -> Result<Vec<SecFiling>> {
        let cik = self.get_cik(ticker).await?;

        let mut filings = Vec::new();

        for form_type in form_types {
            let url = format!(
                "https://data.sec.gov/submissions/CIK{}.json",
                cik.trim_start_matches('0')
            );

            let response: serde_json::Value = self
                .http_client
                .get(&url)
                .header("User-Agent", &self.user_agent)
                .send()
                .await
                .context("Failed to fetch SEC submissions")?
                .json()
                .await?;

            // Parse recent filings
            if let Some(recent) = response["filings"]["recent"].as_object() {
                let forms = recent["form"].as_array().unwrap();
                let dates = recent["filingDate"].as_array().unwrap();
                let accessions = recent["accessionNumber"].as_array().unwrap();
                let fiscal_years = recent["fiscalYearEnd"].as_array().unwrap();

                for i in 0..forms.len().min(limit) {
                    if forms[i].as_str().unwrap() == *form_type {
                        let accession = accessions[i].as_str().unwrap().replace("-", "");
                        let filing_url = format!(
                            "https://www.sec.gov/cgi-bin/viewer?action=view&cik={}&accession_number={}&xbrl_type=v",
                            cik, accessions[i].as_str().unwrap()
                        );

                        filings.push(SecFiling {
                            id: None,
                            ticker: ticker.to_uppercase(),
                            cik: cik.clone(),
                            form_type: form_type.to_string(),
                            filing_date: NaiveDate::parse_from_str(
                                dates[i].as_str().unwrap(),
                                "%Y-%m-%d",
                            )?,
                            fiscal_period: "Q4".to_string(), // Simplified
                            fiscal_year: fiscal_years[i].as_str().unwrap().parse()?,
                            accession_number: accession,
                            filing_url,
                            processed: false,
                        });
                    }
                }
            }
        }

        Ok(filings)
    }

    /// Store filing metadata in database
    pub async fn store_filing(&self, filing: &SecFiling) -> Result<i32> {
        let id = sqlx::query_scalar::<_, i32>(
            r#"
            INSERT INTO sec_filings (
                ticker, cik, form_type, filing_date, fiscal_period,
                fiscal_year, accession_number, filing_url, processed
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (ticker, accession_number) DO UPDATE SET
                filing_date = EXCLUDED.filing_date,
                processed = EXCLUDED.processed
            RETURNING id
            "#,
        )
        .bind(&filing.ticker)
        .bind(&filing.cik)
        .bind(&filing.form_type)
        .bind(&filing.filing_date)
        .bind(&filing.fiscal_period)
        .bind(&filing.fiscal_year)
        .bind(&filing.accession_number)
        .bind(&filing.filing_url)
        .bind(filing.processed)
        .fetch_one(&self.db)
        .await?;

        Ok(id)
    }

    /// Parse XBRL data from filing (simplified version)
    ///
    /// Note: Full XBRL parsing is complex. This is a basic implementation
    /// that extracts common financial metrics. For production, consider
    /// using a dedicated XBRL library or the SEC's XBRL API.
    pub async fn parse_filing(&self, filing: &SecFiling) -> Result<FinancialMetrics> {
        // Fetch the filing HTML
        let html = self
            .http_client
            .get(&filing.filing_url)
            .header("User-Agent", &self.user_agent)
            .send()
            .await?
            .text()
            .await?;

        // Extract metrics using regex patterns (simplified approach)
        let metrics = FinancialMetrics {
            filing_id: filing.id.unwrap_or(0),
            ticker: filing.ticker.clone(),
            period_end: filing.filing_date,

            // These would be extracted from XBRL tags
            // For now, returning None - will implement proper parser next
            revenue: Self::extract_metric(&html, "Revenues?|Total\\s+Revenue"),
            cost_of_revenue: Self::extract_metric(&html, "Cost\\s+of\\s+Revenue"),
            gross_profit: Self::extract_metric(&html, "Gross\\s+Profit"),
            operating_income: Self::extract_metric(&html, "Operating\\s+Income"),
            net_income: Self::extract_metric(&html, "Net\\s+Income"),
            eps_diluted: Self::extract_metric(&html, "Earnings\\s+Per\\s+Share.*Diluted"),

            total_assets: Self::extract_metric(&html, "Total\\s+Assets"),
            total_liabilities: Self::extract_metric(&html, "Total\\s+Liabilities"),
            cash_and_equivalents: Self::extract_metric(&html, "Cash\\s+and\\s+Cash\\s+Equivalents"),
            total_debt: Self::extract_metric(&html, "Total\\s+Debt"),

            operating_cash_flow: Self::extract_metric(&html, "Operating\\s+Activities.*Cash"),
            capex: Self::extract_metric(&html, "Capital\\s+Expenditures"),

            // Calculated field
            free_cash_flow: None,
            shareholders_equity: None,
            eps_basic: None,
            investing_cash_flow: None,
            financing_cash_flow: None,
            shares_outstanding: None,
            rd_expense: None,
            backlog: None,
        };

        Ok(metrics)
    }

    /// Simple metric extraction using regex
    /// Note: This is a placeholder - proper implementation would use XBRL parsing
    fn extract_metric(html: &str, pattern: &str) -> Option<f64> {
        let re = Regex::new(&format!(r"{}:\s*\$?([\d,]+)", pattern)).ok()?;

        if let Some(caps) = re.captures(html) {
            let value_str = caps.get(1)?.as_str().replace(",", "");
            value_str.parse::<f64>().ok()
        } else {
            None
        }
    }

    /// Store financial metrics
    pub async fn store_metrics(&self, metrics: &FinancialMetrics) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO financial_metrics (
                filing_id, ticker, period_end,
                revenue, cost_of_revenue, gross_profit, operating_income, net_income,
                eps_basic, eps_diluted,
                total_assets, total_liabilities, shareholders_equity,
                cash_and_equivalents, total_debt,
                operating_cash_flow, investing_cash_flow, financing_cash_flow,
                free_cash_flow, capex,
                shares_outstanding, rd_expense, backlog
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18,
                $19, $20, $21, $22, $23
            )
            ON CONFLICT (filing_id) DO UPDATE SET
                revenue = EXCLUDED.revenue,
                net_income = EXCLUDED.net_income,
                total_assets = EXCLUDED.total_assets
            "#,
        )
        .bind(metrics.filing_id)
        .bind(&metrics.ticker)
        .bind(metrics.period_end)
        .bind(metrics.revenue)
        .bind(metrics.cost_of_revenue)
        .bind(metrics.gross_profit)
        .bind(metrics.operating_income)
        .bind(metrics.net_income)
        .bind(metrics.eps_basic)
        .bind(metrics.eps_diluted)
        .bind(metrics.total_assets)
        .bind(metrics.total_liabilities)
        .bind(metrics.shareholders_equity)
        .bind(metrics.cash_and_equivalents)
        .bind(metrics.total_debt)
        .bind(metrics.operating_cash_flow)
        .bind(metrics.investing_cash_flow)
        .bind(metrics.financing_cash_flow)
        .bind(metrics.free_cash_flow)
        .bind(metrics.capex)
        .bind(metrics.shares_outstanding)
        .bind(metrics.rd_expense)
        .bind(metrics.backlog)
        .execute(&self.db)
        .await?;

        Ok(())
    }

    /// Process a ticker: fetch filings and extract metrics
    pub async fn process_ticker(&self, ticker: &str) -> Result<usize> {
        info!("Processing SEC filings for {}", ticker);

        // Fetch recent 10-K and 10-Q filings
        let filings = self.fetch_filings(ticker, &["10-K", "10-Q"], 8).await?;

        let mut processed = 0;

        for filing in filings {
            // Store filing metadata
            let filing_id = self.store_filing(&filing).await?;

            // Parse and extract metrics
            let mut filing_with_id = filing.clone();
            filing_with_id.id = Some(filing_id);

            match self.parse_filing(&filing_with_id).await {
                Ok(metrics) => {
                    self.store_metrics(&metrics).await?;
                    processed += 1;
                    info!("Processed {} filing from {}", ticker, filing.filing_date);
                }
                Err(e) => {
                    warn!("Failed to parse filing: {}", e);
                }
            }

            // Rate limiting: SEC requires 10 requests per second max
            tokio::time::sleep(tokio::time::Duration::from_millis(150)).await;
        }

        Ok(processed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore]
    async fn test_fetch_filings() {
        let db_url = std::env::var("DATABASE_URL").expect("DATABASE_URL not set");
        let db = PgPool::connect(&db_url).await.unwrap();

        let service =
            SecFilingService::new(db, "CERNIQ/1.0 (contact@example.com)".to_string());

        let filings = service.fetch_filings("NVDA", &["10-K"], 2).await.unwrap();

        assert!(!filings.is_empty());
        assert_eq!(filings[0].ticker, "NVDA");
        println!("Found {} filings", filings.len());
    }
}
