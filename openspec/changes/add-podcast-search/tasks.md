## 1. Backend: Rust Data Model

- [x] 1.1 Add `PodcastSearchResult` struct to `src-tauri/src/models/podcast.rs` with fields: `title` (String), `url` (String), `author` (Option<String>), `description` (Option<String>), `image_url` (Option<String>), `link` (Option<String>), `episode_count` (Option<i64>), `categories` (Option<HashMap<String, String>>). Derive Serialize/Deserialize with camelCase renaming.
- [x] 1.2 Add `PodcastSearchResponse` struct wrapping the API response: `query` (String), `count` (i64), `feeds` (Vec<PodcastSearchResult>).

## 2. Backend: Rust Search Command

- [x] 2.1 Add `search_podcasts` async command to `src-tauri/src/commands/podcast.rs` that: validates query is non-empty (returns empty vec otherwise), POSTs `{"q": query}` to `https://apollo.rss.com/search/podcast-index/byterm`, parses the JSON response into `PodcastSearchResponse`, and returns the `feeds` vec. Use `reqwest` (already a dependency) for the HTTP call.
- [x] 2.2 Register `commands::search_podcasts` in the `.invoke_handler()` block in `src-tauri/src/lib.rs`.

## 3. Backend: Browser Sync Server HTTP Route

- [x] 3.1 Add `GET /api/podcast/search` route to the Axum router in `src-tauri/src/browser_sync_server.rs` that extracts the `q` query parameter and calls the same upstream API logic, returning the results as JSON.
- [x] 3.2 Add the `handle_podcast_search` handler function that makes the HTTP call and returns the response.

## 4. Frontend: TypeScript Types & API

- [x] 4.1 Add `PodcastSearchResult` TypeScript interface to `src/api/podcast.ts` with fields matching the Rust model: `title`, `url`, `author?`, `description?`, `imageUrl?`, `link?`, `episodeCount?`, `categories?: Record<string, string>`.
- [x] 4.2 Implement `searchPodcasts(query: string): Promise<PodcastSearchResult[]>` following the three-tier pattern: Tauri IPC → HTTP fetch to `/api/podcast/search?q=...` → direct fetch to upstream API (with CORS proxy fallback via `allorigins.win`).
- [x] 4.3 Remove the `discoverPodcasts()` function.

## 5. Frontend: UI Refactor

- [x] 5.1 Remove `showDiscover`, `discoverResults` state variables and the `handleDiscover` function from `PodcastManager.tsx`.
- [x] 5.2 Remove the globe/Discover button from the podcast header toolbar.
- [x] 5.3 Remove the "Discover Podcasts" dialog JSX block and `handleSubscribeFromDiscover` function.
- [x] 5.4 Add state variables for the new search dialog: `searchQuery`, `searchResults`, `isSearching`, `searchError`, `showUrlInput`.
- [x] 5.5 Implement `handleSearch` function with 300ms debounce using a ref-based timeout pattern, calling `searchPodcasts(query)`.
- [x] 5.6 Add an "already subscribed" check in the subscribe handler: compare the result's `url` against existing feeds' `feedUrl` before calling `subscribeToPodcast`.
- [x] 5.7 Replace the "Add Podcast" dialog JSX with the unified search dialog: search input, loading spinner, error state, results card grid, and collapsible "Paste URL" section.

## 6. Cleanup

- [x] 6.1 Remove `parsePodcastFeed` function and its helpers (`getElementText`, `getAttributeText`) from `src/api/podcast.ts` if no longer referenced elsewhere.
- [x] 6.2 Remove the `podcastFeedSearch` utility and its tests in `src/utils/` if no longer used (it filters subscribed feeds, which is separate from API search — only remove if truly unused).
- [x] 6.3 Remove the `rss_podcast_search.py` file from the project root (it was the reference implementation, no longer needed after Rust translation).
