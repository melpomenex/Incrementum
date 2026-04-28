## Why

When an MP3 file is imported and "Transcribe All" is triggered from the transcription settings, the operation fails with "No such file or directory (os error 2)". Audio files imported via `import_document` or `import_podcast_audio_file` store the original filesystem path without copying the file. When transcription runs, the path is passed directly to ffmpeg — if the file was moved, deleted, or is in a macOS sandboxed location, ffmpeg fails with no useful error recovery.

## What Changes

- Add file existence validation in `auto_queue::process_entry` before calling `prepare_audio` (mirroring the check already present in `generate_video_transcript`)
- Add file existence validation in `enqueue_all_untranscribed` to skip missing files with a clear error message instead of enqueueing them
- Return per-file error information from `enqueue_all_untranscribed` so the frontend can display which files failed and why

## Capabilities

### New Capabilities
- `transcription-path-validation`: Validate audio file paths exist before enqueueing or processing transcription jobs, with clear error reporting for missing files

### Modified Capabilities

## Impact

- `src-tauri/src/transcription/auto_queue.rs` — add existence check before `prepare_audio`
- `src-tauri/src/transcription/mod.rs` — validate paths in `enqueue_all_untranscribed`, return skip info
- `src-tauri/src/database/repository.rs` — potentially update `get_untranscribed_media_documents` to include existence info
- `src/api/transcription.ts` — update return type for `enqueueAllUntranscribed` to handle per-file errors
- `src/components/settings/AudioTranscriptionSettings.tsx` — display skipped files to the user
