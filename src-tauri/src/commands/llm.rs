//! LLM Commands for Tauri with Streaming Support
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use futures_util::StreamExt;

const DEFAULT_MAX_TOKENS: usize = 2000;

// Event names for streaming
const LLM_STREAM_CHUNK: &str = "llm:stream:chunk";
const LLM_STREAM_DONE: &str = "llm:stream:done";
const LLM_STREAM_ERROR: &str = "llm:stream:error";

#[inline]
fn emit_stream_event(app: &AppHandle, event: &str, payload: impl Serialize + Clone) {
    if let Err(e) = app.emit(event, payload) {
        tracing::debug!(event, error = %e, "failed to emit LLM stream event");
    }
}

// OpenAI API Types
#[derive(Debug, Serialize)]
struct OpenAIRequest {
    model: String,
    messages: Vec<OpenAIMessage>,
    temperature: f64,
    max_tokens: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    stream: Option<bool>,
}

#[derive(Debug, Serialize)]
struct OpenAIMessage {
    role: String,
    content: OpenAIMessageContent,
}

#[derive(Debug, Serialize)]
#[serde(untagged)]
enum OpenAIMessageContent {
    Text(String),
    Parts(Vec<OpenAIContentPart>),
}

#[derive(Debug, Serialize)]
#[serde(tag = "type")]
enum OpenAIContentPart {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "image_url")]
    ImageUrl { image_url: OpenAIImageUrl },
}

#[derive(Debug, Serialize)]
struct OpenAIImageUrl {
    url: String,
}

#[derive(Debug, Deserialize)]
struct OpenAIResponse {
    choices: Vec<OpenAIChoice>,
    usage: Option<OpenAIUsage>,
}

#[derive(Debug, Deserialize)]
struct OpenAIChoice {
    message: OpenAIResponseMessageContent,
}

#[derive(Debug, Deserialize)]
struct OpenAIResponseMessageContent {
    content: String,
}

#[derive(Debug, Deserialize)]
struct OpenAIUsage {
    prompt_tokens: usize,
    completion_tokens: usize,
    total_tokens: usize,
}

// OpenAI Streaming Types
#[derive(Debug, Deserialize)]
struct OpenAIStreamChunk {
    id: Option<String>,
    choices: Vec<OpenAIStreamChoice>,
}

#[derive(Debug, Deserialize)]
struct OpenAIStreamChoice {
    delta: OpenAIStreamDelta,
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAIStreamDelta {
    content: Option<String>,
}

// Anthropic API Types
#[derive(Debug, Serialize)]
struct AnthropicRequest {
    model: String,
    messages: Vec<AnthropicMessage>,
    max_tokens: usize,
    temperature: f64,
    anthropic_version: String,
    stream: Option<bool>,
}

#[derive(Debug, Serialize)]
struct AnthropicMessage {
    role: String,
    content: AnthropicMessageContent,
}

#[derive(Debug, Serialize)]
#[serde(untagged)]
enum AnthropicMessageContent {
    Text(String),
    Parts(Vec<AnthropicInputContentPart>),
}

#[derive(Debug, Serialize)]
#[serde(tag = "type")]
enum AnthropicInputContentPart {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "image")]
    Image { source: AnthropicImageSource },
}

#[derive(Debug, Serialize)]
struct AnthropicImageSource {
    #[serde(rename = "type")]
    source_type: String,
    media_type: String,
    data: String,
}

#[derive(Debug, Deserialize)]
struct AnthropicResponse {
    content: Vec<AnthropicContent>,
    usage: Option<AnthropicUsage>,
}

#[derive(Debug, Deserialize)]
struct AnthropicContent {
    text: String,
    #[serde(rename = "type")]
    content_type: String,
}

#[derive(Debug, Deserialize)]
struct AnthropicUsage {
    input_tokens: usize,
    output_tokens: usize,
}

