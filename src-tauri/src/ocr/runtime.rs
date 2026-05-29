//! GLM-OCR runtime management (Ollama + vLLM)

use crate::error::{IncrementumError, Result};
use futures_util::StreamExt;
use serde::Serialize;
use serde_json::json;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::OnceLock;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::AsyncWriteExt;
use tokio::process::Child;
use tokio::sync::Mutex as TokioMutex;
use url::Url;

fn strip_ansi(input: &str) -> String {
    let mut output = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch == '\u{1b}' && matches!(chars.peek(), Some('[')) {
            chars.next();
            for next in chars.by_ref() {
                if next.is_ascii_alphabetic() {
                    break;
                }
            }
            continue;
        }

        if ch == '\r' {
            continue;
        }

        output.push(ch);
    }

    output
}

#[derive(Debug, Serialize, Clone)]
pub struct GLMRuntimeStatus {
    pub backend: String,
    pub installed: bool,
    pub running: bool,
    pub endpoint: String,
    pub models_dir: String,
    pub last_error: Option<String>,
}

#[derive(Default)]
struct GLMRuntimeState {
    ollama_child: Option<Child>,
    last_error: Option<String>,
    installer_path: Option<PathBuf>,
}

static GLM_RUNTIME: OnceLock<TokioMutex<GLMRuntimeState>> = OnceLock::new();

fn get_state() -> &'static TokioMutex<GLMRuntimeState> {
    GLM_RUNTIME.get_or_init(|| TokioMutex::new(GLMRuntimeState::default()))
}

fn runtime_root(app_handle: &AppHandle) -> Result<PathBuf> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| IncrementumError::Internal(format!("Failed to resolve app data dir: {}", e)))?;
    Ok(app_dir.join("ocr").join("glm-runtime"))
}

fn runtime_dirs(app_handle: &AppHandle) -> Result<(PathBuf, PathBuf)> {
    let root = runtime_root(app_handle)?;
    let installers = root.join("installers");
    let models = root.join("models");
    std::fs::create_dir_all(&installers)
        .map_err(|e| IncrementumError::Internal(format!("Failed to create installers dir: {}", e)))?;
    std::fs::create_dir_all(&models)
        .map_err(|e| IncrementumError::Internal(format!("Failed to create models dir: {}", e)))?;
    Ok((installers, models))
}

fn normalize_endpoint(endpoint: &str) -> String {
    let trimmed = endpoint.trim_end_matches('/');
    trimmed.to_string()
}

fn strip_v1(endpoint: &str) -> String {
    let trimmed = normalize_endpoint(endpoint);
    if trimmed.ends_with("/v1") {
        trimmed.trim_end_matches("/v1").to_string()
    } else {
        trimmed
    }
}

fn extract_host_port(endpoint: &str) -> String {
    if let Ok(url) = Url::parse(endpoint) {
        let host = url.host_str().unwrap_or("127.0.0.1");
        let port = url.port_or_known_default().unwrap_or(11434);
        return format!("{}:{}", host, port);
    }
    strip_v1(endpoint)
}

async fn check_openai_models(endpoint: &str) -> bool {
    let endpoint = normalize_endpoint(endpoint);

    // Try OpenAI-compatible endpoint first (/models)
    let openai_url = format!("{}/models", endpoint);
    if let Ok(response) = reqwest::Client::new().get(&openai_url).send().await {
        if response.status().is_success() {
            return true;
        }
    }

    // Try Ollama's native API endpoint (/api/tags)
    let ollama_url = format!("{}/api/tags", endpoint);
    if let Ok(response) = reqwest::Client::new().get(&ollama_url).send().await {
        return response.status().is_success();
    }

    false
}

fn resolve_ollama_binary(path_override: Option<String>) -> Result<String> {
    if let Some(path) = path_override {
        let candidate = Path::new(&path);
        if candidate.exists() {
            return Ok(path);
        }
    }

    if executable_exists_in_path("ollama") {
        Ok("ollama".to_string())
    } else {
        Err(IncrementumError::Internal(
            "Ollama not found in PATH. Please install Ollama or provide a binary path.".to_string(),
        ))
    }
}

fn executable_exists_in_path(binary: &str) -> bool {
    std::env::var_os("PATH")
        .into_iter()
        .flat_map(|paths| std::env::split_paths(&paths).collect::<Vec<_>>())
        .map(|dir| dir.join(binary))
        .any(|path| path.is_file())
}

pub async fn get_runtime_status(
    app_handle: &AppHandle,
    backend: &str,
    endpoint: &str,
    ollama_path: Option<String>,
) -> Result<GLMRuntimeStatus> {
    let (_, models_dir) = runtime_dirs(app_handle)?;
    let running = check_openai_models(endpoint).await;
    let installed = if backend == "ollama" {
        resolve_ollama_binary(ollama_path).is_ok()
    } else {
        false
    };

    let state = get_state().lock().await;

    Ok(GLMRuntimeStatus {
        backend: backend.to_string(),
        installed,
        running,
        endpoint: normalize_endpoint(endpoint),
        models_dir: models_dir.to_string_lossy().to_string(),
        last_error: state.last_error.clone(),
    })
}

