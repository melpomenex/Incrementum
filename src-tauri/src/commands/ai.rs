//! AI commands for Tauri
//!
//! Provides Tauri commands for AI-powered features:
//! - Flashcard generation
//! - Q&A with document context
//! - Content summarization
//! - AI configuration management
//! - API key keychain storage

use crate::ai::{
    flashcard_generator::{FlashcardGenerationOptions, FlashcardGenerator},
    qa::QuestionAnswerer,
    summarizer::Summarizer,
    AIConfig, AIProvider, LLMProviderType, Message,
};
use crate::commands::Result;
use crate::commands::ai_key_store;
use crate::database::Repository;
use crate::error::IncrementumError;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::State;

// Global AI configuration state
pub struct AIState {
    pub config: Arc<Mutex<Option<AIConfig>>>,
}

impl Default for AIState {
    fn default() -> Self {
        Self {
            config: Arc::new(Mutex::new(None)),
        }
    }
}

/// Get AI config (clones and drops the mutex guard)
fn get_ai_config_clone(state: &State<'_, AIState>) -> Result<AIConfig> {
    let guard = state.config.lock().unwrap();
    guard
        .as_ref()
        .ok_or_else(|| IncrementumError::Internal("AI configuration not set".to_string()))
        .cloned()
}

/// Generated flashcard for Tauri
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TauriGeneratedFlashcard {
    pub question: String,
    pub answer: String,
    pub card_type: String,
    pub tags: Vec<String>,
}

impl From<crate::ai::flashcard_generator::GeneratedFlashcard> for TauriGeneratedFlashcard {
    fn from(fc: crate::ai::flashcard_generator::GeneratedFlashcard) -> Self {
        Self {
            question: fc.question,
            answer: fc.answer,
            card_type: match fc.card_type {
                crate::ai::flashcard_generator::FlashcardType::Basic => "basic".to_string(),
                crate::ai::flashcard_generator::FlashcardType::Cloze => "cloze".to_string(),
                crate::ai::flashcard_generator::FlashcardType::Qa => "qa".to_string(),
            },
            tags: fc.tags,
        }
    }
}

/// Get AI configuration (API keys are redacted to last 4 characters)
#[tauri::command]
pub async fn get_ai_config(state: State<'_, AIState>) -> Result<Option<serde_json::Value>> {
    let config = state.config.lock().expect("AI config mutex poisoned");
    let Some(config) = config.as_ref() else {
        return Ok(None);
    };

    let mut config_map = serde_json::to_value(config)
        .map_err(|e| IncrementumError::Internal(format!("Failed to serialize AI config: {}", e)))?;

    if let Some(obj) = config_map.as_object_mut() {
        if let Some(api_keys) = obj.get_mut("api_keys").and_then(|v| v.as_object_mut()) {
            for (provider, value) in api_keys.iter_mut() {
                if let Some(key) = value.as_str() {
                    if key.len() > 4 {
                        *value = serde_json::Value::String(format!(
                            "{}{}",
                            "*".repeat(key.len() - 4),
                            &key[key.len() - 4..]
                        ));
                    } else if !key.is_empty() {
                        *value = serde_json::Value::String("*".repeat(key.len()));
                    }
                }
            }
        }
    }

    Ok(Some(config_map))
}

/// Set AI configuration
#[tauri::command]
pub async fn set_ai_config(config: AIConfig, state: State<'_, AIState>) -> Result<()> {
    let mut state_config = state.config.lock().expect("AI config mutex poisoned");
    *state_config = Some(config);
    Ok(())
}

/// Set API key for a provider (stores in OS keychain and in-memory state)
#[tauri::command]
pub async fn set_api_key(
    provider: String,
    api_key: String,
    state: State<'_, AIState>,
    key_store: State<'_, ai_key_store::AIKeyStore>,
) -> Result<()> {
    let provider_lower = provider.to_lowercase();

    match provider_lower.as_str() {
        "openai" | "anthropic" | "openrouter" => {}
        _ => return Err(IncrementumError::InvalidInput(format!("Unknown provider: {}", provider))),
    }

    key_store.store_key(&provider_lower, &api_key).await?;

    // Also update in-memory state for immediate use
    let mut config = state.config.lock().expect("AI config mutex poisoned");
    let mut current = config.clone().unwrap_or_default();

    match provider_lower.as_str() {
        "openai" => current.api_keys.openai = Some(api_key),
        "anthropic" => current.api_keys.anthropic = Some(api_key),
        "openrouter" => current.api_keys.openrouter = Some(api_key),
        _ => unreachable!(),
    }

    *config = Some(current);
    Ok(())
}

