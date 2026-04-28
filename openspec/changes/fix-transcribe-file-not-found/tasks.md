## 1. Backend — Enqueue-time validation

- [x] 1.1 Update `enqueue_all_untranscribed` in `src-tauri/src/transcription/mod.rs` to check `Path::exists()` for each file before enqueueing; collect skipped files into a `skipped: Vec<{title, reason}>` list
- [x] 1.2 Update the return type of `enqueue_all_untranscribed` to include `skipped` alongside the existing enqueue count; update the Tauri command signature accordingly

## 2. Backend — Process-time safety net

- [x] 2.1 Add a `Path::exists()` check in `auto_queue::process_entry` (auto_queue.rs) before calling `engine.prepare_audio`; if missing, mark the entry as failed with "Audio file not found: <path>"

## 3. Frontend — Display skipped files

- [x] 3.1 Update `enqueueAllUntranscribed` return type in `src/api/transcription.ts` to include `skipped: Array<{title: string, reason: string}>`
- [x] 3.2 Update the "Transcribe All" handler in `AudioTranscriptionSettings.tsx` to display skipped file names in a toast/notification when the `skipped` list is non-empty

## 4. Verification

- [x] 4.1 Build the project (`cargo build` + frontend build) and verify no compile errors
- [x] 4.2 Test the "Transcribe All" flow with a mix of existing and non-existing audio files to confirm skip behavior and error messages