// Anthropic Streaming Types
#[derive(Debug, Deserialize)]
struct AnthropicStreamChunk {
    #[serde(rename = "type")]
    chunk_type: String,
    index: Option<usize>,
    delta: Option<AnthropicStreamDelta>,
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AnthropicStreamDelta {
    #[serde(rename = "type")]
    delta_type: String,
    text: Option<String>,
}

// Ollama API Types (OpenAI-compatible)
#[derive(Debug, Serialize)]
struct OllamaRequest {
    model: String,
    messages: Vec<OpenAIMessage>,
    stream: bool,
    options: OllamaOptions,
}

#[derive(Debug, Serialize)]
struct OllamaOptions {
    temperature: f64,
    num_predict: usize,
}

#[derive(Debug, Deserialize)]
struct OllamaResponse {
    message: OpenAIResponseMessageContent,
    prompt_eval_count: Option<usize>,
    eval_count: Option<usize>,
}

// Ollama Streaming Types
#[derive(Debug, Deserialize)]
struct OllamaStreamChunk {
    done: bool,
    message: Option<OllamaStreamMessage>,
    prompt_eval_count: Option<usize>,
    eval_count: Option<usize>,
}

#[derive(Debug, Deserialize)]
struct OllamaStreamMessage {
    role: String,
    content: String,
}

// Non-streaming commands
#[tauri::command]
pub async fn llm_chat(
    provider: String,
    model: Option<String>,
    messages: Vec<LLMMessage>,
    temperature: f64,
    max_tokens: usize,
    api_key: Option<String>,
    base_url: Option<String>,
) -> Result<LLMResponse, String> {
    let client = Client::new();
    let model = normalize_model(model, &provider);
    let max_tokens = if max_tokens == 0 { DEFAULT_MAX_TOKENS } else { max_tokens };
    let base_url = normalize_base_url(base_url, &provider);
    let api_key = normalize_api_key(api_key);
    let requires_api_key = provider_requires_api_key(&provider, &base_url);

    if provider != "ollama" {
        validate_base_url_not_private(&base_url)
            .map_err(|e| format!("Base URL not allowed: {}", e))?;
    }

    if api_key.is_none() && requires_api_key {
        return Err("API key is required".to_string());
    }

    let result = match provider.as_str() {
        "openai" => {
            call_openai_with_key(&client, &model, messages, temperature, max_tokens, api_key.as_deref(), &base_url).await?
        }
        "anthropic" => {
            call_anthropic_with_key(&client, &model, messages, temperature, max_tokens, &api_key.unwrap(), &base_url).await?
        }
        "ollama" => {
            call_ollama_with_url(&client, &model, messages, temperature, max_tokens, &base_url).await?
        }
        "openrouter" => {
            call_openrouter_with_key(&client, &model, messages, temperature, max_tokens, &api_key.unwrap(), &base_url).await?
        }
        _ => return Err(format!("Unknown provider: {}", provider)),
    };

    Ok(result)
}

#[tauri::command]
pub async fn llm_chat_with_context(
    app: AppHandle,
    provider: String,
    model: Option<String>,
    messages: Vec<LLMMessage>,
    context: LLMContextRequest,
    api_key: Option<String>,
    base_url: Option<String>,
) -> Result<LLMResponse, String> {
    use tauri::Manager;
    let latest_user_message = messages
        .iter()
        .rev()
        .find(|message| message.role == "user")
        .and_then(|message| extract_text_from_message_content(&message.content));

    let requested_max_tokens = context.context_window_tokens.unwrap_or(DEFAULT_MAX_TOKENS);
    
    // Build context prompt
    let mut context_prompt = build_context_prompt(&context, latest_user_message.as_deref());

    // Inject long-term memory if enabled
    if context.memory_enabled.unwrap_or(false) {
        if let Ok(app_dir) = app.path().app_data_dir() {
            let memory_file = app_dir.join("memories").join("MEMORY.md");
            if memory_file.exists() {
                if let Ok(memory_content) = std::fs::read_to_string(&memory_file) {
                    context_prompt.push_str("\n\n### USER LONG-TERM MEMORY (Facts & Preferences)\n");
                    context_prompt.push_str("The following is your persistent, long-term memory about the user. Use these facts and preferences to personalize your responses and be more helpful, personable, and accurate:\n");
                    context_prompt.push_str(&memory_content);
                    context_prompt.push_str("\n------------------------------------\n");
                }
            }
        }
    }

    let mut initial_messages = vec![LLMMessage {
        role: "system".to_string(),
        content: LLMMessageContent::Text(context_prompt),
    }];
    initial_messages.extend(messages.clone());

    match llm_chat(
        provider.clone(),
        model.clone(),
        initial_messages,
        0.7,
        requested_max_tokens,
        api_key.clone(),
        base_url.clone(),
    )
    .await
    {
        Ok(response) => Ok(response),
        Err(error)
            if provider == "ollama" && should_retry_ollama_with_smaller_context(&error) =>
        {
            let fallback_context_window = reduced_ollama_context_window(context.context_window_tokens);
            let fallback_max_tokens = reduced_ollama_max_tokens(requested_max_tokens);
            let mut reduced_context = context.clone();
            reduced_context.context_window_tokens = Some(fallback_context_window);

            // Re-build context prompt for Ollama retry
            let mut retry_context_prompt = build_context_prompt(&reduced_context, latest_user_message.as_deref());
            if context.memory_enabled.unwrap_or(false) {
                if let Ok(app_dir) = app.path().app_data_dir() {
                    let memory_file = app_dir.join("memories").join("MEMORY.md");
                    if memory_file.exists() {
                        if let Ok(memory_content) = std::fs::read_to_string(&memory_file) {
                            retry_context_prompt.push_str("\n\n### USER LONG-TERM MEMORY (Facts & Preferences)\n");
                            retry_context_prompt.push_str("The following is your persistent, long-term memory about the user. Use these facts and preferences to personalize your responses and be more helpful, personable, and accurate:\n");
                            retry_context_prompt.push_str(&memory_content);
                            retry_context_prompt.push_str("\n------------------------------------\n");
                        }
                    }
                }
            }

            let mut retry_messages = vec![LLMMessage {
                role: "system".to_string(),
                content: LLMMessageContent::Text(retry_context_prompt),
            }];
            retry_messages.extend(messages);

            llm_chat(
                provider,
                model,
                retry_messages,
                0.7,
                fallback_max_tokens,
                api_key,
                base_url,
            )
            .await
            .map_err(|retry_error| {
                format!(
                    "{}. Retried Ollama with reduced context/max tokens and it still failed: {}",
                    error, retry_error
                )
            })
        }
        Err(error) => Err(error),
    }
}

// Streaming command - emits events to frontend
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn llm_stream_chat(
    app: AppHandle,
    provider: String,
    model: Option<String>,
    messages: Vec<LLMMessage>,
    temperature: f64,
    max_tokens: usize,
    api_key: Option<String>,
    base_url: Option<String>,
) -> Result<(), String> {
    let client = Client::new();
    let model = normalize_model(model, &provider);
    let max_tokens = if max_tokens == 0 { DEFAULT_MAX_TOKENS } else { max_tokens };
    let base_url = normalize_base_url(base_url, &provider);
    let api_key = normalize_api_key(api_key);
    let requires_api_key = provider_requires_api_key(&provider, &base_url);

    if provider != "ollama" {
        validate_base_url_not_private(&base_url)
            .map_err(|e| {
                emit_stream_event(&app, LLM_STREAM_ERROR, serde_json::json!({
                    "error": format!("Base URL not allowed: {}", e)
                }));
                format!("Base URL not allowed: {}", e)
            })?;
    }

    if api_key.is_none() && requires_api_key {
        emit_stream_event(&app, LLM_STREAM_ERROR, serde_json::json!({
            "error": "API key is required"
        }));
        return Err("API key is required".to_string());
    }

    match provider.as_str() {
        "openai" => {
            stream_openai(&app, &client, &model, messages, temperature, max_tokens, api_key.as_deref(), &base_url).await?
        }
        "anthropic" => {
            stream_anthropic(&app, &client, &model, messages, temperature, max_tokens, &api_key.unwrap(), &base_url).await?
        }
        "ollama" => {
            stream_ollama(&app, &client, &model, messages, temperature, max_tokens, &base_url).await?
        }
        "openrouter" => {
            stream_openai(&app, &client, &model, messages, temperature, max_tokens, Some(api_key.as_deref().unwrap()), &base_url).await?
        }
        _ => {
            emit_stream_event(&app, LLM_STREAM_ERROR, serde_json::json!({
                "error": format!("Unknown provider: {}", provider)
            }));
            return Err(format!("Unknown provider: {}", provider));
        }
    };

    Ok(())
}

// Streaming implementations
#[allow(clippy::too_many_arguments)]
async fn stream_openai(
    app: &AppHandle,
    client: &Client,
    model: &str,
    messages: Vec<LLMMessage>,
    temperature: f64,
    max_tokens: usize,
    api_key: Option<&str>,
    base_url: &str,
) -> Result<(), String> {
    let request = OpenAIRequest {
        model: model.to_string(),
        messages: map_openai_messages(messages)?,
        temperature,
        max_tokens,
        stream: Some(true),
    };

    let mut request_builder = client.post(format!("{}/chat/completions", base_url));
    if let Some(api_key) = api_key {
        request_builder = request_builder.header("Authorization", format!("Bearer {}", api_key));
    }

    let response = request_builder
        .json(&request)
        .send()
        .await
        .map_err(|e| {
            emit_stream_event(app, LLM_STREAM_ERROR, serde_json::json!({
                "error": format!("OpenAI API request failed: {}", e)
            }));
            format!("OpenAI API request failed: {}", e)
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        emit_stream_event(app, LLM_STREAM_ERROR, serde_json::json!({
            "error": format!("OpenAI API error ({}): {}", status, error_text)
        }));
        return Err(format!("OpenAI API error ({}): {}", status, error_text));
    }

    // Process streaming response
    let mut stream = response.bytes_stream();
    let mut buffer = Vec::new();

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| {
            emit_stream_event(app, LLM_STREAM_ERROR, serde_json::json!({
                "error": format!("Stream error: {}", e)
            }));
            format!("Stream error: {}", e)
        })?;

        buffer.extend_from_slice(&chunk);
        let data = String::from_utf8_lossy(&buffer);

        // Process SSE lines
        for line in data.lines() {
            let line = line.trim();
            if line.is_empty() || line == "data: [DONE]" {
                continue;
            }

            if let Some(json_str) = line.strip_prefix("data: ") {
                if let Ok(chunk_data) = serde_json::from_str::<OpenAIStreamChunk>(json_str) {
                    if let Some(choice) = chunk_data.choices.first() {
                        if let Some(content) = &choice.delta.content {
                            emit_stream_event(app, LLM_STREAM_CHUNK, serde_json::json!({
                                "content": content,
                                "done": choice.finish_reason.is_some()
                            }));

                            if choice.finish_reason.is_some() {
                                emit_stream_event(app, LLM_STREAM_DONE, serde_json::json!({}));
                                return Ok(());
                            }
                        }
                    }
                }
            }
        }

        buffer.clear();
    }

    emit_stream_event(app, LLM_STREAM_DONE, serde_json::json!({}));
    Ok(())
}

