## Why

The Podcasts tab currently has only a minimal client-side title filter for feeds. Users with many subscriptions have no way to quickly find a specific podcast or narrow down to relevant ones. A proper search/filter experience would let users instantly locate feeds by title, author, or description — matching the search quality available elsewhere in the app (e.g., RSS search, global Command Center).

## What Changes

- Upgrade the podcast feed sidebar search from a title-only filter to a full-text search across feed title, author, and description
- Add a visible search input with clear affordance (icon, placeholder, clear button) in the podcast sidebar header
- Show a "no results" state when the search query matches nothing
- Preserve the existing feed list behavior when no search query is active
- Optionally search across episode titles within the selected feed when viewing episodes

## Capabilities

### New Capabilities
- `podcast-feed-search`: Client-side search/filter for podcast feeds in the sidebar, matching against title, author, and description with real-time filtering as the user types

### Modified Capabilities

## Impact

- `src/components/media/PodcastManager.tsx` — primary UI changes (search input, filtering logic, empty state)
- `src/api/podcast.ts` — no API changes needed (client-side filtering on already-loaded data)
- No new dependencies; reuses existing UI patterns from the app's search components
