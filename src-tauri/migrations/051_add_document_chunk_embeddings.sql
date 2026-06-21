-- Whole-library RAG chat: chunk-level embeddings for documents.
-- Each document is chunked (via DocumentSegmenter) and each chunk is embedded
-- and stored here. Top-k cosine similarity over these vectors powers rag_search
-- and rag_chat. Coexists with queue_item_embeddings (item-level, for the
-- semantic graph) — different granularity, different purpose.

CREATE TABLE IF NOT EXISTS document_chunk_embeddings (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding BLOB NOT NULL,
    content_hash TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    dimension INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_provider_model
    ON document_chunk_embeddings(provider, model);

CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_document
    ON document_chunk_embeddings(document_id);

CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_hash
    ON document_chunk_embeddings(content_hash);
