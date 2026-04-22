## 1. Fix RSS Feed SQL Generation

- [x] 1.1 Fix `update_rss_feed` in `src-tauri/src/commands/rss.rs` (lines 243-277): replace `QueryBuilder::separated` with manual SET clause construction using `format!` + `join(", ")` + sequential `.bind()` calls
- [x] 1.2 Fix `update_rss_feed_http` in `src-tauri/src/commands/rss.rs` (lines 1138-1167): apply the same fix as 1.1
- [x] 1.3 Verify RSS feed refresh works by testing the update flow end-to-end

## 2. Fix Reading Queue N+1 Query Performance

- [x] 2.1 Add `get_document_titles(ids: &[String]) -> HashMap<String, String>` method to `Repository` in `src-tauri/src/database/repository.rs` that issues a single `SELECT id, title FROM documents WHERE id IN (...)`
- [x] 2.2 Refactor `get_queue_items_from_repo` in `src-tauri/src/commands/queue.rs` to collect all document IDs upfront, call `get_document_titles()` once, and use hashmap lookups instead of per-item `get_document()` calls
- [x] 2.3 Replace `repo.list_documents()` call in queue handler (line 244) with a lightweight query that selects only columns needed for queue display (id, title, is_archived, is_dismissed, current_page, total_pages, date_added) — avoid loading `content`
- [x] 2.4 Verify Reading Queue loads successfully with the performance fix
