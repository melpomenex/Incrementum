## Context

The transcription system has two import paths that store the **original** filesystem path for audio files (`import_document`, `import_podcast_audio_file`), and one that copies the file to app-managed storage first (`import_video_file`). The "Transcribe All" feature queries the database for untranscribed media documents and enqueues them for transcription using whatever path is stored in `documents.file_path`. No existence check is performed at enqueue time or before ffmpeg processing, so missing files produce an unhandled OS error.

On macOS, files in sandboxed locations (Downloads, external drives) may also become inaccessible after security-scoped bookmarks expire.

## Goals / Non-Goals

**Goals:**
- Prevent "No such file or directory" crashes when transcribing files whose original path no longer resolves
- Give users clear feedback about which files were skipped and why
- Apply the same existence-check pattern already used in `generate_video_transcript` to the auto-queue path

**Non-Goals:**
- Copying audio files to app-managed storage at import time (separate refactor)
- Handling macOS security-scoped bookmarks (requires Tauri sandbox changes)
- Re-trying or re-discovering moved files

## Decisions

### 1. Check file existence at enqueue time in `enqueue_all_untranscribed`

**Rationale**: Catching missing files early prevents them from entering the queue at all, avoids wasting a queue slot, and allows returning a list of skipped files to the user in a single response.

**Alternative considered**: Check only at process time in `auto_queue::process_entry` — rejected because the user gets no feedback about why nothing was transcribed.

**Decision**: Do both. Filter at enqueue time for user feedback, and add a defensive check at process time as a safety net.

### 2. Return structured skip information from the Tauri command

**Rationale**: The frontend "Transcribe All" button currently shows a generic success/error toast. Returning a list of `{ title, reason }` for skipped files lets the UI show exactly which files were skipped.

**Alternative considered**: Just log a warning and skip silently — rejected because users would see fewer files transcribed than expected with no explanation.

### 3. Use `std::path::Path::exists()` for the check

**Rationale**: Simple, synchronous, already used in `generate_video_transcript`. The check is fast and happens once per file at enqueue time — no performance concern.

## Risks / Trade-offs

- **[Race condition]** File could be deleted between the existence check and ffmpeg processing → Mitigated by the defensive check in `process_entry`; worst case the file fails with a clear error message instead of an unhandled crash.
- **[macOS sandbox]** File exists but is inaccessible due to expired security bookmark → `Path::exists()` returns false in this case, so the file is skipped with the "not found" message, which is accurate from the app's perspective.