/// Get a masked API key for display (last 4 characters)
#[tauri::command]
pub async fn get_masked_api_key(
    provider: String,
    key_store: State<'_, ai_key_store::AIKeyStore>,
) -> Result<Option<String>> {
    let provider_lower = provider.to_lowercase();
    match provider_lower.as_str() {
        "openai" | "anthropic" | "openrouter" => {}
        _ => return Err(IncrementumError::InvalidInput(format!("Unknown provider: {}", provider))),
    }
    key_store.get_masked_key(&provider_lower).await
}

/// Remove an API key from keychain and in-memory state
#[tauri::command]
pub async fn remove_api_key(
    provider: String,
    state: State<'_, AIState>,
    key_store: State<'_, ai_key_store::AIKeyStore>,
) -> Result<()> {
    let provider_lower = provider.to_lowercase();
    match provider_lower.as_str() {
        "openai" | "anthropic" | "openrouter" => {}
        _ => return Err(IncrementumError::InvalidInput(format!("Unknown provider: {}", provider))),
    }

    key_store.remove_key(&provider_lower).await?;

    let mut config = state.config.lock().expect("AI config mutex poisoned");
    let mut current = config.clone().unwrap_or_default();

    match provider_lower.as_str() {
        "openai" => current.api_keys.openai = None,
        "anthropic" => current.api_keys.anthropic = None,
        "openrouter" => current.api_keys.openrouter = None,
        _ => unreachable!(),
    }

    *config = Some(current);
    Ok(())
}

/// Generate flashcards from an extract
#[tauri::command]
pub async fn generate_flashcards_from_extract(
    extract_id: String,
    _options: FlashcardGenerationOptions,
    repo: State<'_, Repository>,
    ai_state: State<'_, AIState>,
) -> Result<Vec<TauriGeneratedFlashcard>> {
    let extract = repo
        .get_extract(&extract_id)
        .await?
        .ok_or_else(|| IncrementumError::NotFound(format!("Extract {} not found", extract_id)))?;

    // Get AI configuration (clones and drops mutex guard)
    let config = get_ai_config_clone(&ai_state)?;

    let provider = AIProvider::from_config(
        config.default_provider,
        &config.api_keys,
        &config.models,
        &config.local_settings,
    )
    .map_err(IncrementumError::Internal)?;

    // Generate flashcards
    let generator = FlashcardGenerator::new(provider);
    let flashcards = generator
        .generate_from_extract(&extract.content, None)
        .await?;

    Ok(flashcards.into_iter().map(TauriGeneratedFlashcard::from).collect())
}

/// Generate flashcards from content
#[tauri::command]
pub async fn generate_flashcards_from_content(
    content: String,
    count: usize,
    ai_state: State<'_, AIState>,
) -> Result<Vec<TauriGeneratedFlashcard>> {
    let config = get_ai_config_clone(&ai_state)?;

    let provider = AIProvider::from_config(
        config.default_provider,
        &config.api_keys,
        &config.models,
        &config.local_settings,
    )
    .map_err(IncrementumError::Internal)?;
    let generator = FlashcardGenerator::new(provider);

    let options = FlashcardGenerationOptions {
        count,
        ..Default::default()
    };

    let flashcards = generator.generate_from_content(&content, &options).await?;

    Ok(flashcards.into_iter().map(TauriGeneratedFlashcard::from).collect())
}

/// Answer a question with document context
#[tauri::command]
pub async fn answer_question(
    question: String,
    context: String,
    ai_state: State<'_, AIState>,
) -> Result<String> {
    let config = get_ai_config_clone(&ai_state)?;

    let provider = AIProvider::from_config(
        config.default_provider,
        &config.api_keys,
        &config.models,
        &config.local_settings,
    )
    .map_err(IncrementumError::Internal)?;
    let qa = QuestionAnswerer::new(provider);

    let answer = qa.answer_with_context(&question, &context).await?;
    Ok(answer)
}

