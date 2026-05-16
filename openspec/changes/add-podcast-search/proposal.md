## Why

The current "Discover Podcasts" feature is a hardcoded list of 4 feed URLs with no search capability. Users must manually find and paste RSS feed URLs to subscribe — a friction-heavy workflow. Adding real-time podcast search via the RSS.com PodcastIndex API lets users find and subscribe to any podcast directly within the app, matching the experience they expect from modern podcast clients.

## What Changes

- Add a `search_podcasts` Rust command that queries `https://apollo.rss.com/search/podcast-index/byterm` with a user-provided query and returns structured search results (title, author, feed URL, description, cover art, episode count, categories).
- Add an HTTP API route `/api/podcast/search` in the browser sync server for the PWA/webapp fallback.
- Replace the frontend `discoverPodcasts()` mock with a real `searchPodcasts(query)` API function following the existing three-tier pattern (Tauri IPC → HTTP fallback → browser direct-fetch).
- Redesign the "Add Podcast" dialog into a unified search experience: a search input that queries the PodcastIndex API in real-time, displays results in a visually rich card grid (cover art, title, author, description, episode count), and lets users subscribe in one click.
- Remove the separate "Discover" dialog and globe button, folding the curated suggestions into the search experience as a default/empty-state view.

## Capabilities

### New Capabilities
- `podcast-search`: Backend podcast search via RSS.com PodcastIndex API, returning structured results with title, author, feed URL, description, image, episode count, and categories.
- `podcast-search-ui`: Frontend search interface within the Add Podcast dialog, replacing the current static discover list with a live search experience featuring rich result cards and one-click subscribe.

### Modified Capabilities

## Impact

- **Rust backend**: New `search_podcasts` command in `src-tauri/src/commands/podcast.rs`, new `PodcastSearchResult` model in `src-tauri/src/models/podcast.rs`.
- **Browser sync server**: New `/api/podcast/search` route in `src-tauri/src/browser_sync_server.rs`.
- **Frontend API**: New `searchPodcasts(query)` in `src/api/podcast.ts` replacing `discoverPodcasts()`.
- **Frontend UI**: Major refactor of the "Add Podcast" dialog in `src/components/media/PodcastManager.tsx` (~80 lines of dialog JSX replaced with search UI).
- **External dependency**: `https://apollo.rss.com/search/podcast-index/byterm` — free, no API key required.
- **No database changes**: Search results are ephemeral; no new tables or migrations needed.
