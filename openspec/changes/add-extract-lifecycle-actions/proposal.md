# Change: Extract Lifecycle Actions (Forget / Dismiss / Done)

## Why

SuperMemo's defining IR lifecycle actions — **Forget**, **Dismiss**, **Done** — let users graduate or retire material from the queue without deleting it. Today Incrementum's extracts can only be reviewed-forever or deleted (`delete_extract`, `bulk_delete_extracts`). Documents have `is_dismissed` (`models/document.rs:38`), but extracts have no equivalent, and there is no "reset memory" or "graduate" action. This leaves the IR workflow incomplete: users cannot clean up their queue except by destructive deletion.

## What Changes

### 1. Persisted lifecycle fields on extracts
- Add `is_dismissed BOOLEAN NOT NULL DEFAULT 0` to the `extracts` table (mirrors documents).
- Add `is_dismissed: bool` to the `Extract` model.
- Dismissed extracts are excluded from the due/new extract queries.

### 2. Three lifecycle commands
- `forget_extract(id)`: resets the extract's FSRS memory state (stability, difficulty, reps, review_count → initial values) and clears `next_review_date`, returning it to the new-extract queue. The extract stays in the library.
- `dismiss_extract(id, dismissed)`: sets `is_dismissed`. When dismissed, the extract is removed from the review queue (not returned by `get_due_extracts` / `get_new_extracts`) but remains in the library and is still visible in the document's extract list (with a dismissed badge).
- `graduate_extract(id)`: sets `next_review_date` far in the future (default +5 years) and marks the extract as graduated by setting a high stability. This is the "Done" action — the material is mastered and leaves active rotation.

### 3. Queue exclusion
- `get_due_extracts`, `get_new_extracts`, `get_due_video_extracts`, `get_new_video_extracts` SHALL filter out dismissed extracts (`WHERE is_dismissed = 0`).

### 4. Frontend actions
- Add Forget / Dismiss / Done buttons to the extract review UI (extract scroll item / extract browser).
- Add a dismissed badge in the extract list.

## Impact

### Affected Specs
- **extract-lifecycle** — New spec for Forget/Dismiss/Done semantics.

### Affected Code Areas
- `src-tauri/migrations/` — `011_add_extract_dismissed.sql`.
- `src-tauri/src/models/extract.rs` — `is_dismissed` field.
- `src-tauri/src/database/repository.rs` — Read/write `is_dismissed`; filter in due/new queries; add `update_extract_dismissed`.
- `src-tauri/src/commands/extract_review.rs` — `forget_extract`, `dismiss_extract`, `graduate_extract` commands.
- `src-tauri/src/lib.rs` — Register commands.
- `src/api/extracts.ts` — Wrappers.
- `src/components/review/ExtractScrollItem.tsx` / extract browser — action buttons + badge.

### Non-goals
- No bulk lifecycle actions this iteration (per-extract only; bulk can follow the existing `extract_bulk.rs` pattern later).
- No change to learning-item (flashcard) lifecycle — only extracts.
- "Graduate" does not create a separate graduated state column; it uses the existing scheduling fields (far-future date + high stability) to keep the schema minimal.
