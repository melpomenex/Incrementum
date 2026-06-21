# Implementation Tasks

## 1. Backend: Storage & Model

- [ ] 1.1 Create migration `010_add_extract_priority.sql` adding `priority_score REAL NOT NULL DEFAULT 0.0` to `extracts`
- [ ] 1.2 Add `priority_score: f64` field to `Extract` struct (`models/extract.rs`), default 0.0 in `new`/`with_html`
- [ ] 1.3 Update `Repository::create_extract` to bind `priority_score`
- [ ] 1.4 Update `Repository::get_extract`, `get_due_extracts`, `get_new_extracts`, and any other extract readers to read `priority_score`
- [ ] 1.5 Add `Repository::update_extract_priority(id, priority_score)` method
- [ ] 1.6 Add `Repository::cascade_document_priority(document_id, new_priority)` method

## 2. Backend: Commands & Inheritance

- [ ] 2.1 Add `set_extract_priority` Tauri command (`commands/extract.rs`)
- [ ] 2.2 Register `set_extract_priority` in `lib.rs` invoke handler
- [ ] 2.3 On extract creation, look up parent document `priority_score` and inherit
- [ ] 2.4 On document priority update (`commands/document.rs` / `document_repository.rs`), cascade to non-overridden extracts
- [ ] 2.5 Blend inherited priority into extract queue weight in `commands/queue.rs`

## 3. Frontend

- [ ] 3.1 Expose `priorityScore` on extract `QueueItem` type and queue store
- [ ] 3.2 (Optional, deferred) Surface priority badge in extract review UI

## 4. Spec & Tests

- [ ] 4.1 Write `specs/extract-priority/spec.md` with ADDED Requirements + Scenarios
- [ ] 4.2 Add Rust unit test for queue priority blending
- [ ] 4.3 Add Rust test for inheritance-on-create
