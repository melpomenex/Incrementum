## Context

Incrementum is a Tauri v2 + React + TypeScript desktop app with a dual-mode architecture: native Tauri IPC (SQLite via `sqlx`) for desktop, and an Axum HTTP server for browser/PWA mode. The RSS reader currently lives in `src/components/media/RSSReader.tsx` (main three-pane reader) and `src/components/media/RSSScrollMode.tsx` (TikTok-style scroll). The backend is `src-tauri/src/commands/rss.rs` with 14 Tauri commands, SQLite tables for feeds/articles/preferences, and a REST API layer in `browser_sync_server.rs`.

The data access layer in `src/api/rss.ts` (~1700 lines) uses a three-tier pattern: Tauri IPC → HTTP API → localStorage fallback, all exposed through unified "Auto" functions.

NewsBlur is a mature web-based RSS reader built on Django/PostgreSQL/MongoDB/Elasticsearch with 15+ years of feature development. This design adapts its most impactful features to Incrementum's architecture: a local-first desktop app where all data lives in SQLite on the user's machine.

## Goals / Non-Goals

**Goals:**
- Add intelligence training that learns user preferences and surfaces focus stories
- Support multiple story rendering modes (original site, clean text, focused story)
- Enable full-text search across all feeds using SQLite FTS5
- Implement keyboard-first navigation throughout the RSS experience
- Add story clustering for duplicate detection across feeds
- Build a site discovery system based on feed similarity
- Support nested folders, feed icons, and richer feed management
- Add tag-based bookmarking for saved stories
- Enable story annotations (highlights, notes)
- Add magazine and grid view layouts

**Non-Goals:**
- Social features (blurblog, sharing, following users, comments) — Incrementum is a personal tool, not a social platform
- Email newsletter ingestion via forwarding (beyond current newsletter RSS discovery)
- AI features like "Ask AI" or "Daily Briefing" (Incrementum already has its own AI summary system)
- Mobile apps — Incrementum is desktop-first with browser fallback
- Self-hosting or multi-user support
- MCP server or CLI tool
- Browser push notifications
- Third-party app integrations (IFTTT, Zapier, etc.)
- Pricing tiers / feature gating

## Decisions

### D1: Intelligence Training — Local SQLite Classifiers

**Decision**: Store all classifiers in SQLite tables with a scoring function computed at query time in Rust.

**Rationale**: NewsBlur uses a complex multi-tier classifier system with Elasticsearch. For Incrementum's local-first model, SQLite is sufficient. Classifiers are small data (a few rows per feed) and the scoring function is straightforward: count matching liked classifiers minus matching disliked classifiers.

**Implementation**: New `rss_classifiers` table with columns: `id`, `feed_id`, `classifier_type` (author/title/tag/feed), `value` (the matched text), `sentiment` (like/dislike/neutral), `scope` (feed/folder/global), `created_at`, `updated_at`. The `get_rss_articles` command gains an optional `intelligence_filter` parameter. A Rust function computes each article's intelligence score by checking classifiers against the article's author, title, tags, and feed ID, then filters/sorts accordingly.

**Alternative considered**: Client-side scoring in TypeScript. Rejected because it would require transferring all classifiers and all articles to the frontend, defeating pagination.

### D2: Multiple Story Views — View Mode Enum + Conditional Rendering

**Decision**: Add a `view_mode` field to feed preferences (existing `rss_user_preferences` table). The RSSReader component conditionally renders based on the active view mode.

**Rationale**: The existing per-feed preferences system already supports `view_mode`. We extend it with new values: `"feed"` (default RSS), `"original"` (iframe embed), `"text"` (extracted clean text), `"story"` (single-article focus view). The Original view uses Tauri's webview capabilities or an iframe. Text view extends the existing `RSSFullContentView` component with better text extraction.

**Implementation**: Update the `RSSReader` component to render different content panels based on the active view mode. Add a view mode switcher to the article toolbar. The Original view wraps the article URL in an iframe (with CSP headers). The Text view uses a dedicated extraction pipeline that strips HTML and normalizes formatting.

### D3: Full-Text Search — SQLite FTS5

**Decision**: Use SQLite's built-in FTS5 extension for full-text search.

**Rationale**: Incrementum already uses SQLite. FTS5 is zero-dependency, fast for the dataset sizes typical of personal RSS readers (tens of thousands of articles), and supports ranking, snippet extraction, and prefix queries. No need for an external search engine like Tantivy or Elasticsearch.