/// Answer a question about an extract
#[tauri::command]
pub async fn answer_about_extract(
    extract_id: String,
    question: String,
    repo: State<'_, Repository>,
    ai_state: State<'_, AIState>,
) -> Result<String> {
    let extract = repo
        .get_extract(&extract_id)
        .await?
        .ok_or_else(|| IncrementumError::NotFound(format!("Extract {} not found", extract_id)))?;

    let config = get_ai_config_clone(&ai_state)?;

    let provider = AIProvider::from_config(
        config.default_provider,
        &config.api_keys,
        &config.models,
        &config.local_settings,
    )
    .map_err(IncrementumError::Internal)?;
    let qa = QuestionAnswerer::new(provider);

    let answer = qa.answer_about_extract(&extract.content, &question).await?;
    Ok(answer)
}

/// Summarize content
#[tauri::command]
pub async fn summarize_content(
    content: String,
    max_words: usize,
    ai_state: State<'_, AIState>,
) -> Result<String> {
    let config = get_ai_config_clone(&ai_state)?;

    let provider = AIProvider::from_config(
        config.default_provider,
        &config.api_keys,
        &config.models,
        &config.local_settings,
    )
    .map_err(IncrementumError::Internal)?;
    let summarizer = Summarizer::new(provider);

    let summary = summarizer.summarize(&content, max_words).await?;
    Ok(summary)
}

/// Extract key points from content
#[tauri::command]
pub async fn extract_key_points(
    content: String,
    count: usize,
    ai_state: State<'_, AIState>,
) -> Result<Vec<String>> {
    let config = get_ai_config_clone(&ai_state)?;

    let provider = AIProvider::from_config(
        config.default_provider,
        &config.api_keys,
        &config.models,
        &config.local_settings,
    )
    .map_err(IncrementumError::Internal)?;
    let summarizer = Summarizer::new(provider);

    let points = summarizer.extract_key_points(&content, count).await?;
    Ok(points)
}

/// Generate title for content
#[tauri::command]
pub async fn generate_title(
    content: String,
    ai_state: State<'_, AIState>,
) -> Result<String> {
    let config = get_ai_config_clone(&ai_state)?;

    let provider = AIProvider::from_config(
        config.default_provider,
        &config.api_keys,
        &config.models,
        &config.local_settings,
    )
    .map_err(IncrementumError::Internal)?;
    let summarizer = Summarizer::new(provider);

    let title = summarizer.generate_title(&content).await?;
    Ok(title)
}

/// Simplify content
#[tauri::command]
pub async fn simplify_content(
    content: String,
    level: String,
    ai_state: State<'_, AIState>,
) -> Result<String> {
    let config = get_ai_config_clone(&ai_state)?;

    let provider = AIProvider::from_config(
        config.default_provider,
        &config.api_keys,
        &config.models,
        &config.local_settings,
    )
    .map_err(IncrementumError::Internal)?;
    let summarizer = Summarizer::new(provider);

    let simplification_level = match level.to_lowercase().as_str() {
        "elementary" => crate::ai::summarizer::SimplificationLevel::Elementary,
        "highschool" => crate::ai::summarizer::SimplificationLevel::HighSchool,
        "college" => crate::ai::summarizer::SimplificationLevel::College,
        "expert" => crate::ai::summarizer::SimplificationLevel::Expert,
        _ => {
            return Err(IncrementumError::InvalidInput(format!(
                "Unknown simplification level: {}",
                level
            )))
        }
    };

    let simplified = summarizer.simplify(&content, simplification_level).await?;
    Ok(simplified)
}

/// Generate questions from content
#[tauri::command]
pub async fn generate_questions(
    content: String,
    count: usize,
    ai_state: State<'_, AIState>,
) -> Result<Vec<String>> {
    let config = get_ai_config_clone(&ai_state)?;

    let provider = AIProvider::from_config(
        config.default_provider,
        &config.api_keys,
        &config.models,
        &config.local_settings,
    )
    .map_err(IncrementumError::Internal)?;
    let qa = QuestionAnswerer::new(provider);

    let questions = qa.generate_questions(&content, count).await?;
    Ok(questions)
}

/// Get available Ollama models (for local LLM)
#[tauri::command]
pub async fn list_ollama_models(
    base_url: String,
) -> Result<Vec<String>> {
    let provider = crate::ai::providers::OllamaProvider::new(base_url, "dummy".to_string());
    provider
        .list_models()
        .await
        .map_err(|e| IncrementumError::Internal(format!("Failed to list Ollama models: {}", e)))
}

