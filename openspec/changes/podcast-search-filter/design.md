## Context

The Podcasts tab (`PodcastManager.tsx`) renders a sidebar with subscribed feeds. Currently, a local `searchQuery` state filters feeds by exact substring match on `feed.title` only. Feeds are already loaded client-side — no backend call needed. The app has well-established search patterns (Command Center, RSS search with FTS5, Global Search) but podcast search is the simplest case: filter an in-memory list.

## Goals / Non-Goals

**Goals:**
- Real-time filtering of podcast feeds as the user types
- Match against feed title, author, and description fields
- Clear visual feedback: highlighted matches, result count, empty state
- Zero-latency UX (client-side filtering, no API calls)

**Non-Goals:**
- FTS5 / backend search integration (feeds are already in memory)
- Searching across episode titles/descriptions (future enhancement)
- Search operators (AND/OR/NOT) — simple substring matching suffices
- Persisting search state across tab switches

## Decisions

### 1. Client-side filtering only (no API changes)
**Rationale:** Podcast feeds are fully loaded into the `feeds` state array on mount. Filtering a few hundred items client-side is instant. No need for FTS5 or backend search — keep it simple.

### 2. Multi-field matching (title, author, description)
**Rationale:** Users often remember a podcast by author or topic, not just title. Searching across all three text fields makes the filter more useful without added complexity.

### 3. Upgrade existing search input rather than replacing it
**Rationale:** A search input already exists in the sidebar header. Rather than introducing a new component, extend the existing one with multi-field matching and improved UX (clear button, empty state).

### 4. Simple case-insensitive substring match
**Alternatives considered:** Fuzzy matching (like the app's `fuzzyMatch` utility) — overkill for ~50-200 feed items. FTS5 — unnecessary for in-memory data. Substring match is predictable, fast, and matches user expectations.

## Risks / Trade-offs

- **Large feed lists (>500)**: Client-side filtering stays fast at this scale, but if the app ever supports thousands of feeds, consider debouncing or virtualized lists → current approach handles this fine for now.
- **Description field may contain HTML**: Podcast descriptions often contain HTML markup from RSS feeds. Search should match against plain text → strip HTML tags before matching to avoid false positives from tag names.
