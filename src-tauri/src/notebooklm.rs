use crate::database::Repository;
use crate::error::AppError;
use crate::models::{ItemType, LearningItem};
use async_trait::async_trait;
use chrono::Utc;
use once_cell::sync::Lazy;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;
use tokio::process::Command;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotebookLMSettings {
    pub enabled: bool,
    pub provider: String,
    pub active_notebook_id: Option<String>,
}

impl Default for NotebookLMSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            provider: "mock".to_string(),
            active_notebook_id: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotebookLMAuthState {
    pub connected: bool,
    pub last_connected_at: Option<String>,
    pub provider: String,
    pub storage_path: Option<String>,
}

impl Default for NotebookLMAuthState {
    fn default() -> Self {
        Self {
            connected: false,
            last_connected_at: None,
            provider: "mock".to_string(),
            storage_path: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotebookLMHealth {
    pub connected: bool,
    pub provider: String,
    pub active_notebook_id: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotebookSummary {
    pub id: String,
    pub title: String,
    pub sources_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceSummary {
    pub id: String,
    pub title: String,
    pub kind: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactSummary {
    pub id: String,
    pub artifact_type: String,
    pub title: String,
    pub created_at: String,
    pub content: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FlashcardItem {
    pub question: String,
    pub answer: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuizItem {
    pub question: String,
    pub correct_answer: String,
    pub user_answer: Option<String>,
    pub was_correct: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactPayload {
    pub flashcards: Vec<FlashcardItem>,
    pub quiz_items: Vec<QuizItem>,
    pub raw_text: Option<String>,
    /// JSON content for structured artifacts like mind-maps, data-tables, etc.
    pub json_content: Option<serde_json::Value>,
    /// URL or file path for media artifacts (audio, video)
    pub media_url: Option<String>,
}

impl Default for ArtifactPayload {
    fn default() -> Self {
        Self {
            flashcards: vec![],
            quiz_items: vec![],
            raw_text: None,
            json_content: None,
            media_url: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotebookLMJob {
    pub id: String,
    pub notebook_id: String,
    pub artifact_type: String,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
    pub error: Option<String>,
    pub artifact: Option<ArtifactSummary>,
    pub payload: ArtifactPayload,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateArtifactRequest {
    pub notebook_id: Option<String>,
    pub artifact_type: String,
    pub instructions: Option<String>,
    pub difficulty: Option<String>,
    pub quantity: Option<String>,
    pub retry_count: Option<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddSourceRequest {
    pub notebook_id: Option<String>,
    pub kind: String,
    pub content: String,
    pub title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AskResponse {
    pub answer: String,
    pub sources: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResearchResponse {
    pub status: String,
    pub imported_sources: usize,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreviewItem {
    pub question: String,
    pub answer: String,
    pub tags: Vec<String>,
    pub source_notebook_id: String,
    pub source_artifact_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub created: usize,
    pub updated: usize,
    pub skipped: usize,
    pub item_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactExportResult {
    pub format: String,
    pub mime_type: String,
    pub file_name: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JobsFile {
    jobs: Vec<NotebookLMJob>,
}

impl Default for JobsFile {
    fn default() -> Self {
        Self { jobs: vec![] }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MockNotebook {
    id: String,
    title: String,
    sources: Vec<SourceSummary>,
    artifacts: Vec<ArtifactSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MockState {
    notebooks: Vec<MockNotebook>,
}

impl Default for MockState {
    fn default() -> Self {
        Self {
            notebooks: vec![MockNotebook {
                id: "nb_demo".to_string(),
                title: "Incrementum NotebookLM Demo".to_string(),
                sources: vec![],
                artifacts: vec![],
            }],
        }
    }
}

#[derive(Debug, Clone)]
struct ProviderContext {
    app_dir: PathBuf,
    notebooklm_bin: Option<PathBuf>,
    notebooklm_runtime_python: Option<PathBuf>,
    notebooklm_runtime_site_packages: Option<PathBuf>,
    notebooklm_runtime_playwright: Option<PathBuf>,
    notebooklm_managed_python: Option<PathBuf>,
}

#[async_trait]
trait NotebookLMProvider: Send + Sync {
    async fn health(
        &self,
        auth: &NotebookLMAuthState,
        settings: &NotebookLMSettings,
        ctx: &ProviderContext,
    ) -> Result<NotebookLMHealth, AppError>;
    async fn list_notebooks(
        &self,
        auth: &NotebookLMAuthState,
        settings: &NotebookLMSettings,
        ctx: &ProviderContext,
    ) -> Result<Vec<NotebookSummary>, AppError>;
    async fn create_notebook(
        &self,
        auth: &NotebookLMAuthState,
        settings: &NotebookLMSettings,
        ctx: &ProviderContext,
        title: &str,
    ) -> Result<NotebookSummary, AppError>;
    async fn list_sources(
        &self,
        auth: &NotebookLMAuthState,
        settings: &NotebookLMSettings,
        ctx: &ProviderContext,
        notebook_id: &str,
    ) -> Result<Vec<SourceSummary>, AppError>;
    async fn add_source(
        &self,
        auth: &NotebookLMAuthState,
        settings: &NotebookLMSettings,
        ctx: &ProviderContext,
        notebook_id: &str,
        req: &AddSourceRequest,
    ) -> Result<SourceSummary, AppError>;
    async fn refresh_source(
        &self,
        auth: &NotebookLMAuthState,
        settings: &NotebookLMSettings,
        ctx: &ProviderContext,
        notebook_id: &str,
        source_id: &str,
    ) -> Result<SourceSummary, AppError>;
    async fn ask(
        &self,
        auth: &NotebookLMAuthState,
        settings: &NotebookLMSettings,
        ctx: &ProviderContext,
        notebook_id: &str,
        question: &str,
    ) -> Result<AskResponse, AppError>;
    async fn research(
        &self,
        auth: &NotebookLMAuthState,
        settings: &NotebookLMSettings,
        ctx: &ProviderContext,
        notebook_id: &str,
        query: &str,
        mode: Option<String>,
        from: Option<String>,
    ) -> Result<ResearchResponse, AppError>;
    async fn generate_artifact(
        &self,
        auth: &NotebookLMAuthState,
        settings: &NotebookLMSettings,
        ctx: &ProviderContext,
        notebook_id: &str,
        req: &GenerateArtifactRequest,
    ) -> Result<(ArtifactSummary, ArtifactPayload), AppError>;
}

struct MockNotebookLMProvider;

#[async_trait]
impl NotebookLMProvider for MockNotebookLMProvider {
    async fn health(
        &self,
        auth: &NotebookLMAuthState,
        settings: &NotebookLMSettings,
        _ctx: &ProviderContext,
    ) -> Result<NotebookLMHealth, AppError> {
        Ok(NotebookLMHealth {
            connected: auth.connected,
            provider: settings.provider.clone(),
            active_notebook_id: settings.active_notebook_id.clone(),
            message: if auth.connected {
                "Connected (mock provider)".to_string()
            } else {
                "Disconnected".to_string()
            },
        })
    }

    async fn list_notebooks(
        &self,
        _auth: &NotebookLMAuthState,
        _settings: &NotebookLMSettings,
        ctx: &ProviderContext,
    ) -> Result<Vec<NotebookSummary>, AppError> {
        let state = load_mock_state(&ctx.app_dir)?;
        Ok(state
            .notebooks
            .into_iter()
            .map(|n| NotebookSummary {
                id: n.id,
                title: n.title,
                sources_count: n.sources.len(),
            })
            .collect())
    }

    async fn create_notebook(
        &self,
        _auth: &NotebookLMAuthState,
        _settings: &NotebookLMSettings,
        ctx: &ProviderContext,
        title: &str,
    ) -> Result<NotebookSummary, AppError> {
        let mut state = load_mock_state(&ctx.app_dir)?;
        let notebook = MockNotebook {
            id: format!("nb_{}", Uuid::new_v4().simple()),
            title: title.to_string(),
            sources: vec![],
            artifacts: vec![],
        };
        let summary = NotebookSummary {
            id: notebook.id.clone(),
            title: notebook.title.clone(),
            sources_count: 0,
        };
        state.notebooks.push(notebook);
        save_mock_state(&ctx.app_dir, &state)?;
        Ok(summary)
    }

    async fn list_sources(
        &self,
        _auth: &NotebookLMAuthState,
        _settings: &NotebookLMSettings,
        ctx: &ProviderContext,
        notebook_id: &str,
    ) -> Result<Vec<SourceSummary>, AppError> {
        let state = load_mock_state(&ctx.app_dir)?;
        let notebook = state
            .notebooks
            .into_iter()
            .find(|n| n.id == notebook_id)
            .ok_or_else(|| AppError::NotFound(format!("Notebook {notebook_id} not found")))?;
        Ok(notebook.sources)
    }

    async fn add_source(
        &self,
        _auth: &NotebookLMAuthState,
        _settings: &NotebookLMSettings,
        ctx: &ProviderContext,
        notebook_id: &str,
        req: &AddSourceRequest,
    ) -> Result<SourceSummary, AppError> {
        let mut state = load_mock_state(&ctx.app_dir)?;
        let notebook = state
            .notebooks
            .iter_mut()
            .find(|n| n.id == notebook_id)
            .ok_or_else(|| AppError::NotFound(format!("Notebook {notebook_id} not found")))?;
        let source = SourceSummary {
            id: format!("src_{}", Uuid::new_v4().simple()),
            title: req.title.clone().unwrap_or_else(|| req.content.chars().take(60).collect()),
            kind: req.kind.clone(),
            status: "ready".to_string(),
        };
        notebook.sources.push(source.clone());
        save_mock_state(&ctx.app_dir, &state)?;
        Ok(source)
    }

    async fn refresh_source(
        &self,
        _auth: &NotebookLMAuthState,
        _settings: &NotebookLMSettings,
        ctx: &ProviderContext,
        notebook_id: &str,
        source_id: &str,
    ) -> Result<SourceSummary, AppError> {
        let mut state = load_mock_state(&ctx.app_dir)?;
        let notebook = state
            .notebooks
            .iter_mut()
            .find(|n| n.id == notebook_id)
            .ok_or_else(|| AppError::NotFound(format!("Notebook {notebook_id} not found")))?;
        let source = notebook
            .sources
            .iter_mut()
            .find(|s| s.id == source_id)
            .ok_or_else(|| AppError::NotFound(format!("Source {source_id} not found")))?;
        source.status = "refreshed".to_string();
        let cloned = source.clone();
        save_mock_state(&ctx.app_dir, &state)?;
        Ok(cloned)
    }

    async fn ask(
        &self,
        _auth: &NotebookLMAuthState,
        _settings: &NotebookLMSettings,
        _ctx: &ProviderContext,
        notebook_id: &str,
        question: &str,
    ) -> Result<AskResponse, AppError> {
        Ok(AskResponse {
            answer: format!(
                "NotebookLM mock answer for `{question}` in notebook `{notebook_id}`.\n\nUse real CLI provider to fetch live NotebookLM responses."
            ),
            sources: vec!["mock://source-1".to_string()],
        })
    }

    async fn research(
        &self,
        _auth: &NotebookLMAuthState,
        _settings: &NotebookLMSettings,
        _ctx: &ProviderContext,
        _notebook_id: &str,
        query: &str,
        mode: Option<String>,
        from: Option<String>,
    ) -> Result<ResearchResponse, AppError> {
        Ok(ResearchResponse {
            status: "completed".to_string(),
            imported_sources: 2,
            summary: format!(
                "Mock research completed for '{query}' (mode={}, from={}).",
                mode.unwrap_or_else(|| "fast".to_string()),
                from.unwrap_or_else(|| "web".to_string())
            ),
        })
    }

    async fn generate_artifact(
        &self,
        _auth: &NotebookLMAuthState,
        _settings: &NotebookLMSettings,
        _ctx: &ProviderContext,
        _notebook_id: &str,
        req: &GenerateArtifactRequest,
    ) -> Result<(ArtifactSummary, ArtifactPayload), AppError> {
        let artifact = ArtifactSummary {
            id: format!("art_{}", Uuid::new_v4().simple()),
            artifact_type: req.artifact_type.clone(),
            title: format!("{} result", req.artifact_type),
            created_at: Utc::now().to_rfc3339(),
            content: req.instructions.clone(),
        };

        let payload = match req.artifact_type.as_str() {
            "flashcards" => ArtifactPayload {
                flashcards: vec![
                    FlashcardItem {
                        question: "What is incremental reading?".to_string(),
                        answer: "A method for breaking reading into spaced reviewable chunks.".to_string(),
                        tags: vec!["notebooklm".to_string(), "incremental-reading".to_string()],
                    },
                    FlashcardItem {
                        question: "Why use NotebookLM artifacts in Incrementum?".to_string(),
                        answer: "To transform research outputs into schedulable review items.".to_string(),
                        tags: vec!["notebooklm".to_string(), "workflow".to_string()],
                    },
                ],
                ..ArtifactPayload::default()
            },
            "quiz" => ArtifactPayload {
                quiz_items: vec![
                    QuizItem {
                        question: "NotebookLM flashcards can be exported as JSON.".to_string(),
                        correct_answer: "True".to_string(),
                        user_answer: Some("False".to_string()),
                        was_correct: false,
                    },
                    QuizItem {
                        question: "Incrementum uses FSRS scheduling.".to_string(),
                        correct_answer: "True".to_string(),
                        user_answer: Some("True".to_string()),
                        was_correct: true,
                    },
                ],
                ..ArtifactPayload::default()
            },
            "mind-map" => {
                let mindmap_json = serde_json::json!({
                    "id": "root",
                    "text": req.instructions.clone().unwrap_or_else(|| "Main Topic".to_string()),
                    "children": [
                        {
                            "id": "child1",
                            "text": "Key Concept 1",
                            "children": [
                                {"id": "child1-1", "text": "Detail 1A"},
                                {"id": "child1-2", "text": "Detail 1B"}
                            ]
                        },
                        {
                            "id": "child2",
                            "text": "Key Concept 2",
                            "children": [
                                {"id": "child2-1", "text": "Detail 2A"},
                                {"id": "child2-2", "text": "Detail 2B"}
                            ]
                        },
                        {
                            "id": "child3",
                            "text": "Key Concept 3"
                        }
                    ]
                });
                ArtifactPayload {
                    json_content: Some(mindmap_json),
                    raw_text: Some(format!("Mind map: {}", req.instructions.clone().unwrap_or_default())),
                    ..ArtifactPayload::default()
                }
            },
            "data-table" => {
                let table_json = serde_json::json!([
                    {"Concept": "Process Scheduling", "Description": "Algorithms for CPU allocation", "Example": "Round Robin"},
                    {"Concept": "Memory Management", "Description": "Handling RAM allocation", "Example": "Virtual Memory"},
                    {"Concept": "File Systems", "Description": "Organization of storage", "Example": "NTFS, ext4"},
                    {"Concept": "I/O Management", "Description": "Device communication", "Example": "DMA, Interrupts"}
                ]);
                ArtifactPayload {
                    json_content: Some(table_json),
                    raw_text: Some("Data table with OS concepts".to_string()),
                    ..ArtifactPayload::default()
                }
            },
            "audio" => ArtifactPayload {
                media_url: Some("https://example.com/audio-overview.mp3".to_string()),
                raw_text: Some("Audio overview generated successfully. Listen to the podcast-style summary of your sources.".to_string()),
                ..ArtifactPayload::default()
            },
            "video" => ArtifactPayload {
                media_url: Some("https://example.com/video-overview.mp4".to_string()),
                raw_text: Some("Video overview generated successfully. Visual presentation of key concepts.".to_string()),
                ..ArtifactPayload::default()
            },
            "report" | "study-guide" => ArtifactPayload {
                raw_text: Some(format!(
                    "# Study Guide: {}\n\n## Summary\n\nThis is a comprehensive summary of the key concepts from your sources.\n\n## Key Points\n\n1. First important concept\n2. Second important concept\n3. Third important concept\n\n## Detailed Analysis\n\nThe material covers several fundamental topics that build upon each other...",
                    req.instructions.clone().unwrap_or_else(|| "Topic".to_string())
                )),
                ..ArtifactPayload::default()
            },
            _ => ArtifactPayload {
                raw_text: Some(format!(
                    "Mock {} artifact generated at {}",
                    req.artifact_type,
                    Utc::now().to_rfc3339()
                )),
                ..ArtifactPayload::default()
            },
        };

        Ok((artifact, payload))
    }
}

struct CliNotebookLMProvider;

#[derive(Debug, Clone)]
struct CliCommandResult {
    stdout: String,
}

impl CliCommandResult {
    fn json(&self) -> Option<serde_json::Value> {
        serde_json::from_str::<serde_json::Value>(&self.stdout).ok()
    }
}

async fn run_notebooklm_command(ctx: &ProviderContext, args: &[String]) -> Result<CliCommandResult, AppError> {
    let storage_path = ctx.app_dir.join("storage_state.json");
    if let Some(parent) = storage_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let mut effective_args = vec![
        "--storage".to_string(),
        storage_path.to_string_lossy().to_string(),
    ];
    effective_args.extend(args.iter().cloned());

    let mut command = if let (Some(runtime_python), Some(site_packages)) = (
        ctx.notebooklm_runtime_python.as_ref(),
        ctx.notebooklm_runtime_site_packages.as_ref(),
    ) {
        let python_home = runtime_python
            .parent()
            .and_then(|p| p.parent())
            .map(|p| p.to_path_buf());
        let mut cmd = Command::new(runtime_python);
        cmd.arg("-m")
            .arg("notebooklm.notebooklm_cli")
            .args(&effective_args)
            .env("PYTHONPATH", site_packages)
            .env("PYTHONNOUSERSITE", "1")
            .env("PYTHONWARNINGS", "ignore::DeprecationWarning");
        if let Some(home) = python_home {
            cmd.env("PYTHONHOME", home);
        }
        if let Some(playwright_path) = ctx.notebooklm_runtime_playwright.as_ref() {
            cmd.env("PLAYWRIGHT_BROWSERS_PATH", playwright_path);
        } else {
            cmd.env("PLAYWRIGHT_BROWSERS_PATH", "0");
        }
        cmd
    } else if let Some(managed_python) = ctx.notebooklm_managed_python.as_ref() {
        let mut cmd = Command::new(managed_python);
        cmd.arg("-m")
            .arg("notebooklm.notebooklm_cli")
            .args(&effective_args);
        cmd.env("PYTHONWARNINGS", "ignore::DeprecationWarning");
        cmd.env("PLAYWRIGHT_BROWSERS_PATH", "0");
        cmd
    } else {
        match ensure_managed_notebooklm_runtime(ctx).await {
            Ok((managed_python, managed_playwright)) => {
                tracing::info!(
                    "Installed NotebookLM managed runtime at {}",
                    managed_python.to_string_lossy()
                );
                let mut cmd = Command::new(managed_python);
                cmd.arg("-m")
                    .arg("notebooklm.notebooklm_cli")
                    .args(&effective_args);
                cmd.env("PYTHONWARNINGS", "ignore::DeprecationWarning");
                if let Some(playwright_path) = managed_playwright {
                    cmd.env("PLAYWRIGHT_BROWSERS_PATH", playwright_path);
                } else {
                    cmd.env("PLAYWRIGHT_BROWSERS_PATH", "0");
                }
                cmd
            }
            Err(install_err) => {
                tracing::warn!("Managed NotebookLM runtime install failed: {}", install_err);
                let executable = ctx
                    .notebooklm_bin
                    .as_ref()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_else(|| "notebooklm".to_string());
                let mut cmd = Command::new(&executable);
                cmd.args(&effective_args)
                    .env("PLAYWRIGHT_BROWSERS_PATH", "0");
                cmd
            }
        }
    };

    let command_label = format!(
        "{} {}",
        command.as_std().get_program().to_string_lossy(),
        command
            .as_std()
            .get_args()
            .map(|a| a.to_string_lossy().to_string())
            .collect::<Vec<_>>()
            .join(" ")
    )
    .trim()
    .to_string();

    let output = command
        .output()
        .await
        .map_err(|e| AppError::IntegrationError(format!("Failed to run notebooklm CLI ({command_label}): {e}")))?;

    if !output.status.success() {
        let code = output
            .status
            .code()
            .map(|c| c.to_string())
            .unwrap_or_else(|| "signal".to_string());
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let details = if !stderr.is_empty() {
            stderr
        } else if !stdout.is_empty() {
            format!("stdout: {stdout}")
        } else {
            "no stdout/stderr output".to_string()
        };
        return Err(AppError::IntegrationError(
            format!(
                "command `{}` failed (exit {}): {}",
                command_label,
                code,
                details
            ),
        ));
    }

    Ok(CliCommandResult {
        stdout: String::from_utf8_lossy(&output.stdout).trim().to_string(),
    })
}

async fn run_first_success(ctx: &ProviderContext, candidates: Vec<Vec<String>>) -> Result<CliCommandResult, AppError> {
    let mut errors = vec![];
    for args in candidates {
        match run_notebooklm_command(ctx, &args).await {
            Ok(result) => return Ok(result),
            Err(err) => errors.push(format!("{} -> {}", args.join(" "), err)),
        }
    }

    Err(AppError::IntegrationError(format!(
        "All notebooklm CLI command attempts failed:\n{}",
        errors.join("\n")
    )))
}

fn notebook_text(v: &serde_json::Value, keys: &[&str]) -> Option<String> {
    for key in keys {
        if let Some(value) = v.get(*key).and_then(|x| x.as_str()) {
            return Some(value.to_string());
        }
    }
    None
}

fn notebook_usize(v: &serde_json::Value, keys: &[&str]) -> Option<usize> {
    for key in keys {
        if let Some(value) = v.get(*key).and_then(|x| x.as_u64()) {
            return Some(value as usize);
        }
    }
    None
}

async fn cli_use_notebook(ctx: &ProviderContext, notebook_id: &str) -> Result<(), AppError> {
    run_notebooklm_command(ctx, &vec!["use".to_string(), notebook_id.to_string()]).await?;
    Ok(())
}

fn parse_notebook_list(value: &serde_json::Value) -> Vec<NotebookSummary> {
    if let Some(array) = value.as_array() {
        return array
            .iter()
            .filter_map(|item| {
                let id = notebook_text(item, &["id", "notebook_id"])?;
                let title = notebook_text(item, &["title", "name"]).unwrap_or_else(|| "Notebook".to_string());
                let sources_count = notebook_usize(item, &["sources_count", "sourcesCount", "source_count"]).unwrap_or(0);
                Some(NotebookSummary {
                    id,
                    title,
                    sources_count,
                })
            })
            .collect();
    }

    if let Some(array) = value.get("notebooks").and_then(|v| v.as_array()) {
        return array
            .iter()
            .filter_map(|item| {
                let id = notebook_text(item, &["id", "notebook_id"])?;
                let title = notebook_text(item, &["title", "name"]).unwrap_or_else(|| "Notebook".to_string());
                let sources_count = notebook_usize(item, &["sources_count", "sourcesCount", "source_count"]).unwrap_or(0);
                Some(NotebookSummary {
                    id,
                    title,
                    sources_count,
                })
            })
            .collect();
    }

    vec![]
}

fn normalize_cli_type(raw: &str) -> String {
    raw.to_lowercase().replace('_', "-").replace(' ', "-")
}

fn cli_list_filter_for(app_artifact_type: &str) -> &'static str {
    match normalize_cli_type(app_artifact_type).as_str() {
        "flashcards" => "flashcard",
        "study-guide" => "report",
        "mind-map" => "mind-map",
        "data-table" => "data-table",
        "audio" => "audio",
        "video" => "video",
        "quiz" => "quiz",
        "report" => "report",
        _ => "all",
    }
}

fn parse_generate_task_id(v: &serde_json::Value) -> Option<String> {
    notebook_text(v, &["task_id", "taskId", "artifact_id", "artifactId", "note_id", "noteId"])
}

fn csv_field(field: &str) -> String {
    field.trim().trim_matches('"').to_string()
}

fn parse_csv_line(line: &str) -> Vec<String> {
    let mut values = vec![];
    let mut field = String::new();
    let mut in_quotes = false;
    let mut chars = line.chars().peekable();
    while let Some(ch) = chars.next() {
        match ch {
            '"' => {
                if in_quotes && matches!(chars.peek(), Some('"')) {
                    field.push('"');
                    let _ = chars.next();
                } else {
                    in_quotes = !in_quotes;
                }
            }
            ',' if !in_quotes => {
                values.push(csv_field(&field));
                field.clear();
            }
            _ => field.push(ch),
        }
    }
    values.push(csv_field(&field));
    values
}

fn parse_csv_to_json_rows(csv: &str) -> serde_json::Value {
    let mut lines = csv.lines().filter(|l| !l.trim().is_empty());
    let headers = lines.next().map(parse_csv_line).unwrap_or_default();
    let rows = lines
        .map(parse_csv_line)
        .map(|values| {
            let mut row = serde_json::Map::new();
            for (idx, h) in headers.iter().enumerate() {
                row.insert(h.clone(), serde_json::Value::String(values.get(idx).cloned().unwrap_or_default()));
            }
            serde_json::Value::Object(row)
        })
        .collect::<Vec<_>>();
    serde_json::Value::Array(rows)
}

static NOTEBOOKLM_INLINE_DOLLAR_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"\$([^$\n]+)\$").expect("valid notebooklm inline-dollar regex"));

fn normalize_notebooklm_text(input: &str) -> String {
    // NotebookLM quiz/flashcard outputs sometimes wrap plain terms like $SCAN$.
    // Strip inline dollar wrappers while preserving inner text.
    NOTEBOOKLM_INLINE_DOLLAR_RE
        .replace_all(input, "$1")
        .replace(r"\$", "$")
        .trim()
        .to_string()
}

#[async_trait]
impl NotebookLMProvider for CliNotebookLMProvider {
    async fn health(
        &self,
        auth: &NotebookLMAuthState,
        settings: &NotebookLMSettings,
        ctx: &ProviderContext,
    ) -> Result<NotebookLMHealth, AppError> {
        if run_first_success(
            ctx,
            vec![
                vec!["status".to_string(), "--json".to_string()],
                vec!["status".to_string()],
            ],
        )
            .await
            .is_ok()
        {
            Ok(NotebookLMHealth {
                connected: auth.connected,
                provider: settings.provider.clone(),
                active_notebook_id: settings.active_notebook_id.clone(),
                message: "NotebookLM CLI reachable".to_string(),
            })
        } else {
            Err(AppError::IntegrationError(
                "NotebookLM CLI is not reachable".to_string(),
            ))
        }
    }

    async fn list_notebooks(
        &self,
        _auth: &NotebookLMAuthState,
        _settings: &NotebookLMSettings,
        ctx: &ProviderContext,
    ) -> Result<Vec<NotebookSummary>, AppError> {
        let result = run_first_success(
            ctx,
            vec![
                vec!["list".to_string(), "--json".to_string()],
            ],
        ).await;
        let result = match result {
            Ok(r) => r,
            Err(e) => {
                let err = e.to_string();
                if is_auth_error(&err) {
                    tracing::info!("NotebookLM list requires login; returning empty notebook list");
                    return Ok(vec![]);
                }
                tracing::warn!("NotebookLM list failed; returning empty list: {}", err);
                return Ok(vec![]);
            }
        };
        if let Some(json) = result.json() {
            return Ok(parse_notebook_list(&json));
        }
        Ok(vec![])
    }

    async fn create_notebook(
        &self,
        _auth: &NotebookLMAuthState,
        _settings: &NotebookLMSettings,
        ctx: &ProviderContext,
        title: &str,
    ) -> Result<NotebookSummary, AppError> {
        let result = run_notebooklm_command(ctx, &vec![
            "create".to_string(),
            title.to_string(),
            "--json".to_string(),
        ])
        .await?;
        if let Some(json) = result.json() {
            let id = notebook_text(&json, &["id", "notebook_id"])
                .ok_or_else(|| AppError::IntegrationError("NotebookLM CLI create did not return notebook ID".to_string()))?;
            let title = notebook_text(&json, &["title", "name"]).unwrap_or_else(|| title.to_string());
            return Ok(NotebookSummary {
                id,
                title,
                sources_count: 0,
            });
        }
        Err(AppError::IntegrationError(
            "NotebookLM CLI create returned non-JSON output. Re-run command manually with --json.".to_string(),
        ))
    }

    async fn list_sources(
        &self,
        _auth: &NotebookLMAuthState,
        _settings: &NotebookLMSettings,
        ctx: &ProviderContext,
        notebook_id: &str,
    ) -> Result<Vec<SourceSummary>, AppError> {
        let result = run_first_success(ctx, vec![
            vec![
                "source".to_string(),
                "list".to_string(),
                "--json".to_string(),
                "--notebook".to_string(),
                notebook_id.to_string(),
            ],
            vec![
                "source".to_string(),
                "list".to_string(),
                "--json".to_string(),
                "-n".to_string(),
                notebook_id.to_string(),
            ],
        ])
        .await?;

        let Some(json) = result.json() else {
            return Ok(vec![]);
        };

        let source_array = if let Some(arr) = json.as_array() {
            arr.clone()
        } else {
            json.get("sources")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default()
        };

        Ok(source_array
            .iter()
            .filter_map(|item| {
                let id = notebook_text(item, &["id", "source_id"])?;
                let title = notebook_text(item, &["title", "name"]).unwrap_or_else(|| "Source".to_string());
                let kind = notebook_text(item, &["kind", "type"]).unwrap_or_else(|| "unknown".to_string());
                let status = notebook_text(item, &["status"]).unwrap_or_else(|| "unknown".to_string());
                Some(SourceSummary { id, title, kind, status })
            })
            .collect())
    }

    async fn add_source(
        &self,
        _auth: &NotebookLMAuthState,
        _settings: &NotebookLMSettings,
        ctx: &ProviderContext,
        notebook_id: &str,
        req: &AddSourceRequest,
    ) -> Result<SourceSummary, AppError> {
        let mut base = vec![
            "source".to_string(),
            "add".to_string(),
            req.content.clone(),
            "--json".to_string(),
            "--notebook".to_string(),
            notebook_id.to_string(),
        ];
        if let Some(title) = &req.title {
            base.push("--title".to_string());
            base.push(title.clone());
        }

        let mut alt = vec![
            "source".to_string(),
            "add".to_string(),
            req.content.clone(),
            "--json".to_string(),
            "-n".to_string(),
            notebook_id.to_string(),
        ];
        if let Some(title) = &req.title {
            alt.push("--title".to_string());
            alt.push(title.clone());
        }

        let result = run_first_success(ctx, vec![base, alt]).await?;
        let Some(json) = result.json() else {
            return Err(AppError::IntegrationError(
                "NotebookLM CLI source add returned non-JSON output.".to_string(),
            ));
        };
        let id = notebook_text(&json, &["id", "source_id"])
            .ok_or_else(|| AppError::IntegrationError("NotebookLM CLI source add did not return source ID".to_string()))?;
        let title = notebook_text(&json, &["title", "name"])
            .or_else(|| req.title.clone())
            .unwrap_or_else(|| req.content.chars().take(60).collect());
        let kind = notebook_text(&json, &["kind", "type"]).unwrap_or_else(|| req.kind.clone());
        let status = notebook_text(&json, &["status"]).unwrap_or_else(|| "processing".to_string());
        Ok(SourceSummary { id, title, kind, status })
    }

    async fn refresh_source(
        &self,
        _auth: &NotebookLMAuthState,
        _settings: &NotebookLMSettings,
        ctx: &ProviderContext,
        notebook_id: &str,
        source_id: &str,
    ) -> Result<SourceSummary, AppError> {
        let result = run_first_success(ctx, vec![
            vec![
                "source".to_string(),
                "refresh".to_string(),
                source_id.to_string(),
                "--json".to_string(),
                "--notebook".to_string(),
                notebook_id.to_string(),
            ],
            vec![
                "source".to_string(),
                "refresh".to_string(),
                source_id.to_string(),
                "--json".to_string(),
                "-n".to_string(),
                notebook_id.to_string(),
            ],
        ])
        .await?;

        let Some(json) = result.json() else {
            return Err(AppError::IntegrationError(
                "NotebookLM CLI source refresh returned non-JSON output.".to_string(),
            ));
        };

        let id = notebook_text(&json, &["id", "source_id"]).unwrap_or_else(|| source_id.to_string());
        let title = notebook_text(&json, &["title", "name"]).unwrap_or_else(|| "Source".to_string());
        let kind = notebook_text(&json, &["kind", "type"]).unwrap_or_else(|| "unknown".to_string());
        let status = notebook_text(&json, &["status"]).unwrap_or_else(|| "refreshed".to_string());
        Ok(SourceSummary { id, title, kind, status })
    }

    async fn ask(
        &self,
        _auth: &NotebookLMAuthState,
        _settings: &NotebookLMSettings,
        ctx: &ProviderContext,
        notebook_id: &str,
        question: &str,
    ) -> Result<AskResponse, AppError> {
        let mut attempts = vec![
            vec![
                "ask".to_string(),
                question.to_string(),
                "--json".to_string(),
                "--notebook".to_string(),
                notebook_id.to_string(),
            ],
            vec![
                "ask".to_string(),
                question.to_string(),
                "--json".to_string(),
                "-n".to_string(),
                notebook_id.to_string(),
            ],
        ];

        // Fallback: set notebook context first, then ask.
        if cli_use_notebook(ctx, notebook_id).await.is_ok() {
            attempts.push(vec![
                "ask".to_string(),
                question.to_string(),
                "--json".to_string(),
            ]);
        }

        let result = run_first_success(ctx, attempts).await?;
        if let Some(json) = result.json() {
            let answer = notebook_text(&json, &["answer", "response", "text"]).unwrap_or_else(|| result.stdout.clone());
            let sources = json
                .get("sources")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|s| {
                            s.as_str().map(|x| x.to_string()).or_else(|| notebook_text(s, &["source_id", "id", "title"]))
                        })
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            return Ok(AskResponse { answer, sources });
        }

        Ok(AskResponse {
            answer: result.stdout,
            sources: vec![],
        })
    }

    async fn research(
        &self,
        _auth: &NotebookLMAuthState,
        _settings: &NotebookLMSettings,
        ctx: &ProviderContext,
        notebook_id: &str,
        query: &str,
        mode: Option<String>,
        from: Option<String>,
    ) -> Result<ResearchResponse, AppError> {
        let mode = mode.unwrap_or_else(|| "fast".to_string());
        let from = from.unwrap_or_else(|| "web".to_string());
        // notebooklm-py CLI workflow:
        // 1) source add-research "<query>" --no-wait ...
        // 2) research wait --json --import-all ...
        let start = run_first_success(
            ctx,
            vec![
                vec![
                    "source".to_string(),
                    "add-research".to_string(),
                    query.to_string(),
                    "--mode".to_string(),
                    mode.clone(),
                    "--from".to_string(),
                    from.clone(),
                    "--no-wait".to_string(),
                    "--notebook".to_string(),
                    notebook_id.to_string(),
                ],
                vec![
                    "source".to_string(),
                    "add-research".to_string(),
                    query.to_string(),
                    "--mode".to_string(),
                    mode.clone(),
                    "--from".to_string(),
                    from.clone(),
                    "--no-wait".to_string(),
                    "-n".to_string(),
                    notebook_id.to_string(),
                ],
            ],
        )
        .await?;

        let wait = run_first_success(
            ctx,
            vec![
                vec![
                    "research".to_string(),
                    "wait".to_string(),
                    "--json".to_string(),
                    "--import-all".to_string(),
                    "--notebook".to_string(),
                    notebook_id.to_string(),
                ],
                vec![
                    "research".to_string(),
                    "wait".to_string(),
                    "--json".to_string(),
                    "--import-all".to_string(),
                    "-n".to_string(),
                    notebook_id.to_string(),
                ],
            ],
        )
        .await?;

        if let Some(json) = wait.json() {
            let summary = notebook_text(
                &json,
                &[
                    "summary",
                    "answer",
                    "response",
                    "text",
                    "message",
                    "result",
                ],
            )
            .unwrap_or_else(|| wait.stdout.clone());
            let imported_sources = notebook_usize(
                &json,
                &[
                    "imported_sources",
                    "importedSources",
                    "sources_imported",
                    "sourcesCount",
                ],
            )
            .unwrap_or(0);
            let status = notebook_text(&json, &["status", "state"]).unwrap_or_else(|| "completed".to_string());
            return Ok(ResearchResponse {
                status,
                imported_sources,
                summary,
            });
        }

        Ok(ResearchResponse {
            status: "completed".to_string(),
            imported_sources: 0,
            summary: format!("{}\n{}", start.stdout, wait.stdout),
        })
    }

    async fn generate_artifact(
        &self,
        _auth: &NotebookLMAuthState,
        _settings: &NotebookLMSettings,
        ctx: &ProviderContext,
        notebook_id: &str,
        req: &GenerateArtifactRequest,
    ) -> Result<(ArtifactSummary, ArtifactPayload), AppError> {
        let now = Utc::now().to_rfc3339();
        let artifact_type = normalize_cli_type(&req.artifact_type);
        let mut generate_args = vec!["generate".to_string()];
        let mut extra_attempts: Vec<Vec<String>> = vec![];

        match artifact_type.as_str() {
            "study-guide" => {
                generate_args.push("report".to_string());
                if let Some(instructions) = req.instructions.as_ref().filter(|s| !s.trim().is_empty()) {
                    generate_args.push(instructions.trim().to_string());
                }
                generate_args.push("--format".to_string());
                generate_args.push("study-guide".to_string());
                generate_args.push("--wait".to_string());
                generate_args.push("--json".to_string());
            }
            "report" => {
                generate_args.push("report".to_string());
                if let Some(instructions) = req.instructions.as_ref().filter(|s| !s.trim().is_empty()) {
                    generate_args.push(instructions.trim().to_string());
                }
                generate_args.push("--wait".to_string());
                generate_args.push("--json".to_string());
            }
            "mind-map" => {
                generate_args.push("mind-map".to_string());
                generate_args.push("--json".to_string());
            }
            "data-table" => {
                generate_args.push("data-table".to_string());
                generate_args.push(
                    req.instructions
                        .as_ref()
                        .filter(|s| !s.trim().is_empty())
                        .map(|s| s.trim().to_string())
                        .unwrap_or_else(|| "Summarize key concepts in a comparison table.".to_string()),
                );
                generate_args.push("--wait".to_string());
                generate_args.push("--json".to_string());
            }
            "flashcards" | "quiz" => {
                generate_args.push(artifact_type.clone());
                if let Some(instructions) = req.instructions.as_ref().filter(|s| !s.trim().is_empty()) {
                    generate_args.push(instructions.trim().to_string());
                }
                if let Some(quantity) = req.quantity.as_ref() {
                    let q = quantity.trim().to_lowercase();
                    if q == "fewer" || q == "standard" || q == "more" {
                        generate_args.push("--quantity".to_string());
                        generate_args.push(q);
                    }
                }
                if let Some(difficulty) = req.difficulty.as_ref() {
                    let d = difficulty.trim().to_lowercase();
                    if d == "easy" || d == "medium" || d == "hard" {
                        generate_args.push("--difficulty".to_string());
                        generate_args.push(d);
                    }
                }
                generate_args.push("--wait".to_string());
                generate_args.push("--json".to_string());
            }
            "audio" | "video" => {
                generate_args.push(artifact_type.clone());
                if let Some(instructions) = req.instructions.as_ref().filter(|s| !s.trim().is_empty()) {
                    generate_args.push(instructions.trim().to_string());
                }
                generate_args.push("--wait".to_string());
                generate_args.push("--json".to_string());
            }
            _ => {
                return Err(AppError::IntegrationError(format!(
                    "Unsupported NotebookLM artifact type for CLI provider: {}",
                    req.artifact_type
                )));
            }
        }

        if let Some(retry_count) = req.retry_count {
            if retry_count > 0 && artifact_type != "mind-map" {
                generate_args.push("--retry".to_string());
                generate_args.push(retry_count.to_string());
            }
        }

        let mut with_notebook = generate_args.clone();
        with_notebook.push("--notebook".to_string());
        with_notebook.push(notebook_id.to_string());

        let mut with_notebook_short = generate_args.clone();
        with_notebook_short.push("-n".to_string());
        with_notebook_short.push(notebook_id.to_string());

        extra_attempts.push(with_notebook);
        extra_attempts.push(with_notebook_short);
        if cli_use_notebook(ctx, notebook_id).await.is_ok() {
            extra_attempts.push(generate_args.clone());
        }

        let generate_result = run_first_success(ctx, extra_attempts).await?;
        let generate_json = generate_result.json();
        let mut artifact_id = generate_json.as_ref().and_then(parse_generate_task_id);

        if artifact_id.is_none() {
            let list_type = cli_list_filter_for(&artifact_type).to_string();
            let list_result = run_first_success(ctx, vec![
                vec![
                    "artifact".to_string(),
                    "list".to_string(),
                    "--type".to_string(),
                    list_type.clone(),
                    "--json".to_string(),
                    "--notebook".to_string(),
                    notebook_id.to_string(),
                ],
                vec![
                    "artifact".to_string(),
                    "list".to_string(),
                    "--type".to_string(),
                    list_type,
                    "--json".to_string(),
                    "-n".to_string(),
                    notebook_id.to_string(),
                ],
            ])
            .await?;
            if let Some(json) = list_result.json() {
                if let Some(artifacts) = json.get("artifacts").and_then(|v| v.as_array()) {
                    let mut latest = artifacts
                        .iter()
                        .filter_map(|a| {
                            Some((
                                notebook_text(a, &["created_at", "createdAt"]).unwrap_or_default(),
                                notebook_text(a, &["id"])?
                            ))
                        })
                        .collect::<Vec<_>>();
                    latest.sort_by(|a, b| b.0.cmp(&a.0));
                    artifact_id = latest.first().map(|(_, id)| id.clone());
                }
            }
        }

        let artifact = ArtifactSummary {
            id: artifact_id.clone().unwrap_or_else(|| format!("art_{}", Uuid::new_v4().simple())),
            artifact_type: artifact_type.clone(),
            title: format!("{} result", artifact_type),
            created_at: now.clone(),
            content: req.instructions.clone(),
        };

        let artifact_dir = ctx.app_dir.join("artifacts");
        fs::create_dir_all(&artifact_dir)?;
        let file_stem = format!("{}-{}", artifact_type.replace('/', "-"), Uuid::new_v4().simple());

        let mut payload = ArtifactPayload::default();

        match artifact_type.as_str() {
            "audio" | "video" => {
                let ext = if artifact_type == "audio" { "mp3" } else { "mp4" };
                let output_path = artifact_dir.join(format!("{}.{}", file_stem, ext));
                let mut download = vec![
                    "download".to_string(),
                    artifact_type.clone(),
                    output_path.to_string_lossy().to_string(),
                ];
                if let Some(id) = artifact_id.as_ref() {
                    download.push("--artifact".to_string());
                    download.push(id.clone());
                }
                download.push("--notebook".to_string());
                download.push(notebook_id.to_string());
                run_notebooklm_command(ctx, &download).await?;
                payload.media_url = Some(output_path.to_string_lossy().to_string());
                payload.raw_text = Some(format!("{} overview generated via NotebookLM CLI.", artifact_type));
            }
            "report" | "study-guide" => {
                let output_path = artifact_dir.join(format!("{}.md", file_stem));
                let mut download = vec![
                    "download".to_string(),
                    "report".to_string(),
                    output_path.to_string_lossy().to_string(),
                ];
                if let Some(id) = artifact_id.as_ref() {
                    download.push("--artifact".to_string());
                    download.push(id.clone());
                }
                download.push("--notebook".to_string());
                download.push(notebook_id.to_string());
                run_notebooklm_command(ctx, &download).await?;
                payload.raw_text = Some(fs::read_to_string(&output_path)?);
            }
            "mind-map" => {
                let output_path = artifact_dir.join(format!("{}.json", file_stem));
                let mut download = vec![
                    "download".to_string(),
                    "mind-map".to_string(),
                    output_path.to_string_lossy().to_string(),
                ];
                if let Some(id) = artifact_id.as_ref() {
                    download.push("--artifact".to_string());
                    download.push(id.clone());
                }
                download.push("--notebook".to_string());
                download.push(notebook_id.to_string());
                run_notebooklm_command(ctx, &download).await?;
                let text = fs::read_to_string(&output_path)?;
                payload.json_content = serde_json::from_str::<serde_json::Value>(&text).ok();
                payload.raw_text = Some(text);
            }
            "data-table" => {
                let output_path = artifact_dir.join(format!("{}.csv", file_stem));
                let mut download = vec![
                    "download".to_string(),
                    "data-table".to_string(),
                    output_path.to_string_lossy().to_string(),
                ];
                if let Some(id) = artifact_id.as_ref() {
                    download.push("--artifact".to_string());
                    download.push(id.clone());
                }
                download.push("--notebook".to_string());
                download.push(notebook_id.to_string());
                run_notebooklm_command(ctx, &download).await?;
                let csv = fs::read_to_string(&output_path)?;
                payload.raw_text = Some(csv.clone());
                payload.json_content = Some(parse_csv_to_json_rows(&csv));
            }
            "flashcards" => {
                let output_path = artifact_dir.join(format!("{}.json", file_stem));
                let mut download = vec![
                    "download".to_string(),
                    "flashcards".to_string(),
                    output_path.to_string_lossy().to_string(),
                    "--format".to_string(),
                    "json".to_string(),
                ];
                if let Some(id) = artifact_id.as_ref() {
                    download.push("--artifact".to_string());
                    download.push(id.clone());
                }
                download.push("--notebook".to_string());
                download.push(notebook_id.to_string());
                run_notebooklm_command(ctx, &download).await?;
                let parsed = serde_json::from_str::<serde_json::Value>(&fs::read_to_string(&output_path)?)
                    .unwrap_or_else(|_| serde_json::json!({}));
                payload.flashcards = parsed
                    .get("cards")
                    .and_then(|v| v.as_array())
                    .map(|cards| {
                        cards
                            .iter()
                            .map(|c| FlashcardItem {
                                question: normalize_notebooklm_text(
                                    &notebook_text(c, &["front", "question", "q", "f"]).unwrap_or_default(),
                                ),
                                answer: normalize_notebooklm_text(
                                    &notebook_text(c, &["back", "answer", "a", "b"]).unwrap_or_default(),
                                ),
                                tags: vec!["notebooklm".to_string(), "flashcards".to_string()],
                            })
                            .filter(|f| !f.question.trim().is_empty() && !f.answer.trim().is_empty())
                            .collect::<Vec<_>>()
                    })
                    .unwrap_or_default();
                payload.raw_text = Some(fs::read_to_string(&output_path)?);
            }
            "quiz" => {
                let output_path = artifact_dir.join(format!("{}.json", file_stem));
                let mut download = vec![
                    "download".to_string(),
                    "quiz".to_string(),
                    output_path.to_string_lossy().to_string(),
                    "--format".to_string(),
                    "json".to_string(),
                ];
                if let Some(id) = artifact_id.as_ref() {
                    download.push("--artifact".to_string());
                    download.push(id.clone());
                }
                download.push("--notebook".to_string());
                download.push(notebook_id.to_string());
                run_notebooklm_command(ctx, &download).await?;
                let parsed = serde_json::from_str::<serde_json::Value>(&fs::read_to_string(&output_path)?)
                    .unwrap_or_else(|_| serde_json::json!({}));
                payload.quiz_items = parsed
                    .get("questions")
                    .and_then(|v| v.as_array())
                    .map(|questions| {
                        questions
                            .iter()
                            .map(|q| {
                                let correct_answer = q
                                    .get("answerOptions")
                                    .and_then(|opts| opts.as_array())
                                    .and_then(|opts| {
                                        opts.iter().find_map(|o| {
                                            let is_correct = o.get("isCorrect").and_then(|v| v.as_bool()).unwrap_or(false);
                                            if is_correct {
                                                notebook_text(o, &["text", "answer"])
                                            } else {
                                                None
                                            }
                                        })
                                    })
                                    .unwrap_or_default();
                                QuizItem {
                                    question: normalize_notebooklm_text(
                                        &notebook_text(q, &["question", "q"]).unwrap_or_default(),
                                    ),
                                    correct_answer: normalize_notebooklm_text(&correct_answer),
                                    user_answer: None,
                                    was_correct: false,
                                }
                            })
                            .filter(|q| !q.question.trim().is_empty() && !q.correct_answer.trim().is_empty())
                            .collect::<Vec<_>>()
                    })
                    .unwrap_or_default();
                payload.raw_text = Some(fs::read_to_string(&output_path)?);
            }
            _ => {}
        }

        Ok((artifact, payload))
    }
}

fn provider_for(settings: &NotebookLMSettings) -> Box<dyn NotebookLMProvider> {
    if settings.provider == "cli" {
        Box::new(CliNotebookLMProvider)
    } else {
        Box::new(MockNotebookLMProvider)
    }
}

fn current_target_triple() -> &'static str {
    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    {
        return "x86_64-unknown-linux-gnu";
    }
    #[cfg(all(target_os = "linux", target_arch = "aarch64"))]
    {
        return "aarch64-unknown-linux-gnu";
    }
    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    {
        return "x86_64-apple-darwin";
    }
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    {
        return "aarch64-apple-darwin";
    }
    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    {
        return "x86_64-pc-windows-msvc";
    }
    "unknown-target"
}

fn notebooklm_binary_candidates(app: &tauri::AppHandle) -> Vec<PathBuf> {
    let mut candidates = vec![];
    let triple = current_target_triple();
    let ext = if cfg!(target_os = "windows") { ".exe" } else { "" };

    if let Ok(path) = std::env::var("NOTEBOOKLM_BIN_PATH") {
        if !path.trim().is_empty() {
            candidates.push(PathBuf::from(path));
        }
    }

    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join(format!("notebooklm-{}{}", triple, ext)));
        candidates.push(resource_dir.join("bin").join(format!("notebooklm-{}{}", triple, ext)));
        candidates.push(resource_dir.join("bin").join(format!("notebooklm{}", ext)));
    }

    // Dev-mode relative paths from either repo root or src-tauri cwd.
    candidates.push(PathBuf::from("src-tauri/bin").join(format!("notebooklm-{}{}", triple, ext)));
    candidates.push(PathBuf::from("src-tauri/bin").join(format!("notebooklm{}", ext)));
    candidates.push(PathBuf::from("bin").join(format!("notebooklm-{}{}", triple, ext)));
    candidates.push(PathBuf::from("bin").join(format!("notebooklm{}", ext)));
    candidates.push(PathBuf::from("../src-tauri/bin").join(format!("notebooklm-{}{}", triple, ext)));
    candidates.push(PathBuf::from("../src-tauri/bin").join(format!("notebooklm{}", ext)));
    candidates.push(PathBuf::from(format!("notebooklm{}", ext)));
    candidates
}

fn notebooklm_runtime_base_candidates(app: &tauri::AppHandle) -> Vec<PathBuf> {
    let mut candidates = vec![];
    let triple = current_target_triple();

    if let Ok(path) = std::env::var("NOTEBOOKLM_RUNTIME_PATH") {
        if !path.trim().is_empty() {
            candidates.push(PathBuf::from(path));
        }
    }

    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("notebooklm-runtime").join(triple));
        candidates.push(resource_dir.join("bin").join("notebooklm-runtime").join(triple));
    }

    candidates.push(PathBuf::from("src-tauri/bin/notebooklm-runtime").join(triple));
    candidates.push(PathBuf::from("bin/notebooklm-runtime").join(triple));
    candidates.push(PathBuf::from("../src-tauri/bin/notebooklm-runtime").join(triple));
    candidates
}

fn managed_notebooklm_runtime_base(app_dir: &Path) -> PathBuf {
    app_dir.join("runtime").join(current_target_triple())
}

fn managed_notebooklm_runtime_python(base: &Path) -> PathBuf {
    if cfg!(target_os = "windows") {
        base.join(".venv").join("Scripts").join("python.exe")
    } else {
        base.join(".venv").join("bin").join("python3")
    }
}

fn managed_runtime_has_notebooklm_package(base: &Path) -> bool {
    if cfg!(target_os = "windows") {
        return base
            .join(".venv")
            .join("Lib")
            .join("site-packages")
            .join("notebooklm")
            .exists();
    }

    let lib_dir = base.join(".venv").join("lib");
    let entries = match fs::read_dir(&lib_dir) {
        Ok(entries) => entries,
        Err(_) => return false,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        if !name.starts_with("python") {
            continue;
        }
        if path.join("site-packages").join("notebooklm").exists() {
            return true;
        }
    }

    false
}

fn resolve_managed_notebooklm_runtime(app_dir: &Path) -> (Option<PathBuf>, Option<PathBuf>) {
    let base = managed_notebooklm_runtime_base(app_dir);
    let python = managed_notebooklm_runtime_python(&base);
    if python.exists() && managed_runtime_has_notebooklm_package(&base) {
        return (Some(python), None);
    }
    (None, None)
}

async fn detect_system_python() -> Option<Vec<String>> {
    let candidates: Vec<Vec<&str>> = if cfg!(target_os = "windows") {
        vec![vec!["py", "-3"], vec!["python"], vec!["python3"]]
    } else {
        vec![vec!["python3"], vec!["python"]]
    };

    for candidate in candidates {
        let mut cmd = Command::new(candidate[0]);
        if candidate.len() > 1 {
            cmd.args(&candidate[1..]);
        }
        let status = cmd.arg("--version").output().await;
        if let Ok(output) = status {
            if output.status.success() {
                return Some(candidate.iter().map(|s| s.to_string()).collect());
            }
        }
    }

    None
}

async fn run_command_required(
    program: &str,
    args: &[String],
    envs: &[(String, String)],
    label: &str,
) -> Result<(), AppError> {
    let mut cmd = Command::new(program);
    cmd.args(args);
    for (k, v) in envs {
        cmd.env(k, v);
    }
    let output = cmd
        .output()
        .await
        .map_err(|e| AppError::IntegrationError(format!("Failed to execute {label}: {e}")))?;
    if output.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let details = if !stderr.is_empty() {
        stderr
    } else if !stdout.is_empty() {
        format!("stdout: {stdout}")
    } else {
        "no stdout/stderr output".to_string()
    };
    Err(AppError::IntegrationError(format!("{label} failed: {details}")))
}

async fn run_command_optional(program: &str, args: &[String], label: &str) {
    if let Err(e) = run_command_required(program, args, &[], label).await {
        tracing::warn!("Optional command failed: {}", e);
    }
}

async fn ensure_managed_notebooklm_runtime(
    ctx: &ProviderContext,
) -> Result<(PathBuf, Option<PathBuf>), AppError> {
    let python_cmd = detect_system_python().await.ok_or_else(|| {
        AppError::IntegrationError(
            "NotebookLM runtime is not installed and no system Python was found. Install Python 3 and retry."
                .to_string(),
        )
    })?;

    let base = managed_notebooklm_runtime_base(&ctx.app_dir);
    let venv_dir = base.join(".venv");
    fs::create_dir_all(&base)?;

    let venv_python = managed_notebooklm_runtime_python(&base);
    if !venv_python.exists() {
        let mut venv_args = python_cmd[1..].to_vec();
        venv_args.extend([
            "-m".to_string(),
            "venv".to_string(),
            venv_dir.to_string_lossy().to_string(),
        ]);
        run_command_required(&python_cmd[0], &venv_args, &[], "Create NotebookLM venv").await?;
        if !venv_python.exists() {
            return Err(AppError::IntegrationError(
                "NotebookLM venv was created but python executable is missing".to_string(),
            ));
        }
    }

    let pip_upgrade = vec![
        "-m".to_string(),
        "pip".to_string(),
        "install".to_string(),
        "--upgrade".to_string(),
        "pip".to_string(),
    ];
    run_command_optional(
        &venv_python.to_string_lossy(),
        &pip_upgrade,
        "Upgrade pip in NotebookLM runtime",
    )
    .await;

    let install_cli = vec![
        "-m".to_string(),
        "pip".to_string(),
        "install".to_string(),
        "notebooklm-py[browser]".to_string(),
    ];
    run_command_required(
        &venv_python.to_string_lossy(),
        &install_cli,
        &[],
        "Install notebooklm-py runtime",
    )
    .await?;

    let install_browser = vec![
        "-m".to_string(),
        "playwright".to_string(),
        "install".to_string(),
        "chromium".to_string(),
    ];
    run_command_required(
        &venv_python.to_string_lossy(),
        &install_browser,
        &[("PLAYWRIGHT_BROWSERS_PATH".to_string(), "0".to_string())],
        "Install Playwright Chromium",
    )
    .await?;

    Ok((venv_python, None))
}

fn resolve_notebooklm_runtime(
    app: &tauri::AppHandle,
) -> (Option<PathBuf>, Option<PathBuf>, Option<PathBuf>) {
    let runtime_python_rel = if cfg!(target_os = "windows") {
        PathBuf::from("python").join("python.exe")
    } else {
        PathBuf::from("python").join("bin").join("python3")
    };

    for base in notebooklm_runtime_base_candidates(app) {
        let runtime_python = base.join(&runtime_python_rel);
        let site_packages = base.join("site-packages");
        if runtime_python.exists() && site_packages.exists() {
            let playwright = base.join("playwright");
            let playwright_opt = if playwright.exists() {
                Some(playwright)
            } else {
                None
            };
            return (Some(runtime_python), Some(site_packages), playwright_opt);
        }
    }

    (None, None, None)
}

fn resolve_notebooklm_binary(app: &tauri::AppHandle) -> Option<PathBuf> {
    for candidate in notebooklm_binary_candidates(app) {
        if candidate == PathBuf::from("notebooklm") || candidate == PathBuf::from("notebooklm.exe") {
            return Some(candidate);
        }
        if candidate.exists() {
            return Some(candidate);
        }
    }
    None
}

fn provider_context(app: &tauri::AppHandle, app_dir: PathBuf) -> ProviderContext {
    let (notebooklm_runtime_python, notebooklm_runtime_site_packages, notebooklm_runtime_playwright) =
        resolve_notebooklm_runtime(app);
    let (notebooklm_managed_python, managed_playwright) = resolve_managed_notebooklm_runtime(&app_dir);
    let notebooklm_runtime_playwright = notebooklm_runtime_playwright.or(managed_playwright);
    ProviderContext {
        app_dir,
        notebooklm_bin: resolve_notebooklm_binary(app),
        notebooklm_runtime_python,
        notebooklm_runtime_site_packages,
        notebooklm_runtime_playwright,
        notebooklm_managed_python,
    }
}

fn integration_root(app: &tauri::AppHandle) -> Result<PathBuf, AppError> {
    let root = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::IntegrationError(format!("Failed to resolve app data dir: {e}")))?
        .join("notebooklm");
    fs::create_dir_all(&root)?;
    Ok(root)
}

fn settings_path(root: &Path) -> PathBuf {
    root.join("settings.json")
}

fn auth_path(root: &Path) -> PathBuf {
    root.join("auth.json")
}

fn jobs_path(root: &Path) -> PathBuf {
    root.join("jobs.json")
}

fn mock_state_path(root: &Path) -> PathBuf {
    root.join("mock_state.json")
}

fn load_settings(root: &Path) -> Result<NotebookLMSettings, AppError> {
    let path = settings_path(root);
    if !path.exists() {
        return Ok(NotebookLMSettings::default());
    }
    Ok(serde_json::from_str(&fs::read_to_string(path)?)?)
}

fn save_settings(root: &Path, settings: &NotebookLMSettings) -> Result<(), AppError> {
    write_json_secure(&settings_path(root), settings)
}

fn load_auth(root: &Path) -> Result<NotebookLMAuthState, AppError> {
    let path = auth_path(root);
    if !path.exists() {
        return Ok(NotebookLMAuthState::default());
    }
    Ok(serde_json::from_str(&fs::read_to_string(path)?)?)
}

fn save_auth(root: &Path, auth: &NotebookLMAuthState) -> Result<(), AppError> {
    write_json_secure(&auth_path(root), auth)
}

fn load_jobs(root: &Path) -> Result<JobsFile, AppError> {
    let path = jobs_path(root);
    if !path.exists() {
        return Ok(JobsFile::default());
    }
    Ok(serde_json::from_str(&fs::read_to_string(path)?)?)
}

fn save_jobs(root: &Path, jobs: &JobsFile) -> Result<(), AppError> {
    write_json_secure(&jobs_path(root), jobs)
}

fn load_mock_state(root: &Path) -> Result<MockState, AppError> {
    let path = mock_state_path(root);
    if !path.exists() {
        let state = MockState::default();
        write_json_secure(&path, &state)?;
        return Ok(state);
    }
    Ok(serde_json::from_str(&fs::read_to_string(path)?)?)
}

fn save_mock_state(root: &Path, state: &MockState) -> Result<(), AppError> {
    write_json_secure(&mock_state_path(root), state)
}

fn write_json_secure<T: Serialize>(path: &Path, value: &T) -> Result<(), AppError> {
    let payload = serde_json::to_vec_pretty(value)?;
    fs::write(path, payload)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = fs::Permissions::from_mode(0o600);
        fs::set_permissions(path, perms)?;
    }
    Ok(())
}

fn resolve_notebook_id(settings: &NotebookLMSettings, input: &Option<String>) -> Result<String, AppError> {
    input
        .clone()
        .or_else(|| settings.active_notebook_id.clone())
        .ok_or_else(|| AppError::InvalidInput("No notebook selected".to_string()))
}

fn is_auth_error(err: &str) -> bool {
    let lower = err.to_lowercase();
    lower.contains("auth")
        || lower.contains("401")
        || lower.contains("403")
        || lower.contains("session")
        || lower.contains("not logged in")
        || lower.contains("login")
        || lower.contains("unauthorized")
}

fn should_retry_generation(err: &str, attempts_left: u8) -> bool {
    attempts_left > 0 && !is_auth_error(err)
}

fn quiz_to_import_items(quiz_items: &[QuizItem], mode: &str) -> Vec<(String, String)> {
    let missed_only = mode.eq_ignore_ascii_case("missed-only");
    quiz_items
        .iter()
        .filter(|q| !missed_only || !q.was_correct)
        .map(|q| {
            let answer = q
                .user_answer
                .clone()
                .filter(|a| !a.trim().is_empty())
                .unwrap_or_else(|| q.correct_answer.clone());
            (
                normalize_notebooklm_text(&q.question),
                normalize_notebooklm_text(&answer),
            )
        })
        .collect()
}

async fn upsert_learning_items(
    repo: &Repository,
    candidates: &[ImportPreviewItem],
    deck_name: Option<String>,
    dedupe: bool,
) -> Result<SyncResult, AppError> {
    let mut created = 0;
    let mut updated = 0;
    let mut skipped = 0;
    let mut item_ids = Vec::new();
    let existing = repo.get_all_learning_items().await?;
    let mut index: HashMap<(String, String), LearningItem> = HashMap::new();
    for item in existing {
        index.insert(
            (
                item.question.trim().to_lowercase(),
                item.answer.clone().unwrap_or_default().trim().to_lowercase(),
            ),
            item,
        );
    }

    for candidate in candidates {
        let key = (
            candidate.question.trim().to_lowercase(),
            candidate.answer.trim().to_lowercase(),
        );
        if dedupe {
            if let Some(mut existing_item) = index.get(&key).cloned() {
                for tag in candidate.tags.iter() {
                    if !existing_item.tags.contains(tag) {
                        existing_item.tags.push(tag.clone());
                    }
                }
                if let Some(deck) = &deck_name {
                    let deck_tag = format!("deck:{deck}");
                    if !existing_item.tags.contains(&deck_tag) {
                        existing_item.tags.push(deck_tag);
                    }
                }
                existing_item.date_modified = Utc::now();
                let saved = repo.update_learning_item(&existing_item).await?;
                updated += 1;
                item_ids.push(saved.id);
                continue;
            }
        }

        let mut item = LearningItem::new(ItemType::Flashcard, candidate.question.clone());
        item.answer = Some(candidate.answer.clone());
        item.tags = candidate.tags.clone();
        item.tags.push("source:notebooklm".to_string());
        item.tags.push(format!("notebook:{}", candidate.source_notebook_id));
        item.tags.push(format!("artifact:{}", candidate.source_artifact_id));
        if let Some(deck) = &deck_name {
            item.tags.push(format!("deck:{deck}"));
        }
        let saved = repo.create_learning_item(&item).await?;
        created += 1;
        item_ids.push(saved.id.clone());
        index.insert(key, saved);
    }

    if !dedupe {
        skipped = 0;
    }

    Ok(SyncResult {
        created,
        updated,
        skipped,
        item_ids,
    })
}

#[tauri::command]
pub async fn notebooklm_get_settings(app: tauri::AppHandle) -> Result<NotebookLMSettings, AppError> {
    let root = integration_root(&app)?;
    load_settings(&root)
}

#[tauri::command]
pub async fn notebooklm_set_settings(
    app: tauri::AppHandle,
    enabled: Option<bool>,
    provider: Option<String>,
    active_notebook_id: Option<String>,
) -> Result<NotebookLMSettings, AppError> {
    let root = integration_root(&app)?;
    let mut settings = load_settings(&root)?;
    if let Some(v) = enabled {
        settings.enabled = v;
    }
    if let Some(v) = provider {
        settings.provider = v;
    }
    if active_notebook_id.is_some() {
        settings.active_notebook_id = active_notebook_id;
    }
    save_settings(&root, &settings)?;
    tracing::info!("notebooklm.settings.updated");
    Ok(settings)
}

#[tauri::command]
pub async fn notebooklm_connect(
    app: tauri::AppHandle,
    auth_json: Option<String>,
    provider: Option<String>,
) -> Result<NotebookLMAuthState, AppError> {
    let root = integration_root(&app)?;
    let mut settings = load_settings(&root)?;
    settings.enabled = true;
    if let Some(p) = provider {
        settings.provider = p;
    }
    save_settings(&root, &settings)?;

    if let Some(auth) = auth_json {
        let storage = root.join("storage_state.json");
        fs::write(&storage, auth.as_bytes())?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&storage, fs::Permissions::from_mode(0o600))?;
        }
    }

    let mut auth = load_auth(&root)?;
    auth.connected = true;
    auth.last_connected_at = Some(Utc::now().to_rfc3339());
    auth.provider = settings.provider.clone();
    auth.storage_path = Some(root.join("storage_state.json").to_string_lossy().to_string());
    save_auth(&root, &auth)?;
    tracing::info!("notebooklm.connect provider={}", auth.provider);
    Ok(auth)
}

#[tauri::command]
pub async fn notebooklm_disconnect(app: tauri::AppHandle) -> Result<NotebookLMAuthState, AppError> {
    let root = integration_root(&app)?;
    let storage = root.join("storage_state.json");
    if storage.exists() {
        let _ = fs::remove_file(storage);
    }
    let mut auth = load_auth(&root)?;
    auth.connected = false;
    auth.storage_path = None;
    save_auth(&root, &auth)?;
    tracing::info!("notebooklm.disconnect");
    Ok(auth)
}

#[tauri::command]
pub async fn notebooklm_health(app: tauri::AppHandle) -> Result<NotebookLMHealth, AppError> {
    let root = integration_root(&app)?;
    let settings = load_settings(&root)?;
    let auth = load_auth(&root)?;
    let provider = provider_for(&settings);
    provider.health(&auth, &settings, &provider_context(&app, root.clone())).await
}

#[tauri::command]
pub async fn notebooklm_list_notebooks(app: tauri::AppHandle) -> Result<Vec<NotebookSummary>, AppError> {
    let root = integration_root(&app)?;
    let settings = load_settings(&root)?;
    let auth = load_auth(&root)?;
    let provider = provider_for(&settings);
    provider
        .list_notebooks(
            &auth,
            &settings,
            &provider_context(&app, root.clone()),
        )
        .await
}

#[tauri::command]
pub async fn notebooklm_create_notebook(
    app: tauri::AppHandle,
    title: String,
) -> Result<NotebookSummary, AppError> {
    let root = integration_root(&app)?;
    let settings = load_settings(&root)?;
    let auth = load_auth(&root)?;
    let provider = provider_for(&settings);
    let notebook = provider
        .create_notebook(
            &auth,
            &settings,
            &provider_context(&app, root.clone()),
            &title,
        )
        .await?;
    tracing::info!("notebooklm.notebook.created id={}", notebook.id);
    Ok(notebook)
}

#[tauri::command]
pub async fn notebooklm_select_notebook(
    app: tauri::AppHandle,
    notebook_id: String,
) -> Result<NotebookLMSettings, AppError> {
    let root = integration_root(&app)?;
    let mut settings = load_settings(&root)?;
    settings.active_notebook_id = Some(notebook_id);
    save_settings(&root, &settings)?;
    Ok(settings)
}

#[tauri::command]
pub async fn notebooklm_list_sources(
    app: tauri::AppHandle,
    notebook_id: Option<String>,
) -> Result<Vec<SourceSummary>, AppError> {
    let root = integration_root(&app)?;
    let settings = load_settings(&root)?;
    let auth = load_auth(&root)?;
    let selected = resolve_notebook_id(&settings, &notebook_id)?;
    let provider = provider_for(&settings);
    provider
        .list_sources(
            &auth,
            &settings,
            &provider_context(&app, root.clone()),
            &selected,
        )
        .await
}

#[tauri::command]
pub async fn notebooklm_add_source(
    app: tauri::AppHandle,
    req: AddSourceRequest,
) -> Result<SourceSummary, AppError> {
    let root = integration_root(&app)?;
    let settings = load_settings(&root)?;
    let auth = load_auth(&root)?;
    let selected = resolve_notebook_id(&settings, &req.notebook_id)?;
    let provider = provider_for(&settings);
    let source = provider
        .add_source(
            &auth,
            &settings,
            &provider_context(&app, root.clone()),
            &selected,
            &req,
        )
        .await?;
    tracing::info!("notebooklm.source.added id={} kind={}", source.id, source.kind);
    Ok(source)
}

#[tauri::command]
pub async fn notebooklm_refresh_source(
    app: tauri::AppHandle,
    source_id: String,
    notebook_id: Option<String>,
) -> Result<SourceSummary, AppError> {
    let root = integration_root(&app)?;
    let settings = load_settings(&root)?;
    let auth = load_auth(&root)?;
    let selected = resolve_notebook_id(&settings, &notebook_id)?;
    let provider = provider_for(&settings);
    provider
        .refresh_source(
            &auth,
            &settings,
            &provider_context(&app, root.clone()),
            &selected,
            &source_id,
        )
        .await
}

#[tauri::command]
pub async fn notebooklm_ask(
    app: tauri::AppHandle,
    question: String,
    notebook_id: Option<String>,
) -> Result<AskResponse, AppError> {
    let root = integration_root(&app)?;
    let settings = load_settings(&root)?;
    let auth = load_auth(&root)?;
    let selected = resolve_notebook_id(&settings, &notebook_id)?;
    let provider = provider_for(&settings);
    provider
        .ask(
            &auth,
            &settings,
            &provider_context(&app, root.clone()),
            &selected,
            &question,
        )
        .await
}

#[tauri::command]
pub async fn notebooklm_research(
    app: tauri::AppHandle,
    query: String,
    mode: Option<String>,
    from: Option<String>,
    notebook_id: Option<String>,
) -> Result<ResearchResponse, AppError> {
    let root = integration_root(&app)?;
    let settings = load_settings(&root)?;
    let auth = load_auth(&root)?;
    let selected = resolve_notebook_id(&settings, &notebook_id)?;
    let provider = provider_for(&settings);
    provider
        .research(
            &auth,
            &settings,
            &provider_context(&app, root.clone()),
            &selected,
            &query,
            mode,
            from,
        )
        .await
}

#[tauri::command]
pub async fn notebooklm_generate_artifact(
    app: tauri::AppHandle,
    req: GenerateArtifactRequest,
) -> Result<NotebookLMJob, AppError> {
    let root = integration_root(&app)?;
    let settings = load_settings(&root)?;
    let auth = load_auth(&root)?;
    let selected = resolve_notebook_id(&settings, &req.notebook_id)?;
    let provider = provider_for(&settings);
    let mut jobs = load_jobs(&root)?;
    let now = Utc::now().to_rfc3339();
    let mut job = NotebookLMJob {
        id: format!("job_{}", Uuid::new_v4().simple()),
        notebook_id: selected.clone(),
        artifact_type: req.artifact_type.clone(),
        status: "queued".to_string(),
        created_at: now.clone(),
        updated_at: now,
        error: None,
        artifact: None,
        payload: ArtifactPayload::default(),
    };
    jobs.jobs.push(job.clone());
    save_jobs(&root, &jobs)?;

    job.status = "running".to_string();
    job.updated_at = Utc::now().to_rfc3339();
    replace_job(&root, &job)?;
    tracing::info!("notebooklm.job.started id={} type={}", job.id, job.artifact_type);

    let mut attempts_left = req.retry_count.unwrap_or(0);
    tracing::info!(
        "notebooklm.generate_artifact.start job_id={} type={} provider={}",
        job.id,
        req.artifact_type,
        settings.provider
    );
    loop {
        match provider
            .generate_artifact(
                &auth,
                &settings,
                &provider_context(&app, root.clone()),
                &selected,
                &req,
            )
            .await
        {
            Ok((artifact, payload)) => {
                job.status = "succeeded".to_string();
                job.updated_at = Utc::now().to_rfc3339();
                job.artifact = Some(artifact);
                job.payload = payload.clone();
                replace_job(&root, &job)?;
                tracing::info!(
                    "notebooklm.job.succeeded id={} type={} has_json_content={} has_media_url={}",
                    job.id,
                    job.artifact_type,
                    payload.json_content.is_some(),
                    payload.media_url.is_some()
                );
                return Ok(job);
            }
            Err(e) => {
                let msg = e.to_string();
                if should_retry_generation(&msg, attempts_left) {
                    attempts_left -= 1;
                    tracing::warn!(
                        "notebooklm.job.retry id={} remaining_retries={} reason={}",
                        job.id,
                        attempts_left,
                        msg
                    );
                    continue;
                }
                job.status = if is_auth_error(&msg) {
                    "expired-auth".to_string()
                } else {
                    "failed".to_string()
                };
                job.error = Some(msg);
                job.updated_at = Utc::now().to_rfc3339();
                replace_job(&root, &job)?;
                tracing::warn!("notebooklm.job.failed id={} status={}", job.id, job.status);
                return Ok(job);
            }
        }
    }
}

fn replace_job(root: &Path, updated: &NotebookLMJob) -> Result<(), AppError> {
    let mut jobs = load_jobs(root)?;
    if let Some(existing) = jobs.jobs.iter_mut().find(|j| j.id == updated.id) {
        *existing = updated.clone();
    } else {
        jobs.jobs.push(updated.clone());
    }
    save_jobs(root, &jobs)
}

#[tauri::command]
pub async fn notebooklm_get_jobs(
    app: tauri::AppHandle,
    limit: Option<usize>,
) -> Result<Vec<NotebookLMJob>, AppError> {
    let root = integration_root(&app)?;
    let mut jobs = load_jobs(&root)?.jobs;
    jobs.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    if let Some(limit) = limit {
        jobs.truncate(limit);
    }
    Ok(jobs)
}

#[tauri::command]
pub async fn notebooklm_get_job(
    app: tauri::AppHandle,
    job_id: String,
) -> Result<Option<NotebookLMJob>, AppError> {
    let root = integration_root(&app)?;
    let jobs = load_jobs(&root)?;
    Ok(jobs.jobs.into_iter().find(|j| j.id == job_id))
}

#[tauri::command]
pub async fn notebooklm_preview_flashcards(
    app: tauri::AppHandle,
    job_id: String,
) -> Result<Vec<ImportPreviewItem>, AppError> {
    let root = integration_root(&app)?;
    let jobs = load_jobs(&root)?;
    let job = jobs
        .jobs
        .into_iter()
        .find(|j| j.id == job_id)
        .ok_or_else(|| AppError::NotFound(format!("Job {job_id} not found")))?;
    let artifact_id = job
        .artifact
        .as_ref()
        .map(|a| a.id.clone())
        .unwrap_or_else(|| "unknown".to_string());
    Ok(job
        .payload
        .flashcards
        .iter()
        .map(|f| ImportPreviewItem {
            question: normalize_notebooklm_text(&f.question),
            answer: normalize_notebooklm_text(&f.answer),
            tags: f.tags.clone(),
            source_notebook_id: job.notebook_id.clone(),
            source_artifact_id: artifact_id.clone(),
        })
        .collect())
}

#[tauri::command]
pub async fn notebooklm_preview_quiz_import(
    app: tauri::AppHandle,
    job_id: String,
    mode: Option<String>,
) -> Result<Vec<ImportPreviewItem>, AppError> {
    let root = integration_root(&app)?;
    let jobs = load_jobs(&root)?;
    let job = jobs
        .jobs
        .into_iter()
        .find(|j| j.id == job_id)
        .ok_or_else(|| AppError::NotFound(format!("Job {job_id} not found")))?;
    let quiz_mode = mode.unwrap_or_else(|| "all".to_string());
    let artifact_id = job
        .artifact
        .as_ref()
        .map(|a| a.id.clone())
        .unwrap_or_else(|| "unknown".to_string());
    Ok(quiz_to_import_items(&job.payload.quiz_items, &quiz_mode)
        .into_iter()
        .map(|(question, answer)| ImportPreviewItem {
            question,
            answer,
            tags: vec!["notebooklm".to_string(), "quiz-import".to_string()],
            source_notebook_id: job.notebook_id.clone(),
            source_artifact_id: artifact_id.clone(),
        })
        .collect())
}

#[tauri::command]
pub async fn notebooklm_sync_flashcards(
    app: tauri::AppHandle,
    job_id: String,
    deck_name: Option<String>,
    dedupe: Option<bool>,
    repo: tauri::State<'_, Repository>,
) -> Result<SyncResult, AppError> {
    let preview = notebooklm_preview_flashcards(app.clone(), job_id).await?;
    let result = upsert_learning_items(&repo, &preview, deck_name, dedupe.unwrap_or(true)).await?;
    tracing::info!(
        "notebooklm.sync.flashcards created={} updated={} skipped={}",
        result.created,
        result.updated,
        result.skipped
    );
    Ok(result)
}

#[tauri::command]
pub async fn notebooklm_sync_quiz(
    app: tauri::AppHandle,
    job_id: String,
    mode: Option<String>,
    deck_name: Option<String>,
    dedupe: Option<bool>,
    repo: tauri::State<'_, Repository>,
) -> Result<SyncResult, AppError> {
    let preview = notebooklm_preview_quiz_import(app.clone(), job_id, mode).await?;
    let result = upsert_learning_items(&repo, &preview, deck_name, dedupe.unwrap_or(true)).await?;
    tracing::info!(
        "notebooklm.sync.quiz created={} updated={} skipped={}",
        result.created,
        result.updated,
        result.skipped
    );
    Ok(result)
}

#[tauri::command]
pub async fn notebooklm_sync_preview_items(
    preview_items: Vec<ImportPreviewItem>,
    deck_name: Option<String>,
    dedupe: Option<bool>,
    repo: tauri::State<'_, Repository>,
) -> Result<SyncResult, AppError> {
    let result = upsert_learning_items(&repo, &preview_items, deck_name, dedupe.unwrap_or(true)).await?;
    tracing::info!(
        "notebooklm.sync.preview created={} updated={} skipped={}",
        result.created,
        result.updated,
        result.skipped
    );
    Ok(result)
}

#[tauri::command]
pub async fn notebooklm_export_job_artifact(
    app: tauri::AppHandle,
    job_id: String,
    output_format: Option<String>,
) -> Result<ArtifactExportResult, AppError> {
    let root = integration_root(&app)?;
    let jobs = load_jobs(&root)?;
    let job = jobs
        .jobs
        .into_iter()
        .find(|j| j.id == job_id)
        .ok_or_else(|| AppError::NotFound(format!("Job {job_id} not found")))?;

    let format = output_format.unwrap_or_else(|| "json".to_string()).to_lowercase();
    let (mime_type, content, extension) = if format == "markdown" {
        let mut lines = Vec::new();
        if !job.payload.flashcards.is_empty() {
            lines.push("# Flashcards".to_string());
            for (idx, f) in job.payload.flashcards.iter().enumerate() {
                lines.push(format!("## Card {}", idx + 1));
                lines.push(format!("Q: {}", f.question));
                lines.push(format!("A: {}", f.answer));
                lines.push(String::new());
            }
        }
        if !job.payload.quiz_items.is_empty() {
            lines.push("# Quiz Items".to_string());
            for (idx, q) in job.payload.quiz_items.iter().enumerate() {
                lines.push(format!("## Question {}", idx + 1));
                lines.push(format!("Q: {}", q.question));
                lines.push(format!("Correct: {}", q.correct_answer));
                lines.push(format!(
                    "User: {}",
                    q.user_answer.clone().unwrap_or_else(|| "(none)".to_string())
                ));
                lines.push(format!("Was correct: {}", q.was_correct));
                lines.push(String::new());
            }
        }
        (
            "text/markdown".to_string(),
            lines.join("\n"),
            "md".to_string(),
        )
    } else if format == "html" {
        let json = serde_json::to_string_pretty(&job.payload)?;
        (
            "text/html".to_string(),
            format!(
                "<!doctype html><html><body><h1>NotebookLM Export</h1><pre>{}</pre></body></html>",
                html_escape(&json)
            ),
            "html".to_string(),
        )
    } else {
        (
            "application/json".to_string(),
            serde_json::to_string_pretty(&job.payload)?,
            "json".to_string(),
        )
    };

    Ok(ArtifactExportResult {
        format: format.clone(),
        mime_type,
        file_name: format!("notebooklm-{}-{}.{}", job.artifact_type, job.id, extension),
        content,
    })
}

fn html_escape(input: &str) -> String {
    input
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

/// Check if notebooklm CLI is installed and get its version
#[tauri::command]
pub async fn notebooklm_check_cli(app: tauri::AppHandle) -> Result<serde_json::Value, AppError> {
    let ctx = provider_context(&app, integration_root(&app)?);
    
    // Try to run notebooklm --version or notebooklm version
    let version_result = run_first_success(
        &ctx,
        vec![
            vec!["--version".to_string()],
            vec!["version".to_string()],
        ],
    )
    .await;
    
    match version_result {
        Ok(result) => {
            let version = result.stdout.trim().to_string();
            // Try to check login status
            let status_result = run_first_success(
                &ctx,
                vec![
                    vec!["status".to_string(), "--json".to_string()],
                    vec!["status".to_string()],
                ],
            )
            .await;
            
            let is_authenticated = match status_result {
                Ok(_) => true,
                Err(e) => {
                    let err_str = e.to_string().to_lowercase();
                    !err_str.contains("not logged in") 
                        && !err_str.contains("unauthorized")
                        && !err_str.contains("401")
                }
            };
            
            Ok(serde_json::json!({
                "installed": true,
                "version": version,
                "is_authenticated": is_authenticated,
                "binary_path": ctx
                    .notebooklm_runtime_python
                    .or(ctx.notebooklm_managed_python)
                    .or(ctx.notebooklm_bin)
                    .map(|p| p.to_string_lossy().to_string()),
            }))
        }
        Err(e) => {
            tracing::warn!("notebooklm CLI not found or not working: {}", e);
            Ok(serde_json::json!({
                "installed": false,
                "error": e.to_string(),
            }))
        }
    }
}

/// Run notebooklm login command
/// This will open a browser for authentication
#[tauri::command]
pub async fn notebooklm_cli_login(app: tauri::AppHandle) -> Result<serde_json::Value, AppError> {
    let ctx = provider_context(&app, integration_root(&app)?);
    
    tracing::info!("Starting notebooklm CLI login flow");
    
    // Run the login command - this opens a browser
    match run_notebooklm_command(
        &ctx,
        &["login".to_string()],
    )
    .await {
        Ok(result) => {
            tracing::info!("notebooklm login completed successfully");
            Ok(serde_json::json!({
                "success": true,
                "message": "Login successful",
                "output": result.stdout,
            }))
        }
        Err(e) => {
            let err_str = e.to_string();
            tracing::error!("notebooklm login failed: {}", err_str);
            
            // Check for specific errors
            if err_str.contains("already logged in") || err_str.contains("already authenticated") {
                return Ok(serde_json::json!({
                    "success": true,
                    "message": "Already logged in",
                    "output": err_str,
                }));
            }
            
            Err(AppError::IntegrationError(format!(
                "Login failed. Incrementum could not prepare NotebookLM runtime automatically. Error: {}",
                err_str
            )))
        }
    }
}

/// Run notebooklm logout command
#[tauri::command]
pub async fn notebooklm_cli_logout(app: tauri::AppHandle) -> Result<serde_json::Value, AppError> {
    let ctx = provider_context(&app, integration_root(&app)?);
    
    tracing::info!("Running notebooklm CLI logout");
    
    match run_first_success(
        &ctx,
        vec![
            vec!["logout".to_string()],
            vec!["auth".to_string(), "logout".to_string()],
        ],
    )
    .await {
        Ok(result) => {
            tracing::info!("notebooklm logout completed");
            Ok(serde_json::json!({
                "success": true,
                "message": "Logout successful",
                "output": result.stdout,
            }))
        }
        Err(e) => {
            tracing::warn!("notebooklm logout had issues: {}", e);
            // Logout might still have succeeded even with errors
            Ok(serde_json::json!({
                "success": true,
                "message": "Logout may have succeeded",
                "output": e.to_string(),
            }))
        }
    }
}

/// Get detailed CLI authentication status
#[tauri::command]
pub async fn notebooklm_cli_status(app: tauri::AppHandle) -> Result<serde_json::Value, AppError> {
    let ctx = provider_context(&app, integration_root(&app)?);
    
    let result = run_first_success(
        &ctx,
        vec![
            vec!["status".to_string(), "--json".to_string()],
            vec!["status".to_string()],
        ],
    )
    .await;
    
    match result {
        Ok(output) => {
            let stdout = output.stdout.to_lowercase();
            let is_authenticated = !stdout.contains("not logged in") 
                && !stdout.contains("no active session");
            
            Ok(serde_json::json!({
                "is_authenticated": is_authenticated,
                "status_output": output.stdout,
                "error": null,
            }))
        }
        Err(e) => {
            let err_str = e.to_string().to_lowercase();
            let is_auth_error = err_str.contains("not logged in") 
                || err_str.contains("unauthorized")
                || err_str.contains("401")
                || err_str.contains("no active session");
            
            Ok(serde_json::json!({
                "is_authenticated": false,
                "status_output": null,
                "error": e.to_string(),
                "is_auth_error": is_auth_error,
            }))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn filters_missed_only_quiz_mode() {
        let quiz = vec![
            QuizItem {
                question: "Q1".to_string(),
                correct_answer: "A1".to_string(),
                user_answer: Some("A2".to_string()),
                was_correct: false,
            },
            QuizItem {
                question: "Q2".to_string(),
                correct_answer: "A2".to_string(),
                user_answer: Some("A2".to_string()),
                was_correct: true,
            },
        ];
        let items = quiz_to_import_items(&quiz, "missed-only");
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].0, "Q1");
    }

    #[test]
    fn keeps_all_quiz_items_in_all_mode() {
        let quiz = vec![
            QuizItem {
                question: "Q1".to_string(),
                correct_answer: "A1".to_string(),
                user_answer: None,
                was_correct: false,
            },
            QuizItem {
                question: "Q2".to_string(),
                correct_answer: "A2".to_string(),
                user_answer: Some("A2".to_string()),
                was_correct: true,
            },
        ];
        let items = quiz_to_import_items(&quiz, "all");
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].1, "A1");
    }

    #[test]
    fn identifies_auth_errors() {
        assert!(is_auth_error("HTTP 401 Unauthorized"));
        assert!(is_auth_error("session expired"));
        assert!(!is_auth_error("network timeout"));
    }

    #[test]
    fn retries_non_auth_errors_only() {
        assert!(should_retry_generation("temporary timeout", 1));
        assert!(!should_retry_generation("HTTP 401 Unauthorized", 3));
        assert!(!should_retry_generation("temporary timeout", 0));
    }

    #[test]
    fn export_html_escapes_payload() {
        let escaped = html_escape("<script>alert('x')</script>");
        assert_eq!(escaped, "&lt;script&gt;alert('x')&lt;/script&gt;");
    }

    #[test]
    fn persists_job_lifecycle_states() {
        let root = std::env::temp_dir().join(format!("notebooklm-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).expect("create temp dir");
        let now = Utc::now().to_rfc3339();

        let mut job = NotebookLMJob {
            id: "job_test".to_string(),
            notebook_id: "nb_1".to_string(),
            artifact_type: "flashcards".to_string(),
            status: "queued".to_string(),
            created_at: now.clone(),
            updated_at: now.clone(),
            error: None,
            artifact: None,
            payload: ArtifactPayload::default(),
        };
        replace_job(&root, &job).expect("queued write");

        job.status = "running".to_string();
        replace_job(&root, &job).expect("running write");
        let loaded = load_jobs(&root).expect("load jobs");
        assert_eq!(loaded.jobs.len(), 1);
        assert_eq!(loaded.jobs[0].status, "running");

        job.status = "expired-auth".to_string();
        job.error = Some("session expired".to_string());
        replace_job(&root, &job).expect("expired write");
        let loaded = load_jobs(&root).expect("load jobs");
        assert_eq!(loaded.jobs[0].status, "expired-auth");

        let _ = fs::remove_dir_all(&root);
    }
}
