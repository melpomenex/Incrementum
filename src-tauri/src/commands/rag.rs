//! Whole-library RAG (retrieval-augmented generation) chat.
//!
//! Builds on the existing embedding providers (`ai/embeddings.rs`), the shared
//! provider builder (`ai/embedding_config.rs`), and the document segmenter
//! (`segmentation.rs`). Provides:
//!   - `rag_index_document` / `rag_index_collection`: chunk + embed + persist.
//!   - `rag_index_status`: counts + configured provider/model.
//!   - `rag_search`: embed query → top-k cosine over chunk embeddings.
//!   - `rag_chat`: retrieve → assemble grounded context with citations → LLM.

use crate::ai::embedding_config::{build_provider, cosine_similarity, model_name, provider_name};
use crate::ai::embeddings::EmbeddingProvider;
use crate::commands::llm::{llm_chat, LLMMessage, LLMMessageContent, LLMResponse};
use crate::commands::semantic_graph::EmbeddingConfigInput;
use crate::database::{DocumentChunkEmbedding, Repository};
use crate::error::{IncrementumError, Result};
use crate::segmentation::{DocumentSegmenter, SegmentConfig, SegmentationMethod};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, State};

/// A single retrieved chunk with its source document.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RagHit {
    pub document_id: String,
    pub document_title: String,
    pub chunk_index: i32,
    pub chunk_text: String,
    /// Cosine similarity to the query (0.0–1.0).
    pub score: f32,
}

/// Indexing progress event payload.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RagIndexProgress {
    pub current: u32,
    pub total: u32,
    pub document_id: String,
    pub document_title: String,
    pub chunks_embedded: u32,
}

/// Status of the RAG index for the configured provider+model.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RagIndexStatus {
    pub indexed_documents: i64,
    pub total_documents: i64,
    pub total_chunks: i64,
    pub provider: String,
    pub model: String,
    /// Non-archived documents with no extractable text content (can't be indexed).
    pub documents_without_content: i64,
}

/// Response from `rag_chat`.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RagChatResponse {
    pub answer: String,
    /// Ordered citations; `citations[i]` corresponds to marker `[i+1]`.
    pub citations: Vec<RagHit>,
}

/// Optional RAG settings applied to a single call (chunk size, top-k, etc.).
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RagOptions {
    pub chunk_size: Option<usize>,
    pub chunk_overlap: Option<usize>,
    pub top_k: Option<usize>,
    pub min_similarity: Option<f32>,
}

fn chunk_hash(text: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(text.as_bytes());
    hex::encode(hasher.finalize())
}

/// Conservative per-chunk character cap. The OpenAI/OpenRouter embedding
/// models enforce an 8192-token input limit, but the tokens-per-char ratio
/// varies wildly by content (English prose ≈4 chars/token, code/CJK/base64
/// can be ≈1-2 chars/token). We use a deliberately small 8000-char ceiling
/// (≈2000-4000 tokens even for dense content) so the splitter alone handles
/// the vast majority of cases. The batch retry loop below is the backstop for
/// anything that still slips through.
const MAX_CHUNK_CHARS: usize = 8_000;

/// Rough token estimate (~4 chars/token for English). Used only to decide
/// whether to split a chunk further — never for billing.
fn approx_tokens(text: &str) -> usize {
    text.len() / 4
}

/// Split a chunk that exceeds the embedding token limit into smaller pieces,
/// preferring sentence boundaries. Returns 1+ sub-chunks each under the cap.
fn split_oversized_chunk(text: &str) -> Vec<String> {
    if text.chars().count() <= MAX_CHUNK_CHARS {
        return vec![text.to_string()];
    }

    // Try splitting on sentence boundaries first.
    let sentences: Vec<&str> = text.split_inclusive(|c: char| c == '.' || c == '!' || c == '?').collect();
    if sentences.len() > 1 {
        let mut out: Vec<String> = Vec::new();
        let mut current = String::new();
        for sent in sentences {
            if current.chars().count() + sent.chars().count() > MAX_CHUNK_CHARS && !current.is_empty() {
                out.push(std::mem::take(&mut current));
            }
            current.push_str(sent);
        }
        if !current.is_empty() {
            out.push(current);
        }
        // Recursively guard against a single sentence longer than the cap.
        return out.iter().flat_map(|s| split_oversized_chunk(s)).collect();
    }

    // Fallback: hard-split on character boundaries.
    let chars: Vec<char> = text.chars().collect();
    chars
        .chunks(MAX_CHUNK_CHARS)
        .map(|c| c.iter().collect())
        .collect()
}

