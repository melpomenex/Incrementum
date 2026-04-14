## Why

The Newsletter Directory is a static catalog of 36 hardcoded entries. Users can click "Subscribe" but the directory has no way to search, browse, or discover newsletters beyond this fixed list. The Substack public API (already reverse-engineered in `substack_api.py`) provides free, unauthenticated access to search, browse categories, and fetch publication metadata. Integrating this turns the directory from a dead-end listing into a live discovery engine where users can find and subscribe to any Substack newsletter.

## What Changes

- Add a live Substack search endpoint that queries Substack's public `/api/v1/top/search` API for newsletters by keyword
- Add category browsing using Substack's `/api/v1/categories` and category-based feed endpoints
- Add publication detail fetching (homepage data, recent posts) so users can preview before subscribing
- Replace the static directory with a dynamic view combining curated picks and live search results
- Wire search results to the existing `subscribeToFeedAuto()` flow so discovered newsletters subscribe immediately via their RSS feed URL
- Add a Rust backend command layer (or browser-fallback HTTP) for Substack API calls to avoid CORS issues

## Capabilities

### New Capabilities

- `substack-api-client`: TypeScript client wrapping Substack's public JSON API (search, categories, publication homepage, archive) with rate limiting and the app's Tauri/browser dual-mode pattern
- `newsletter-discovery-ui`: Dynamic newsletter discovery interface replacing the static directory — live search, category browsing, publication preview cards, and subscribe actions

### Modified Capabilities

_(none — no existing spec-level requirements change; the RSS subscription flow remains the same)_

## Impact

- **Frontend**: New `src/api/substack.ts` module; rewritten or enhanced `NewsletterDirectory.tsx` / `NewsletterDirectoryEnhanced.tsx` components; new sub-components for search results and publication preview
- **Backend (Rust)**: New `src-tauri/src/commands/substack.rs` with Tauri commands for proxying Substack API calls (avoids CORS in desktop mode); registered in `lib.rs`
- **Dependencies**: None — uses only `fetch`/`urllib` for HTTP calls, no new crates or npm packages needed
- **Existing code**: `src/data/newsletterDirectory.ts` curated list may be retained as "Editor's Picks" alongside live results