#[allow(clippy::too_many_arguments)]
async fn stream_anthropic(
    app: &AppHandle,
    client: &Client,
    model: &str,
    messages: Vec<LLMMessage>,
    temperature: f64,
    max_tokens: usize,
    api_key: &str,
    base_url: &str,
) -> Result<(), String> {
    // Filter out system messages for Anthropic
    let (system_message, chat_messages): (Vec<_>, Vec<_>) = messages
        .into_iter()
        .partition(|m| m.role == "system");

    let anthropic_messages = map_anthropic_messages(chat_messages)?;

    let request = AnthropicRequest {
        model: model.to_string(),
        messages: anthropic_messages,
        max_tokens,
        temperature,
        anthropic_version: "2023-06-01".to_string(),
        stream: Some(true),
    };

    let response = client
        .post(format!("{}/messages", base_url))
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e| {
            emit_stream_event(app, LLM_STREAM_ERROR, serde_json::json!({
                "error": format!("Anthropic API request failed: {}", e)
            }));
            format!("Anthropic API request failed: {}", e)
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        emit_stream_event(app, LLM_STREAM_ERROR, serde_json::json!({
            "error": format!("Anthropic API error ({}): {}", status, error_text)
        }));
        return Err(format!("Anthropic API error ({}): {}", status, error_text));
    }

    // Process streaming response
    let mut stream = response.bytes_stream();
    let mut buffer = Vec::new();

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| {
            emit_stream_event(app, LLM_STREAM_ERROR, serde_json::json!({
                "error": format!("Stream error: {}", e)
            }));
            format!("Stream error: {}", e)
        })?;

        buffer.extend_from_slice(&chunk);
        let data = String::from_utf8_lossy(&buffer);

        // Process SSE lines
        for line in data.lines() {
            let line = line.trim();
            if line.is_empty() || !line.starts_with("data: ") {
                continue;
            }

            let json_str = &line[6..];
            if let Ok(chunk_data) = serde_json::from_str::<AnthropicStreamChunk>(json_str) {
                match chunk_data.chunk_type.as_str() {
                    "content_block_delta" => {
                        if let Some(delta) = chunk_data.delta {
                            if let Some(text) = delta.text {
                                emit_stream_event(app, LLM_STREAM_CHUNK, serde_json::json!({
                                    "content": text,
                                    "done": false
                                }));
                            }
                        }
                    }
                    "message_stop" => {
                        emit_stream_event(app, LLM_STREAM_DONE, serde_json::json!({}));
                        return Ok(());
                    }
                    "error" => {
                        emit_stream_event(app, LLM_STREAM_ERROR, serde_json::json!({
                            "error": "Anthropic streaming error"
                        }));
                        return Err("Anthropic streaming error".to_string());
                    }
                    _ => {}
                }
            }
        }

        buffer.clear();
    }

    emit_stream_event(app, LLM_STREAM_DONE, serde_json::json!({}));
    Ok(())
}

async fn stream_ollama(
    app: &AppHandle,
    client: &Client,
    model: &str,
    messages: Vec<LLMMessage>,
    temperature: f64,
    max_tokens: usize,
    base_url: &str,
) -> Result<(), String> {
    let request = OllamaRequest {
        model: model.to_string(),
        messages: map_openai_messages(messages)?,
        stream: true,
        options: OllamaOptions {
            temperature,
            num_predict: max_tokens,
        },
    };

    let response = client
        .post(format!("{}/chat/completions", base_url))
        .json(&request)
        .send()
        .await
        .map_err(|e| {
            emit_stream_event(app, LLM_STREAM_ERROR, serde_json::json!({
                "error": format!("Ollama API request failed: {}", e)
            }));
            format!("Ollama API request failed: {}", e)
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        emit_stream_event(app, LLM_STREAM_ERROR, serde_json::json!({
            "error": format!("Ollama API error ({}): {}", status, error_text)
        }));
        return Err(format!("Ollama API error ({}): {}", status, error_text));
    }

    // Process streaming response
    let mut stream = response.bytes_stream();
    let mut buffer = Vec::new();

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| {
            emit_stream_event(app, LLM_STREAM_ERROR, serde_json::json!({
                "error": format!("Stream error: {}", e)
            }));
            format!("Stream error: {}", e)
        })?;

        buffer.extend_from_slice(&chunk);
        let data = String::from_utf8_lossy(&buffer);

        // Process SSE lines
        for line in data.lines() {
            let line = line.trim();
            if line.is_empty() || line == "data: [DONE]" {
                continue;
            }

            if let Some(json_str) = line.strip_prefix("data: ") {
                if let Ok(chunk_data) = serde_json::from_str::<OpenAIStreamChunk>(json_str) {
                    if let Some(choice) = chunk_data.choices.first() {
                        if let Some(content) = &choice.delta.content {
                            emit_stream_event(app, LLM_STREAM_CHUNK, serde_json::json!({
                                "content": content,
                                "done": choice.finish_reason.is_some()
                            }));

                            if choice.finish_reason.is_some() {
                                emit_stream_event(app, LLM_STREAM_DONE, serde_json::json!({}));
                                return Ok(());
                            }
                        }
                    }
                }
            }
        }

        buffer.clear();
    }

    emit_stream_event(app, LLM_STREAM_DONE, serde_json::json!({}));
    Ok(())
}