/// Index a single document: chunk its content, embed each chunk (skipping
/// unchanged chunks via content-hash staleness), and upsert into
/// `document_chunk_embeddings`.
#[tauri::command]
pub async fn rag_index_document(
    document_id: String,
    config: EmbeddingConfigInput,
    options: Option<RagOptions>,
    repo: State<'_, Repository>,
) -> Result<u32> {
    index_document_inner(&repo, &document_id, &config, &options).await
}

/// Core indexing logic, callable from both the Tauri command and the
/// collection loop without needing a `State<Repository>` wrapper.
async fn index_document_inner(
    repo: &Repository,
    document_id: &str,
    config: &EmbeddingConfigInput,
    options: &Option<RagOptions>,
) -> Result<u32> {
    let doc = repo
        .get_document(document_id)
        .await?
        .ok_or_else(|| IncrementumError::NotFound(format!("Document {}", document_id)))?;

    let content = doc.content.clone().unwrap_or_default();
    if content.trim().is_empty() {
        return Ok(0);
    }

    let provider = build_provider(&config)?;
    let provider_str = provider_name(&config);
    let model_str = model_name(&config);

    // Chunk the document.
    let seg_config = SegmentConfig {
        method: SegmentationMethod::Smart,
        target_length: options.as_ref().and_then(|o| o.chunk_size).unwrap_or(200),
        overlap: options.as_ref().and_then(|o| o.chunk_overlap).unwrap_or(20),
        min_length: 20,
        max_length: 1000,
    };
    let segments = DocumentSegmenter::new(seg_config)
        .segment(&content)
        .map_err(|e| IncrementumError::Internal(format!("segmentation failed: {e}")))?;

    // Find which chunks are stale (new or content-hash changed), then split
    // any that exceed the embedding model's token limit into sub-chunks so a
    // single oversized chunk can't fail the whole batch (OpenAI/OpenRouter
    // reject inputs > 8192 tokens with an opaque 400).
    let stored = repo
        .get_stored_chunk_hashes(&document_id, &provider_str, &model_str)
        .await?;
    let stale_set: std::collections::HashSet<usize> = segments
        .segments
        .iter()
        .enumerate()
        .filter(|(idx, seg)| {
            let h = chunk_hash(&seg.content);
            stored.get(&(*idx as i32)).map_or(true, |sh| sh != &h)
        })
        .map(|(idx, _)| idx)
        .collect();

    // Flatten stale segments into (chunk_index, sub_index, text) triples,
    // expanding oversized chunks. Sub-index disambiguates split pieces so each
    // gets its own row id. Clear any existing rows for stale indices first so
    // split pieces don't leave orphaned single-row predecessors.
    let mut to_embed: Vec<(usize, usize, String)> = Vec::new();
    for (idx, seg) in segments.segments.iter().enumerate() {
        if !stale_set.contains(&idx) {
            continue;
        }
        repo.delete_chunk_embeddings_for_index(&document_id, idx as i32)
            .await?;
        for (sub, piece) in split_oversized_chunk(&seg.content).into_iter().enumerate() {
            to_embed.push((idx, sub, piece));
        }
    }

    if to_embed.is_empty() {
        return Ok(0);
    }

    // Embed in batches of 25. If a batch fails (e.g. one chunk still exceeds
    // the token limit despite splitting), fall back to embedding one-by-one so
    // a single bad chunk skips instead of failing the whole document.
    let batch_size = 25;
    let mut embedded: u32 = 0;
    let mut skipped: u32 = 0;
    let now = chrono::Utc::now().timestamp_millis();

    let store_chunk = |chunk_idx: &usize, sub_idx: &usize, text: &str, response: &crate::ai::embeddings::EmbeddingResponse| -> Result<DocumentChunkEmbedding> {
        let row_id = if *sub_idx > 0 {
            format!("{}:{}:{}", document_id, chunk_idx, sub_idx)
        } else {
            format!("{}:{}", document_id, chunk_idx)
        };
        Ok(DocumentChunkEmbedding {
            id: row_id,
            document_id: document_id.to_string(),
            chunk_index: *chunk_idx as i32,
            chunk_text: text.to_string(),
            embedding: response.embedding.clone(),
            content_hash: chunk_hash(text),
            provider: provider_str.clone(),
            model: model_str.clone(),
            dimension: response.dimension as i32,
            created_at: now,
        })
    };

    'batch_loop: for batch in to_embed.chunks(batch_size) {
        let texts: Vec<String> = batch.iter().map(|(_, _, text)| text.clone()).collect();

        // Try the whole batch first.
        match provider.generate_embeddings_batch(&texts).await {
            Ok(responses) => {
                for ((chunk_idx, sub_idx, text), response) in batch.iter().zip(responses.iter()) {
                    let emb = store_chunk(chunk_idx, sub_idx, text, response)?;
                    repo.upsert_chunk_embedding(&emb).await?;
                    embedded += 1;
                }
                continue 'batch_loop;
            }
            Err(batch_err) => {
                tracing::warn!(
                    "RAG batch failed ({} chunks), falling back to one-by-one: {}",
                    batch.len(),
                    batch_err
                );
            }
        }

        // Fallback: embed each chunk individually, skip failures.
        for (chunk_idx, sub_idx, text) in batch {
            match provider.generate_embedding(text).await {
                Ok(response) => {
                    let emb = store_chunk(chunk_idx, sub_idx, text, &response)?;
                    repo.upsert_chunk_embedding(&emb).await?;
                    embedded += 1;
                }
                Err(err) => {
                    tracing::warn!(
                        "RAG: skipping chunk {}:{}:{} ({} chars) — embedding failed: {}",
                        document_id, chunk_idx, sub_idx, text.chars().count(), err
                    );
                    skipped += 1;
                }
            }
        }
    }

    tracing::info!("RAG indexed {}: {} embedded, {} skipped", document_id, embedded, skipped);
    Ok(embedded)
}

