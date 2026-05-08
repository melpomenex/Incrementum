## Context

The Schedule view loads all queue items and renders them in a flat HTML table or cards list with no virtualization. The workload forecast uses a per-day SQL loop (180 queries for 90 days). The project already uses `@tanstack/react-virtual` in Queue, Review, and Learning Cards views, with a shared `DynamicVirtualList` component at `src/components/common/VirtualList.tsx`.

Current data flow:
1. `ScheduleView.loadData()` calls `getWorkloadForecast(90)` (180 SQL queries) and `getQueue()` (6+ SQL queries) in parallel
2. Results stored in `useState`, passed to `ScheduleItemList` → `ScheduleTable` or `ScheduleItemRow`
3. All items rendered as flat DOM nodes, grouped by date sections

## Goals / Non-Goals

**Goals:**
- Reduce forecast SQL from 180 queries to 1
- Virtualize the Schedule item list (both table and cards modes)
- Eliminate unnecessary re-fetches after single-item actions
- Fix N+1 playlist queries
- Move client-side filters to SQL WHERE clauses

**Non-Goals:**
- Changing the visual design or layout of the Schedule view
- Adding pagination UI (virtualization handles this)
- Refactoring the duplicate helper functions between ScheduleItemRow and ScheduleTable
- Modifying the spread modal behavior
- Changing the forecast response shape or API contract

## Decisions

### 1. Forecast: single GROUP BY query replaces per-day loop

Replace the 180-query loop in `algorithm.rs:604-634` with two aggregate queries:

```sql
SELECT DATE(due_date) as day, COUNT(*) as count
FROM learning_items
WHERE is_suspended = false AND due_date <= ? AND due_date >= ?
GROUP BY DATE(due_date)

SELECT DATE(next_reading_date) as day, COUNT(*) as count
FROM documents
WHERE is_archived = false AND next_reading_date <= ? AND next_reading_date >= ?
GROUP BY DATE(next_reading_date)
```

Then merge the results in Rust into the existing `ForecastPoint` array, filling zero-count days.

**Alternative considered**: Caching forecast in Redis/memory — rejected because this is a local Tauri app with a single-user SQLite DB. The query optimization alone makes caching unnecessary.

### 2. Virtualization: adapt existing DynamicVirtualList pattern

The project already has `DynamicVirtualList` (VirtualList.tsx) used by Queue and Review views. For the Schedule view, we adapt this pattern:

- `ScheduleItemList` becomes the virtualized container
- Date section headers become sticky elements within the virtual list
- `ScheduleTable` rows and `ScheduleItemRow` cards render only when visible
- Table mode: use a CSS table layout within virtual rows (each row is a standalone `<div>` styled as a table row, or use the virtualizer with a `<table>` wrapper and absolutely-positioned rows based on `virtualizer.getVirtualItems()`)

**Table mode approach**: Since `@tanstack/react-virtual` works best with a flat list of same-height or measured items, and the Schedule table has variable-height expanded rows, we use `estimateSize` with dynamic measurement. The `<thead>` stays fixed outside the virtualizer. Each `<tr>` is rendered conditionally based on the virtualizer's visible range, with proper `top` positioning via `translateY`.

**Alternative considered**: `@tanstack/react-virtuoso` — rejected because `react-virtual` is already installed and the team has existing patterns with it.

### 3. Skip forecast re-fetch after single-item mutations

Currently `loadData()` (which re-fetches both queue AND forecast) is called after postpone, suspend, delete, dismiss. Change these to call `reloadItems()` (queue only). The forecast only changes meaningfully when the spread action runs, which already correctly calls `loadData()`.

### 4. Fix N+1 playlist queries

In `queue.rs:509-561`, batch all playlist document IDs and subscription IDs, then fetch with `WHERE id IN (?)` instead of per-item queries.

### 5. Server-side filters for video extracts

Move the `review_count == 0 && next_review_date.is_none()` filter from Rust client-side code (queue.rs:93-97) to the SQL query in `repository.rs:3096`.

## Risks / Trade-offs

- **[Variable row heights in table mode]** → Use `measureElement` from react-virtual to dynamically measure row heights after first render. This adds a small layout shift on first load for visible rows but is negligible at scale.
- **[Sticky date headers in virtualized list]** → Date section headers must be interleaved as list items with their own height, rather than separate elements outside the virtualizer. This is the same pattern used in the existing DynamicVirtualList.
- **[Forecast GROUP BY date formatting]** → SQLite's `DATE()` function returns ISO format strings. The existing `ForecastPoint` struct uses date strings, so no serialization change needed.
- **[Batch query for playlists]** → Must collect IDs first, then batch-query. If there are zero playlist items, the IN clause is empty — must guard with `if ids.is_empty() { return vec![]; }`.