/// Test AI connection
#[tauri::command]
pub async fn test_ai_connection(
    provider_type: LLMProviderType,
    ai_state: State<'_, AIState>,
) -> Result<String> {
    let config = get_ai_config_clone(&ai_state)?;

    let provider = AIProvider::from_config(
        provider_type,
        &config.api_keys,
        &config.models,
        &config.local_settings,
    )
    .map_err(IncrementumError::Internal)?;

    if !provider.is_available() {
        return Err(IncrementumError::Internal(format!(
            "Provider {:?} is not available",
            provider_type
        )));
    }

    // Test with a simple prompt
    let request = crate::ai::providers::ChatCompletionRequest {
        messages: vec![
            Message::system("You are a helpful assistant."),
            Message::user("Say 'Connection successful!'"),
        ],
        temperature: 0.5,
        max_tokens: 50,
        stream: false,
    };

    let response = provider.chat_completion(&request).await.map_err(|e| {
        IncrementumError::Internal(format!("AI connection test failed: {}", e))
    })?;

    Ok(response.content)
}

/// Generate progressive disclosure summaries for an extract.
/// Summaries are cached on the extract after generation.
#[tauri::command]
pub async fn generate_progressive_summaries(
    extract_id: String,
    repo: State<'_, Repository>,
    ai_state: State<'_, AIState>,
) -> Result<Vec<crate::models::extract::ProgressiveSummaryEntry>> {
    let mut extract = repo
        .get_extract(&extract_id)
        .await?
        .ok_or_else(|| {
            IncrementumError::NotFound(format!("Extract {} not found", extract_id))
        })?;

    if let Some(ref summaries) = extract.progressive_summaries {
        if !summaries.is_empty() {
            return Ok(summaries.clone());
        }
    }

    let config = get_ai_config_clone(&ai_state)?;

    let provider = AIProvider::from_config(
        config.default_provider,
        &config.api_keys,
        &config.models,
        &config.local_settings,
    )
    .map_err(IncrementumError::Internal)?;

    let summarizer = Summarizer::new(provider);

    let max_level = extract.max_disclosure_level;
    if max_level <= 0 {
        return Err(IncrementumError::InvalidInput(
            "Progressive disclosure is not enabled for this extract".to_string(),
        ));
    }

    // AI summaries cover the first half of levels
    let num_ai_levels = ((max_level as f64) / 2.0).ceil() as u32;
    let levels: Vec<u32> = (1..=num_ai_levels).collect();

    let summaries = summarizer
        .progressive_summary(&extract.content, &levels)
        .await
        .map_err(|e| {
            IncrementumError::Internal(format!(
                "Failed to generate progressive summaries: {}",
                e
            ))
        })?;

    let entries: Vec<crate::models::extract::ProgressiveSummaryEntry> = summaries
        .into_iter()
        .map(|s| crate::models::extract::ProgressiveSummaryEntry {
            level: s.level,
            summary: s.summary,
            word_count: s.word_count,
        })
        .collect();

    // Cache on the extract
    extract.progressive_summaries = Some(entries.clone());
    repo.update_extract(&extract).await?;

    Ok(entries)
}

/// Get the content of the long-term memory file.
/// If it doesn't exist, creates the memories directory and MEMORY.md with a default template.
#[tauri::command]
pub async fn get_memory_content(app: tauri::AppHandle) -> Result<String> {
    use tauri::Manager;
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| IncrementumError::Internal(format!("Failed to get app data dir: {}", e)))?;

    let memories_dir = app_dir.join("memories");
    std::fs::create_dir_all(&memories_dir)
        .map_err(|e| IncrementumError::Internal(format!("Failed to create memories directory: {}", e)))?;

    let memory_file = memories_dir.join("MEMORY.md");
    if !memory_file.exists() {
        let default_content = "# Incrementum AI Memory\n\n\
        This file contains durable facts, preferences, and standing decisions that you've told the assistant or that the assistant has learned about you.\n\n\
        ## About Me\n\
        - (No facts recorded yet)\n\n\
        ## Preferences & Settings\n\
        - (No preferences recorded yet)\n\n\
        ## Standing Decisions & Goals\n\
        - (No goals recorded yet)\n";
        
        std::fs::write(&memory_file, default_content)
            .map_err(|e| IncrementumError::Internal(format!("Failed to initialize MEMORY.md: {}", e)))?;
    }

    let content = std::fs::read_to_string(&memory_file)
        .map_err(|e| IncrementumError::Internal(format!("Failed to read MEMORY.md: {}", e)))?;

    Ok(content)
}

