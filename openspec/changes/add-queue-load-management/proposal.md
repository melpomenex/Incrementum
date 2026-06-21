# Change: Queue Load Management (Easy Days, Load Balancing, Advance)

## Why

The single most-installed Anki add-on is **FSRS Helper** (#759844606), which exists almost entirely to solve one problem: the **overdue-backlog death spiral**, where a few busy days snowball into hundreds of due reviews the user can never catch up on. Incrementum already has a sophisticated algorithm-aware postpone (`postpone_item`), but is missing the three companion features that prevent the spiral from forming in the first place:

1. **Easy Days** — suppress reviews on chosen weekdays (weekend / vacation mode). New reviews are not scheduled onto easy days, and existing due items are gently pushed past them.
2. **Load Balancing** — redistribute the due pile across the next N days to flatten peaks (so "50 due today, 200 due tomorrow" becomes "125 / 125").
3. **Advance** — the inverse of postpone: pull *future* due items forward to today ("do today"), useful before an exam or trip.

None of these exist in Incrementum today (verified: zero matches for `easy_days`, `load_balance`, `advance` in source).

## What Changes

### 1. Easy Days
- Add `easy_days: Vec<u8>` (weekday indices 0=Sun..6=Sat) to user learning settings (frontend field `easyDays: number[]` already added in the review-source-context change).
- New command `apply_easy_days(days: i32)`: scans learning items whose `due_date` falls on an easy day within the next `days` window and reschedules them to the next non-easy day, preserving intervals (additive shift only — no memory-state mutation).
- Reads `easyDays` from settings when invoked without explicit overrides.

### 2. Load Balancing
- Add `load_balancing_enabled: bool` to learning settings (frontend field already added).
- New command `load_balance_queue(window_days: i32, target_per_day: Option<i32>)`: redistributes due learning items across the next `window_days` (default 14) so no single day exceeds `target_per_day` (defaults to the average + 25% headroom). Items are shifted additively (interval preserved). Does not mutate FSRS memory state — only `due_date`.
- Surfaced as a manual action in the queue/Analytics UI (no automatic background loop in this iteration, to avoid surprise rescheduling).

### 3. Advance (Do Today)
- New command `advance_item(item_id, item_type, days)`: the inverse of `postpone_item`. Pulls a future-due item forward by bringing `due_date` to today (or N days earlier). Negative-postpone semantics.
- Also `advance_due_queue(days)`: bulk-pull all items due within the next `days` to today, for "I have time now, let me get ahead" cramming.

## Impact

### Affected Specs
- **queue-load-management** — New spec covering Easy Days, load balancing, and advance contracts.

### Affected Code Areas
- `src-tauri/src/commands/queue_bulk.rs` — New `advance_item`, `advance_due_queue`, `load_balance_queue`, `apply_easy_days` commands.
- `src-tauri/src/database/repository.rs` — Helper queries for bulk due-date shifts and per-day load counts.
- `src-tauri/src/lib.rs` — Register new commands.
- `src/types/queue.ts` / `src/api/queue.ts` — Frontend wrappers.
- `src/components/queue/` — Buttons/actions for advance + load balance (Easy Days is settings-driven).

### Non-goals
- No automatic background load-balancing loop (manual trigger only this iteration).
- No change to FSRS memory-state on load-balanced items (purely a `due_date` shift, preserving the scheduler's long-term model).
- Easy Days does not *delete* reviews — it only shifts their `due_date` past the easy day.
