use axum::{
    extract::{State, Json},
    response::Json as AxumJson,
};
use serde::{Deserialize};
use serde_json::{json, Value};
use std::sync::Arc;
use uuid::Uuid;

use crate::error::{AppError, Result};
use crate::state::AppState;
use crate::models::{Report, Finding};

#[derive(Deserialize)]
pub struct GenerateReportRequest {
    pub workspace_id: Uuid,
}

pub async fn generate_report(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<GenerateReportRequest>,
) -> Result<AxumJson<Value>> {
    // 1. Fetch all findings for workspace
    let findings = sqlx::query_as::<_, Finding>(
        "SELECT * FROM findings WHERE workspace_id = $1 ORDER BY amount DESC"
    )
    .bind(payload.workspace_id)
    .fetch_all(&state.db)
    .await?;

    if findings.is_empty() {
        return Err(AppError::InvalidInput("No findings to report. Run analysis first.".to_string()));
    }

    // 2. Calculate aggregations
    let findings_count = findings.len() as i32;
    let total_leaks_found: f64 = findings.iter().map(|f| f.amount.unwrap_or(0.0)).sum();
    
    // In a real app, we'd fetch total_spend from vendors table
    let total_spend_analyzed = 1_000_000.0; // Placeholder
    let leaks_percentage = (total_leaks_found / total_spend_analyzed) * 100.0;

    // 3. Generate Formatted Memo Text
    let mut memo = String::new();
    memo.push_str("EXECUTIVE LEAK AUDIT REPORT\n");
    memo.push_str("===========================\n\n");
    
    memo.push_str("SUMMARY\n");
    memo.push_str(&format!("Total Potential Recovery: ${:.2}\n", total_leaks_found));
    memo.push_str(&format!("Leakage Rate: {:.2}% of analyzed spend\n", leaks_percentage));
    memo.push_str(&format!("Issues Identified: {}\n\n", findings_count));

    memo.push_str("TOP PRIORITY LEAKS\n");
    memo.push_str("------------------\n");
    
    for (i, finding) in findings.iter().take(5).enumerate() {
        let amount = finding.amount.unwrap_or(0.0);
        let vendor = finding.description.as_deref().unwrap_or("Unknown Vendor");
        memo.push_str(&format!("{}. ${:.2} - {}\n", i + 1, amount, vendor));
        memo.push_str(&format!("   Risk: {} | Type: {}\n\n", 
            finding.severity.as_deref().unwrap_or("Medium"),
            finding.finding_type
        ));
    }

    memo.push_str("RECOMMENDED ACTIONS\n");
    memo.push_str("-------------------\n");
    memo.push_str("1. Immediate: Contact vendors listed above for credit/refund.\n");
    memo.push_str("2. Process: Implement unique invoice number validation in AP.\n");
    memo.push_str("3. Review: Check auto-renewal clauses for upcoming contracts.\n");

    // 4. Store Report
    let report_data = json!({
        "memo_text": memo,
        "top_findings": findings.iter().take(10).collect::<Vec<_>>()
    });

    let report = sqlx::query_as::<_, Report>(
        r#"
        INSERT INTO reports (
            id, workspace_id, report_type, total_spend_analyzed, 
            total_leaks_found, leaks_percentage, findings_count, report_data
        )
        VALUES ($1, $2, 'leak_audit', $3, $4, $5, $6, $7)
        RETURNING *
        "#
    )
    .bind(Uuid::new_v4())
    .bind(payload.workspace_id)
    .bind(total_spend_analyzed)
    .bind(total_leaks_found)
    .bind(leaks_percentage)
    .bind(findings_count)
    .bind(report_data)
    .fetch_one(&state.db)
    .await?;

    Ok(AxumJson(json!({
        "message": "Report generated successfully",
        "report_id": report.id,
        "summary": {
            "total_found": total_leaks_found,
            "count": findings_count
        },
        "memo": memo
    })))
}

pub async fn get_report(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(report_id): axum::extract::Path<Uuid>,
) -> Result<AxumJson<Value>> {
    let report = sqlx::query_as::<_, Report>("SELECT * FROM reports WHERE id = $1")
        .bind(report_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Report not found".to_string()))?;

    Ok(AxumJson(json!(report)))
}