#[tauri::command]
pub async fn llm_get_models(provider: String, api_key: Option<String>, base_url: Option<String>) -> Result<Vec<ModelInfo>, String> {
    match provider.as_str() {
        "openai" => {
            let normalized_api_key = normalize_api_key(api_key.clone());
            if normalized_api_key.is_some()
                || provider_allows_keyless_access("openai", &normalize_base_url(base_url.clone(), "openai"))
            {
                let client = Client::new();
                let url = normalize_base_url(base_url, "openai");
                match fetch_openai_compatible_models(&client, &url, normalized_api_key.as_deref()).await {
                    Ok(models) => Ok(models),
                    Err(_) if normalized_api_key.is_none() => Ok(vec![
                        ModelInfo { id: "gpt-4o".to_string(), name: "GPT-4o".to_string(), context_length: Some(128000), pricing: Some(ModelPricing { prompt: Some(0.0025), completion: Some(0.01), request: None, image: None, web_search: None, cache_read: None, cache_write: None }) },
                        ModelInfo { id: "gpt-4o-mini".to_string(), name: "GPT-4o Mini".to_string(), context_length: Some(128000), pricing: Some(ModelPricing { prompt: Some(0.00015), completion: Some(0.0006), request: None, image: None, web_search: None, cache_read: None, cache_write: None }) },
                        ModelInfo { id: "gpt-4-turbo".to_string(), name: "GPT-4 Turbo".to_string(), context_length: Some(128000), pricing: Some(ModelPricing { prompt: Some(0.01), completion: Some(0.03), request: None, image: None, web_search: None, cache_read: None, cache_write: None }) },
                        ModelInfo { id: "gpt-3.5-turbo".to_string(), name: "GPT-3.5 Turbo".to_string(), context_length: Some(16385), pricing: Some(ModelPricing { prompt: Some(0.0005), completion: Some(0.0015), request: None, image: None, web_search: None, cache_read: None, cache_write: None }) },
                    ]),
                    Err(error) => Err(error),
                }
            } else {
                Ok(vec![
                    ModelInfo { id: "gpt-4o".to_string(), name: "GPT-4o".to_string(), context_length: Some(128000), pricing: Some(ModelPricing { prompt: Some(0.0025), completion: Some(0.01), request: None, image: None, web_search: None, cache_read: None, cache_write: None }) },
                    ModelInfo { id: "gpt-4o-mini".to_string(), name: "GPT-4o Mini".to_string(), context_length: Some(128000), pricing: Some(ModelPricing { prompt: Some(0.00015), completion: Some(0.0006), request: None, image: None, web_search: None, cache_read: None, cache_write: None }) },
                    ModelInfo { id: "gpt-4-turbo".to_string(), name: "GPT-4 Turbo".to_string(), context_length: Some(128000), pricing: Some(ModelPricing { prompt: Some(0.01), completion: Some(0.03), request: None, image: None, web_search: None, cache_read: None, cache_write: None }) },
                    ModelInfo { id: "gpt-3.5-turbo".to_string(), name: "GPT-3.5 Turbo".to_string(), context_length: Some(16385), pricing: Some(ModelPricing { prompt: Some(0.0005), completion: Some(0.0015), request: None, image: None, web_search: None, cache_read: None, cache_write: None }) },
                ])
            }
        }
        "anthropic" => {
            let normalized_api_key = normalize_api_key(api_key);
            if let Some(api_key) = normalized_api_key.as_deref() {
                let client = Client::new();
                let url = normalize_base_url(base_url, "anthropic");
                match fetch_anthropic_models(&client, &url, api_key).await {
                    Ok(models) => Ok(models),
                    Err(_) => Ok(vec![
                        ModelInfo { id: "claude-3-5-sonnet-20241022".to_string(), name: "Claude 3.5 Sonnet".to_string(), context_length: Some(200000), pricing: Some(ModelPricing { prompt: Some(0.003), completion: Some(0.015), request: None, image: None, web_search: None, cache_read: Some(0.0003), cache_write: Some(0.00375), }) },
                        ModelInfo { id: "claude-3-5-haiku-20241022".to_string(), name: "Claude 3.5 Haiku".to_string(), context_length: Some(200000), pricing: Some(ModelPricing { prompt: Some(0.0008), completion: Some(0.004), request: None, image: None, web_search: None, cache_read: Some(0.00008), cache_write: Some(0.001), }) },
                        ModelInfo { id: "claude-3-opus-20240229".to_string(), name: "Claude 3 Opus".to_string(), context_length: Some(200000), pricing: Some(ModelPricing { prompt: Some(0.015), completion: Some(0.075), request: None, image: None, web_search: None, cache_read: Some(0.0015), cache_write: Some(0.01875), }) },
                    ]),
                }
            } else {
                Ok(vec![
                    ModelInfo { id: "claude-3-5-sonnet-20241022".to_string(), name: "Claude 3.5 Sonnet".to_string(), context_length: Some(200000), pricing: Some(ModelPricing { prompt: Some(0.003), completion: Some(0.015), request: None, image: None, web_search: None, cache_read: Some(0.0003), cache_write: Some(0.00375), }) },
                    ModelInfo { id: "claude-3-5-haiku-20241022".to_string(), name: "Claude 3.5 Haiku".to_string(), context_length: Some(200000), pricing: Some(ModelPricing { prompt: Some(0.0008), completion: Some(0.004), request: None, image: None, web_search: None, cache_read: Some(0.00008), cache_write: Some(0.001), }) },
                    ModelInfo { id: "claude-3-opus-20240229".to_string(), name: "Claude 3 Opus".to_string(), context_length: Some(200000), pricing: Some(ModelPricing { prompt: Some(0.015), completion: Some(0.075), request: None, image: None, web_search: None, cache_read: Some(0.0015), cache_write: Some(0.01875), }) },
                ])
            }
        }
        "ollama" => {
            let client = Client::new();
            let url = normalize_base_url(base_url, "ollama");
            // /api/tags is the native Ollama endpoint (strip /v1 suffix if present)
            let tags_url = url.replace("/v1", "").replace("/chat/completions", "");
            fetch_ollama_models(&client, &tags_url).await
        }
        "openrouter" => {
            // Fetch from OpenRouter API if API key is provided
            let api_key = normalize_api_key(api_key);
            if let Some(key) = api_key {
                let client = Client::new();
                let url = normalize_base_url(base_url, "openrouter");
                return fetch_openrouter_models(&client, &url, &key).await;
            }
            // Fallback to default list with approximate pricing
            Ok(vec![
                ModelInfo { id: "anthropic/claude-3.5-sonnet".to_string(), name: "Claude 3.5 Sonnet".to_string(), context_length: Some(200000), pricing: Some(ModelPricing { prompt: Some(0.003), completion: Some(0.015), request: None, image: None, web_search: None, cache_read: None, cache_write: None }) },
                ModelInfo { id: "anthropic/claude-3.5-sonnet:beta".to_string(), name: "Claude 3.5 Sonnet (Beta)".to_string(), context_length: Some(200000), pricing: Some(ModelPricing { prompt: Some(0.003), completion: Some(0.015), request: None, image: None, web_search: None, cache_read: None, cache_write: None }) },
                ModelInfo { id: "anthropic/claude-3.5-haiku".to_string(), name: "Claude 3.5 Haiku".to_string(), context_length: Some(200000), pricing: Some(ModelPricing { prompt: Some(0.0008), completion: Some(0.004), request: None, image: None, web_search: None, cache_read: None, cache_write: None }) },
                ModelInfo { id: "anthropic/claude-3-opus".to_string(), name: "Claude 3 Opus".to_string(), context_length: Some(200000), pricing: Some(ModelPricing { prompt: Some(0.015), completion: Some(0.075), request: None, image: None, web_search: None, cache_read: None, cache_write: None }) },
                ModelInfo { id: "openai/gpt-4o".to_string(), name: "GPT-4o".to_string(), context_length: Some(128000), pricing: Some(ModelPricing { prompt: Some(0.0025), completion: Some(0.01), request: None, image: None, web_search: None, cache_read: None, cache_write: None }) },
                ModelInfo { id: "openai/gpt-4o-mini".to_string(), name: "GPT-4o Mini".to_string(), context_length: Some(128000), pricing: Some(ModelPricing { prompt: Some(0.00015), completion: Some(0.0006), request: None, image: None, web_search: None, cache_read: None, cache_write: None }) },
                ModelInfo { id: "openai/gpt-4-turbo".to_string(), name: "GPT-4 Turbo".to_string(), context_length: Some(128000), pricing: Some(ModelPricing { prompt: Some(0.01), completion: Some(0.03), request: None, image: None, web_search: None, cache_read: None, cache_write: None }) },
                ModelInfo { id: "google/gemini-pro-1.5".to_string(), name: "Gemini Pro 1.5".to_string(), context_length: Some(2000000), pricing: Some(ModelPricing { prompt: Some(0.00125), completion: Some(0.005), request: None, image: None, web_search: None, cache_read: None, cache_write: None }) },
                ModelInfo { id: "meta-llama/llama-3.1-405b-instruct".to_string(), name: "Llama 3.1 405B".to_string(), context_length: Some(128000), pricing: Some(ModelPricing { prompt: Some(0.005), completion: Some(0.005), request: None, image: None, web_search: None, cache_read: None, cache_write: None }) },
                ModelInfo { id: "deepseek/deepseek-chat".to_string(), name: "DeepSeek Chat".to_string(), context_length: Some(64000), pricing: Some(ModelPricing { prompt: Some(0.00027), completion: Some(0.0011), request: None, image: None, web_search: None, cache_read: None, cache_write: None }) },
            ])
        }
        _ => Err(format!("Unknown provider: {}", provider)),
    }
}

#[tauri::command]
pub async fn llm_test_connection(
    provider: String,
    api_key: String,
    base_url: Option<String>,
) -> Result<bool, String> {
    let client = Client::new();
    let base_url = normalize_base_url(base_url, &provider);
    let api_key = normalize_api_key(Some(api_key)).unwrap_or_default();

    if provider_requires_api_key(&provider, &base_url) && api_key.is_empty() {
        return Err("API key is required".to_string());
    }

    let result = match provider.as_str() {
        "openai" => {
            test_openai_connection(&client, &base_url, if api_key.is_empty() { None } else { Some(api_key.as_str()) }).await?
        }
        "anthropic" => {
            test_anthropic_connection(&client, &base_url, &api_key).await?
        }
        "ollama" => {
            test_ollama_connection(&client, &base_url).await?
        }
        "openrouter" => {
            test_openrouter_connection(&client, &base_url, &api_key).await?
        }
        _ => return Err(format!("Unknown provider: {}", provider)),
    };

    Ok(result)
}

