## Why

The Schedule view becomes extremely laggy with thousands of items. Two root causes: (1) the workload forecast fires 180 sequential SQL queries (2 per day × 90 days) on every load, and (2) the frontend renders all items in a flat HTML table with no virtualization, creating thousands of DOM nodes. Additionally, the queue fetch loads all items with 6+ SQL queries and includes some N+1 patterns for playlist items.

## What Changes

- Replace the 180-query forecast loop with a single `GROUP BY date` aggregation query
- Add windowed virtualization to the Schedule table and cards view using the existing `@tanstack/react-virtual` dependency
- Eliminate redundant client-side re-sorting (backend already sorts)
- Fix N+1 playlist queries in `get_queue_with_playlist_intersperse`
- Move server-side filters that currently happen client-side (e.g., `video_extracts` new-item filter)
- Skip unnecessary forecast re-fetch after single-item actions (postpone, suspend, delete, dismiss)
- Defer non-critical data loading (summary stats, new extracts) behind the initial render

## Capabilities

### New Capabilities

- `schedule-virtualization`: Windowed virtualization of the Schedule item list (both table and cards modes) using `@tanstack/react-virtual`, consistent with the existing pattern used in Queue/Review views
- `forecast-query-optimization`: Efficient workload forecast using a single `GROUP BY` SQL query instead of a per-day loop

### Modified Capabilities

_(none — these are internal performance optimizations with no spec-level behavioral changes)_

## Impact

- **Rust backend**: `src-tauri/src/commands/algorithm.rs` (forecast query), `src-tauri/src/commands/queue.rs` (playlist N+1, server-side filters), `src-tauri/src/database/repository.rs` (new aggregation query)
- **Frontend**: `src/components/schedule/ScheduleTable.tsx` (virtualized table), `src/components/schedule/ScheduleItemRow.tsx` (virtualized cards), `src/components/schedule/ScheduleView.tsx` (data loading strategy), `src/components/schedule/ScheduleItemList.tsx` (virtual list wrapper)
- **Dependencies**: `@tanstack/react-virtual` already installed — no new dependencies
- **API**: No public API changes; `get_due_workload_forecast` response shape stays the same
