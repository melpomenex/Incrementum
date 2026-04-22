## Why

Two critical bugs block core functionality: (1) refreshing any RSS feed fails with a SQLite syntax error caused by `sqlx::QueryBuilder::separated()` misuse, and (2) the Reading Queue never loads because the backend handler makes N+1 database queries (one `get_document()` call per queue item), causing it to hang indefinitely on any non-trivial dataset.

## What Changes

- Fix the `QueryBuilder::separated()` pattern in `update_rss_feed` and `update_rss_feed_http` — `push("col = ").push_bind(val)` produces `col = , ?` because `separated` inserts commas between every pushed item. Replace with individual `push_bind()` calls that properly combine column assignment and bind into one separated item.
- Fix the N+1 query problem in `get_queue_items_from_repo` — batch all document title lookups into a single query instead of issuing one `get_document()` call per queue item.
- Replace `list_documents()` (which loads full `content` column for every document) with a lightweight query that only fetches the columns needed for queue display.

## Capabilities

### New Capabilities
_(none)_

### Modified Capabilities
_(none — these are bug fixes with no spec-level behavior changes)_

## Impact

- `src-tauri/src/commands/rss.rs` — two functions with broken SQL generation (lines 243-277 and 1138-1167)
- `src-tauri/src/commands/queue.rs` — `get_queue_items_from_repo` function (lines 55-280) with N+1 query pattern
- `src-tauri/src/database/repository.rs` — may need a new lightweight document list method
