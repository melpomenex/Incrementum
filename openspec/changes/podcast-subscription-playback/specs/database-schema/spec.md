## Spec: Podcast Database Schema

### `podcast_feeds` table

```sql
CREATE TABLE IF NOT EXISTS podcast_feeds (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    author TEXT,
    language TEXT,
    link TEXT,
    feed_url TEXT NOT NULL UNIQUE,
    last_fetched TEXT,          -- ISO 8601 datetime of last successful fetch
    subscribed_at TEXT NOT NULL DEFAULT (datetime('now')),
    sort_order INTEGER DEFAULT 0
);
```

### `podcast_episodes` table

```sql
CREATE TABLE IF NOT EXISTS podcast_episodes (
    id TEXT PRIMARY KEY,
    feed_id TEXT NOT NULL REFERENCES podcast_feeds(id) ON DELETE CASCADE,
    guid TEXT,                  -- podcast GUID for dedup (unique per feed)
    title TEXT NOT NULL,
    description TEXT,
    published_date TEXT,        -- ISO 8601
    duration INTEGER,           -- seconds
    audio_url TEXT NOT NULL,
    audio_type TEXT,            -- MIME type
    file_size INTEGER,          -- bytes
    image_url TEXT,
    link TEXT,
    played INTEGER NOT NULL DEFAULT 0,
    playback_position REAL DEFAULT 0.0,  -- seconds
    date_added TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(feed_id, guid)
);
```

### Indices

```sql
CREATE INDEX IF NOT EXISTS idx_podcast_episodes_feed ON podcast_episodes(feed_id);
CREATE INDEX IF NOT EXISTS idx_podcast_episodes_played ON podcast_episodes(feed_id, played);
CREATE INDEX IF NOT EXISTS idx_podcast_episodes_published ON podcast_episodes(published_date);
```
