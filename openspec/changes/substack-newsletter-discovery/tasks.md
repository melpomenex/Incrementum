## 1. Rust Backend — Substack API Proxy

- [x] 1.1 Create `src-tauri/src/commands/substack.rs` with Tauri command `substack_search` that proxies GET to `https://substack.com/api/v1/top/search` with query and cursor params via `reqwest`
- [x] 1.2 Add Tauri command `substack_categories` that proxies GET to `https://substack.com/api/v1/categories`
- [x] 1.3 Add Tauri command `substack_pub_homepage` that proxies GET to `https://{subdomain}.substack.com/api/v1/homepage_data`
- [x] 1.4 Add Tauri command `substack_category_feed` that proxies GET to `https://substack.com/api/v1/reader/feed` with tab=categoryId, type=category
- [x] 1.5 Register all new commands in `src-tauri/src/lib.rs` invoke_handler

## 2. TypeScript API Client

- [x] 2.1 Create `src/api/substack.ts` with TypeScript interfaces matching Substack API response shapes (SubstackSearchResponse, SubstackSearchItem, SubstackPublication, SubstackCategory, SubstackFeedResponse, SubstackPost, SubstackProfile)
- [x] 2.2 Implement `searchSubstack(query, cursor?)` using `invokeCommand` in Tauri mode and direct `fetch` in browser mode
- [x] 2.3 Implement `getSubstackCategories()` with dual-mode transport
- [x] 2.4 Implement `getSubstackPublication(subdomain)` with dual-mode transport
- [x] 2.5 Implement `getSubstackCategoryFeed(categoryId, cursor?)` with dual-mode transport
- [x] 2.6 Add client-side rate limiter (token bucket, 30 req/min) to all API functions
- [x] 2.7 Add `deriveSubstackFeedUrl(publication)` helper that returns the RSS feed URL from subdomain or custom_domain
- [x] 2.8 Add error handling for CORS failures in browser mode with descriptive error type

## 3. Browser Backend Fallback

- [x] 3.1 Add handler cases in `src/lib/browser-backend.ts` (or equivalent) for the four new Substack commands that perform direct fetch to Substack's public API

## 4. Newsletter Directory UI — Search & Discovery

- [x] 4.1 Refactor `NewsletterDirectory.tsx` to load subscribed feeds on mount and cross-reference with displayed entries to show accurate "Subscribed" state
- [x] 4.2 Add debounced (500ms) live search that calls `searchSubstack()` and displays results
- [x] 4.3 Add loading spinner and error/retry state for search requests
- [x] 4.4 Display search results as newsletter cards with publication name, author, description, and "Subscribe" button
- [x] 4.5 Handle both post-type and profile-type search results with appropriate card layouts
- [x] 4.6 Wire "Subscribe" on search results to derive RSS feed URL and call `subscribeToFeedAuto()`
- [x] 4.7 Add "Load more" button for cursor-based search pagination

## 5. Newsletter Directory UI — Category Browsing

- [x] 5.1 Fetch Substack categories on component mount and display them as filter chips (alongside existing curated curated categories)
- [x] 5.2 When a Substack category is selected, call `getSubstackCategoryFeed()` and display results
- [x] 5.3 Allow combining category selection with text search (search takes priority)

## 6. Publication Preview

- [x] 6.1 Create `NewsletterPreviewModal` component that fetches publication homepage data via `getSubstackPublication()`
- [x] 6.2 Display publication metadata: name, description, author name/photo, subscriber count, logo
- [x] 6.3 Display up to 5 recent post titles with dates in the preview
- [x] 6.4 Add "Subscribe" button in preview modal that subscribes and closes modal
- [x] 6.5 Wire search result cards and curated entries to open the preview modal on click

## 7. Editor's Picks Section

- [x] 7.1 Reorganize the default directory view: show curated entries under "Editor's Picks" heading
- [x] 7.2 When search is active, show "Editor's Picks" as a collapsible/scrollable row above search results
- [x] 7.3 Show "Search Results" heading with result count below picks when search is active
