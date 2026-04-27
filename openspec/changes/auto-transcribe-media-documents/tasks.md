## 1. Database — Transcription Queue Table

- [x] 1.1 Add `transcription_queue` migration with columns: `id` (TEXT PK), `document_id` (TEXT FK), `audio_path` (TEXT), `provider` (TEXT), `model_id` (TEXT), `language` (TEXT), `status` (TEXT: pending/processing/completed/failed/cancelled), `error_message` (TEXT nullable), `priority` (INTEGER default 0), `created_at` (TEXT ISO date), `started_at` (TEXT nullable), `completed_at` (TEXT nullable), `retry_count` (INTEGER default 0)
- [x] 1.2 Add index on `transcription_queue(status, priority, created_at)` for efficient queue processing queries
- [x] 1.3 Add Rust structs for `TranscriptionQueueEntry` and repository methods: `enqueue`, `dequeue_next`, `update_status`, `get_by_document_id`, `get_by_status`, `cancel`, `retry`

## 2. Backend — Auto-Transcription Queue Processing

- [x] 2.1 Create `src-tauri/src/transcription/auto_queue.rs` — an `AutoTranscriptionQueue` that wraps the existing `JobQueue` with persistence via the `transcription_queue` table
- [x] 2.2 Implement `enqueue_auto_transcription(document_id, audio_path, priority)` — creates a queue entry, emits `transcription://queue-updated` event
- [x] 2.3 Implement queue processor loop: dequeues next pending job (ordered by priority desc, created_at asc), updates status to `processing`, delegates to existing `TranscriptionEngine` or Groq depending on provider
- [x] 2.4 On completion: write transcript text to `documents.content`, store segments in `transcript_segments`, update queue entry to `completed`, emit events
- [x] 2.5 On failure: increment `retry_count`, reset to `pending` if under 3 retries, otherwise set `failed` with error message
- [x] 2.6 Handle cancelled status: check before processing each job, skip if cancelled
- [x] 2.7 On app startup: reset any `processing` jobs back to `pending` (interrupted by shutdown), resume queue processing

## 3. Backend — Idle-Time Backfill Scanner

- [x] 3.1 Create `src-tauri/src/transcription/idle_scanner.rs` — periodic task that runs every N minutes (configurable, default 5)
- [x] 3.2 Query for media documents (fileType = audio/video) where `content` is empty or null AND no completed queue entry exists
- [x] 3.3 Enqueue found documents with low priority (-1)
- [x] 3.4 Respect settings: only run when `autoTranscription` is enabled and idle scanning is not disabled
- [x] 3.5 Only trigger scan when no transcription job is currently processing

## 4. Backend — Hook into Document Import

- [x] 4.1 In `import_video_file` command: after document creation, check `autoTranscription` and `autoTranscribeLocalVideos` settings, enqueue for auto-transcription if both are true
- [x] 4.2 In `import_podcast_audio_file` command: refactor to use the auto-transcription queue instead of inline transcription, preserving existing behavior for manual trigger
- [x] 4.3 Expose `enqueue_auto_transcription` Tauri command for frontend to trigger on audio import

## 5. Backend — Tauri Commands for Queue Management

- [x] 5.1 `get_transcription_queue` — returns all queue entries with document title and status
- [x] 5.2 `cancel_transcription_job(id)` — sets status to cancelled, stops processing if active
- [x] 5.3 `retry_transcription_job(id)` — resets failed job to pending with retry_count = 0
- [x] 5.4 `prioritize_transcription_job(id)` — sets priority to high (10)
- [x] 5.5 `get_transcription_status(document_id)` — returns queue entry + transcript status for a specific document

## 6. Frontend — Transcription Queue Store

- [x] 6.1 Create `src/stores/transcriptionQueueStore.ts` — Zustand store with queue entries, filtered views, and actions (cancel, retry, prioritize)
- [x] 6.2 Listen to `transcription://queue-updated` events to refresh queue state
- [x] 6.3 Listen to existing `transcription://progress` and `transcription://segment` events to update active job progress in queue view

## 7. Frontend — Queue Management UI

- [x] 7.1 Add transcription queue section to TTS/Transcription settings panel showing active queue with document title, status badge, progress bar, and action buttons (cancel, retry, prioritize)
- [x] 7.2 Add empty state: "No pending transcriptions" with description of auto-transcription behavior
- [x] 7.3 Add "Transcribe All" button to enqueue all untranscribed media documents immediately

## 8. Frontend — Document Status Indicators

- [x] 8.1 Add transcription status badge to media document cards in the library: "Transcribing..." (animated), "Pending", "Failed", or no badge (completed)
- [x] 8.2 In media document viewer: show transcription progress bar when actively transcribing, with live segment count
- [x] 8.3 In media document viewer: display completed transcript text in a tab/panel alongside the media player
- [x] 8.4 Make transcript text selectable and extractable (Ctrl+E or extraction button)

## 9. Frontend — Search & Extraction Integration

- [x] 9.1 Verify FTS5 triggers correctly index `documents.content` when updated with transcript text (existing DB triggers should handle this)
- [x] 9.2 Add transcript segment timestamps to extracts created from transcript text (store timestamp in extract metadata or `page_number` field)
- [x] 9.3 When a search result matches a transcript, include media timestamp in result metadata for navigation

## 10. Settings

- [x] 10.1 Add `idleTranscriptionEnabled` (boolean, default true) to `AudioTranscriptionSettings`
- [x] 10.2 Add `idleThresholdMinutes` (number, default 5) to `AudioTranscriptionSettings`
- [x] 10.3 Wire existing `autoTranscription` flag to the new backend auto-transcription pipeline
- [x] 10.4 Add transcription settings i18n strings for en, de, es, fr, ja, zh
