## ADDED Requirements

### Requirement: Document chunk embeddings are persisted
The system SHALL maintain a `document_chunk_embeddings` table with columns: `id` (TEXT PK), `document_id` (TEXT), `chunk_index` (INTEGER), `chunk_text` (TEXT), `embedding` (BLOB, f32 little-endian), `content_hash` (TEXT), `provider` (TEXT), `model` (TEXT), `dimension` (INTEGER), `created_at` (INTEGER). Indexes SHALL exist on `(provider, model)`, `document_id`, and `content_hash`.

#### Scenario: Fresh database gets the table on migration
- **WHEN** migration `051` runs on a fresh database
- **THEN** the `document_chunk_embeddings` table and its three indexes SHALL exist

### Requirement: RAG indexing chunks and embeds a document
The `rag_index_document(document_id, config)` command SHALL: (1) load the document's text content, (2) chunk it via `DocumentSegmenter` (smart strategy, configurable size/overlap), (3) skip chunks whose `content_hash` matches the stored hash for the same provider+model (staleness), (4) embed new/stale chunks in batches via the configured provider, (5) upsert into `document_chunk_embeddings`. It SHALL return the count of chunks embedded.

#### Scenario: Indexing an unseen document embeds all chunks
- **WHEN** `rag_index_document` is called on a document with no existing chunks for the configured provider+model
- **THEN** every chunk SHALL be embedded and stored

#### Scenario: Re-indexing an unchanged document is a no-op
- **WHEN** `rag_index_document` is called on a document whose chunks all have matching content hashes
- **THEN** zero chunks SHALL be embedded (returns 0)

### Requirement: Collection-level indexing iterates all documents
The `rag_index_collection(config)` command SHALL index every non-archived document in the active collection via `rag_index_document`. It SHALL emit `rag-index-progress` events with `{ current, total, document_id }`.

#### Scenario: Collection index processes all documents
- **WHEN** `rag_index_collection` is called on a collection with 50 documents
- **THEN** all 50 documents SHALL be chunked and embedded, and 50 progress events SHALL be emitted

### Requirement: RAG search returns top-k relevant chunks
The `rag_search(query, document_ids, limit, config)` command SHALL: (1) embed the query via the configured provider, (2) load chunk embeddings (filtered by `document_ids` when provided, else all), (3) compute cosine similarity between the query and each chunk, (4) return the top-`limit` chunks above `minSimilarity` as `RagHit { document_id, document_title, chunk_index, chunk_text, score }`, sorted by descending score.

#### Scenario: Whole-library search returns ranked chunks
- **WHEN** `rag_search("mitochondria", None, 8, config)` is called against an indexed library
- **THEN** up to 8 chunks mentioning mitochondria SHALL be returned, highest-score first

#### Scenario: Scoped search filters by document set
- **WHEN** `rag_search` is called with `document_ids = ["doc-1", "doc-2"]`
- **THEN** only chunks belonging to those documents SHALL be considered

### Requirement: RAG chat grounds answers in retrieved chunks with citations
The `rag_chat(query, document_ids, history, config, llm_settings)` command SHALL: (1) run `rag_search` to retrieve top-k chunks, (2) assemble them into a grounded context string with `[1]`, `[2]`… citation markers, (3) call the LLM with a system prompt instructing it to cite sources by marker number, (4) return `{ answer, citations: Vec<RagHit> }` where `citations[i]` corresponds to marker `[i+1]`.

#### Scenario: Answer cites retrieved sources
- **WHEN** `rag_chat` retrieves 3 chunks and the LLM references the second one
- **THEN** the answer SHALL contain marker `[2]` and `citations[1]` SHALL be that chunk's `RagHit`

#### Scenario: No relevant chunks yields an ungrounded or "not found" answer
- **WHEN** `rag_chat` retrieves zero chunks above `minSimilarity`
- **THEN** the LLM SHALL be informed that no relevant context was found, and `citations` SHALL be empty

### Requirement: Embedding provider is user-configurable (cloud or local)
The system SHALL persist embedding settings (`provider`, `model`, `chunkSize`, `chunkOverlap`, `topK`, `minSimilarity`, `ollamaBaseUrl`). API keys for cloud providers SHALL be read from the existing `AIKeyStore`. The user SHALL be able to select any provider (OpenAI, Cohere, OpenRouter, or Ollama for local) regardless of which keys exist; Ollama requires only a base URL.

#### Scenario: User selects local Ollama provider
- **WHEN** the user sets `provider = "ollama"` with `ollamaBaseUrl = "http://localhost:11434"`
- **THEN** RAG indexing and search SHALL use the local Ollama daemon with no API key required

#### Scenario: User selects cloud OpenAI provider
- **WHEN** the user sets `provider = "openai"` and an OpenAI key exists in `AIKeyStore`
- **THEN** RAG indexing and search SHALL call the OpenAI embeddings API

### Requirement: Assistant offers a whole-library chat scope
The `AssistantPanel` SHALL offer a scope selector with at least two modes: "This document" (existing single-document behavior) and "Whole library" (RAG-backed). When "Whole library" is selected, chat SHALL call `rag_chat` and render the returned citations beneath the answer.

#### Scenario: User switches to whole-library scope
- **WHEN** the user selects "Whole library" scope and asks a question
- **THEN** the assistant SHALL retrieve relevant chunks across the collection and answer with citations

### Requirement: Changing embedding model invalidates stale vectors
When the configured `provider` or `model` changes, chunks indexed under the previous provider+model SHALL be considered stale (the `(provider, model)` index allows coexistence, but search filters to the currently configured pair, so old vectors are effectively invisible until re-indexed).

#### Scenario: Switching models requires re-indexing
- **WHEN** the user switches from `text-embedding-3-small` to `nomic-embed-text` and searches without re-indexing
- **THEN** `rag_search` SHALL return no results (no chunks exist for the new provider+model) until `rag_index_collection` is run
