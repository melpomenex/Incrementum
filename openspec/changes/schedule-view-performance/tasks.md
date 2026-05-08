## 1. Forecast Query Optimization (Rust Backend)

- [x] 1.1 Replace the 180-query per-day loop in `algorithm.rs` with two `GROUP BY DATE()` aggregation queries for `learning_items` and `documents`
- [x] 1.2 Add a repository method (e.g., `get_workload_forecast_grouped`) that executes the grouped queries and returns raw `Vec<(String, i64)>` per entity type
- [x] 1.3 Merge the grouped results in the `get_due_workload_forecast` command into the existing `ForecastPoint` vec, filling zero-count days for missing dates
- [x] 1.4 Verify the forecast output matches the current format and results

## 2. Queue Query Optimization (Rust Backend)

- [x] 2.1 Add a filtered SQL query variant for `get_all_video_extracts` that includes `WHERE review_count = 0 AND next_review_date IS NULL`, replacing the client-side filter in `queue.rs:93-97`
- [x] 2.2 Update `get_queue_items_from_repo` to use the new filtered query instead of fetching all video extracts and filtering in Rust
- [x] 2.3 Batch the playlist intersperse queries in `get_queue_with_playlist_intersperse` — collect all document IDs and subscription IDs first, then fetch with `WHERE id IN (?)` instead of per-item queries

## 3. Frontend Data Loading Optimization

- [x] 3.1 Change postpone, suspend, unsuspend, delete, and dismiss handlers in `ScheduleView.tsx` to call `reloadItems()` instead of `loadData()` (skip forecast re-fetch)
- [x] 3.2 Verify the spread action still calls `loadData()` since it meaningfully changes the forecast

## 4. Schedule View Virtualization

- [x] 4.1 Study the existing `DynamicVirtualList` pattern in `src/components/common/VirtualList.tsx` and how it's used in Queue/Review views
- [x] 4.2 Refactor `ScheduleItemList` to serve as the virtualized container: flatten the date-grouped items into a single list where date headers are interleaved as list items
- [x] 4.3 Implement virtualization for the table view mode in `ScheduleTable.tsx`: keep `<thead>` fixed, use `useVirtualizer` with `measureElement` for variable-height rows, render only visible `<tr>` elements with `translateY` positioning
- [x] 4.4 Implement virtualization for the cards view mode in `ScheduleItemRow.tsx`: wrap items in a virtualized scroll container rendering only visible card elements
- [x] 4.5 Handle the expanded row state: ensure `expandedId` state survives when rows scroll out of and back into the virtualizer viewport
- [x] 4.6 Handle the selected date filter: when a date is selected on the timeline, reset the virtualizer scroll position and only show that day's items
- [x] 4.7 Test with 1000+ items: verify initial render time < 200ms and no jank during scroll