/// Index every non-archived document in the active collection.
#[tauri::command]
pub async fn rag_index_collection(
    config: EmbeddingConfigInput,
    options: Option<RagOptions>,
    collection_id: Option<String>,
    repo: State<'_, Repository>,
    app: AppHandle,
) -> Result<u32> {
    let cid = match collection_id {
        Some(c) => c,
        None => repo.get_default_collection_id().await?,
    };
    let docs = repo.list_documents_by_collection(&cid).await?;
    // Only count non-archived docs in the total so progress and status agree.
    let indexable: Vec<&crate::models::Document> = docs.iter().filter(|d| !d.is_archived).collect();
    let total = indexable.len() as u32;
    let mut total_embedded: u32 = 0;
    let mut failed: u32 = 0;

    for (i, doc) in indexable.iter().enumerate() {
        // Index each document; on failure, log + continue so one bad document
        // doesn't abort the whole collection index.
        let embedded = match index_document_inner(repo.inner(), &doc.id, &config, &options).await {
            Ok(n) => n,
            Err(e) => {
                tracing::warn!("RAG: failed to index document {} ({}): {}", doc.id, doc.title, e);
                failed += 1;
                0
            }
        };

        total_embedded += embedded;
        let _ = app.emit(
            "rag-index-progress",
            RagIndexProgress {
                current: (i + 1) as u32,
                total,
                document_id: doc.id.clone(),
                document_title: doc.title.clone(),
                chunks_embedded: embedded,
            },
        );
    }

    tracing::info!(
        "RAG collection index complete: {} embedded across {} documents, {} failed",
        total_embedded, total, failed
    );
    Ok(total_embedded)
}

/// Report RAG index status for the configured provider+model.
#[tauri::command]
pub async fn rag_index_status(
    config: EmbeddingConfigInput,
    repo: State<'_, Repository>,
) -> Result<RagIndexStatus> {
    let provider_str = provider_name(&config);
    let model_str = model_name(&config);

    let indexed_documents = repo
        .count_indexed_documents(&provider_str, &model_str)
        .await?;
    let total_chunks = repo
        .count_chunk_embeddings(&provider_str, &model_str)
        .await?;

    // Total documents in the active collection (denominator) + how many lack
    // extractable text content (can't be indexed — e.g. scanned PDFs without OCR).
    let cid = repo.get_default_collection_id().await?;
    let indexable: Vec<crate::models::Document> = repo
        .list_documents_by_collection(&cid)
        .await?
        .into_iter()
        .filter(|d| !d.is_archived)
        .collect();
    let total_documents = indexable.len() as i64;
    let documents_without_content = indexable
        .iter()
        .filter(|d| d.content.as_deref().map_or(true, |c| c.trim().is_empty()))
        .count() as i64;

    Ok(RagIndexStatus {
        indexed_documents,
        total_documents,
        total_chunks,
        provider: provider_str,
        model: model_str,
        documents_without_content,
    })
}

