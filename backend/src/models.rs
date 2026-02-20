use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use sqlx::FromRow;

#[derive(Debug, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "finding_status", rename_all = "snake_case")]
pub enum FindingStatus {
    New,
    Triaged,
    Investigating,
    Resolved,
    Ignored,
}

#[derive(Debug, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "finding_type", rename_all = "snake_case")]
pub enum FindingType {
    DuplicatePayment,
    SubscriptionDrift,
    SpendSpike,
    VendorAnomaly,
    DataQuality,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub password_hash: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Portfolio {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Position {
    pub id: Uuid,
    pub portfolio_id: Uuid,
    pub ticker: String,
    pub weight: f64,
    pub asset_class: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MarketData {
    pub time: DateTime<Utc>,
    pub ticker: String,
    pub price: f64,
    pub volume: Option<i64>,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AIInsight {
    pub id: Uuid,
    pub ticker: Option<String>,
    pub insight_type: String,
    pub content: String,
    pub confidence: f64,
    pub generated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Workspace {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub company_name: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Waitlist {
    pub id: Uuid,
    pub email: String,
    pub company: Option<String>,
    pub role: Option<String>,
    pub company_size: Option<String>,
    pub top_pain: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Upload {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub file_name: String,
    pub file_type: String,
    pub file_url: Option<String>,
    pub file_size: Option<i64>,
    pub status: String,
    pub error_message: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub processed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Vendor {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub vendor_name: String,
    pub normalized_name: Option<String>,
    pub vendor_id: Option<String>,
    pub total_spend: Option<f64>, // numeric in DB
    pub invoice_count: Option<i32>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Invoice {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub upload_id: Option<Uuid>,
    pub vendor_id: Option<Uuid>,
    pub invoice_number: Option<String>,
    pub invoice_date: Option<chrono::NaiveDate>,
    pub amount: Option<f64>,
    pub currency: Option<String>,
    pub description: Option<String>,
    pub category: Option<String>,
    pub raw_data: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Finding {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub vendor_id: Option<Uuid>,
    pub finding_type: String,
    pub severity: Option<String>,
    pub amount: Option<f64>,
    pub confidence: Option<f64>,
    pub evidence: Option<serde_json::Value>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub created_at: DateTime<Utc>,
    pub resolved_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Report {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub report_type: Option<String>,
    pub total_spend_analyzed: Option<f64>,
    pub total_leaks_found: Option<f64>,
    pub leaks_percentage: Option<f64>,
    pub findings_count: Option<i32>,
    pub report_data: Option<serde_json::Value>,
    pub generated_at: DateTime<Utc>,
}
