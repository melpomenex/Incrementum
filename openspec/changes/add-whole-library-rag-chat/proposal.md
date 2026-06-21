# Change: Whole-Library RAG Chat

## Why

Readwise Reader's Ghostreader v3 (Dec 2025) made whole-library chat a flagship feature. Today Incrementum's main `AssistantPanel` is per-document only (`chatWithContext` with a single resolved context, `AssistantPanel.tsx:979`); the closest thing is `DocumentQATab.tsx:481`, which merely *tells the LLM* "search across all documents" without actually retrieving anything.

This change adds true retrieval-augmented generation (RAG) over the user's whole collection: embed document chunks, retrieve the top-k most relevant at query time, and feed them as grounded context to the LLM — with citations back to source documents.

The embedding infrastructure already exists and is reused: four providers (`OpenAI`, `Cohere`, `OpenRouter`, `Ollama` for local) in `ai/embeddings.rs`, the `EmbeddingProvider` trait, batch generation, and a content-hash staleness pattern from `semantic_graph.rs`. What's missing — and what this change builds — is a chunk-level vector table, indexing triggers, a top-k retrieval command, and a first-class "Whole library" scope in the assistant.

## What Changes

### 1. Chunk-level embeddings table
- New migration `051_add_document_chunk_embeddings.sql` creating `document_chunk_embeddings`:
  `id TEXT PK, document_id TEXT, chunk_index INTEGER, chunk_text TEXT, embedding BLOB, content_hash TEXT, provider TEXT, model TEXT, dimension INTEGER, created_at INTEGER`.
- Indexes on `(provider, model)`, `document_id`, and `content_hash`.
- Reuses the f32→LE-bytes serialization pattern from `queue_item_embeddings`.

### 2. Shared provider builder
- Lift the private `get_provider`/`provider_name`/`model_name` helpers out of `semantic_graph.rs` into a shared module (`ai/embeddings.rs` or a new `ai/embedding_config.rs`) so both the semantic graph and RAG can build a provider from `EmbeddingConfigInput` without duplication.

### 3. RAG indexing command
- `rag_index_document(document_id, config) -> u32`: chunks the document's content via the existing `DocumentSegmenter` (`segmentation.rs`, `segment_smart` strategy by default), embeds each chunk in batches, and upserts into `document_chunk_embeddings`. Uses content-hash staleness to skip unchanged chunks. Returns count embedded.
- `rag_index_collection(config) -> u32`: iterates all documents in the active collection, calling `rag_index_document`. Emits `rag-index-progress` events.
- `rag_index_status() -> RagIndexStatus`: returns `{ indexed_documents, total_documents, total_chunks, provider, model }`.

### 4. RAG retrieval command
- `rag_search(query, document_ids?, limit, config) -> Vec<RagHit>`: embeds the query, loads candidate chunk embeddings (optionally filtered by `document_ids`), computes cosine similarity in Rust, returns top-k `RagHit { document_id, document_title, chunk_index, chunk_text, score }`.
- Brute-force cosine is acceptable for v1 (matches the existing `find_similar` approach); a future iteration can add sqlite-vec/ANN.

### 5. RAG chat command
- `rag_chat(query, document_ids?, conversation_history, config, llm_settings) -> RagChatResponse`: runs `rag_search`, assembles the top-k chunks into a grounded context string with `[1]`, `[2]`… citation markers, then calls the LLM via the existing chat path. Returns `{ answer, citations: Vec<RagHit> }`.
- System prompt instructs the model to cite sources by their marker numbers.

### 6. Embedding settings
- New `embeddingSettings` in both settings layers: `{ provider, model, apiKey (stored via AIKeyStore), ollamaBaseUrl, chunkSize, chunkOverlap, topK, minSimilarity }`.
- Defaults: provider resolved from AIKeyStore (OpenAI if key present, else OpenRouter, else Ollama local), `chunkSize: 200` words, `chunkOverlap: 20`, `topK: 8`, `minSimilarity: 0.25`.
- User can explicitly choose cloud (OpenAI/Cohere/OpenRouter) or local (Ollama) regardless of which keys exist.

### 7. Frontend
- `src/api/rag.ts`: wrappers for `rag_index_document`, `rag_index_collection`, `rag_index_status`, `rag_search`, `rag_chat`.
- `src/stores/ragStore.ts`: index status, last results, loading flags.
- `AssistantPanel.tsx`: new scope selector — "This document" (existing) vs **"Whole library"** (new). When "Whole library" is selected, chat calls `rag_chat` and renders citations beneath the answer.
- Citation chips are clickable to open the source document (deep-link to reader is a stretch goal; minimum: show document title + chunk snippet tooltip).
- Settings UI for embedding provider/model/chunk-size/top-k under a new "Embeddings & RAG" settings section.

## Impact

### Affected Specs
- **whole-library-rag-chat** — New spec for the RAG indexing, retrieval, and chat contracts.

### Affected Code Areas
- `src-tauri/migrations/051_add_document_chunk_embeddings.sql` — New.
- `src-tauri/src/database/migrations.rs` — Add migration `051`.
- `src-tauri/src/database/repository.rs` — Chunk embedding CRUD + top-k cosine search.
- `src-tauri/src/commands/rag.rs` — New command module (`rag_index_document`, `rag_index_collection`, `rag_index_status`, `rag_search`, `rag_chat`).
- `src-tauri/src/ai/embeddings.rs` (or new `embedding_config.rs`) — Shared `build_provider` helper.
- `src-tauri/src/lib.rs` — Register RAG commands.
- `src/types/settings.ts` + `src/stores/settingsStore.ts` — `embeddingSettings`.
- `src/api/rag.ts` — New.
- `src/stores/ragStore.ts` — New.
- `src/components/assistant/AssistantPanel.tsx` — Scope selector + citation rendering.
- `src/components/settings/EmbeddingSettings.tsx` — New settings section.

### Non-goals
- No sqlite-vec/ANN index (brute-force cosine for v1; the existing `find_similar` uses the same approach).
- No automatic background re-indexing scheduler (manual trigger this iteration; matches the existing semantic-graph pattern).
- No re-embedding on every document edit (content-hash staleness skips unchanged chunks; edited chunks get re-embedded on next manual index).
- No multi-modal RAG (images/figures) — text chunks only.
- Citation deep-linking into the exact reader position is a stretch goal; v1 shows the source document title + chunk snippet.
