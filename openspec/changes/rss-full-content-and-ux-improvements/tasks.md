## 1. Database Schema & Backend Setup

- [x] 1.1 Add database migration for new RSS columns (full_content, full_content_fetched_at, auto_fetch_full_content)
- [x] 1.2 Update Rust repository.rs with new fields in RSS article and feed models
- [x] 1.3 Add Rust dependencies (readable-readability crate) for content extraction
- [x] 1.4 Create Rust command `fetch_full_content` to fetch and extract article HTML
- [x] 1.5 Create Rust command `update_feed_auto_fetch` to set per-feed auto-fetch preference
- [x] 1.6 Create Rust command `get_article_full_content` to retrieve cached content

## 2. Frontend API Layer

- [x] 2.1 Extend Feed and FeedItem interfaces in rss.ts with new full content fields
- [x] 2.2 Add `fetchArticleFullContent()` API function with Tauri/Web mode support
- [x] 2.3 Add `updateFeedAutoFetchPreference()` API function
- [x] 2.4 Add `generateArticleExcerpt()` utility function (200 chars, plain text)
- [x] 2.5 Add CORS proxy fallback chain for web mode fetching
- [x] 2.6 Create content extraction service using Web Readability (web mode) or backend (Tauri mode)

## 3. Full Content Reader Component

- [x] 3.1 Create `RSSFullContentView` component for displaying extracted article content
- [x] 3.2 Implement safe HTML rendering with XSS sanitization
- [x] 3.3 Add "Fetch Full Content" button to RSSReader article view
- [x] 3.4 Add cache indicator (show when viewing cached content)
- [x] 3.5 Add retry button for failed fetches with error message
- [x] 3.6 Implement refresh action for stale content (>30 days)

## 4. Feed Auto-Fetch Configuration

- [x] 4.1 Add auto-fetch mode selector to RSS feed settings UI
- [x] 4.2 Implement "always", "favorites", "manual" options with descriptions
- [x] 4.3 Hook up auto-fetch trigger when new articles arrive ("always" mode)
- [x] 4.4 Hook up auto-fetch trigger on favorite action ("favorites" mode)
- [x] 4.5 Set default auto-fetch to "manual" for new feeds (already in schema)

## 5. Article List Enhancements

- [x] 5.1 Update article list to show excerpt from full content when available
- [x] 5.2 Add full content availability indicator in article list items
- [x] 5.3 Add "Fetch Full Content" quick action in article list context menu

## 6. Scroll Mode UX Enhancements

- [x] 6.1 Add floating progress bar component at top of scroll mode
- [x] 6.2 Implement article counter display ("X of Y") in scroll mode
- [x] 6.3 Add click/drag navigation on progress bar for quick seeking
- [x] 6.4 Improve swipe gesture detection with haptic feedback
- [x] 6.5 Add mouse wheel threshold detection to prevent accidental navigation
- [x] 6.6 Enhance keyboard navigation (arrows, spacebar) for article scrolling vs navigation
- [x] 6.7 Add jump-to-article-index input feature with quick modal
- [x] 6.8 Implement "Mark All as Read" action with confirmation toast + undo
- [x] 6.9 Add animated favorite button with visual feedback in scroll mode

## 7. Article Context Overlay

- [x] 7.1 Create article metadata overlay component for scroll mode
- [x] 7.2 Display feed name, pub date, author, word count, reading time
- [x] 7.3 Add link to open original source URL
- [x] 7.4 Add full content indicator and expand/collapse action in overlay
- [x] 7.5 Trigger overlay on info button or 'i' key

## 8. Offline & Caching

- [x] 8.1 Implement content size limit check (max 1MB per article)
- [x] 8.2 Add background pruning of old content (>30 days)
- [x] 8.3 Add offline indicator functionality
- [x] 8.4 Handle CORS failures with proxy fallback chain in web mode
- [x] 8.5 Log fetch/extraction failures for debugging

## 9. Integration & Testing

- [x] 9.1 Integrate full content view into existing RSSReader component
- [x] 9.2 Integrate enhanced scroll mode features into RSSScrollMode
- [x] 9.3 Test manual fetch flow end-to-end
- [x] 9.4 Test auto-fetch "always" mode with new feed items
- [x] 9.5 Test auto-fetch "favorites" mode
- [x] 9.6 Test CORS proxy fallback in web mode
- [x] 9.7 Test content extraction on various article types
- [x] 9.8 Test scroll mode gestures on touch and desktop
- [x] 9.9 Verify backward compatibility (no full content still works)

## 10. Documentation & Polish

- [x] 10.1 Add help text explaining auto-fetch modes in feed settings
- [x] 10.2 Add loading states and skeleton screens for content fetching
- [x] 10.3 Add error state UI for failed fetches with helpful message
- [x] 10.4 Update user-facing documentation about full content feature
- [x] 10.5 Final UI polish and responsive design checks
