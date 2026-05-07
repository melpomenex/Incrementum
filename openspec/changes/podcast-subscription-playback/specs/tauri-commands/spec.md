## Spec: Podcast Tauri Commands

### `subscribe_podcast(feed_url: String) -> Result<PodcastFeed>`

1. Check if `feed_url` already exists in `podcast_feeds` — return existing if so.
2. Fetch the RSS feed via `reqwest::get(&feed_url)` with a 30s timeout.
3. Parse the XML response as RSS 2.0 with iTunes namespace support.
4. Extract channel metadata (title, description, image, author, language, link).
5. Extract all `<item>` entries as episodes (guid, title, description, pubDate, enclosure/audioUrl, duration, imageUrl).
6. Insert `podcast_feed` row.
7. Bulk-insert `podcast_episodes` rows (dedup by feed_id + guid).
8. Return the populated `PodcastFeed` with all episodes.

### `unsubscribe_podcast(feed_id: String) -> Result<()>`

1. Delete from `podcast_feeds` (CASCADE deletes episodes).
2. Return `Ok(())`.

### `get_podcast_feeds() -> Result<Vec<PodcastFeed>>`

1. `SELECT * FROM podcast_feeds ORDER BY sort_order, subscribed_at`.
2. For each feed, optionally load episode count (unplayed count for badge).
3. Return feeds.

### `refresh_podcast_feed(feed_id: String) -> Result<PodcastFeed>`

1. Fetch the feed's `feed_url` via reqwest.
2. Parse and upsert episodes (preserve `played`, `playback_position` on existing).
3. Update `last_fetched`.
4. Return updated feed with all episodes.

### `get_podcast_episodes(feed_id: String, include_played: Option<bool>) -> Result<Vec<PodcastEpisode>>`

1. Query episodes by `feed_id`, ordered by `published_date DESC`.
2. If `include_played == Some(false)`, add `WHERE played = 0`.
3. Return episodes.

### `mark_episode_played(episode_id: String, played: bool) -> Result<()>`

1. Update `played` column.
2. Return `Ok(())`.

### `update_episode_position(episode_id: String, position: f64) -> Result<()>`

1. Update `playback_position`.
2. Return `Ok(())`.

### `get_episode_position(episode_id: String) -> Result<f64>`

1. Return `playback_position` for the episode.

### RSS Parsing Requirements

- Handle standard RSS 2.0 `<channel>` / `<item>` elements.
- Parse iTunes namespace: `<itunes:title>`, `<itunes:image>`, `<itunes:author>`, `<itunes:duration>`, `<itunes:summary>`, `<itunes:category>`.
- Parse `<enclosure url="" type="" length="">` for audio.
- Parse `<guid>` for episode deduplication.
- Graceful error handling for malformed feeds.
- Use `quick-xml` crate (already a dependency in the Rust project via epub/tauri ecosystem) or `rss` crate.
