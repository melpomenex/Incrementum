//! GLM-OCR runtime commands

use crate::error::Result;
use crate::ocr::runtime::{
    download_ollama_installer,
    get_runtime_status,
    open_installer,
    pull_ollama_model,
    start_ollama_runtime,
    stop_ollama_runtime,
    GLMRuntimeStatus,
};
use tauri::AppHandle;

#[tauri::command]
pub async fn glm_runtime_status(
    app_handle: AppHandle,
    backend: String,
    endpoint: String,
    ollama_path: Option<String>,
) -> Result<GLMRuntimeStatus> {
    get_runtime_status(&app_handle, &backend, &endpoint, ollama_path).await
}

#[tauri::command]
pub async fn glm_download_ollama_installer(app_handle: AppHandle) -> Result<String> {
    download_ollama_installer(app_handle).await
}

#[tauri::command]
pub async fn glm_open_installer(path: String) -> Result<()> {
    open_installer(path).await
}

#[tauri::command]
pub async fn glm_start_ollama_runtime(
    app_handle: AppHandle,
    endpoint: String,
    ollama_path: Option<String>,
) -> Result<()> {
    start_ollama_runtime(app_handle, endpoint, ollama_path).await
}

#[tauri::command]
pub async fn glm_stop_ollama_runtime() -> Result<()> {
    stop_ollama_runtime().await
}

#[tauri::command]
pub async fn glm_pull_ollama_model(
    app_handle: AppHandle,
    model: String,
    ollama_path: Option<String>,
) -> Result<String> {
    pull_ollama_model(app_handle, model, ollama_path).await
}
