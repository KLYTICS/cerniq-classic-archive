use axum::{
    extract::{State, Path, Query},
    response::Json as AxumJson,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use uuid::Uuid;
use chrono::{Utc, Duration};
use std::collections::HashMap;

use crate::error::{AppError, Result};
use crate::state::AppState;

#[derive(Deserialize)]
pub struct GenerateReportRequest {
    pub workspace_id: Uuid,
    pub title: Option<String>,
}

#[derive(Serialize)]
pub struct ReportResponse {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub title: String,
    pub generated_at: String,
    pub executive_summary: ExecutiveSummary,
    pub findings_by_type: HashMap<String, Vec<FindingSummary>>,
    pub vendor_breakdown: Vec<VendorBreakdown>,
    pub recommended_actions: Vec<String>,
}

#[derive(Serialize, Clone)]
pub struct ExecutiveSummary {
    pub total_spend_analyzed: f64,
    pub total_leaks_found: f64,
    pub leaks_percentage: f64,
    pub findings_count: i64,
    pub resolved_count: i64,
    pub potential_annual_savings: f64,
}

#[derive(Serialize, Clone)]
pub struct FindingSummary {
    pub id: Uuid,
    pub title: String,
    pub entity_name: String,
    pub severity: i32,
    pub potential_savings: f64,
    pub status: String,
}

#[derive(Serialize, Clone)]
pub struct VendorBreakdown {
    pub vendor_name: String,
    pub total_spend: f64,
    pub findings_count: i64,
    pub potential_savings: f64,
}

#[derive(Deserialize)]
pub struct ExportQuery {
    pub format: Option<String>,
}

/// Generate a new report for a workspace
pub async fn generate_report(
    State(state): State<Arc<AppState>>,
    AxumJson(payload): AxumJson<GenerateReportRequest>,
) -> Result<AxumJson<ReportResponse>> {
    let workspace_id = payload.workspace_id;

    // Get executive summary data
    let summary = get_executive_summary(workspace_id, &state).await?;

    // Get findings grouped by type
    let findings_by_type = get_findings_by_type(workspace_id, &state).await?;

    // Get vendor breakdown
    let vendor_breakdown = get_vendor_breakdown(workspace_id, &state).await?;

    // Generate recommended actions
    let recommended_actions = generate_recommendations(&findings_by_type);

    // Store report in database
    let report_id = Uuid::new_v4();
    let title = payload.title.unwrap_or_else(|| {
        format!("Spend Leak Report - {}", Utc::now().format("%Y-%m-%d"))
    });

    sqlx::query(
        r#"
        INSERT INTO reports (id, workspace_id, title, report_data, generated_at)
        VALUES ($1, $2, $3, $4, NOW())
        "#
    )
    .bind(report_id)
    .bind(workspace_id)
    .bind(&title)
    .bind(json!({
        "executive_summary": summary,
        "findings_by_type": findings_by_type,
        "vendor_breakdown": vendor_breakdown,
        "recommended_actions": recommended_actions
    }))
    .execute(&state.db)
    .await?;

    Ok(AxumJson(ReportResponse {
        id: report_id,
        workspace_id,
        title,
        generated_at: Utc::now().to_rfc3339(),
        executive_summary: summary,
        findings_by_type,
        vendor_breakdown,
        recommended_actions,
    }))
}

/// Get a previously generated report
pub async fn get_report(
    State(state): State<Arc<AppState>>,
    Path(report_id): Path<Uuid>,
) -> Result<AxumJson<Value>> {
    let report: Option<(Uuid, Uuid, String, Value, chrono::DateTime<Utc>)> = sqlx::query_as(
        "SELECT id, workspace_id, title, report_data, generated_at FROM reports WHERE id = $1"
    )
    .bind(report_id)
    .fetch_optional(&state.db)
    .await?;

    match report {
        Some((id, workspace_id, title, data, generated_at)) => {
            Ok(AxumJson(json!({
                "id": id,
                "workspace_id": workspace_id,
                "title": title,
                "generated_at": generated_at.to_rfc3339(),
                "data": data
            })))
        }
        None => Err(AppError::NotFound("Report not found".to_string()))
    }
}

/// Export report in different formats
pub async fn export_report(
    State(state): State<Arc<AppState>>,
    Path(report_id): Path<Uuid>,
    Query(query): Query<ExportQuery>,
) -> Result<AxumJson<Value>> {
    let report: Option<(Uuid, String, Value)> = sqlx::query_as(
        "SELECT workspace_id, title, report_data FROM reports WHERE id = $1"
    )
    .bind(report_id)
    .fetch_optional(&state.db)
    .await?;

    let (workspace_id, title, data) = report
        .ok_or_else(|| AppError::NotFound("Report not found".to_string()))?;

    let format = query.format.unwrap_or_else(|| "json".to_string());

    match format.as_str() {
        "json" => {
            Ok(AxumJson(json!({
                "format": "json",
                "report_id": report_id,
                "title": title,
                "workspace_id": workspace_id,
                "data": data
            })))
        }
        "text" => {
            let text_report = generate_text_report(&title, &data);
            Ok(AxumJson(json!({
                "format": "text",
                "report_id": report_id,
                "title": title,
                "content": text_report
            })))
        }
        _ => Err(AppError::InvalidInput(format!("Unknown format: {}", format)))
    }
}

/// Create a shareable brief with public token
pub async fn create_brief(
    State(state): State<Arc<AppState>>,
    Path(report_id): Path<Uuid>,
) -> Result<AxumJson<Value>> {
    // Check report exists
    let report: Option<(Uuid, String, Value)> = sqlx::query_as(
        "SELECT workspace_id, title, report_data FROM reports WHERE id = $1"
    )
    .bind(report_id)
    .fetch_optional(&state.db)
    .await?;

    let (workspace_id, title, data) = report
        .ok_or_else(|| AppError::NotFound("Report not found".to_string()))?;

    // Generate public token
    let token = Uuid::new_v4().to_string().replace("-", "")[..12].to_string();
    let expires_at = Utc::now() + Duration::days(7);

    // Extract summary for brief
    let summary = data.get("executive_summary").cloned().unwrap_or(json!({}));

    sqlx::query(
        r#"
        INSERT INTO briefs (id, report_id, workspace_id, token, title, summary_data, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        "#
    )
    .bind(Uuid::new_v4())
    .bind(report_id)
    .bind(workspace_id)
    .bind(&token)
    .bind(&title)
    .bind(&summary)
    .bind(expires_at)
    .execute(&state.db)
    .await?;

    Ok(AxumJson(json!({
        "token": token,
        "public_url": format!("/pub/briefs/{}", token),
        "expires_at": expires_at.to_rfc3339(),
        "title": title
    })))
}

/// Get public brief (no auth required)
pub async fn get_public_brief(
    State(state): State<Arc<AppState>>,
    Path(token): Path<String>,
) -> Result<AxumJson<Value>> {
    let brief: Option<(String, Value, chrono::DateTime<Utc>)> = sqlx::query_as(
        "SELECT title, summary_data, expires_at FROM briefs WHERE token = $1 AND expires_at > NOW()"
    )
    .bind(&token)
    .fetch_optional(&state.db)
    .await?;

    match brief {
        Some((title, summary, expires_at)) => {
            Ok(AxumJson(json!({
                "title": title,
                "summary": summary,
                "expires_at": expires_at.to_rfc3339(),
                "is_public": true
            })))
        }
        None => Err(AppError::NotFound("Brief not found or expired".to_string()))
    }
}

// Helper functions

async fn get_executive_summary(workspace_id: Uuid, state: &Arc<AppState>) -> Result<ExecutiveSummary> {
    // Total spend analyzed
    let (total_spend,): (Option<f64>,) = sqlx::query_as(
        "SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE workspace_id = $1"
    )
    .bind(workspace_id)
    .fetch_one(&state.db)
    .await?;

    // Total leaks and counts
    let (total_leaks, findings_count): (Option<f64>, i64) = sqlx::query_as(
        "SELECT COALESCE(SUM(potential_savings_amount), 0), COUNT(*) FROM findings WHERE workspace_id = $1"
    )
    .bind(workspace_id)
    .fetch_one(&state.db)
    .await?;

    // Resolved count
    let (resolved_count,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM findings WHERE workspace_id = $1 AND status = 'resolved'"
    )
    .bind(workspace_id)
    .fetch_one(&state.db)
    .await?;

    let spend = total_spend.unwrap_or(0.0);
    let leaks = total_leaks.unwrap_or(0.0);
    let percentage = if spend > 0.0 { (leaks / spend) * 100.0 } else { 0.0 };

    Ok(ExecutiveSummary {
        total_spend_analyzed: spend,
        total_leaks_found: leaks,
        leaks_percentage: percentage,
        findings_count,
        resolved_count,
        potential_annual_savings: leaks * 1.2, // Assume some recurring savings
    })
}

async fn get_findings_by_type(workspace_id: Uuid, state: &Arc<AppState>) -> Result<HashMap<String, Vec<FindingSummary>>> {
    let findings: Vec<(Uuid, String, String, String, i32, Option<f64>, String)> = sqlx::query_as(
        r#"
        SELECT id, type::text, title, entity_name, severity, potential_savings_amount, status::text
        FROM findings 
        WHERE workspace_id = $1
        ORDER BY severity DESC
        "#
    )
    .bind(workspace_id)
    .fetch_all(&state.db)
    .await?;

    let mut grouped: HashMap<String, Vec<FindingSummary>> = HashMap::new();

    for (id, finding_type, title, entity_name, severity, savings, status) in findings {
        let summary = FindingSummary {
            id,
            title,
            entity_name,
            severity,
            potential_savings: savings.unwrap_or(0.0),
            status,
        };
        grouped.entry(finding_type).or_insert_with(Vec::new).push(summary);
    }

    Ok(grouped)
}

async fn get_vendor_breakdown(workspace_id: Uuid, state: &Arc<AppState>) -> Result<Vec<VendorBreakdown>> {
    let vendors: Vec<(String, Option<f64>, i64, Option<f64>)> = sqlx::query_as(
        r#"
        SELECT 
            v.vendor_name,
            v.total_spend,
            COUNT(f.id) as findings_count,
            COALESCE(SUM(f.potential_savings_amount), 0) as potential_savings
        FROM vendors v
        LEFT JOIN findings f ON f.entity_name = v.vendor_name AND f.workspace_id = v.workspace_id
        WHERE v.workspace_id = $1
        GROUP BY v.id, v.vendor_name, v.total_spend
        HAVING COUNT(f.id) > 0
        ORDER BY potential_savings DESC
        LIMIT 10
        "#
    )
    .bind(workspace_id)
    .fetch_all(&state.db)
    .await?;

    Ok(vendors.into_iter().map(|(name, spend, count, savings)| {
        VendorBreakdown {
            vendor_name: name,
            total_spend: spend.unwrap_or(0.0),
            findings_count: count,
            potential_savings: savings.unwrap_or(0.0),
        }
    }).collect())
}

fn generate_recommendations(findings: &HashMap<String, Vec<FindingSummary>>) -> Vec<String> {
    let mut recommendations = Vec::new();

    if let Some(duplicates) = findings.get("duplicate_payment") {
        if !duplicates.is_empty() {
            let total: f64 = duplicates.iter().map(|f| f.potential_savings).sum();
            recommendations.push(format!(
                "Priority 1: Request refunds for {} duplicate payments (${:.2} potential recovery)",
                duplicates.len(), total
            ));
        }
    }

    if let Some(zombies) = findings.get("zombie_subscription") {
        if !zombies.is_empty() {
            recommendations.push(format!(
                "Priority 2: Cancel {} zombie subscriptions immediately",
                zombies.len()
            ));
        }
    }

    if let Some(drift) = findings.get("subscription_drift") {
        if !drift.is_empty() {
            recommendations.push(format!(
                "Priority 3: Review {} subscription price changes with vendors",
                drift.len()
            ));
        }
    }

    if let Some(spikes) = findings.get("spend_spike") {
        if !spikes.is_empty() {
            recommendations.push(format!(
                "Priority 4: Verify {} unusual spend amounts for legitimacy",
                spikes.len()
            ));
        }
    }

    if let Some(vendor_dups) = findings.get("vendor_duplicate") {
        if !vendor_dups.is_empty() {
            recommendations.push(format!(
                "Priority 5: Consolidate {} duplicate vendor entries in AP system",
                vendor_dups.len()
            ));
        }
    }

    if recommendations.is_empty() {
        recommendations.push("No actionable findings detected. Great job!".to_string());
    }

    recommendations
}

fn generate_text_report(title: &str, data: &Value) -> String {
    let summary = data.get("executive_summary").cloned().unwrap_or(json!({}));
    let actions = data.get("recommended_actions")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let mut report = String::new();
    
    report.push_str("═══════════════════════════════════════════════════════════\n");
    report.push_str(&format!("  {}\n", title.to_uppercase()));
    report.push_str(&format!("  Generated: {}\n", Utc::now().format("%B %d, %Y")));
    report.push_str("═══════════════════════════════════════════════════════════\n\n");

    report.push_str("EXECUTIVE SUMMARY\n");
    report.push_str("─────────────────\n");
    report.push_str(&format!("  Total Spend Analyzed:    ${:.2}\n", 
        summary.get("total_spend_analyzed").and_then(|v| v.as_f64()).unwrap_or(0.0)));
    report.push_str(&format!("  Total Leaks Found:       ${:.2}\n", 
        summary.get("total_leaks_found").and_then(|v| v.as_f64()).unwrap_or(0.0)));
    report.push_str(&format!("  Leak Percentage:         {:.1}%\n", 
        summary.get("leaks_percentage").and_then(|v| v.as_f64()).unwrap_or(0.0)));
    report.push_str(&format!("  Findings Count:          {}\n", 
        summary.get("findings_count").and_then(|v| v.as_i64()).unwrap_or(0)));
    report.push_str(&format!("  Potential Annual Savings: ${:.2}\n\n", 
        summary.get("potential_annual_savings").and_then(|v| v.as_f64()).unwrap_or(0.0)));

    report.push_str("RECOMMENDED ACTIONS\n");
    report.push_str("───────────────────\n");
    for (i, action) in actions.iter().enumerate() {
        if let Some(text) = action.as_str() {
            report.push_str(&format!("  {}. {}\n", i + 1, text));
        }
    }
    report.push_str("\n");

    report.push_str("═══════════════════════════════════════════════════════════\n");
    report.push_str("  Report generated by SpendCheck\n");
    report.push_str("═══════════════════════════════════════════════════════════\n");

    report
}