#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
pub async fn download_ollama_installer(app_handle: AppHandle) -> Result<String> {
    let (installers_dir, _) = runtime_dirs(&app_handle)?;

    let (url, filename): (&str, &str) = {
        #[cfg(target_os = "windows")]
        { ("https://ollama.com/download/OllamaSetup.exe", "OllamaSetup.exe") }
        #[cfg(target_os = "macos")]
        { ("https://ollama.com/download/Ollama.dmg", "Ollama.dmg") }
        #[cfg(target_os = "linux")]
        { ("https://ollama.com/install.sh", "ollama-install.sh") }
    };

    let dest_path = installers_dir.join(filename);
    let temp_path = dest_path.with_extension("download");

    let client = reqwest::Client::new();
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to download installer: {}", e)))?;

    if !response.status().is_success() {
        return Err(IncrementumError::Internal(format!(
            "Installer download failed: {}",
            response.status()
        )));
    }

    let total_size = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut file = tokio::fs::File::create(&temp_path)
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to create installer file: {}", e)))?;

    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| IncrementumError::Internal(format!("Download error: {}", e)))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| IncrementumError::Internal(format!("Write error: {}", e)))?;
        downloaded += chunk.len() as u64;

        if total_size > 0 {
            let progress = (downloaded as f32 / total_size as f32) * 100.0;
            let _ = app_handle.emit(
                "glm-ocr://download-progress",
                serde_json::json!({ "id": "ollama", "progress": progress }),
            );
        }
    }

    file.flush()
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to flush installer: {}", e)))?;
    drop(file);

    tokio::fs::rename(&temp_path, &dest_path)
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to finalize installer: {}", e)))?;

    {
        let mut state = get_state().lock().await;
        state.installer_path = Some(dest_path.clone());
    }

    let _ = app_handle.emit(
        "glm-ocr://download-complete",
        serde_json::json!({ "id": "ollama", "path": dest_path.to_string_lossy() }),
    );

    Ok(dest_path.to_string_lossy().to_string())
}

/// Stub for unsupported platforms
#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
pub async fn download_ollama_installer(_app_handle: AppHandle) -> Result<String> {
    Err(IncrementumError::Internal(
        "Automatic Ollama installer download is not supported on this platform".to_string(),
    ))
}

pub async fn open_installer(path: String) -> Result<()> {
    let installer_path = PathBuf::from(path);
    if !installer_path.exists() {
        return Err(IncrementumError::Internal("Installer not found".to_string()));
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", installer_path.to_string_lossy().as_ref()])
            .spawn()
            .map_err(|e| IncrementumError::Internal(format!("Failed to open installer: {}", e)))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&installer_path)
            .spawn()
            .map_err(|e| IncrementumError::Internal(format!("Failed to open installer: {}", e)))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&installer_path)
            .spawn()
            .map_err(|e| IncrementumError::Internal(format!("Failed to open installer: {}", e)))?;
    }

    Ok(())
}

pub async fn start_ollama_runtime(
    app_handle: AppHandle,
    endpoint: String,
    ollama_path: Option<String>,
) -> Result<()> {
    if check_openai_models(&endpoint).await {
        return Ok(());
    }

    let binary = resolve_ollama_binary(ollama_path)?;
    let (_, models_dir) = runtime_dirs(&app_handle)?;
    let host = extract_host_port(&endpoint);

    let mut command = tokio::process::Command::new(binary);
    command
        .arg("serve")
        .env("OLLAMA_MODELS", &models_dir)
        .env("OLLAMA_HOST", &host)
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    let mut child = command
        .spawn()
        .map_err(|e| IncrementumError::Internal(format!("Failed to start Ollama: {}", e)))?;

    {
        let mut state = get_state().lock().await;
        state.ollama_child = Some(child);
    }

    let mut attempts = 0;
    while attempts < 20 {
        if check_openai_models(&endpoint).await {
            return Ok(());
        }
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        attempts += 1;
    }

    stop_ollama_runtime().await?;
    Err(IncrementumError::Internal(
        "Ollama failed to start in time".to_string(),
    ))
}

pub async fn stop_ollama_runtime() -> Result<()> {
    let mut state = get_state().lock().await;
    if let Some(mut child) = state.ollama_child.take() {
        child
            .kill()
            .await
            .map_err(|e| IncrementumError::Internal(format!("Failed to stop Ollama: {}", e)))?;
    }
    Ok(())
}

pub async fn pull_ollama_model(
    app_handle: AppHandle,
    model: String,
    ollama_path: Option<String>,
) -> Result<String> {
    resolve_ollama_binary(ollama_path.clone())?;

    let default_endpoint = "http://127.0.0.1:11434";
    let is_running = check_openai_models(default_endpoint).await;

    // Auto-start ollama if not running
    if !is_running {
        let start_result = start_ollama_runtime(
            app_handle.clone(),
            default_endpoint.to_string(),
            ollama_path,
        )
        .await;

        if let Err(e) = start_result {
            return Err(IncrementumError::Internal(format!(
                "Ollama server is not running and failed to start automatically. \
                Please start Ollama manually or check the logs. Error: {}",
                e
            )));
        }
    }

    let response = reqwest::Client::new()
        .post(format!("{}/api/pull", default_endpoint))
        .json(&json!({
            "name": model,
            "stream": false,
        }))
        .send()
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to call Ollama pull API: {}", e)))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        let cleaned = strip_ansi(body.trim());
        let hint = if cleaned.contains("requires a newer version of Ollama") {
            " Please update Ollama to the latest version and try again."
        } else if cleaned.contains("could not connect") || cleaned.contains("connection refused") {
            " Please ensure Ollama is running (try starting the runtime first)."
        } else {
            ""
        };
        return Err(IncrementumError::Internal(format!(
            "Ollama pull failed ({}): {}{}",
            status,
            if cleaned.is_empty() {
                "Unknown error"
            } else {
                &cleaned
            },
            hint
        )));
    }

    let body = response
        .text()
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to read Ollama pull response: {}", e)))?;

    Ok(if body.trim().is_empty() {
        "Ollama pull completed successfully.".to_string()
    } else {
        body
    })
}
