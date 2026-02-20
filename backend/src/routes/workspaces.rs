//! Workspace Management Routes for SpendCheck

use axum::{
    extract::{Path, State, Json},
    response::Json as AxumJson,
    Extension,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use uuid::Uuid;

use crate::error::{AppError, Result};
use crate::state::AppState;
use crate::models::Workspace;

#[derive(Deserialize)]
pub struct CreateWorkspaceRequest {
    pub name: String,
    pub company_name: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateWorkspaceRequest {
    pub name: Option<String>,
    pub company_name: Option<String>,
}

#[derive(Serialize)]
pub struct WorkspaceResponse {
    pub id: Uuid,
    pub name: String,
    pub company_name: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub stats: Option<WorkspaceStats>,
}

#[derive(Serialize)]
pub struct WorkspaceStats {
    pub total_uploads: i64,
    pub total_invoices: i64,
    pub total_vendors: i64,
    pub total_findings: i64,
    pub total_spend_analyzed: f64,
    pub total_potential_savings: f64,
}

/// Create a new workspace
pub async fn create_workspace(
    State(state): State<Arc<AppState>>,
    user_id: Option<Extension<Uuid>>,
    Json(payload): Json<CreateWorkspaceRequest>,
) -> Result<AxumJson<WorkspaceResponse>> {
    // Use provided user_id or a demo user UUID
    let user_uuid = user_id
        .map(|Extension(id)| id)
        .unwrap_or_else(|| Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap());

    let workspace = sqlx::query_as::<_, Workspace>(
        r#"
        INSERT INTO workspaces (id, user_id, name, company_name)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        "#
    )
    .bind(Uuid::new_v4())
    .bind(user_uuid)
    .bind(&payload.name)
    .bind(&payload.company_name)
    .fetch_one(&state.db)
    .await?;

    Ok(AxumJson(WorkspaceResponse {
        id: workspace.id,
        name: workspace.name,
        company_name: workspace.company_name,
        created_at: workspace.created_at,
        stats: None,
    }))
}

/// List all workspaces for the current user
pub async fn list_workspaces(
    State(state): State<Arc<AppState>>,
    user_id: Option<Extension<Uuid>>,
) -> Result<AxumJson<Vec<WorkspaceResponse>>> {
    // Use provided user_id or demo user UUID
    let user_uuid = user_id
        .map(|Extension(id)| id)
        .unwrap_or_else(|| Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap());

    let workspaces = sqlx::query_as::<_, Workspace>(
        "SELECT * FROM workspaces WHERE user_id = $1 ORDER BY created_at DESC"
    )
    .bind(user_uuid)
    .fetch_all(&state.db)
    .await?;

    let responses: Vec<WorkspaceResponse> = workspaces
        .into_iter()
        .map(|w| WorkspaceResponse {
            id: w.id,
            name: w.name,
            company_name: w.company_name,
            created_at: w.created_at,
            stats: None,
        })
        .collect();

    Ok(AxumJson(responses))
}

/// Get a single workspace with stats
pub async fn get_workspace(
    State(state): State<Arc<AppState>>,
    user_id: Option<Extension<Uuid>>,
    Path(workspace_id): Path<Uuid>,
) -> Result<AxumJson<WorkspaceResponse>> {
    let user_uuid = user_id
        .map(|Extension(id)| id)
        .unwrap_or_else(|| Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap());

    let workspace = sqlx::query_as::<_, Workspace>(
        "SELECT * FROM workspaces WHERE id = $1 AND user_id = $2"
    )
    .bind(workspace_id)
    .bind(user_uuid)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Workspace not found".to_string()))?;

    // Get stats
    let stats = get_workspace_stats(workspace_id, &state.db).await?;

    Ok(AxumJson(WorkspaceResponse {
        id: workspace.id,
        name: workspace.name,
        company_name: workspace.company_name,
        created_at: workspace.created_at,
        stats: Some(stats),
    }))
}

/// Update a workspace
pub async fn update_workspace(
    State(state): State<Arc<AppState>>,
    user_id: Option<Extension<Uuid>>,
    Path(workspace_id): Path<Uuid>,
    Json(payload): Json<UpdateWorkspaceRequest>,
) -> Result<AxumJson<WorkspaceResponse>> {
    let user_uuid = user_id
        .map(|Extension(id)| id)
        .unwrap_or_else(|| Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap());

    // Verify ownership
    let existing = sqlx::query_as::<_, Workspace>(
        "SELECT * FROM workspaces WHERE id = $1 AND user_id = $2"
    )
    .bind(workspace_id)
    .bind(user_uuid)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Workspace not found".to_string()))?;

    let name = payload.name.unwrap_or(existing.name);
    let company_name = payload.company_name.or(existing.company_name);

    let updated = sqlx::query_as::<_, Workspace>(
        r#"
        UPDATE workspaces 
        SET name = $1, company_name = $2, updated_at = NOW()
        WHERE id = $3
        RETURNING *
        "#
    )
    .bind(&name)
    .bind(&company_name)
    .bind(workspace_id)
    .fetch_one(&state.db)
    .await?;

    Ok(AxumJson(WorkspaceResponse {
        id: updated.id,
        name: updated.name,
        company_name: updated.company_name,
        created_at: updated.created_at,
        stats: None,
    }))
}

/// Delete a workspace (cascades to all related data)
pub async fn delete_workspace(
    State(state): State<Arc<AppState>>,
    user_id: Option<Extension<Uuid>>,
    Path(workspace_id): Path<Uuid>,
) -> Result<AxumJson<Value>> {
    let user_uuid = user_id
        .map(|Extension(id)| id)
        .unwrap_or_else(|| Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap());

    // Verify ownership
    let result = sqlx::query(
        "DELETE FROM workspaces WHERE id = $1 AND user_id = $2"
    )
    .bind(workspace_id)
    .bind(user_uuid)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Workspace not found".to_string()));
    }

    Ok(AxumJson(json!({
        "message": "Workspace deleted successfully",
        "id": workspace_id
    })))
}

async fn get_workspace_stats(workspace_id: Uuid, db: &sqlx::PgPool) -> Result<WorkspaceStats> {
    let uploads: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM uploads WHERE workspace_id = $1"
    )
    .bind(workspace_id)
    .fetch_one(db)
    .await?;

    let invoices: (i64, Option<f64>) = sqlx::query_as(
        "SELECT COUNT(*), COALESCE(SUM(amount), 0) FROM invoices WHERE workspace_id = $1"
    )
    .bind(workspace_id)
    .fetch_one(db)
    .await?;

    let vendors: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM vendors WHERE workspace_id = $1"
    )
    .bind(workspace_id)
    .fetch_one(db)
    .await?;

    let findings: (i64, Option<f64>) = sqlx::query_as(
        "SELECT COUNT(*), COALESCE(SUM(amount), 0) FROM findings WHERE workspace_id = $1"
    )
    .bind(workspace_id)
    .fetch_one(db)
    .await?;

    Ok(WorkspaceStats {
        total_uploads: uploads.0,
        total_invoices: invoices.0,
        total_vendors: vendors.0,
        total_findings: findings.0,
        total_spend_analyzed: invoices.1.unwrap_or(0.0),
        total_potential_savings: findings.1.unwrap_or(0.0),
    })
}
