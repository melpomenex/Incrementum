## Why

The app has a fully built podcast UI shell (`PodcastManager.tsx`, `PodcastPage.tsx`, `api/podcast.ts`) with feed parsing, subscribe/unsubscribe, episode browsing, discovery, and i18n across all locales — but it's completely disconnected from the backend. Subscriptions live in `localStorage`, feed parsing uses a browser CORS proxy (`allorigins.win`), there are no SQLite tables for podcasts, the page isn't wired into the router, and there's no audio playback. Meanwhile, Incrementum already has a capable `AudiobookViewer` component and Whisper transcription pipeline that could handle podcast episodes. Wiring the existing pieces together would unlock podcast consumption as a first-class content type alongside books, articles, and RSS feeds.

## What Changes

### 1. Backend: SQLite podcast tables and Tauri commands

- Create `podcast_feeds` table: `id`, `title`, `description`, `image_url`, `author`, `language`, `link`, `feed_url`, `last_fetched`, `subscribed_at`, `sort_order`.
- Create `podcast_episodes` table: `id`, `feed_id`, `guid`, `title`, `description`, `published_date`, `duration`, `audio_url`, `audio_type`, `file_size`, `image_url`, `link`, `played`, `playback_position`, `date_added`.
- Add Tauri commands: `subscribe_podcast`, `unsubscribe_podcast`, `get_podcast_feeds`, `refresh_podcast_feed`, `get_podcast_episodes`, `mark_episode_played`, `update_episode_position`, `search_podcasts`.
- Feed fetching should happen server-side in Rust (via `reqwest`) — no more CORS proxy dependency.
- On subscribe: fetch & parse the RSS feed server-side, insert feed + episodes into DB. Return the populated feed.
- On refresh: fetch feed, upsert new episodes, preserve `played`/`playback_position` state on existing episodes.
- Use `opml` crate or manual parsing for RSS 2.0 + iTunes namespace podcast feeds.

### 2. Router: Wire PodcastPage into the app

- Add podcast tab/route alongside existing tabs (Documents, Queue, Review, RSS, Settings, etc.).
- Add podcast icon to the sidebar/tab bar (use `Headphones` or `Podcast` from lucide-react).
- Connect `PodcastManager` to real backend commands instead of localStorage.

### 3. Audio playback: Reuse AudiobookViewer for episodes

- When a user clicks "Play" on an episode, open it in `DocumentViewer` with the `AudiobookViewer` renderer.
- Stream the episode audio URL directly (no local file download required for streaming).
- Persist `playback_position` to the `podcast_episodes` table so progress survives app restarts.
- Show episode title, podcast name, and duration in the player header.
- Optional: add a mini-player bar at the bottom when navigating away from the podcast player.

### 4. Feed the queue: Podcast episodes in incremental reading

- Add a queue setting (similar to RSS queue settings) to optionally include unplayed podcast episodes in the scroll queue.
- Episodes appear as audio items in scroll mode with the same `AudiobookViewer` playback.
- Use the existing `engagementScore`/`relevanceScore` pattern — recency-weighted, with classifier-style signals if users rate episodes.

### 5. Transcription: Whisper pipeline for episodes

- The existing `import_podcast_audio_file` command already tags imported audio as "podcast" and enqueues Whisper transcription.
- Extend this: when an episode is played or added to the queue, offer to transcribe it (using local Whisper, Groq, or configured provider).
- Store transcript in the document content (same as audiobook transcripts) so it's searchable.

### 6. Migration from localStorage

- On first launch with the new backend, offer to migrate existing `localStorage` subscriptions to SQLite.
- Parse stored feed URLs, re-fetch server-side, insert into DB.

## Capabilities

### New Capabilities
- `podcast-subscription`: Subscribe to podcast feeds via URL, persisted in SQLite. Server-side RSS parsing with iTunes namespace support. Feed refresh with incremental episode sync.
- `podcast-playback`: Stream podcast episodes through the existing audiobook player. Persist playback position per episode. Resume across sessions.
- `podcast-queue-integration`: Optionally surface unplayed podcast episodes in the scroll reading queue alongside documents and RSS items.
- `podcast-discovery`: Search and browse podcast feeds (initially via curated directory, later via iTunes/Apple Podcasts search API).

### Modified Capabilities
- `audiobook-playback`: `AudiobookViewer` gains ability to play remote audio URLs (streaming) in addition to local files.
- `transcription-pipeline`: Whisper transcription can be triggered for podcast episodes (not just local audio files).

## Impact

- **Backend (Rust)**: New `podcast` module with DB tables, feed fetching, and CRUD commands. ~300-400 lines of Rust.
- **Frontend**: `PodcastManager.tsx` rewritten to use Tauri commands instead of localStorage. `api/podcast.ts` gets Tauri IPC + HTTP fallback paths. `PodcastPage` wired into router.
- **AudiobookViewer**: Minor changes to accept remote audio URLs and persist position to podcast_episodes table.
- **QueueScrollPage**: Optional podcast episode inclusion in the scroll queue.
- **Migration**: One-time localStorage → SQLite migration on upgrade.
- **Data**: 2 new SQLite tables (~10 columns each). Existing `import_podcast_audio_file` command continues to work unchanged.
- **Dependencies**: `reqwest` (already in use), possibly `opml` or `rss` crate for robust feed parsing.

## Non-Goals

- OPML import/export (follow-up)
- Offline episode downloading/caching
- Chapter support
- Variable playback speed (AudiobookViewer may already support this)
- Podcast notifications / new episode alerts
- Podlove / Podcasting 2.0 namespace support
