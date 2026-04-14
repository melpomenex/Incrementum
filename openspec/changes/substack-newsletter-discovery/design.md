## Context

Incrementum is a Tauri v2 desktop app (Rust backend + React/TypeScript frontend) that runs in dual mode: Tauri desktop and browser PWA. The Newsletter Directory tab currently displays a static list of 36 hardcoded newsletters from `src/data/newsletterDirectory.ts`. Users can subscribe, but the directory has no search or discovery beyond this fixed list.

A Python reference implementation (`substack_api.py`) documents Substack's public JSON API — no auth required — with endpoints for search, category browsing, feed, publication homepage, and archive. These endpoints return structured JSON with post metadata, publication info, and cursor-based pagination.

The existing RSS subscription pipeline (`src/api/rss.ts`) already handles feed URL discovery for Substack publications (including custom domains) via `discoverNewsletterFeedUrl()`. Subscribing a discovered newsletter just means constructing a `Feed` object with the correct RSS URL and calling `subscribeToFeedAuto()`.

## Goals / Non-Goals

**Goals:**
- Allow users to search Substack for newsletters by keyword and subscribe directly from results
- Provide category-based browsing of Substack newsletters
- Show publication preview (description, recent posts, subscriber count) before subscribing
- Integrate cleanly with the existing RSS subscription flow
- Work in both Tauri desktop and browser/PWA modes

**Non-Goals:**
- Authentication with Substack (no login, no private feeds)
- Supporting non-Substack platforms via API (Beehiiv, Ghost, etc. — RSS discovery already covers these)
- Modifying the existing curated directory entries (kept as "Editor's Picks")
- Feed/comment search (only publication/post search)
- Caching or offline access to Substack search results

## Decisions

### 1. API proxy via Rust Tauri command (not direct fetch from frontend)

**Choice**: Add Rust `#[tauri::command]` handlers that proxy Substack API requests server-side.

**Alternative**: Direct `fetch()` from TypeScript frontend.

**Rationale**: Substack's API likely doesn't set CORS headers for arbitrary origins. In Tauri desktop mode, Rust `reqwest` calls bypass CORS entirely. In browser/PWA mode, we need a fallback — we'll use the existing `browserInvoke` pattern but route through a small fetch helper that hits Substack directly (CORS may or may not work in PWA). If CORS blocks browser-mode requests, we gracefully degrade with an error message.

### 2. TypeScript API client in `src/api/substack.ts` (not Rust-only)

**Choice**: Create a TypeScript API module that calls Rust commands in Tauri mode and falls back to direct fetch in browser mode.

**Rationale**: Follows the established `src/api/*.ts` pattern used by RSS, documents, and other features. Keeps the frontend in control of rate limiting, pagination state, and data transformation. The Rust layer is a thin proxy — no business logic.

### 3. Substack feed URL derivation from publication subdomain

**Choice**: Construct RSS feed URL as `https://{subdomain}.substack.com/feed` or `https://{custom_domain}/feed` for discovered publications.

**Rationale**: This is already the pattern used by `detectPlatformFeed()` in `rss.ts` for Substack. Substack publications always expose an RSS feed at `/feed`. We don't need to call Substack's API for this — just derive it from the publication's `base_url` or `subdomain`.

### 4. Rate limiting on the client (30 req/min)

**Choice**: Implement a simple token-bucket rate limiter in the TypeScript API client.

**Rationale**: Matches the Python reference implementation's default. Prevents hammering Substack's public API from the desktop app. Easy to adjust if needed.

### 5. Keep curated directory as "Editor's Picks" tab

**Choice**: The existing static directory entries remain accessible as a curated section, not deleted.

**Rationale**: The curated list serves a different purpose — vetted quality recommendations. Live search results complement it rather than replace it.

## Risks / Trade-offs

- **Substack API changes without notice** → The API is unofficial/public. If endpoints change, the client will need updates. Mitigation: wrap all API calls with error handling that degrades gracefully (show "search unavailable" rather than crash).

- **CORS blocking in browser/PWA mode** → Substack likely doesn't set `Access-Control-Allow-Origin` for non-Substack origins. Mitigation: in Tauri mode (primary use case), Rust proxy bypasses CORS. In browser mode, show a helpful message if requests fail, directing users to the desktop app for full functionality.

- **Rate limiting by Substack** → If Substack throttles or blocks the client IP. Mitigation: client-side rate limiting (30 req/min), exponential backoff on 429 responses, and caching search results for the session.

- **Custom domain Substack publications** → Search results return `base_url` and `custom_domain` fields. We need to handle both when constructing RSS feed URLs. Mitigation: use `base_url` when available, fall back to `https://{subdomain}.substack.com/feed`.
