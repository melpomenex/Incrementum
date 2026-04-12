## Context

The current RSS reader implementation has the following architecture:

**Frontend (React/TypeScript):**

- `RSSReader.tsx` - 3-pane layout with feed list, article list, and reader
- `RSSScrollMode.tsx` - TikTok-style vertical scroll reader
- `rss.ts` - Unified API layer for feed fetching and storage (Tauri + Web modes)
- Content fetching currently limited to RSS feed XML data only

**Backend (Rust/Tauri):**

- `rss.rs` - RSS feed fetching and parsing commands
- `repository.rs` - SQLite database operations for feeds and articles
- `browser_sync_server.rs` - HTTP API for web mode

**Current Limitations:**

- RSS feeds typically provide summaries or truncated content
- No automatic fetching of full article HTML from source URLs
- Users must open external browser links to read complete articles
- Scroll mode lacks progress indicators and quick navigation features

**Existing Patterns to Leverage:**

- `documentImport.ts` has CORS proxy fallback chain and HTML processing
- `WebArticleImportDialog.tsx` demonstrates full article import patterns
- Content extraction patterns exist for processing raw HTML

## Goals / Non-Goals

**Goals:**

- Fetch full article content from source URLs when RSS provides summaries only
- Extract readable content from HTML using Readability algorithm
- Cache full content locally for offline reading
- Add per-feed auto-fetch configuration (always, favorites-only, manual)
- Enhance scroll mode with progress indicators and improved navigation
- Maintain backward compatibility with existing RSS functionality

**Non-Goals:**

- Not a full web scraper - focused on article content only
- No automatic content summarization (existing AI summary feature remains separate)
- No RSS feed generation or publishing
- No social/sharing features beyond existing ones

## Decisions

### 1. Content Extraction Approach: Mozilla Readability Algorithm

**Decision:** Use Mozilla's Readability algorithm ported to Rust (`readable-readability` crate) for HTML content extraction.

**Rationale:**

- Industry standard for article content extraction
- Battle-tested in Firefox Reader Mode
- Removes navigation, ads, and non-content elements
- Produces clean, structured article text

**Alternatives Considered:**

- Custom regex/HTML parsing: Too brittle, site-specific
- External API service: Adds latency, privacy concerns, rate limits
- Diffbot/Mercury: External dependency, cost, privacy issues

### 2. Fetching Strategy: Lazy with Manual Trigger

**Decision:** Full content is fetched on-demand when user requests it, with optional auto-fetch for new items.

**Flow:**

1. User opens article → check if full content exists in cache
2. If not cached, fetch from source URL using Tauri bypass or CORS proxies
3. Extract content using Readability
4. Store in SQLite with timestamp
5. Display in reader view

**Rationale:**

- Avoids bandwidth waste for articles users never read
- Reduces storage requirements
- Faster initial feed loading
- User controls which articles get full content

**Auto-fetch Options per Feed:**

- `always` - Auto-fetch for all new items
- `favorites` - Only auto-fetch favorited/starred items
- `manual` - Only fetch when user requests (default)

### 3. Storage: Extend Existing SQLite Schema

**Decision:** Add columns to existing `rss_articles` table rather than separate table.

**Schema Changes:**

```sql
ALTER TABLE rss_articles ADD COLUMN full_content TEXT;
ALTER TABLE rss_articles ADD COLUMN full_content_fetched_at TIMESTAMP;
ALTER TABLE rss_feeds ADD COLUMN auto_fetch_full_content TEXT DEFAULT 'manual';
```

**Rationale:**

- Simpler queries (no joins needed)
- Atomic operations for article CRUD
- Natural cache invalidation with article deletion

### 4. Enhanced Scroll Mode: Progress Indicator + Quick Actions

**Decision:** Add floating progress indicator showing article position and quick navigation buttons.

**UX Elements:**

- Floating progress bar at top of screen
- Article counter (e.g., "3 of 24")
- Swipe gesture improvements with haptic feedback
- Quick "mark all as read" action
- Jump to article index input

**Rationale:**

- Users lose context in infinite scroll
- Progress indication improves perceived control
- Quick navigation reduces fatigue in long reading sessions

### 5. Integration with Existing Document System

**Decision:** Full content can optionally be promoted to the document system for advanced features.

**Flow:**

- Full content stored in RSS table by default (fast access)
- Option to "Save to Documents" for annotation, linking, etc.
- Reuses existing `documentImport.ts` patterns

## Risks / Trade-offs

**[RISK] Content extraction may fail on some sites**
→ Mitigation: Graceful fallback to RSS content; manual fetch retry option; log failures for debugging

**[RISK] CORS issues in web mode**
→ Mitigation: Use CORS proxy chain pattern from `documentImport.ts`; Tauri mode bypasses CORS entirely

**[RISK] Storage bloat from full HTML content**
→ Mitigation: Content size limits (e.g., max 1MB per article); auto-prune old content; user-configurable retention

**[RISK] Rate limiting from source sites**
→ Mitigation: Respect robots.txt; implement request throttling; cache aggressively; user-controlled auto-fetch

**[RISK] Breaking changes to RSS data structures**
→ Mitigation: Optional fields with defaults; database migrations; graceful degradation if fields missing

## Migration Plan

1. **Database Migration**
   - Run SQL to add new columns (nullable with defaults)
   - Existing articles remain functional without full content

2. **Gradual Rollout**
   - Default auto-fetch mode: `manual` (no automatic change in behavior)
   - Users opt-in to auto-fetch per feed
   - Full content features appear only when content is available

3. **Backward Compatibility**
   - RSS reader works identically without full content
   - New UI elements hidden until first full content fetch
   - API endpoints return existing fields unchanged

## Open Questions

1. **Content retention policy**: How long to keep full content cache? (suggest: 30 days default)
2. **Size limits**: Maximum article content size to store? (suggest: 1MB)
3. **Image handling**: Store images locally or reference external URLs? (suggest: external URLs to reduce storage)
4. **Offline indicator**: Show visual indicator when viewing cached offline content?
