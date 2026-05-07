# Spec: Database Migration for Podcast Transcripts

## Migration SQL

```sql
ALTER TABLE podcast_episodes ADD COLUMN transcript_text TEXT DEFAULT NULL;
ALTER TABLE podcast_episodes ADD COLUMN transcript_status TEXT DEFAULT 'none';
ALTER TABLE podcast_episodes ADD COLUMN transcript_error TEXT DEFAULT NULL;
ALTER TABLE podcast_episodes ADD COLUMN transcribed_at TEXT DEFAULT NULL;

ALTER TABLE podcast_feeds ADD COLUMN auto_transcribe BOOLEAN DEFAULT 0;
ALTER TABLE podcast_feeds ADD COLUMN transcribe_language TEXT DEFAULT NULL;
```

## PodcastEpisodeResponse changes
Add fields:
- `transcript_text: Option<String>`
- `transcript_status: String` (defaults to "none")
- `transcript_error: Option<String>`
- `transcribed_at: Option<String>`

## PodcastFeedResponse changes
Add fields:
- `auto_transcribe: bool`
- `transcribe_language: Option<String>`

## Constraints
- `transcript_status` must be one of: 'none', 'downloading', 'transcribing', 'done', 'error'
- `transcript_text` can be large (30min podcast ≈ 30KB of text) — no size limit needed, SQLite handles it fine
