# Change: Extract Priority Inheritance

## Why

Incrementum positions itself as a SuperMemo-style incremental reading (IR) tool. The defining feature of true IR — going back to Wozniak's original design — is that **extracts inherit their parent article's priority**, so a library of thousands of articles stays tractable. Today Incrementum only stores priority on documents (`priority_rating`, `priority_slider`, `priority_score`); extracts have no priority field, and the queue hardcodes extract priority to `9.0` (new) / `7.0` (reviewed) regardless of which article the extract came from (`src-tauri/src/commands/queue.rs:191-195`). This means a high-priority article's extracts float at the same queue weight as a low-priority one's, breaking the IR priority chain.

## What Changes

### 1. Persisted extract priority
- Add `priority_score` (REAL, default 0.0) column to the `extracts` table.
- Add the field to the `Extract` Rust model.
- On extract creation, inherit the parent document's current `priority_score`. If the document has none, default to 0.0.

### 2. Queue ordering uses inherited priority
- When building extract queue items, blend the inherited document priority with the existing new/reviewed base weight, so:
  - Higher-priority documents surface their extracts earlier.
  - Extracts still get the new-vs-reviewed boost (new extracts remain slightly preferred).
- Expose `priority_score` on the extract `QueueItem` so the UI can display it.

### 3. Priority re-inheritance on document priority change
- When a document's priority is updated, propagate the new `priority_score` to extracts that have not been individually re-prioritized (i.e. extract's `priority_score` still equals its inherited value). This mirrors SuperMemo's "extract inherits until manually overridden" behavior.

### 4. Optional manual override
- Add a command to set an individual extract's priority, marking it as user-overridden so it stops inheriting.

## Impact

### Affected Specs
- **extract-priority** — New spec for extract priority inheritance and override.

### Affected Code Areas
- `src-tauri/migrations/` — New migration adding `priority_score` to `extracts`.
- `src-tauri/src/models/extract.rs` — Add `priority_score` field.
- `src-tauri/src/database/repository.rs` — Read/write priority on extracts; inherit on create; propagate on document update.
- `src-tauri/src/commands/queue.rs` — Blend inherited priority into queue weight.
- `src-tauri/src/commands/document.rs` — On priority update, cascade to child extracts.
- `src-tauri/src/commands/extract.rs` — New `set_extract_priority` command.

### Migration Requirements
- Database migration: `ALTER TABLE extracts ADD COLUMN priority_score REAL NOT NULL DEFAULT 0.0`.
- Backfill: existing extracts adopt their parent document's `priority_score` (or 0.0 if parent has none).

### Non-goals
- No new UI screen for bulk extract priority editing (manual override is a single command, surfaced later).
- No change to learning-item (flashcard) scheduling — only extract queue ordering.

---

## Tasks

- [ ] 1.1 Add migration `010_add_extract_priority.sql`
- [ ] 1.2 Add `priority_score` to `Extract` model + `new`/`with_html` defaults
- [ ] 1.3 Update repository `create_extract`/`get_extract`/`get_due_extracts`/`get_new_extracts` to read/write `priority_score`
- [ ] 1.4 Add `update_extract_priority` repository method
- [ ] 1.5 Add `set_extract_priority` Tauri command + register in `lib.rs`
- [ ] 1.6 Inherit parent document `priority_score` on extract creation
- [ ] 1.7 Cascade priority update from document to non-overridden child extracts
- [ ] 1.8 Blend inherited priority into extract queue weight in `queue.rs`
- [ ] 1.9 Expose `priority_score` on extract `QueueItem`
- [ ] 1.10 Write OpenSpec spec under `specs/extract-priority/spec.md`
