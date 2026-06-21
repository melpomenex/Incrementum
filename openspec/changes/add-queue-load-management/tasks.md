# Implementation Tasks

## 1. Backend
- [ ] 1.1 `advance_item` command (inverse of postpone) in `queue_bulk.rs`
- [ ] 1.2 `advance_due_queue(days)` bulk command
- [ ] 1.3 `load_balance_queue(window_days, target_per_day)` command
- [ ] 1.4 `apply_easy_days(days, easy_days)` command
- [ ] 1.5 Register all four in `lib.rs`

## 2. Frontend
- [ ] 2.1 Add wrappers to `api/queue.ts`
- [ ] 2.2 Add Easy Days picker to learning settings UI
- [ ] 2.3 Add "Load Balance" + "Advance" actions to queue context menu / analytics

## 3. Spec
- [ ] 3.1 Write `specs/queue-load-management/spec.md`
