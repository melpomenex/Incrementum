## Context

`sqlx::QueryBuilder::separated(", ")` treats every `push()` and `push_bind()` call as a separate item, inserting the separator (`, `) between consecutive items. The current code does `separated.push("title = ").push_bind(title)`, which produces two items: `"title = "` and `?"`, with a comma between them — yielding `title = , ?`. The same bug exists in both `update_rss_feed` (Tauri command) and `update_rss_feed_http` (HTTP command).

The Reading Queue handler (`get_queue_items_from_repo`) loops over learning items, extracts, and video extracts, calling `repo.get_document(id)` individually for each one. For a user with hundreds of items, this issues hundreds of sequential queries. It also calls `repo.list_documents()` which runs `SELECT *` including the full `content` column.

## Goals / Non-Goals

**Goals:**
- Fix RSS feed update SQL generation so feeds refresh without syntax errors
- Fix Reading Queue to load in bounded time regardless of dataset size

**Non-Goals:**
- Refactoring the SQL injection issues found in `rss_features.rs` (separate change)
- Re-architecting the queue system (performance fix only)
- Adding pagination to the queue (not needed once N+1 is fixed)

## Decisions

### 1. Fix QueryBuilder pattern by using `push()` with `format_args!` bindings

**Approach:** Use `separated.push_bind(value)` combined with inline column names via `QueryBuilder`'s SQL string methods. The correct sqlx pattern is to combine the assignment and bind into one push operation.

**Concrete fix:** Replace the `separated` pattern with direct `builder.push()` calls that include both the column name and a `?` placeholder, then append all binds. This avoids `separated` entirely for the SET clause.

Example:
```rust
let mut set_clauses: Vec<String> = Vec::new();
let mut binds: Vec<...> = Vec::new();
if let Some(title) = title {
    set_clauses.push("title = ?".to_string());
    binds.push(title);
}
// ...
let sql = format!("UPDATE rss_feeds SET {} WHERE id = ?", set_clauses.join(", "));
let mut query = sqlx::query(&sql);
for bind in binds {
    query = query.bind(bind);
}
query = query.bind(&id);
query.execute(pool).await?;
```

**Alternative considered:** Using `separated.push(format_args!("title = ")).push_bind(title)` — but `push_bind` on a `Separated` still creates a separate item. The manual approach is clearer and avoids `QueryBuilder` footguns.

### 2. Batch document lookups in queue handler

**Approach:** Collect all unique `document_id` values from learning items, extracts, and video extracts upfront. Issue a single `SELECT id, title FROM documents WHERE id IN (...)` query to get all needed titles at once. Build a `HashMap<String, String>` for O(1) lookups.

**Concrete fix:**
1. Collect all `document_id` values before the loops
2. Add a `repo.get_document_titles(ids: &[String])` method that returns `HashMap<String, String>`
3. Replace per-item `repo.get_document(id)` calls with hashmap lookups

### 3. Replace `list_documents()` with lightweight queue query

**Approach:** Add a `repo.list_documents_for_queue()` method that selects only the columns needed for queue display (id, title, is_archived, is_dismissed, current_page, total_pages, date_added) without loading `content`.

**Alternative considered:** Using `list_documents()` and dropping content — but that still transfers potentially large blobs over the SQLite connection for no reason.

## Risks / Trade-offs

- **[Risk] Manual SQL construction in rss.rs** → Mitigation: Column names are hardcoded string literals, not user input. No injection risk.
- **[Risk] Large IN clause for document titles** → Mitigation: Queue datasets are bounded by user activity; even 10k items produces a manageable query. If needed, batch in chunks of 500.
- **[Risk] `get_document_titles` is a new method** → Mitigation: Simple SELECT with IN clause, well-understood SQLite pattern.
