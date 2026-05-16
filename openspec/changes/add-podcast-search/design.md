## Context

The podcast feature currently supports subscribing via manual RSS URL entry and a static "Discover" list of 4 hardcoded feeds. There is no search capability — users must leave the app to find podcast feeds. The existing codebase follows a three-tier API pattern: Tauri IPC for native builds, HTTP routes via `browser_sync_server.rs` for the PWA/webapp, and direct browser fetch as a final fallback.

The external API (`https://apollo.rss.com/search/podcast-index/byterm`) is free, requires no authentication, and returns structured JSON with title, author, feed URL, description, image, episode count, and categories.

## Goals / Non-Goals

**Goals:**
- Enable users to search for podcasts by name/keyword from within the app
- Display search results in a visually rich, scannable card layout
- Allow one-click subscribe from search results
- Support the same three-tier architecture (Tauri native, HTTP API, browser fetch)

**Non-Goals:**
- No new database tables or migrations (search results are ephemeral)
- No search history persistence
- No trending/recommendation engine — just keyword search
- No pagination or infinite scroll (the API returns a fixed result set per query)

## Decisions

### 1. Backend: Thin proxy in Rust, not a full search engine

The Rust `search_podcasts` command is a simple HTTP proxy to `apollo.rss.com`. It takes a query string, makes a POST request, and returns the parsed JSON. No caching, no indexing, no local storage.

**Why**: The upstream API is free and fast. Adding a local cache or index would add complexity with no clear benefit — search results change over time and the API has no rate limits that we'd hit with normal usage.

**Alternative considered**: Client-side direct fetch from the browser. Rejected because the Tauri native build should route through the backend for consistency with the existing pattern, and the PWA needs the HTTP route for environments where CORS blocks direct access.

### 2. Frontend: Unified search dialog replaces separate Add + Discover modals

The current UI has two separate modals: "Add Podcast" (URL input) and "Discover Podcasts" (static list). These merge into a single "Add Podcast" dialog with:
- A search input at the top
- Search results displayed below in a responsive card grid
- The URL input preserved as a secondary tab or collapsible section for advanced users

**Why**: Reduces UI surface area. Most users will search rather than paste URLs. Keeping URL entry as a fallback handles edge cases (private feeds, newly published feeds not yet indexed).

**Alternative considered**: Separate "Search" tab in the sidebar. Rejected — a modal dialog keeps the workflow focused (search → preview → subscribe) without adding permanent UI chrome.

### 3. Search result model: Dedicated struct, not reusing existing types

Create a new `PodcastSearchResult` struct (Rust) / `PodcastSearchResult` type (TypeScript) distinct from `PodcastFeed`/`ParsedPodcastFeed`. Search results have fields that feeds don't (categories map, episode count without full episode data) and lack fields that feeds have (id, subscribed_at, sort_order).

**Why**: Keeps the type system honest. A search result is a *prospect* — it becomes a feed only after subscription. Reusing `ParsedPodcastFeed` would require injecting fake data for fields like `episodes: Vec<ParsedPodcastEpisode>`.

### 4. Debounced search with minimum query length

Frontend debounces the search input (300ms) and requires a minimum of 2 characters before firing a request. This prevents excessive API calls during typing.

**Why**: Standard UX pattern for live search. The upstream API is fast but we should still be good citizens.

### 5. Browser/PWA fallback: Direct fetch with CORS proxy

For the browser-only path (non-Tauri, non-HTTP-server), the frontend fetches `apollo.rss.com` directly. If CORS blocks this, fall back to the existing `allorigins.win` CORS proxy pattern already used by `parsePodcastFeed`.

**Why**: The PWA may run in environments without the browser sync server. A CORS proxy fallback ensures it still works, matching the resilience of the existing feed preview feature.

## Risks / Trade-offs

- **[Upstream API availability]** → If `apollo.rss.com` goes down or changes its contract, search breaks. Mitigation: the subscribe-via-URL path remains as a fallback. The API response shape is simple and stable.
- **[No offline search]** → Search requires network. Mitigation: this is expected for a cloud search feature. Subscribed feeds remain available offline.
- **[CORS on direct browser fetch]** → The PWA fallback may fail in some browsers due to CORS. Mitigation: `allorigins.win` proxy as fallback, and the HTTP server route works when the sync server is running.
