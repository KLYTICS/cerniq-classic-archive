//! Findings Management Routes for SpendCheck

use axum::{
    extract::{Json, Path, Query, State},
    response::Json as AxumJson,
    Extension,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use uuid::Uuid;

use crate::error::{AppError, Result};
use crate::state::AppState;

#[derive(Deserialize)]
pub struct FindingsQuery {
    pub workspace_id: Uuid,
    #[serde(rename = "type")]
    pub finding_type: Option<String>,
    pub status: Option<String>,
    pub severity_min: Option<i32>,
    pub limit: Option<i32>,
    pub offset: Option<i32>,
}

#[derive(Serialize)]
pub struct FindingResponse {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub finding_type: String,
    pub severity: Option<i32>,
    pub status: Option<String>,
    pub entity_id: Option<String>,
    pub entity_name: Option<String>,
    pub title: Option<String>,
    pub explanation: Option<String>,
    pub evidence: Option<Value>,
    pub potential_savings: Option<f64>,
    pub recommended_action: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Serialize)]
pub struct FindingsListResponse {
    pub findings: Vec<FindingResponse>,
    pub total_count: i64,
    pub total_savings: f64,
}

#[derive(Deserialize)]
pub struct UpdateFindingRequest {
    pub status: Option<String>,
}

#[derive(Deserialize)]
pub struct FeedbackRequest {
    pub is_true_positive: bool,
    pub notes: Option<String>,
}

#[derive(Serialize)]
pub struct FindingsStatsResponse {
    pub total_findings: i64,
    pub by_type: Vec<TypeStats>,
    pub by_status: Vec<StatusStats>,
    pub total_potential_savings: f64,
    pub resolved_savings: f64,
}

#[derive(Serialize)]
pub struct TypeStats {
    pub finding_type: String,
    pub count: i64,
    pub total_amount: f64,
}

#[derive(Serialize)]
pub struct StatusStats {
    pub status: String,
    pub count: i64,
}

