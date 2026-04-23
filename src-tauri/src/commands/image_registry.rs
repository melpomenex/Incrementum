//! Image registry commands

use base64::{engine::general_purpose, Engine as _};
use image::GenericImageView;
use sha2::{Digest, Sha256};
use std::io::Cursor;
use tauri::State;

use crate::database::Repository;
use crate::error::{IncrementumError, Result};

const MAX_IMAGE_BYTES: usize = 10 * 1024 * 1024;
const REGISTRY_THUMBNAIL_MAX_DIMENSION: u32 = 256;

#[derive(Debug, serde::Serialize)]
pub struct ImageAssetDto {
    pub id: String,
    pub mime_type: String,
    pub file_name: Option<String>,
    pub byte_size: i64,
    pub sha256: String,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub created_at: String,
    pub reference_count: i64,
    pub is_referenced: bool,
    pub data_url: String,
}

#[derive(Debug, serde::Serialize)]
pub struct DeleteImageAssetResult {
    pub deleted: bool,
    pub reason: Option<String>,
}

#[tauri::command]
pub async fn ingest_image_asset(
    base64_data: String,
    mime_type: Option<String>,
    file_name: Option<String>,
    repo: State<'_, Repository>,
) -> Result<ImageAssetDto> {
    let bytes = general_purpose::STANDARD
        .decode(base64_data.as_bytes())
        .map_err(|e| IncrementumError::InvalidInput(format!("Invalid base64 image payload: {}", e)))?;

    if bytes.is_empty() {
        return Err(IncrementumError::InvalidInput("Image payload is empty".to_string()));
    }

    if bytes.len() > MAX_IMAGE_BYTES {
        return Err(IncrementumError::InvalidInput(format!(
            "Image exceeds max size of {} bytes",
            MAX_IMAGE_BYTES
        )));
    }

    let guessed = image::guess_format(&bytes)
        .map_err(|_| IncrementumError::InvalidInput("Unsupported image format".to_string()))?;
    let normalized_mime = normalize_mime(mime_type.as_deref(), guessed)?;

    let dimensions = image::load_from_memory(&bytes)
        .map_err(|e| IncrementumError::InvalidInput(format!("Unable to decode image dimensions: {}", e)))?
        .dimensions();

    let sha256 = hex_sha256(&bytes);
    let asset = repo
        .create_or_get_image_asset(
            &normalized_mime,
            file_name.as_deref(),
            &bytes,
            &sha256,
            i32::try_from(dimensions.0).ok(),
            i32::try_from(dimensions.1).ok(),
        )
        .await?;

    Ok(to_dto(asset))
}

#[tauri::command]
pub async fn list_image_assets(repo: State<'_, Repository>) -> Result<Vec<ImageAssetDto>> {
    let assets = repo.list_image_assets_with_usage().await?;
    Ok(assets
        .into_iter()
        .map(|asset| to_registry_list_dto(asset.asset, asset.reference_count))
        .collect())
}

#[tauri::command]
pub async fn get_image_asset(asset_id: String, repo: State<'_, Repository>) -> Result<Option<ImageAssetDto>> {
    let asset = repo.get_image_asset(&asset_id).await?;
    Ok(asset.map(|asset| to_dto_with_usage(asset, 0)))
}

#[tauri::command]
pub async fn delete_image_asset(asset_id: String, repo: State<'_, Repository>) -> Result<DeleteImageAssetResult> {
    let deleted = repo.delete_image_asset_if_unreferenced(&asset_id).await?;
    if deleted {
        return Ok(DeleteImageAssetResult {
            deleted: true,
            reason: None,
        });
    }

    Ok(DeleteImageAssetResult {
        deleted: false,
        reason: Some("Image is still referenced by one or more flashcards".to_string()),
    })
}

fn to_dto(asset: crate::models::ImageAsset) -> ImageAssetDto {
    to_dto_with_usage(asset, 0)
}

fn to_dto_with_usage(asset: crate::models::ImageAsset, reference_count: i64) -> ImageAssetDto {
    let data_url = encode_data_url(&asset.mime_type, &asset.content);
    ImageAssetDto {
        id: asset.id,
        mime_type: asset.mime_type.clone(),
        file_name: asset.file_name,
        byte_size: asset.byte_size,
        sha256: asset.sha256,
        width: asset.width,
        height: asset.height,
        created_at: asset.created_at.to_rfc3339(),
        reference_count,
        is_referenced: reference_count > 0,
        data_url,
    }
}

fn to_registry_list_dto(asset: crate::models::ImageAsset, reference_count: i64) -> ImageAssetDto {
    let mime_type = asset.mime_type.clone();
    let data_url = thumbnail_data_url(&asset.content).unwrap_or_else(|| encode_data_url(&mime_type, &asset.content));
    ImageAssetDto {
        id: asset.id,
        mime_type,
        file_name: asset.file_name,
        byte_size: asset.byte_size,
        sha256: asset.sha256,
        width: asset.width,
        height: asset.height,
        created_at: asset.created_at.to_rfc3339(),
        reference_count,
        is_referenced: reference_count > 0,
        data_url,
    }
}

fn encode_data_url(mime_type: &str, bytes: &[u8]) -> String {
    let base64_data = general_purpose::STANDARD.encode(bytes);
    format!("data:{};base64,{}", mime_type, base64_data)
}

fn thumbnail_data_url(bytes: &[u8]) -> Option<String> {
    let image = image::load_from_memory(bytes).ok()?;
    let thumbnail = image.thumbnail(
        REGISTRY_THUMBNAIL_MAX_DIMENSION,
        REGISTRY_THUMBNAIL_MAX_DIMENSION,
    );

    let mut buffer = Cursor::new(Vec::new());
    thumbnail.write_to(&mut buffer, image::ImageFormat::Png).ok()?;
    Some(encode_data_url("image/png", &buffer.into_inner()))
}

fn hex_sha256(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

fn normalize_mime(requested: Option<&str>, guessed: image::ImageFormat) -> Result<String> {
    let guessed_mime = match guessed {
        image::ImageFormat::Png => "image/png",
        image::ImageFormat::Jpeg => "image/jpeg",
        image::ImageFormat::Gif => "image/gif",
        image::ImageFormat::WebP => "image/webp",
        _ => return Err(IncrementumError::InvalidInput("Unsupported image format".to_string())),
    };

    if let Some(requested) = requested {
        let normalized = requested.trim().to_lowercase();
        if normalized.starts_with("image/") {
            return Ok(normalized);
        }
    }

    Ok(guessed_mime.to_string())
}
