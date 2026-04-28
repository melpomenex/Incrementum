## Why

The transcription queue accumulates failed, cancelled, and completed entries with no way to remove them. Users report that failed entries pile up and there is no "clear" button. This makes the queue unusable over time — you can't distinguish old failures from current work.

## What Changes

- Add `clear_transcription_queue` Tauri command that deletes queue entries by status (failed, completed, cancelled, or all)
- Add `remove_transcription_entry` Tauri command to delete a single queue entry
- Add corresponding repository methods (`delete_transcription_queue_by_status`, `delete_transcription_queue_entry`)
- Add frontend API functions and store actions for clearing
- Add "Clear Failed", "Clear Completed", and "Clear All" buttons to the queue section of AudioTranscriptionSettings

## Capabilities

### New Capabilities
- `transcription-queue-cleanup`: Delete individual or bulk transcription queue entries by status, with UI controls in the transcription settings

### Modified Capabilities

## Impact

- `src-tauri/src/database/repository.rs` — add delete methods
- `src-tauri/src/transcription/mod.rs` — add `clear_transcription_queue` and `remove_transcription_entry` commands
- `src/api/transcription.ts` — add `clearTranscriptionQueue` and `removeTranscriptionEntry`
- `src/stores/transcriptionQueueStore.ts` — add clear/remove actions
- `src/components/settings/AudioTranscriptionSettings.tsx` — add clear buttons to queue UI
