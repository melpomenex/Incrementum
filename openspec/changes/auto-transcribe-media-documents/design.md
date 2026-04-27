## Context

The app already has a complete transcription system with two backends:
- **Local Whisper** (whisper.cpp sidecar) — serial `JobQueue` in Rust, processes jobs one at a time, stores results in `transcripts` + `transcript_segments` tables
- **Groq Cloud API** — frontend-driven, auto-chunks large files, handles rate limits

Audio/video imports already support transcription, but it's manual — the user must trigger it. The `import_podcast_audio_file` command does inline transcription, but `import_video_file` does not. Settings have `autoTranscription` and `autoTranscribeLocalVideos` flags that are currently unused.

FTS5 search tables (`document_search`, `extract_search`) exist and are synced via SQL triggers on the `documents` and `extracts` tables, but the Rust `search.rs` command handlers are stubs.

## Goals / Non-Goals

**Goals:**
- Auto-enqueue transcription when a media document is imported (audio, video, podcast) if `autoTranscription` is enabled
- Process the queue in the background without blocking the UI
- Populate the document `content` field with transcript text on completion (FTS5 triggers will auto-index)
- Show transcription status on media document cards and in the viewer
- Provide a queue management view to monitor, retry, cancel, and prioritize jobs
- Catch up on untranscribed existing media documents during idle time

**Non-Goals:**
- Rewriting the existing Whisper engine or Groq transcription client
- Implementing the FTS5 search command handlers (they are stubs — separate concern)
- Speaker diarization or multi-speaker transcripts (future enhancement)
- Real-time streaming transcription (the existing engine already emits progress)
- Transcription of YouTube videos (already handled by YouTube transcript API)

## Decisions

### 1. Backend-first queue management in Rust

**Decision**: Add a `transcription_queue` table and manage auto-transcription entirely in the Rust backend, rather than frontend-driven orchestration.

**Rationale**: The existing `JobQueue` in Rust already serializes Whisper jobs. Adding a persistent queue table means jobs survive app restarts. The backend can also detect idle time and process backlogged documents without frontend involvement. Frontend-only orchestration would lose jobs on refresh and can't detect idle reliably.

**Alternative considered**: Frontend-managed queue with localStorage. Rejected because transcription is a long-running process that should survive page refreshes, and the backend already has the engine.

### 2. Reuse existing transcription backends

**Decision**: Use the existing `TranscriptionEngine` (local) and `GroqTranscription` (cloud) without modification. The auto-transcription layer is a scheduling wrapper, not a new transcription implementation.

**Rationale**: Both backends are proven. The auto-transcription layer just decides *when* and *what* to transcribe, not *how*.

### 3. Hook into document import and idle detection

**Decision**: Two trigger points for auto-transcription:
1. **On import**: When a media document is created, check `autoTranscription` setting and enqueue
2. **On idle**: Periodic scan for untranscribed media documents when the app has been idle for a configurable threshold

**Rationale**: On-import catches new documents immediately. Idle scan catches documents that existed before auto-transcription was enabled, or that failed and need retry. The idle scan avoids competing with user activity.

### 4. Populate `documents.content` for FTS5 indexing

**Decision**: After transcription completes, write the full transcript text to the document's `content` column. The existing FTS5 triggers on `documents` will automatically index it.

**Rationale**: No custom indexing code needed — the SQL triggers already sync `documents.content` → `document_search`. This also makes transcripts available to the existing extraction flow which reads from `documents.content`.

### 5. Frontend status via Tauri events

**Decision**: Extend the existing Tauri event system (`transcription://*` events) with queue-level events (`transcription://queue-updated`, `transcription://job-status`). The frontend listens and updates UI reactively.

**Rationale**: The existing event pattern (`transcription://progress`, `transcription://segment`, etc.) works well. Extending it is consistent and avoids polling.

### 6. Transcription queue stored in SQLite

**Decision**: New `transcription_queue` table with columns: `id`, `document_id`, `audio_path`, `provider`, `model_id`, `language`, `status` (pending/processing/completed/failed/cancelled), `error_message`, `priority`, `created_at`, `started_at`, `completed_at`, `retry_count`.

**Rationale**: Persistent queue survives app restarts. SQLite is already the database. The `priority` column enables user-controlled ordering.

## Risks / Trade-offs

- **[Long transcription times on large files]** → Show accurate progress and allow cancellation. Default to Groq for large files if API key is configured, falling back to local.
- **[Resource usage during idle transcription]** → Only run idle transcription when CPU is below a threshold (use simple heuristic: no active transcription jobs + no user interactions for N minutes). Allow user to configure idle threshold or disable idle scanning entirely.
- **[Disk space for WAV intermediates]** → The engine already cleans up WAV files after transcription. No additional risk.
- **[Failed transcriptions accumulating]** → Retry failed jobs up to 3 times with exponential backoff. After max retries, mark as permanently failed and notify user in queue view.
- **[Groq rate limits during bulk import]** → Respect Groq free tier limits (20 RPM, 28800s/day). Queue should space Groq jobs to stay within limits. Track usage against existing `groqTranscriptionUsage` settings.
