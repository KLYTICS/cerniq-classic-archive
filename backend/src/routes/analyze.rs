use axum::{
    extract::{State, Json},
    response::Json as AxumJson,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use uuid::Uuid;
use std::path::PathBuf;
use std::collections::HashMap;

use crate::error::{AppError, Result};
use crate::state::AppState;
use crate::models::{Upload, Vendor};
use crate::parsers::parse_ap_export;
use crate::services::leak_detectors::{
    detect_duplicates, detect_subscription_drift, 
    detect_spend_spikes, detect_new_vendor_risks,
    detect_zombie_subscriptions, detect_vendor_duplicates,
    DetectedFinding,
};

#[derive(Deserialize)]
pub struct AnalyzeRequest {
    pub upload_id: Uuid,
    pub workspace_id: Uuid,
}

#[derive(Serialize)]
pub struct AnalysisResult {
    pub message: String,
    pub invoices_parsed: usize,
    pub vendors_created: usize,
    pub findings_found: usize,
    pub findings_by_type: HashMap<String, i32>,
    pub total_potential_savings: f64,
    pub status: String,
}

/// Run comprehensive leak detection analysis
pub async fn run_analysis(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<AnalyzeRequest>,
) -> Result<AxumJson<AnalysisResult>> {
    // 1. Get upload record
    let upload = sqlx::query_as::<_, Upload>("SELECT * FROM uploads WHERE id = $1")
        .bind(payload.upload_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Upload not found".to_string()))?;

    // 2. Parse file
    let file_path = upload.file_url.ok_or_else(|| AppError::InvalidInput("No file path".to_string()))?;
    let path = PathBuf::from(&file_path);

    if !path.exists() {
        return Err(AppError::Internal(format!("File not found: {}", file_path)));
    }

    let parsed_invoices = parse_ap_export(&path)?;
    let mut vendors_created = 0;

    // 3. Store invoices and vendors
    for inv in &parsed_invoices {
        // Upsert vendor
        let vendor = sqlx::query_as::<_, Vendor>(
            "SELECT id, workspace_id, vendor_name, normalized_name, vendor_id, total_spend::float8, invoice_count, created_at FROM vendors WHERE workspace_id = $1 AND vendor_name = $2"
        )
        .bind(payload.workspace_id)
        .bind(&inv.vendor)
        .fetch_optional(&state.db)
        .await?;

        let vendor_id = if let Some(v) = vendor {
            v.id
        } else {
            vendors_created += 1;
            let new_vendor = sqlx::query_as::<_, Vendor>(
                r#"
                INSERT INTO vendors (id, workspace_id, vendor_name, normalized_name)
                VALUES ($1, $2, $3, $4)
                RETURNING id, workspace_id, vendor_name, normalized_name, vendor_id, total_spend::float8, invoice_count, created_at
                "#
            )
            .bind(Uuid::new_v4())
            .bind(payload.workspace_id)
            .bind(&inv.vendor)
            .bind(inv.vendor.to_lowercase())
            .fetch_one(&state.db)
            .await?;
            new_vendor.id
        };

        // Insert invoice
        sqlx::query(
            r#"
            INSERT INTO invoices (
                id, workspace_id, upload_id, vendor_id, 
                invoice_number, invoice_date, amount, description
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            "#
        )
        .bind(Uuid::new_v4())
        .bind(payload.workspace_id)
        .bind(payload.upload_id)
        .bind(vendor_id)
        .bind(&inv.invoice_number)
        .bind(inv.date)
        .bind(inv.amount)
        .bind(&inv.description)
        .execute(&state.db)
        .await?;
    }

    // 4. Run all leak detectors
    let mut all_findings: Vec<DetectedFinding> = Vec::new();
    
    // Run each detector and collect findings
    let duplicates = detect_duplicates(payload.workspace_id, &state.db).await?;
    let drift = detect_subscription_drift(payload.workspace_id, &state.db).await?;
    let spikes = detect_spend_spikes(payload.workspace_id, &state.db).await?;
    let new_vendor_risks = detect_new_vendor_risks(payload.workspace_id, &state.db).await?;
    let zombie_subs = detect_zombie_subscriptions(payload.workspace_id, &state.db).await?;
    let vendor_dups = detect_vendor_duplicates(payload.workspace_id, &state.db).await?;

    all_findings.extend(duplicates);
    all_findings.extend(drift);
    all_findings.extend(spikes);
    all_findings.extend(new_vendor_risks);
    all_findings.extend(zombie_subs);
    all_findings.extend(vendor_dups);

    // 5. Store findings (with deduplication via hash)
    let mut findings_stored = 0;
    let mut findings_by_type: HashMap<String, i32> = HashMap::new();
    let mut total_savings = 0.0;

    for finding in &all_findings {
        // Check if finding with this hash already exists
        let exists: Option<(Uuid,)> = sqlx::query_as(
            "SELECT id FROM findings WHERE workspace_id = $1 AND hash = $2"
        )
        .bind(payload.workspace_id)
        .bind(&finding.hash)
        .fetch_optional(&state.db)
        .await?;

        if exists.is_none() {
            // Map severity int to string
            let severity_str = match finding.severity {
                s if s >= 80 => "high",
                s if s >= 50 => "medium",
                _ => "low",
            };
            
            sqlx::query(
                r#"
                INSERT INTO findings (
                    id, workspace_id, finding_type, severity, status,
                    description, evidence, amount, confidence, hash
                )
                VALUES ($1, $2, $3, $4, 'open', $5, $6, $7, $8, $9)
                "#
            )
            .bind(Uuid::new_v4())
            .bind(payload.workspace_id)
            .bind(&finding.finding_type)
            .bind(severity_str)
            .bind(&finding.explanation)
            .bind(&finding.evidence)
            .bind(finding.potential_savings)
            .bind(0.8f64) // confidence
            .bind(&finding.hash)
            .execute(&state.db)
            .await?;

            findings_stored += 1;
            total_savings += finding.potential_savings;

            // Count by type
            *findings_by_type.entry(finding.finding_type.clone()).or_insert(0) += 1;
        }
    }

    // 6. Update upload status
    sqlx::query("UPDATE uploads SET status = 'completed', processed_at = NOW() WHERE id = $1")
        .bind(payload.upload_id)
        .execute(&state.db)
        .await?;

    // 7. Update vendor stats
    sqlx::query(
        r#"
        UPDATE vendors v SET 
            total_spend = (SELECT COALESCE(SUM(amount), 0) FROM invoices i WHERE i.vendor_id = v.id),
            invoice_count = (SELECT COUNT(*) FROM invoices i WHERE i.vendor_id = v.id)
        WHERE workspace_id = $1
        "#
    )
    .bind(payload.workspace_id)
    .execute(&state.db)
    .await?;

    Ok(AxumJson(AnalysisResult {
        message: "Analysis complete".to_string(),
        invoices_parsed: parsed_invoices.len(),
        vendors_created,
        findings_found: findings_stored,
        findings_by_type,
        total_potential_savings: total_savings,
        status: "completed".to_string(),
    }))
}

/// Get analysis status for a workspace
pub async fn get_analysis_status(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(workspace_id): axum::extract::Path<Uuid>,
) -> Result<AxumJson<Value>> {
    // Get counts
    let (invoices,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM invoices WHERE workspace_id = $1"
    )
    .bind(workspace_id)
    .fetch_one(&state.db)
    .await?;

    let (findings,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM findings WHERE workspace_id = $1"
    )
    .bind(workspace_id)
    .fetch_one(&state.db)
    .await?;

    let (pending_uploads,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM uploads WHERE workspace_id = $1 AND status = 'pending'"
    )
    .bind(workspace_id)
    .fetch_one(&state.db)
    .await?;

    let (total_savings,): (Option<f64>,) = sqlx::query_as(
        "SELECT COALESCE(SUM(potential_savings_amount), 0) FROM findings WHERE workspace_id = $1"
    )
    .bind(workspace_id)
    .fetch_one(&state.db)
    .await?;

    Ok(AxumJson(json!({
        "workspace_id": workspace_id,
        "total_invoices": invoices,
        "total_findings": findings,
        "pending_uploads": pending_uploads,
        "total_potential_savings": total_savings.unwrap_or(0.0),
        "status": if pending_uploads > 0 { "processing" } else { "ready" }
    })))
}

