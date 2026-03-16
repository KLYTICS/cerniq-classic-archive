use axum::{
    extract::{Multipart, State},
    response::Json,
};
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::fs;
use tokio::io::AsyncWriteExt;
use uuid::Uuid;

use crate::error::{AppError, Result};
use crate::models::Upload;
use crate::state::AppState;

pub async fn upload_file(
    State(state): State<Arc<AppState>>,
    mut multipart: Multipart,
) -> Result<Json<Value>> {
    let mut workspace_id: Option<Uuid> = None;
    let mut file_data: Option<(String, Vec<u8>)> = None;

    // Process all multipart fields
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::InvalidInput(e.to_string()))?
    {
        let name = field.name().unwrap_or("").to_string();

        if name == "workspace_id" {
            // Extract workspace_id from form field
            let text = field
                .text()
                .await
                .map_err(|e| AppError::InvalidInput(e.to_string()))?;
            workspace_id = Some(
                Uuid::parse_str(&text)
                    .map_err(|e| AppError::InvalidInput(format!("Invalid workspace_id: {}", e)))?,
            );
        } else if name == "file" || field.file_name().is_some() {
            // This is the file field
            let file_name = field.file_name().unwrap_or("unknown").to_string();
            let data = field
                .bytes()
                .await
                .map_err(|e| AppError::InvalidInput(e.to_string()))?;
            file_data = Some((file_name, data.to_vec()));
        }
    }

    // Validate we have both workspace_id and file
    let workspace_id = workspace_id
        .ok_or_else(|| AppError::InvalidInput("workspace_id is required".to_string()))?;
    let (file_name, data) =
        file_data.ok_or_else(|| AppError::InvalidInput("No file provided".to_string()))?;

    // Determine file type based on extension
    let file_type = if file_name.ends_with(".csv") {
        "ap_export"
    } else if file_name.ends_with(".pdf") {
        "contract"
    } else {
        "unknown"
    };

    if file_type == "unknown" {
        return Err(AppError::InvalidInput(
            "Unsupported file type. Please upload CSV or PDF files.".to_string(),
        ));
    }

    let file_size = data.len() as i64;

    // Save to local disk
    let upload_dir = PathBuf::from("uploads");
    if !upload_dir.exists() {
        fs::create_dir_all(&upload_dir)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?;
    }

    let file_id = Uuid::new_v4();
    let file_path = upload_dir.join(format!("{}_{}", file_id, file_name));

    let mut file = fs::File::create(&file_path)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;
    file.write_all(&data)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    // Create upload record
    let _upload = sqlx::query_as::<_, Upload>(
        r#"
        INSERT INTO uploads (id, workspace_id, file_name, file_type, file_url, file_size, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'pending')
        RETURNING *
        "#,
    )
    .bind(file_id)
    .bind(workspace_id)
    .bind(&file_name)
    .bind(file_type)
    .bind(file_path.to_string_lossy().to_string())
    .bind(file_size)
    .fetch_one(&state.db)
    .await
    .map_err(AppError::Database)?;

    Ok(Json(json!({
        "message": "File uploaded successfully",
        "file_id": file_id,
        "file_name": file_name,
        "workspace_id": workspace_id
    })))
}
