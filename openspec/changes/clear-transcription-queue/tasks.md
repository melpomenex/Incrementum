## 1. Backend — Repository delete methods

- [x] 1.1 Add `delete_transcription_queue_by_status(statuses: Vec<String>)` to repository.rs that runs `DELETE FROM transcription_queue WHERE status IN (...)`
- [x] 1.2 Add `delete_transcription_queue_entry(id: String)` to repository.rs that runs `DELETE FROM transcription_queue WHERE id = ?`

## 2. Backend — Tauri commands

- [x] 2.1 Add `clear_transcription_queue(statuses: Vec<String>)` command to mod.rs — call repo delete method, emit `transcription://queue-updated` event
- [x] 2.2 Add `remove_transcription_entry(id: String)` command to mod.rs — call repo delete method, emit `transcription://queue-updated` event

## 3. Frontend — API and store

- [x] 3.1 Add `clearTranscriptionQueue(statuses: string[])` and `removeTranscriptionEntry(id: string)` to `src/api/transcription.ts`
- [x] 3.2 Add `clearByStatus(statuses: string[])` and `removeEntry(id: string)` actions to `src/stores/transcriptionQueueStore.ts`

## 4. Frontend — UI

- [x] 4.1 Add "Clear Failed", "Clear Completed", and "Clear All" buttons above the queue list in AudioTranscriptionSettings.tsx, conditionally shown based on queue contents
- [x] 4.2 Add a remove/trash button to individual queue entries

## 5. Verification

- [x] 5.1 Build the project and verify no compile errors
- [x] 5.2 Test clearing failed entries, completed entries, and all entries via the UI