/// List findings with filters
pub async fn list_findings(
    State(state): State<Arc<AppState>>,
    Query(params): Query<FindingsQuery>,
) -> Result<AxumJson<FindingsListResponse>> {
    let limit = params.limit.unwrap_or(50).min(100);
    let offset = params.offset.unwrap_or(0);

    // Build dynamic query based on filters
    let mut query = String::from(
        r#"
        SELECT id, workspace_id, 
               COALESCE(finding_type::text, 'unknown') as finding_type,
               severity::int, status, 
               entity_id, entity_name,
               title, explanation, evidence,
               amount::float8 as potential_savings, description as recommended_action,
               created_at
        FROM findings
        WHERE workspace_id = $1
        "#,
    );

    if params.finding_type.is_some() {
        query.push_str(" AND finding_type::text = $4");
    }
    if params.status.is_some() {
        query.push_str(" AND status = $5");
    }
    if params.severity_min.is_some() {
        query.push_str(" AND severity >= $6");
    }

    query.push_str(" ORDER BY severity DESC, created_at DESC LIMIT $2 OFFSET $3");

    let findings: Vec<(
        Uuid,
        Uuid,
        String,
        Option<i32>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<Value>,
        Option<f64>,
        Option<String>,
        DateTime<Utc>,
    )> = sqlx::query_as(&query)
        .bind(params.workspace_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await?;

    // Get total count
    let (total_count,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM findings WHERE workspace_id = $1")
            .bind(params.workspace_id)
            .fetch_one(&state.db)
            .await?;

    // Get total savings
    let (total_savings,): (Option<f64>,) = sqlx::query_as(
        "SELECT COALESCE(SUM(amount)::float8, 0) FROM findings WHERE workspace_id = $1",
    )
    .bind(params.workspace_id)
    .fetch_one(&state.db)
    .await?;

    let responses: Vec<FindingResponse> = findings
        .into_iter()
        .map(|f| FindingResponse {
            id: f.0,
            workspace_id: f.1,
            finding_type: f.2,
            severity: f.3,
            status: f.4,
            entity_id: f.5,
            entity_name: f.6,
            title: f.7,
            explanation: f.8,
            evidence: f.9,
            potential_savings: f.10,
            recommended_action: f.11,
            created_at: f.12,
        })
        .collect();

    Ok(AxumJson(FindingsListResponse {
        findings: responses,
        total_count,
        total_savings: total_savings.unwrap_or(0.0),
    }))
}

/// Get a single finding by ID
pub async fn get_finding(
    State(state): State<Arc<AppState>>,
    Path(finding_id): Path<Uuid>,
) -> Result<AxumJson<FindingResponse>> {
    let finding: (
        Uuid,
        Uuid,
        String,
        Option<i32>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<Value>,
        Option<f64>,
        Option<String>,
        DateTime<Utc>,
    ) = sqlx::query_as(
        r#"
        SELECT id, workspace_id, 
               COALESCE(finding_type::text, 'unknown'),
               severity::int, status,
               entity_id, entity_name,
               title, explanation, evidence,
               amount::float8, description,
               created_at
        FROM findings
        WHERE id = $1
        "#,
    )
    .bind(finding_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Finding not found".to_string()))?;

    Ok(AxumJson(FindingResponse {
        id: finding.0,
        workspace_id: finding.1,
        finding_type: finding.2,
        severity: finding.3,
        status: finding.4,
        entity_id: finding.5,
        entity_name: finding.6,
        title: finding.7,
        explanation: finding.8,
        evidence: finding.9,
        potential_savings: finding.10,
        recommended_action: finding.11,
        created_at: finding.12,
    }))
}

/// Update a finding's status
pub async fn update_finding(
    State(state): State<Arc<AppState>>,
    Path(finding_id): Path<Uuid>,
    Json(payload): Json<UpdateFindingRequest>,
) -> Result<AxumJson<Value>> {
    let valid_statuses = ["new", "triaged", "investigating", "resolved", "ignored"];

    if let Some(ref status) = payload.status {
        if !valid_statuses.contains(&status.as_str()) {
            return Err(AppError::InvalidInput(format!(
                "Invalid status. Must be one of: {:?}",
                valid_statuses
            )));
        }
    }

    let result = sqlx::query(
        r#"
        UPDATE findings 
        SET status = COALESCE($1, status),
            resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE resolved_at END,
            updated_at = NOW()
        WHERE id = $2
        "#,
    )
    .bind(&payload.status)
    .bind(finding_id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Finding not found".to_string()));
    }

    Ok(AxumJson(json!({
        "message": "Finding updated successfully",
        "id": finding_id,
        "status": payload.status
    })))
}

/// Submit feedback on a finding
pub async fn submit_feedback(
    State(state): State<Arc<AppState>>,
    user_id: Option<Extension<Uuid>>,
    Path(finding_id): Path<Uuid>,
    Json(payload): Json<FeedbackRequest>,
) -> Result<AxumJson<Value>> {
    let user_id = user_id
        .map(|Extension(id)| id)
        .ok_or_else(|| AppError::Auth("Authentication required".to_string()))?;

    // Verify finding exists
    let _finding: (Uuid,) = sqlx::query_as("SELECT id FROM findings WHERE id = $1")
        .bind(finding_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Finding not found".to_string()))?;

    // Insert feedback
    sqlx::query(
        r#"
        INSERT INTO finding_feedback (id, finding_id, user_id, is_true_positive, notes)
        VALUES ($1, $2, $3, $4, $5)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(finding_id)
    .bind(user_id)
    .bind(payload.is_true_positive)
    .bind(&payload.notes)
    .execute(&state.db)
    .await?;

    // Update finding status based on feedback
    let new_status = if payload.is_true_positive {
        "triaged"
    } else {
        "ignored"
    };
    sqlx::query("UPDATE findings SET status = $1, updated_at = NOW() WHERE id = $2")
        .bind(new_status)
        .bind(finding_id)
        .execute(&state.db)
        .await?;

    Ok(AxumJson(json!({
        "message": "Feedback submitted successfully",
        "finding_id": finding_id,
        "is_true_positive": payload.is_true_positive,
        "new_status": new_status
    })))
}

/// Get findings statistics for a workspace
pub async fn get_findings_stats(
    State(state): State<Arc<AppState>>,
    Query(params): Query<FindingsQuery>,
) -> Result<AxumJson<FindingsStatsResponse>> {
    // Total findings
    let (total,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM findings WHERE workspace_id = $1")
        .bind(params.workspace_id)
        .fetch_one(&state.db)
        .await?;

    // By type
    let by_type: Vec<(String, i64, Option<f64>)> = sqlx::query_as(
        r#"
        SELECT finding_type::text, COUNT(*), COALESCE(SUM(amount)::float8, 0)
        FROM findings 
        WHERE workspace_id = $1
        GROUP BY finding_type
        "#,
    )
    .bind(params.workspace_id)
    .fetch_all(&state.db)
    .await?;

    // By status
    let by_status: Vec<(String, i64)> = sqlx::query_as(
        r#"
        SELECT COALESCE(status, 'new'), COUNT(*)
        FROM findings 
        WHERE workspace_id = $1
        GROUP BY status
        "#,
    )
    .bind(params.workspace_id)
    .fetch_all(&state.db)
    .await?;

    // Total potential savings
    let (total_savings,): (Option<f64>,) = sqlx::query_as(
        "SELECT COALESCE(SUM(amount)::float8, 0) FROM findings WHERE workspace_id = $1",
    )
    .bind(params.workspace_id)
    .fetch_one(&state.db)
    .await?;

    // Resolved savings
    let (resolved_savings,): (Option<f64>,) = sqlx::query_as(
        "SELECT COALESCE(SUM(amount)::float8, 0) FROM findings WHERE workspace_id = $1 AND status = 'resolved'"
    )
    .bind(params.workspace_id)
    .fetch_one(&state.db)
    .await?;

    Ok(AxumJson(FindingsStatsResponse {
        total_findings: total,
        by_type: by_type
            .into_iter()
            .map(|(t, c, a)| TypeStats {
                finding_type: t,
                count: c,
                total_amount: a.unwrap_or(0.0),
            })
            .collect(),
        by_status: by_status
            .into_iter()
            .map(|(s, c)| StatusStats {
                status: s,
                count: c,
            })
            .collect(),
        total_potential_savings: total_savings.unwrap_or(0.0),
        resolved_savings: resolved_savings.unwrap_or(0.0),
    }))
}
