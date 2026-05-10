## 1. Backend: Anna's Archive Search Implementation

- [x] 1.1 Update `LIBGEN_MIRRORS` to `ANNAS_ARCHIVE_MIRRORS` with active domains (annas-archive.org, .li, .se, .rs)
- [x] 1.2 Implement `fetch_annas_archive_search` to query the search page with proper browser headers
- [x] 1.3 Implement HTML parsing for search results using `a.js-vim-focus` and related selectors
- [x] 1.4 Extract MD5 hashes, formats, and rich metadata (year, language, size) from search results
- [x] 1.5 Implement mirror rotation and basic retry logic for search

## 2. Backend: Multi-Mirror Download Implementation

- [x] 2.1 Implement `fetch_download_mirrors` to parse the book detail page (`/md5/{md5}`)
- [x] 2.2 Add logic to identify and prioritize "Slow Download" and external LibGen mirrors
- [x] 2.3 Update `download_book` command to use the tiered download strategy (Direct -> Mirror -> Fallback)
- [x] 2.4 Ensure cross-platform path handling for downloads (Windows/Linux verification)

## 3. Frontend: API and UI Updates

- [x] 3.1 Update `src/api/anna-archive.ts` to support enriched `BookSearchResult` fields (isbn, description)
- [x] 3.2 Update `src/components/import/AnnaArchiveSearch.tsx` to display cover images and descriptions
- [x] 3.3 Relax platform visibility gating in `src/components/documents/DocumentsView.tsx` to allow Windows/Linux testing
- [x] 3.4 Update UI to show multiple download format options if available

## 4. Testing and Validation

- [x] 4.1 Write unit tests in `src-tauri/src/commands/anna_archive.rs` for search result parsing
- [x] 4.2 Verify search functionality with various queries (title, author, ISBN)
- [x] 4.3 Verify download functionality from both direct and mirror links
- [x] 4.4 Perform cross-platform testing on Windows and Linux if environments are available