/// Embed the query and retrieve the top-k most-similar document chunks.
#[tauri::command]
pub async fn rag_search(
    query: String,
    document_ids: Option<Vec<String>>,
    config: EmbeddingConfigInput,
    options: Option<RagOptions>,
    repo: State<'_, Repository>,
) -> Result<Vec<RagHit>> {
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }

    let provider = build_provider(&config)?;
    let provider_str = provider_name(&config);
    let model_str = model_name(&config);
    let top_k = options.as_ref().and_then(|o| o.top_k).unwrap_or(8);
    let min_sim = options.as_ref().and_then(|o| o.min_similarity).unwrap_or(0.25);

    // Embed the query.
    let query_resp = provider
        .generate_embedding(&query)
        .await
        .map_err(IncrementumError::Internal)?;
    let query_vec = query_resp.embedding;

    // Load candidate chunk embeddings.
    let docs_ref = document_ids.as_deref();
    let chunks = repo
        .get_chunk_embeddings(docs_ref, &provider_str, &model_str)
        .await?;

    if chunks.is_empty() {
        return Ok(Vec::new());
    }

    // Resolve document titles in one pass.
    let mut titles: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    for chunk in &chunks {
        if !titles.contains_key(&chunk.document_id) {
            if let Ok(Some(doc)) = repo.get_document(&chunk.document_id).await {
                titles.insert(chunk.document_id.clone(), doc.title);
            }
        }
    }

    // Score + rank.
    let mut scored: Vec<RagHit> = chunks
        .iter()
        .map(|chunk| RagHit {
            document_id: chunk.document_id.clone(),
            document_title: titles
                .get(&chunk.document_id)
                .cloned()
                .unwrap_or_else(|| "Unknown".to_string()),
            chunk_index: chunk.chunk_index,
            chunk_text: chunk.chunk_text.clone(),
            score: cosine_similarity(&query_vec, &chunk.embedding),
        })
        .filter(|hit| hit.score >= min_sim)
        .collect();

    scored.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(top_k);

    Ok(scored)
}

/// Retrieve relevant chunks and feed them as grounded context to the LLM,
/// returning an answer plus the citations it was grounded on.
#[tauri::command]
pub async fn rag_chat(
    query: String,
    document_ids: Option<Vec<String>>,
    history: Vec<LLMMessage>,
    config: EmbeddingConfigInput,
    options: Option<RagOptions>,
    llm_provider: String,
    llm_model: Option<String>,
    llm_api_key: Option<String>,
    llm_base_url: Option<String>,
    repo: State<'_, Repository>,
) -> Result<RagChatResponse> {
    let top_k = options.as_ref().and_then(|o| o.top_k).unwrap_or(8);
    let hits = rag_search(
        query.clone(),
        document_ids,
        config,
        Some(RagOptions {
            top_k: Some(top_k),
            ..Default::default()
        }),
        repo.clone(),
    )
    .await?;

    // Assemble grounded context with [1], [2]… citation markers.
    let context_block = if hits.is_empty() {
        "No relevant passages were found in the library for this question. Answer from general knowledge and say you found nothing in the user's notes.".to_string()
    } else {
        let mut block = String::from("Relevant passages from the user's library:\n\n");
        for (i, hit) in hits.iter().enumerate() {
            block.push_str(&format!(
                "[{}] (from \"{}\")\n{}\n\n",
                i + 1,
                hit.document_title,
                hit.chunk_text.trim()
            ));
        }
        block.push_str("Cite sources using the [N] marker numbers above when you use a passage.");
        block
    };

    let system_prompt = format!(
        "You are a knowledgeable assistant answering questions about the user's personal library. \
Use the provided context passages to ground your answer. Cite sources by their [N] marker. \
If the context doesn't contain the answer, say so.\n\n{context_block}"
    );

    // Build the message list: system + history + the current query.
    let mut messages: Vec<LLMMessage> = Vec::with_capacity(history.len() + 2);
    messages.push(LLMMessage {
        role: "system".to_string(),
        content: LLMMessageContent::Text(system_prompt),
    });
    messages.extend(history.into_iter().filter(|m| m.role != "system"));
    messages.push(LLMMessage {
        role: "user".to_string(),
        content: LLMMessageContent::Text(query),
    });

    let response: LLMResponse = llm_chat(
        llm_provider,
        llm_model,
        messages,
        0.4,
        1024,
        llm_api_key,
        llm_base_url,
    )
    .await
    .map_err(IncrementumError::Internal)?;

    Ok(RagChatResponse {
        answer: response.content,
        citations: hits,
    })
}