// Non-streaming helper functions (kept for compatibility)
async fn call_openai_with_key(
    client: &Client,
    model: &str,
    messages: Vec<LLMMessage>,
    temperature: f64,
    max_tokens: usize,
    api_key: Option<&str>,
    base_url: &str,
) -> Result<LLMResponse, String> {
    let request = OpenAIRequest {
        model: model.to_string(),
        messages: map_openai_messages(messages)?,
        temperature,
        max_tokens,
        stream: None,
    };

    let mut request_builder = client.post(format!("{}/chat/completions", base_url));
    if let Some(api_key) = api_key {
        request_builder = request_builder.header("Authorization", format!("Bearer {}", api_key));
    }

    let response = request_builder
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("OpenAI API request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("OpenAI API error ({}): {}", status, error_text));
    }

    let openai_response: OpenAIResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse OpenAI response: {}", e))?;

    let content = openai_response
        .choices
        .first()
        .map(|c| c.message.content.clone())
        .unwrap_or_default();

    Ok(LLMResponse {
        content,
        usage: openai_response.usage.map(|u| LLMUsage {
            prompt_tokens: u.prompt_tokens,
            completion_tokens: u.completion_tokens,
            total_tokens: u.total_tokens,
        }),
    })
}

async fn call_anthropic_with_key(
    client: &Client,
    model: &str,
    messages: Vec<LLMMessage>,
    temperature: f64,
    max_tokens: usize,
    api_key: &str,
    base_url: &str,
) -> Result<LLMResponse, String> {
    // Filter out system messages for Anthropic
    let (system_message, chat_messages): (Vec<_>, Vec<_>) = messages
        .into_iter()
        .partition(|m| m.role == "system");

    let anthropic_messages = map_anthropic_messages(chat_messages)?;

    let request = AnthropicRequest {
        model: model.to_string(),
        messages: anthropic_messages,
        max_tokens,
        temperature,
        anthropic_version: "2023-06-01".to_string(),
        stream: None,
    };

    let response = client
        .post(format!("{}/messages", base_url))
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Anthropic API request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Anthropic API error ({}): {}", status, error_text));
    }

    let anthropic_response: AnthropicResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Anthropic response: {}", e))?;

    let content = anthropic_response
        .content
        .iter()
        .filter(|c| c.content_type == "text")
        .map(|c| c.text.clone())
        .collect::<Vec<_>>()
        .join("\n");

    Ok(LLMResponse {
        content,
        usage: anthropic_response.usage.map(|u| LLMUsage {
            prompt_tokens: u.input_tokens,
            completion_tokens: u.output_tokens,
            total_tokens: u.input_tokens + u.output_tokens,
        }),
    })
}

async fn call_ollama_with_url(
    client: &Client,
    model: &str,
    messages: Vec<LLMMessage>,
    temperature: f64,
    max_tokens: usize,
    base_url: &str,
) -> Result<LLMResponse, String> {
    let request = OllamaRequest {
        model: model.to_string(),
        messages: map_openai_messages(messages)?,
        stream: false,
        options: OllamaOptions {
            temperature,
            num_predict: max_tokens,
        },
    };

    let response = client
        .post(format!("{}/chat/completions", base_url))
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Ollama API request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Ollama API error ({}): {}", status, error_text));
    }

    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read Ollama response: {}", e))?;
    let openai_response: OpenAIResponse = serde_json::from_str(&body)
        .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

    let choice = openai_response.choices.into_iter().next()
        .ok_or_else(|| "Ollama response contained no choices".to_string())?;

    Ok(LLMResponse {
        content: choice.message.content,
        usage: openai_response.usage.map(|u| LLMUsage {
            prompt_tokens: u.prompt_tokens,
            completion_tokens: u.completion_tokens,
            total_tokens: u.total_tokens,
        }),
    })
}

async fn call_openrouter_with_key(
    client: &Client,
    model: &str,
    messages: Vec<LLMMessage>,
    temperature: f64,
    max_tokens: usize,
    api_key: &str,
    base_url: &str,
) -> Result<LLMResponse, String> {
    // Clamp temperature to valid range for OpenAI-compatible APIs (0-2)
    let temperature = temperature.clamp(0.0, 2.0);

    let request = OpenAIRequest {
        model: model.to_string(),
        messages: map_openai_messages(messages)?,
        temperature,
        max_tokens,
        stream: None,
    };

    let response = client
        .post(format!("{}/chat/completions", base_url))
        .header("Authorization", format!("Bearer {}", api_key))
        .header("HTTP-Referer", "https://incrementum.app")
        .header("X-Title", "Incrementum")
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("OpenRouter API request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let _error_text = response.text().await.unwrap_or_default();
        return Err(format!("OpenRouter API error ({}): {}", status, "request failed"));
    }

    let openrouter_response: OpenAIResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse OpenRouter response: {}", e))?;

    let content = openrouter_response
        .choices
        .first()
        .map(|c| c.message.content.clone())
        .unwrap_or_default();

    Ok(LLMResponse {
        content,
        usage: openrouter_response.usage.map(|u| LLMUsage {
            prompt_tokens: u.prompt_tokens,
            completion_tokens: u.completion_tokens,
            total_tokens: u.total_tokens,
        }),
    })
}

async fn test_openai_connection(
    client: &Client,
    base_url: &str,
    api_key: Option<&str>,
) -> Result<bool, String> {
    if api_key.is_none() && !is_local_base_url(base_url) {
        return Err("API key is required".to_string());
    }

    let mut request_builder = client.get(format!("{}/models", base_url));
    if let Some(api_key) = api_key {
        request_builder = request_builder.header("Authorization", format!("Bearer {}", api_key));
    }

    let response = request_builder
        .send()
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;

    Ok(response.status().is_success())
}

async fn test_anthropic_connection(
    client: &Client,
    base_url: &str,
    api_key: &str,
) -> Result<bool, String> {
    let response = client
        .get(format!("{}/models", base_url))
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .send()
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;

    Ok(response.status().is_success())
}

async fn test_ollama_connection(
    client: &Client,
    base_url: &str,
) -> Result<bool, String> {
    let response = client
        .get(format!("{}/tags", base_url.replace("/v1", "")))
        .send()
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;

    Ok(response.status().is_success())
}

async fn test_openrouter_connection(
    client: &Client,
    base_url: &str,
    api_key: &str,
) -> Result<bool, String> {
    // Verify the API key by checking models endpoint (lighter weight and reliable)
    let models_response = client
        .get(format!("{}/models", base_url))
        .header("Authorization", format!("Bearer {}", api_key))
        .header("HTTP-Referer", "https://incrementum.app")
        .header("X-Title", "Incrementum")
        .send()
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;

    if !models_response.status().is_success() {
        let status = models_response.status();
        let error_text = models_response.text().await.unwrap_or_default();
        return Err(format!("OpenRouter API key validation failed ({}): {}", status, error_text));
    }

    Ok(true)
}

// Model pricing information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelPricing {
    pub prompt: Option<f64>,
    pub completion: Option<f64>,
    pub request: Option<f64>,
    pub image: Option<f64>,
    pub web_search: Option<f64>,
    #[serde(rename = "cache_read")]
    pub cache_read: Option<f64>,
    #[serde(rename = "cache_write")]
    pub cache_write: Option<f64>,
}