**Implementation**: Create an FTS5 virtual table `rss_articles_fts` that mirrors `rss_articles` with columns `title`, `content`, `author`. Add Rust triggers (or use `AFTER INSERT` SQLite triggers) to keep the FTS index in sync. New Tauri commands: `search_rss_articles(query, feed_id?, folder_id?, scope)` returning ranked results with snippet highlighting.

### D4: Story Clustering — Rust-Side Title Similarity

**Decision**: Implement title-based clustering in Rust using string similarity metrics (e.g., Jaro-Winkler or trigram similarity).

**Rationale**: NewsBlur uses word embeddings for clustering. For a local app, lightweight string similarity is sufficient and avoids heavy dependencies. Clustering happens at query time for visible articles (not as a background job), keeping it simple.

**Implementation**: New `rss_story_clusters` table: `id`, `canonical_article_id`, `article_id`, `similarity_score`, `cluster_type` (duplicate/related). A Rust function compares titles of articles within a time window (same day ± 2 days) using trigram similarity. Thresholds: >0.85 = "duplicate", >0.6 = "related". New command `get_rss_article_clusters(feed_id?, folder_id?)` returns grouped articles. Frontend displays cluster pills on articles and allows collapsing duplicates.

### D5: Keyboard Navigation — Global Shortcut Registry

**Decision**: Implement a global keyboard shortcut system using a Zustand store + React event listeners, with a `?` help overlay.

**Rationale**: Incrementum's RSS components already have some keyboard support (scroll mode). A unified system prevents conflicts and makes shortcuts discoverable. The `?` overlay pattern is standard (NewsBlur, Gmail, GitHub).

**Implementation**: New `src/stores/keyboardShortcutsStore.ts` with default bindings and user-customizable overrides stored in `rss_user_preferences`. A `KeyboardShortcutProvider` React component attaches a `keydown` listener to the document. Each shortcut maps to an action string (e.g., `"mark-read"`, `"next-feed"`, `"open-story"`, `"toggle-focus"`). The `RSSReader` component registers context-specific handlers. A `KeyboardHelpOverlay` component renders the shortcut reference.

### D6: Nested Folders — Adjacency List in SQLite

**Decision**: Add `parent_id` to the existing folder representation to support nesting.

**Rationale**: Currently folders are stored in localStorage as a flat list of `FeedFolder` objects with `feeds: string[]`. Adding `parent_id` to the data model is the simplest approach for the depth levels typical of RSS organization (2-3 levels max).

**Implementation**: Move folder storage from localStorage to SQLite. New `rss_folders` table: `id`, `name`, `parent_id` (nullable self-reference), `icon` (emoji or uploaded path), `sort_order`, `created_at`. Migrate existing localStorage folders. Update `RSSReader` sidebar to render nested folder trees with expand/collapse. Add drag-and-drop reordering.

### D7: Tags for Saved Stories — Separate Tags Table with Junction

**Decision**: Create `rss_tags` and `rss_article_tags` tables.

**Rationale**: Many-to-many relationship between articles and tags. A junction table is the standard relational approach.

**Implementation**: `rss_tags` table: `id`, `name`, `created_at`. `rss_article_tags` table: `article_id`, `tag_id`. Extend the favorite/star action to optionally prompt for tags. Add a tag management panel in the saved stories view. New commands: `add_tag`, `remove_tag`, `get_article_tags`, `get_articles_by_tag`.

### D8: Annotations — Inline Highlight + Note Storage

**Decision**: Store highlights and notes in an `rss_annotations` table linked to articles.

**Rationale**: Highlights need position data (character offset or XPath) for rendering. Notes are free-form text. Both are per-user, per-article.

**Implementation**: `rss_annotations` table: `id`, `article_id`, `type` (highlight/note), `content` (highlighted text or note body), `start_offset`, `end_offset`, `color` (for highlights), `created_at`, `updated_at`. Frontend uses `window.getSelection()` to capture highlighted text ranges. A highlights panel in the reader shows all annotations for the current article.

### D9: Article Layouts — CSS Grid with Configurable Templates

**Decision**: Implement magazine and grid layouts as CSS Grid configurations driven by preference settings.

