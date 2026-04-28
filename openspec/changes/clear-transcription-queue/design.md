## Context

The transcription queue currently has zero delete operations. Entries transition through statuses (pending → processing → completed/failed) but are never removed. The `cancel_transcription_job` command only sets status to `cancelled` without deleting the row. Over time, failed and completed entries accumulate, cluttering the queue view.

## Goals / Non-Goals

**Goals:**
- Allow users to clear queue entries by status (failed, completed, cancelled, or all)
- Allow removing individual entries from the queue
- Keep the UI simple — a few action buttons next to the existing queue controls

**Non-Goals:**
- Auto-cleanup of old entries (can be added later)
- Bulk selection UI for cherry-picking entries to remove
- Archiving vs deleting distinction

## Decisions

### 1. Single `clear_transcription_queue` command with status filter

**Rationale**: One command that accepts an optional status filter is more flexible than separate `clear_failed`, `clear_completed` commands. The caller passes a list of statuses to delete (e.g., `["failed"]`, `["completed", "cancelled"]`, or all).

**Alternative considered**: Separate commands per status — rejected because it duplicates code for what is fundamentally one DELETE query with a WHERE clause.

### 2. Delete only — no archive

**Rationale**: Queue entries are operational, not user data. The actual transcript content lives in the `transcripts` and `documents` tables. Deleting a queue entry just removes it from the processing list; it doesn't lose any completed transcription work.

### 3. Guard against deleting active entries

**Rationale**: The clear command MUST NOT delete entries with `pending` or `processing` status unless explicitly requested (via "Clear All"). The "Clear Failed" and "Clear Completed" buttons are safe one-click actions.

## Risks / Trade-offs

- **[Deleting a processing entry]** Could orphan the active transcription task → Mitigated by excluding active statuses from the targeted clear buttons; "Clear All" should cancel active work first.
- **[Re-transcription]** Clearing a completed entry doesn't undo the transcription — the document still has its content. If the user wants to re-transcribe, they use the existing "Transcribe All" or manual enqueue.