// Model information with pricing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub context_length: Option<usize>,
    pub pricing: Option<ModelPricing>,
}

async fn fetch_openrouter_models(
    client: &Client,
    base_url: &str,
    api_key: &str,
) -> Result<Vec<ModelInfo>, String> {
    let response = client
        .get(format!("{}/models", base_url))
        .header("Authorization", format!("Bearer {}", api_key))
        .header("HTTP-Referer", "https://incrementum.app")
        .header("X-Title", "Incrementum")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch models from OpenRouter: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("OpenRouter models API error ({}): {}", status, error_text));
    }

    // OpenRouter's models payload can contain mixed types (numbers/strings/null).
    // Parse defensively from raw JSON to avoid hard-failing on type drift.
    let payload: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse OpenRouter models response: {}", e))?;

    let data = payload
        .get("data")
        .and_then(|v| v.as_array())
        .ok_or_else(|| "Failed to parse OpenRouter models response: missing `data` array".to_string())?;

    let parse_f64 = |value: Option<&serde_json::Value>| -> Option<f64> {
        let value = value?;
        if let Some(n) = value.as_f64() {
            return Some(n);
        }
        if let Some(s) = value.as_str() {
            return s.trim().parse::<f64>().ok();
        }
        None
    };

    let parse_usize = |value: Option<&serde_json::Value>| -> Option<usize> {
        let value = value?;
        if let Some(n) = value.as_u64() {
            return usize::try_from(n).ok();
        }
        if let Some(s) = value.as_str() {
            return s.trim().parse::<usize>().ok();
        }
        None
    };

    // Convert to ModelInfo and sort by ID
    let mut models: Vec<ModelInfo> = data
        .iter()
        .filter_map(|entry| {
            let obj = entry.as_object()?;
            let id = obj.get("id")?.as_str()?.trim().to_string();
            if id.is_empty() {
                return None;
            }

            let name = obj
                .get("name")
                .and_then(|v| v.as_str())
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| id.clone());

            let context_length = parse_usize(obj.get("context_length"));

            let pricing = obj
                .get("pricing")
                .and_then(|v| v.as_object())
                .map(|pricing_obj| ModelPricing {
                    prompt: parse_f64(pricing_obj.get("prompt")),
                    completion: parse_f64(pricing_obj.get("completion")),
                    request: parse_f64(pricing_obj.get("request")),
                    image: parse_f64(pricing_obj.get("image")),
                    web_search: parse_f64(pricing_obj.get("web_search")),
                    cache_read: parse_f64(pricing_obj.get("cache_read")),
                    cache_write: parse_f64(pricing_obj.get("cache_write")),
                });

            Some(ModelInfo {
                id,
                name,
                context_length,
                pricing,
            })
        })
        .collect();

    models.sort_by(|a, b| a.id.cmp(&b.id));

    if models.is_empty() {
        return Err("OpenRouter models response did not contain any usable model entries".to_string());
    }

    Ok(models)
}

async fn fetch_openai_compatible_models(
    client: &Client,
    base_url: &str,
    api_key: Option<&str>,
) -> Result<Vec<ModelInfo>, String> {
    let mut request_builder = client.get(format!("{}/models", base_url));
    if let Some(api_key) = api_key {
        request_builder = request_builder.header("Authorization", format!("Bearer {}", api_key));
    }

    let response = request_builder
        .send()
        .await
        .map_err(|e| format!("Failed to fetch models from OpenAI-compatible endpoint: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("OpenAI-compatible models API error ({}): {}", status, error_text));
    }

    let payload: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse OpenAI-compatible models response: {}", e))?;

    let data = payload
        .get("data")
        .and_then(|v| v.as_array())
        .ok_or_else(|| "Failed to parse OpenAI-compatible models response: missing `data` array".to_string())?;

    let mut models: Vec<ModelInfo> = data
        .iter()
        .filter_map(|entry| {
            let obj = entry.as_object()?;
            let id = obj.get("id")?.as_str()?.trim().to_string();
            if id.is_empty() {
                return None;
            }

            Some(ModelInfo {
                name: id.clone(),
                id,
                context_length: None,
                pricing: None,
            })
        })
        .collect();

    if models.is_empty() {
        return Err("OpenAI-compatible endpoint did not return any usable models".to_string());
    }

    models.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(models)
}

async fn fetch_anthropic_models(
    client: &Client,
    base_url: &str,
    api_key: &str,
) -> Result<Vec<ModelInfo>, String> {
    let response = client
        .get(format!("{}/models", base_url))
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch models from Anthropic: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Anthropic models API error ({}): {}", status, error_text));
    }

    let payload: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Anthropic models response: {}", e))?;

    let data = payload
        .get("data")
        .and_then(|v| v.as_array())
        .ok_or_else(|| "Failed to parse Anthropic models response: missing `data` array".to_string())?;

    let mut models: Vec<ModelInfo> = data
        .iter()
        .filter_map(|entry| {
            let obj = entry.as_object()?;
            let id = obj.get("id")?.as_str()?.trim().to_string();
            if id.is_empty() {
                return None;
            }

            let display_name = obj
                .get("display_name")
                .and_then(|v| v.as_str())
                .map(|name| name.trim().to_string())
                .filter(|name| !name.is_empty())
                .unwrap_or_else(|| id.clone());

            Some(ModelInfo {
                id,
                name: display_name,
                context_length: None,
                pricing: None,
            })
        })
        .collect();

    if models.is_empty() {
        return Err("Anthropic models response did not contain any usable models".to_string());
    }

    models.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(models)
}

async fn fetch_ollama_models(
    client: &Client,
    base_url: &str,
) -> Result<Vec<ModelInfo>, String> {
    let response = client
        .get(format!("{}/api/tags", base_url))
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Ollama at {}: {}", base_url, e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Ollama API error ({}): {}", status, error_text));
    }

    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read Ollama response: {}", e))?;
    let payload: serde_json::Value = serde_json::from_str(&body)
        .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

    let empty: Vec<serde_json::Value> = vec![];
    let models = payload
        .get("models")
        .and_then(|v| v.as_array())
        .unwrap_or(&empty);

    let format_size = |bytes: Option<&serde_json::Value>| -> Option<String> {
        let b = bytes?.as_u64()?;
        let gb = b as f64 / (1024.0 * 1024.0 * 1024.0);
        if gb >= 1.0 {
            Some(format!("{:.1} GB", gb))
        } else {
            let mb = b as f64 / (1024.0 * 1024.0);
            Some(format!("{:.0} MB", mb))
        }
    };

    let mut result: Vec<ModelInfo> = models
        .iter()
        .filter_map(|m| {
            let name = m.get("name")?.as_str()?.to_string();
            let size = m.get("size").and_then(|v| format_size(Some(v)));
            let family = m.get("details")
                .and_then(|d| d.get("family"))
                .and_then(|f| f.as_str())
                .map(|s| s.to_string());

            let display_name = match (&size, &family) {
                (Some(s), Some(f)) => format!("{} ({}, {})", name, f, s),
                (Some(s), None) => format!("{} ({})", name, s),
                (None, Some(f)) => format!("{} ({})", name, f),
                (None, None) => name.clone(),
            };

            Some(ModelInfo {
                id: name,
                name: display_name,
                context_length: None,
                pricing: None,
            })
        })
        .collect();

    if result.is_empty() {
        return Err("No models found in Ollama. Run `ollama pull <model>` to install one.".to_string());
    }

    result.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(result)
}

