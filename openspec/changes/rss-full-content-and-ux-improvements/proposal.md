## Why

The current RSS reader only displays content available directly in the RSS feed XML, which typically contains summaries or truncated excerpts rather than full article content. This forces users to open articles in external browsers to read the complete text. Additionally, the scroll mode experience can be improved with better navigation controls and article context. We need to fetch full article content automatically and enhance the reading UX.

## What Changes

- **Full Article Content Fetching**: Automatically fetch and cache complete article HTML content from source URLs when RSS feeds only provide summaries
- **Content Extraction & Cleaning**: Parse fetched HTML to extract readable article content using Mozilla's Readability algorithm
- **Enhanced Scroll Mode**: Add article progress indicators, quick navigation, and improved gestures for the TikTok-style reader
- **Offline Reading**: Store full article content locally for offline access
- **Auto-Fetch Settings**: Configurable per-feed auto-fetch preferences (always, favorites-only, manual)
- **Reader Mode Improvements**: Clean, distraction-free reading view with typography controls

## Capabilities

### New Capabilities

- `rss-full-content-fetch`: Full article content fetching from source URLs with caching and offline support
- `rss-content-extraction`: HTML content extraction and cleaning using Readability algorithm
- `rss-scroll-mode-enhance`: Enhanced scroll mode UX with progress indicators and quick navigation

### Modified Capabilities

- `document-import`: Extend existing web article import patterns to integrate with RSS full-content fetching

## Impact

**Frontend Components:**

- `src/api/rss.ts` - Add full content fetching methods
- `src/components/media/RSSReader.tsx` - Add full content view mode
- `src/components/media/RSSScrollMode.tsx` - Enhanced navigation and progress UI
- New: `src/components/media/RSSFullContentView.tsx` - Dedicated full article reader

**Backend (Tauri):**

- `src-tauri/src/commands/rss.rs` - Add fetch and store full content commands
- `src-tauri/src/database/repository.rs` - Extend article storage for full content

**Dependencies:**

- Add `readability` Rust crate or similar for HTML content extraction
- May use existing `documentImport.ts` patterns for CORS proxy fetching

**Database Schema:**

- New field: `rss_articles.full_content` (TEXT, nullable)
- New field: `rss_articles.full_content_fetched_at` (TIMESTAMP)
- New field: `rss_feeds.auto_fetch_full_content` (TEXT: 'always', 'favorites', 'manual')