/// Save the manual edits of the long-term memory file.
#[tauri::command]
pub async fn save_memory_content(content: String, app: tauri::AppHandle) -> Result<()> {
    use tauri::Manager;
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| IncrementumError::Internal(format!("Failed to get app data dir: {}", e)))?;

    let memories_dir = app_dir.join("memories");
    std::fs::create_dir_all(&memories_dir)
        .map_err(|e| IncrementumError::Internal(format!("Failed to create memories directory: {}", e)))?;

    let memory_file = memories_dir.join("MEMORY.md");
    std::fs::write(&memory_file, content)
        .map_err(|e| IncrementumError::Internal(format!("Failed to save MEMORY.md: {}", e)))?;

    Ok(())
}

/// Asynchronously analyze chat logs to extract user preferences, facts, and updates,
/// then write them back to MEMORY.md.
#[tauri::command]
pub async fn update_memory_from_chat(
    messages: Vec<crate::ai::Message>,
    app: tauri::AppHandle,
    ai_state: State<'_, AIState>,
) -> Result<()> {
    // 1. Get current memory content
    let current_memory = get_memory_content(app.clone()).await?;

    // 2. Format recent messages into a readable conversation transcript
    let mut conversation_text = String::new();
    for msg in messages.iter().rev().take(10).rev() { // Take last 10 turns
        let role_str = match msg.role {
            crate::ai::MessageRole::System => "System",
            crate::ai::MessageRole::User => "User",
            crate::ai::MessageRole::Assistant => "Assistant",
        };
        conversation_text.push_str(&format!("{}: {}\n", role_str, msg.content));
    }

    if conversation_text.trim().is_empty() {
        return Ok(());
    }

    // 3. Construct system prompt for memory extraction
    let system_prompt = "You are a specialized memory-consolidation assistant. \
    Analyze the conversation between the user and the AI. \
    Your task is to identify any new, durable facts, preferences, standing decisions, goals, or important details about the user. \
    Compare them with the user's current long-term memory (provided below). \
    Propose an updated version of the long-term memory, keeping the exact same structure (headings and markdown style) but adding the new information or refining existing bullet points. \
    Only make changes if there is clear, durable new information. \
    If there is no new information to add or modify, respond with exactly 'NO_CHANGE'. \
    Do not add conversational fluff, explanations, or metadata. Only output the updated markdown or 'NO_CHANGE'.";

    let user_prompt = format!(
        "--- CURRENT LONG-TERM MEMORY ---\n{}\n\n\
         --- NEW CONVERSATION ---\n{}\n\n\
         Propose an updated long-term memory in markdown, or reply 'NO_CHANGE' if nothing new should be recorded:",
        current_memory, conversation_text
    );

    // 4. Get AI configuration and provider
    let config = get_ai_config_clone(&ai_state)?;
    let provider = AIProvider::from_config(
        config.default_provider,
        &config.api_keys,
        &config.models,
        &config.local_settings,
    )
    .map_err(IncrementumError::Internal)?;

    if !provider.is_available() {
        return Ok(()); // Silently fail if AI provider is not available
    }

    // 5. Send request to the LLM
    let request = crate::ai::providers::ChatCompletionRequest {
        messages: vec![
            crate::ai::Message::system(system_prompt),
            crate::ai::Message::user(user_prompt),
        ],
        temperature: 0.2, // Low temperature for high precision
        max_tokens: 1500,
        stream: false,
    };

    let app_clone = app.clone();
    // Execute request asynchronously in background so we don't block the caller
    tauri::async_runtime::spawn(async move {
        match provider.chat_completion(&request).await {
            Ok(response) => {
                let cleaned_response = response.content.trim();
                if cleaned_response != "NO_CHANGE" && !cleaned_response.is_empty() {
                    tracing::info!("AI extracted new memories! Updating MEMORY.md.");
                    let _ = save_memory_content(cleaned_response.to_string(), app_clone).await;
                } else {
                    tracing::info!("No new memories detected in chat conversation.");
                }
            }
            Err(e) => {
                tracing::warn!("Failed to auto-update memory from chat: {}", e);
            }
        }
    });

    Ok(())
}