// Helper functions
fn get_default_model(provider: &str) -> String {
    match provider {
        "openai" => "gpt-4o".to_string(),
        "anthropic" => "claude-3-5-sonnet-20241022".to_string(),
        "ollama" => "llama3.2".to_string(),
        // Use a free model that's actually available on OpenRouter
        "openrouter" => "google/gemma-2-9b-it:free".to_string(),
        _ => "default".to_string(),
    }
}

fn normalize_api_key(api_key: Option<String>) -> Option<String> {
    api_key
        .map(|key| key.trim().to_string())
        .filter(|key| !key.is_empty())
}

fn normalize_model(model: Option<String>, provider: &str) -> String {
    model
        .map(|name| name.trim().to_string())
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| get_default_model(provider))
}

fn provider_allows_keyless_access(provider: &str, base_url: &str) -> bool {
    provider == "ollama" || (provider == "openai" && is_local_base_url(base_url))
}

fn provider_requires_api_key(provider: &str, base_url: &str) -> bool {
    !provider_allows_keyless_access(provider, base_url)
}

fn is_local_base_url(base_url: &str) -> bool {
    let trimmed = base_url.trim().to_ascii_lowercase();
    let without_scheme = trimmed
        .strip_prefix("http://")
        .or_else(|| trimmed.strip_prefix("https://"))
        .unwrap_or(trimmed.as_str());
    let host_port = without_scheme.split('/').next().unwrap_or("");
    let host = if host_port.starts_with('[') {
        host_port.split(']').next().unwrap_or(host_port).trim_start_matches('[')
    } else {
        host_port.split(':').next().unwrap_or(host_port)
    };

    matches!(host, "localhost" | "127.0.0.1" | "0.0.0.0" | "::1" | "host.docker.internal")
        || host.ends_with(".local")
}

/// Validate that a user-supplied base_url is not a private/internal address.
/// Returns Err if the URL resolves to a private IP or localhost (for non-Ollama providers).
fn validate_base_url_not_private(base_url: &str) -> Result<(), String> {
    let trimmed = base_url.trim().to_ascii_lowercase();
    // Allow localhost/127.0.0.1 for Ollama which runs locally
    let without_scheme = trimmed
        .strip_prefix("http://")
        .or_else(|| trimmed.strip_prefix("https://"))
        .unwrap_or(trimmed.as_str());
    let host_port = without_scheme.split('/').next().unwrap_or("");
    let host = if host_port.starts_with('[') {
        host_port.split(']').next().unwrap_or(host_port).trim_start_matches('[')
    } else {
        host_port.split(':').next().unwrap_or(host_port)
    };

    // Skip validation for known local-only hosts (Ollama use case)
    if matches!(host, "localhost" | "127.0.0.1" | "0.0.0.0" | "::1" | "host.docker.internal")
        || host.ends_with(".local")
    {
        return Ok(());
    }

    crate::security::validate_url_not_private(base_url)
}

fn normalize_base_url(base_url: Option<String>, provider: &str) -> String {
    let fallback = get_default_base_url(provider);
    let url = base_url.unwrap_or(fallback.clone());
    if url.trim().is_empty() {
        return fallback;
    }
    url.trim_end_matches('/').to_string()
}

fn get_default_base_url(provider: &str) -> String {
    match provider {
        "openai" => "https://api.openai.com/v1".to_string(),
        "anthropic" => "https://api.anthropic.com/v1".to_string(),
        "ollama" => "http://localhost:11434/v1".to_string(),
        "openrouter" => "https://openrouter.ai/api/v1".to_string(),
        _ => "".to_string(),
    }
}

fn build_context_prompt(
    context: &LLMContextRequest,
    latest_user_message: Option<&str>,
) -> String {
    let mut instructions = String::from(
        "Use the provided context to answer the user's request. \
If the user asks for a summary, summarize the relevant context. \
If the answer is not in the provided context, say so.",
    );

    instructions.push('\n');

    match context.r#type.as_str() {
        "document" => {
            let mut prompt = format!(
                "The user is viewing a document{}.",
                context
                    .document_id
                    .as_ref()
                    .map(|id| format!(" (ID: {})", id))
                    .unwrap_or_default()
            );

            if let Some(selection) = context.selection.as_ref() {
                if !selection.trim().is_empty() {
                    prompt.push_str(&format!("\nSelected text: \"{}\"", selection));
                }
            }

            if let Some(content) = context.content.as_ref() {
                let excerpt = select_relevant_excerpt(
                    content,
                    context.context_window_tokens,
                    latest_user_message,
                );
                if !excerpt.trim().is_empty() {
                    prompt.push_str("\nDocument content (excerpt):\n");
                    prompt.push_str(&excerpt);
                }
            }

            instructions.push_str(&prompt);
            instructions
        }
        "web" => {
            let mut prompt = format!(
                "The user is browsing the web page: {}.",
                context.url.as_deref().unwrap_or("Unknown")
            );

            if let Some(selection) = context.selection.as_ref() {
                if !selection.trim().is_empty() {
                    prompt.push_str(&format!("\nSelected text: \"{}\"", selection));
                }
            }

            if let Some(content) = context.content.as_ref() {
                let excerpt = select_relevant_excerpt(
                    content,
                    context.context_window_tokens,
                    latest_user_message,
                );
                if !excerpt.trim().is_empty() {
                    prompt.push_str("\nPage content (excerpt):\n");
                    prompt.push_str(&excerpt);
                }
            }

            instructions.push_str(&prompt);
            instructions
        }
        "video" => {
            let mut prompt = String::from("The user is watching a video.");

            if let Some(selection) = context.selection.as_ref() {
                if !selection.trim().is_empty() {
                    prompt.push_str(&format!("\nSelected text: \"{}\"", selection));
                }
            }

            if let Some(content) = context.content.as_ref() {
                let excerpt = select_relevant_excerpt(
                    content,
                    context.context_window_tokens,
                    latest_user_message,
                );
                if !excerpt.trim().is_empty() {
                    prompt.push_str("\nTranscript (excerpt):\n");
                    prompt.push_str(&excerpt);
                }
            }

            instructions.push_str(&prompt);
            instructions
        }
        _ => {
            instructions.push_str("You are a helpful assistant.");
            instructions
        }
    }
}

fn prepend_context_message(
    messages: Vec<LLMMessage>,
    context: &LLMContextRequest,
    latest_user_message: Option<&str>,
) -> Vec<LLMMessage> {
    let context_prompt = build_context_prompt(context, latest_user_message);
    let mut messages_with_context = vec![LLMMessage {
        role: "system".to_string(),
        content: LLMMessageContent::Text(context_prompt),
    }];
    messages_with_context.extend(messages);
    messages_with_context
}

fn extract_text_from_message_content(content: &LLMMessageContent) -> Option<String> {
    match content {
        LLMMessageContent::Text(text) => Some(text.clone()),
        LLMMessageContent::Parts(parts) => {
            let text = parts
                .iter()
                .filter_map(|part| match part {
                    LLMMessageContentPart::Text { text } => Some(text.trim()),
                    LLMMessageContentPart::ImageUrl { .. } => None,
                })
                .filter(|text| !text.is_empty())
                .collect::<Vec<_>>()
                .join("\n");

            if text.is_empty() {
                None
            } else {
                Some(text)
            }
        }
    }
}

fn map_openai_messages(messages: Vec<LLMMessage>) -> Result<Vec<OpenAIMessage>, String> {
    messages
        .into_iter()
        .map(|message| {
            Ok(OpenAIMessage {
                role: message.role,
                content: map_openai_message_content(message.content),
            })
        })
        .collect()
}

fn map_openai_message_content(content: LLMMessageContent) -> OpenAIMessageContent {
    match content {
        LLMMessageContent::Text(text) => OpenAIMessageContent::Text(text),
        LLMMessageContent::Parts(parts) => OpenAIMessageContent::Parts(
            parts.into_iter().map(map_openai_content_part).collect(),
        ),
    }
}

