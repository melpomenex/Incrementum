## 1. Data Model and Backend Foundations

- [x] 1.1 Add SQLite migration(s) for `image_assets` and reference fields/indexes required by flashcard/image linkage.
- [x] 1.2 Implement backend image asset model/repository methods for create, list, get-by-id, and delete/soft-delete checks.
- [x] 1.3 Implement shared ingest pipeline (file + clipboard) with MIME/type validation, max-size enforcement, metadata extraction, and SHA-256 dedup.
- [x] 1.4 Add/extend Tauri commands and DTOs for ingest, browse, retrieve, and attach image asset IDs in flashcard payloads.

## 2. Clipboard and Import UX

- [x] 2.1 Add frontend image registry surface with grid/list rendering of stored assets and metadata.
- [x] 2.2 Implement file import flow wiring to backend ingest command with success/error feedback.
- [x] 2.3 Implement clipboard paste ingestion flow with focus/shortcut handling and actionable failure states.
- [x] 2.4 Add registry delete behavior with dependency-safe messaging for assets referenced by flashcards.

## 3. Flashcard Integration

- [x] 3.1 Add registry picker UI in flashcard creation/edit flows and bind selection to image asset references.
- [x] 3.2 Update flashcard read/render views to resolve and display referenced image assets reliably.
- [x] 3.3 Ensure document review/rating flows continue to submit FSRS ratings unchanged when image-backed flashcards are created.

## 4. Validation and Quality

- [x] 4.1 Add backend tests for ingest validation, dedup behavior, retrieval, and referenced-asset deletion safeguards.
- [x] 4.2 Add frontend tests for import/paste UX, registry browsing, and flashcard image selection behavior.
- [ ] 4.3 Add an end-to-end verification pass for creating a flashcard from imported and pasted images and re-rendering it after restart.
