-- Store vector embeddings for queue items (documents, extracts, flashcards)
-- used for semantic similarity computation in the review queue graph.
CREATE TABLE IF NOT EXISTS queue_item_embeddings (
    item_id TEXT PRIMARY KEY,
    embedding BLOB NOT NULL,
    content_hash TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    dimension INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_queue_item_embeddings_content_hash
    ON queue_item_embeddings(content_hash);
