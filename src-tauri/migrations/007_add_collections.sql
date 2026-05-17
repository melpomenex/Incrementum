-- Migration: Add collections for data partitioning

-- Collections table
CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    is_default BOOLEAN NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed the default "Personal" collection using a fixed UUID
INSERT OR IGNORE INTO collections (id, name, is_default, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'Personal', 1, datetime('now'), datetime('now'));

-- Add collection_id to core tables and backfill with default collection
ALTER TABLE documents ADD COLUMN collection_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES collections(id);
ALTER TABLE extracts ADD COLUMN collection_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES collections(id);
ALTER TABLE learning_items ADD COLUMN collection_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES collections(id);
ALTER TABLE review_sessions ADD COLUMN collection_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES collections(id);
ALTER TABLE review_results ADD COLUMN collection_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES collections(id);
ALTER TABLE annotations ADD COLUMN collection_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES collections(id);
ALTER TABLE categories ADD COLUMN collection_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES collections(id);
ALTER TABLE transcript_chunks ADD COLUMN collection_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES collections(id);
ALTER TABLE transcript_embeddings ADD COLUMN collection_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES collections(id);

-- Indexes for collection-scoped queries
CREATE INDEX IF NOT EXISTS idx_documents_collection ON documents(collection_id);
CREATE INDEX IF NOT EXISTS idx_extracts_collection ON extracts(collection_id);
CREATE INDEX IF NOT EXISTS idx_learning_items_collection ON learning_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_review_sessions_collection ON review_sessions(collection_id);
CREATE INDEX IF NOT EXISTS idx_review_results_collection ON review_results(collection_id);
CREATE INDEX IF NOT EXISTS idx_annotations_collection ON annotations(collection_id);
CREATE INDEX IF NOT EXISTS idx_categories_collection ON categories(collection_id);
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_collection ON transcript_chunks(collection_id);
CREATE INDEX IF NOT EXISTS idx_transcript_embeddings_collection ON transcript_embeddings(collection_id);
