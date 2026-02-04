-- Migration: Add Semantic Search tables for transcript embeddings

-- Transcript chunks for embedding
CREATE TABLE IF NOT EXISTS transcript_chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    start_time REAL,
    end_time REAL,
    speaker TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Embeddings stored separately
CREATE TABLE IF NOT EXISTS transcript_embeddings (
    chunk_id TEXT PRIMARY KEY,
    embedding BLOB NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    dimension INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (chunk_id) REFERENCES transcript_chunks(id) ON DELETE CASCADE
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_document ON transcript_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_speaker ON transcript_chunks(speaker);

-- Index for embedding lookups by provider/model
CREATE INDEX IF NOT EXISTS idx_transcript_embeddings_provider ON transcript_embeddings(provider, model);