**Rationale**: The existing `RSSCustomizationPanel` already supports card/list/compact display modes. Magazine and grid are extensions of this system with different grid templates and card aspect ratios.

**Implementation**: Extend `RSSCustomizationPanel` with new layout options: `magazine` (2-column masonry-style cards with large thumbnails), `grid` (3-4 column uniform grid). Add `card_height`, `show_excerpt`, `thumbnail_position` preferences. The `RSSReader` article list component switches grid template based on the selected layout.

### D10: Site Discovery — Feed Metadata Analysis

**Decision**: Implement discovery by analyzing feed categories, tags, and link patterns across subscribed feeds, then suggesting related feeds from a curated database and from RSS auto-discovery on linked sites.

**Rationale**: NewsBlur uses word embeddings trained on feed content. For Incrementum, a simpler approach combines: (1) curated "similar feeds" metadata bundled with the app, (2) RSS auto-discovery from outbound links in articles. This avoids heavy ML dependencies while providing useful discovery.

**Implementation**: New `rss_discovered_sites` cache table: `id`, `url`, `title`, `description`, `feed_url`, `similarity_source`, `discovered_at`. A background task runs periodically: extract domains from recent article links, fetch their homepages for RSS auto-discovery, score similarity based on shared categories/tags with subscribed feeds. New `DiscoverSites` component renders an infinite-scroll grid of discovered sites with subscribe actions.

## Risks / Trade-offs

- **[Risk] FTS5 availability on all platforms** → SQLite FTS5 is compiled in by default on most SQLite builds including the `rusqlite` crate. Verify in CI builds. Fallback: strip search to SQL `LIKE` queries if FTS5 unavailable.

- **[Risk] Iframe CSP restrictions for Original view** → Many sites block iframe embedding via `X-Frame-Options` or CSP. Mitigation: Attempt iframe first; fall back to opening in the system default browser. For Tauri desktop, consider using a secondary webview window instead of iframe.

- **[Risk] Title clustering accuracy** → Simple string similarity will miss semantically similar but lexically different titles. Mitigation: Set conservative thresholds (>0.85 for duplicates) and allow users to manually merge/separate clusters. The "related" tier (>0.6) is explicitly labeled as approximate.

- **[Risk] Performance with many classifiers** → Evaluating classifiers for every article on every query could be slow with thousands of classifiers. Mitigation: Cache computed intelligence scores in the `rss_articles` table (new `intelligence_score` column), recompute only when classifiers change.

- **[Trade-off] No social features** → NewsBlur's social layer (blurblog, following, comments) is a major differentiator but fundamentally incompatible with Incrementum's personal/local-first model. This is an intentional exclusion.

- **[Trade-off] Local-only discovery** → Without a server-side index of feeds, discovery relies on curated data and outbound link analysis. This is inherently more limited than NewsBlur's global feed graph but respects user privacy.

## Migration Plan

1. **Database migrations**: All new tables added via new migration file in `src-tauri/src/database/migrations.rs`. Existing tables receive new columns via `ALTER TABLE`.
2. **Folder migration**: One-time migration script moves localStorage folders to new `rss_folders` SQLite table on first launch after update.
3. **Preferences migration**: New preference keys added with sensible defaults. Existing preferences unaffected.
4. **FTS5 index build**: Initial population of `rss_articles_fts` table runs as a background task after migration, indexing all existing articles. UI remains usable during indexing.
5. **Rollback**: All new tables are additive. To rollback, drop new tables and columns. No data loss to existing feeds/articles/preferences.

## Open Questions

- **Q1**: Should intelligence classifier scores be cached in the articles table or computed on-the-fly? Cached scores are faster but need invalidation when classifiers change. Decision: Cache with classifier-change-triggered invalidation (a `classifiers_updated_at` timestamp compared to `intelligence_score_computed_at`).
- **Q2**: For the Original view, should we use an iframe or open a Tauri secondary webview? Iframes have CSP limitations; webviews are more capable but add complexity. Decision: Try iframe first, fallback to system browser. Secondary webview considered for a future iteration.
- **Q3**: What similarity algorithm for clustering? Jaro-Winkler is good for short strings but slow for large sets. Trigram similarity with SQLite's built-in trigram functions may be faster. Decision: Use SQLite trigram similarity for initial implementation, measure performance, upgrade to Rust-native Levenshtein/Jaro-Winkler if needed.