fn map_openai_content_part(part: LLMMessageContentPart) -> OpenAIContentPart {
    match part {
        LLMMessageContentPart::Text { text } => OpenAIContentPart::Text { text },
        LLMMessageContentPart::ImageUrl { image_url } => OpenAIContentPart::ImageUrl {
            image_url: OpenAIImageUrl { url: image_url },
        },
    }
}

fn map_anthropic_messages(messages: Vec<LLMMessage>) -> Result<Vec<AnthropicMessage>, String> {
    messages
        .into_iter()
        .map(|message| {
            Ok(AnthropicMessage {
                role: message.role,
                content: map_anthropic_message_content(message.content)?,
            })
        })
        .collect()
}

fn map_anthropic_message_content(content: LLMMessageContent) -> Result<AnthropicMessageContent, String> {
    match content {
        LLMMessageContent::Text(text) => Ok(AnthropicMessageContent::Text(text)),
        LLMMessageContent::Parts(parts) => Ok(AnthropicMessageContent::Parts(
            parts.into_iter().map(map_anthropic_content_part).collect::<Result<Vec<_>, _>>()?,
        )),
    }
}

fn map_anthropic_content_part(part: LLMMessageContentPart) -> Result<AnthropicInputContentPart, String> {
    match part {
        LLMMessageContentPart::Text { text } => Ok(AnthropicInputContentPart::Text { text }),
        LLMMessageContentPart::ImageUrl { image_url } => {
            let (media_type, data) = parse_data_url(&image_url)
                .ok_or_else(|| "Anthropic image inputs must be provided as data URLs".to_string())?;
            Ok(AnthropicInputContentPart::Image {
                source: AnthropicImageSource {
                    source_type: "base64".to_string(),
                    media_type,
                    data,
                },
            })
        }
    }
}

fn parse_data_url(url: &str) -> Option<(String, String)> {
    let trimmed = url.trim();
    let rest = trimmed.strip_prefix("data:")?;
    let (meta, data) = rest.split_once(',')?;
    if !meta.contains(";base64") {
        return None;
    }
    let media_type = meta.split(';').next()?.trim();
    if media_type.is_empty() || data.trim().is_empty() {
        return None;
    }
    Some((media_type.to_string(), data.trim().to_string()))
}

fn should_retry_ollama_with_smaller_context(error: &str) -> bool {
    let lowered = error.to_ascii_lowercase();
    lowered.contains("unexpected eof")
        || (lowered.contains("ollama api error (500") && lowered.contains("api_error"))
}

fn reduced_ollama_context_window(context_window_tokens: Option<usize>) -> usize {
    let current = context_window_tokens.unwrap_or(DEFAULT_MAX_TOKENS);
    current.min(512).max(256)
}

fn reduced_ollama_max_tokens(max_tokens: usize) -> usize {
    max_tokens.min(512).max(256)
}

fn select_relevant_excerpt(
    content: &str,
    context_window_tokens: Option<usize>,
    user_query: Option<&str>,
) -> String {
    let max_chars = estimate_context_chars(context_window_tokens);
    let mut char_indices: Vec<usize> = content.char_indices().map(|(i, _)| i).collect();
    char_indices.push(content.len());
    let total_chars = char_indices.len().saturating_sub(1);

    if total_chars <= max_chars {
        return content.to_string();
    }

    let query_terms = user_query
        .map(extract_query_terms)
        .unwrap_or_default();

    if query_terms.is_empty() {
        return content.chars().take(max_chars).collect();
    }

    let mut best_chunks: Vec<(usize, usize, usize)> = Vec::new(); // (score, start, end)
    let chunk_len = max_chars.clamp(400, 1200).min(total_chars);
    let overlap = 200.min(chunk_len / 3);
    let mut start_char = 0;

    while start_char < total_chars {
        let end_char = (start_char + chunk_len).min(total_chars);
        let start = char_indices[start_char];
        let end = char_indices[end_char];
        let chunk = &content[start..end];
        let score = score_chunk(chunk, &query_terms);
        best_chunks.push((score, start, end));

        if end_char == total_chars {
            break;
        }
        start_char = end_char.saturating_sub(overlap);
    }

    best_chunks.sort_by(|a, b| b.0.cmp(&a.0));
    let mut selected = String::new();

    for (score, start, end) in best_chunks {
        if score == 0 && !selected.is_empty() {
            break;
        }
        let chunk = &content[start..end];
        let selected_chars = selected.chars().count();
        let chunk_chars = chunk.chars().count();
        if selected_chars + chunk_chars + 12 > max_chars {
            break;
        }
        if !selected.is_empty() {
            selected.push_str("\n\n[...]\n\n");
        }
        selected.push_str(chunk);
        if selected.chars().count() >= max_chars {
            break;
        }
    }

    if selected.is_empty() {
        content.chars().take(max_chars).collect()
    } else {
        selected
    }
}

fn estimate_context_chars(context_window_tokens: Option<usize>) -> usize {
    let tokens = context_window_tokens.unwrap_or(DEFAULT_MAX_TOKENS);
    tokens.saturating_mul(4)
}

fn extract_query_terms(query: &str) -> Vec<String> {
    let stop_words = [
        "the", "and", "or", "of", "to", "in", "a", "an", "is", "are", "was", "were", "what",
        "how", "why", "when", "where", "which", "who", "summarize", "summary", "chapter", "page",
        "book", "document", "this", "that",
    ];

    let mut terms: Vec<String> = query
        .to_lowercase()
        .split(|ch: char| !ch.is_alphanumeric())
        .filter(|term| term.len() >= 4)
        .filter(|term| !stop_words.contains(term))
        .map(|term| term.to_string())
        .collect();

    let chars: Vec<(usize, char)> = query.char_indices().collect();
    let mut index = 0;
    while index < chars.len() {
        if !chars[index].1.is_ascii_digit() {
            index += 1;
            continue;
        }

        let start = chars[index].0;
        let mut end = query.len();
        let mut cursor = index;
        while cursor < chars.len() && (chars[cursor].1.is_ascii_digit() || chars[cursor].1 == '.') {
            cursor += 1;
        }
        if cursor < chars.len() {
            end = chars[cursor].0;
        }

        let candidate = query[start..end].trim();
        if candidate.contains('.') && candidate.len() >= 3 {
            terms.push(candidate.to_lowercase());
        }
        index = cursor;
    }

    terms.sort();
    terms.dedup();
    terms
}

fn score_chunk(chunk: &str, terms: &[String]) -> usize {
    let chunk_lower = chunk.to_lowercase();
    terms
        .iter()
        .map(|term| chunk_lower.matches(term).count())
        .sum()
}

// Types for Tauri commands

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LLMMessage {
    pub role: String,
    pub content: LLMMessageContent,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(untagged)]
pub enum LLMMessageContent {
    Text(String),
    Parts(Vec<LLMMessageContentPart>),
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(tag = "type")]
pub enum LLMMessageContentPart {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "image_url")]
    ImageUrl {
        #[serde(rename = "imageUrl", alias = "image_url")]
        image_url: String,
    },
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LLMResponse {
    pub content: String,
    pub usage: Option<LLMUsage>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LLMUsage {
    pub prompt_tokens: usize,
    pub completion_tokens: usize,
    pub total_tokens: usize,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LLMContextRequest {
    #[serde(rename = "type")]
    pub r#type: String,
    pub document_id: Option<String>,
    pub url: Option<String>,
    pub selection: Option<String>,
    pub content: Option<String>,
    pub context_window_tokens: Option<usize>,
    pub memory_enabled: Option<bool>,
}
