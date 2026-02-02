-- Migration: Add Transcription tables

CREATE TABLE transcripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id TEXT NOT NULL,
    chapter_id TEXT NOT NULL,
    model_used TEXT NOT NULL,
    language TEXT NOT NULL,
    status TEXT NOT NULL, -- 'pending', 'processing', 'completed', 'failed'
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(book_id, chapter_id)
);

CREATE TABLE transcript_segments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transcript_id INTEGER NOT NULL,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    text TEXT NOT NULL,
    confidence REAL,
    FOREIGN KEY(transcript_id) REFERENCES transcripts(id) ON DELETE CASCADE
);

CREATE INDEX idx_transcript_segments_time ON transcript_segments(transcript_id, start_ms);
