## Context

Incrementum supports text-centric document review but lacks a reusable visual asset library for learning content. Users currently cannot import files or paste clipboard images into a managed store that can be reused during flashcard authoring. The change introduces a new cross-cutting workflow across Tauri commands, database schema, and UI surfaces.

Constraints:
- Must run locally with existing Tauri + SQLite architecture.
- Clipboard and file import behavior must work consistently across supported desktop environments.
- Image operations must not degrade interactive UI performance.

## Goals / Non-Goals

**Goals:**
- Add an image registry with stable asset IDs and persistent storage.
- Support file import and clipboard paste ingestion.
- Expose list/retrieve/delete and selection flows for flashcard creation.
- Define validation limits and user-visible failure behavior.

**Non-Goals:**
- Cloud sync or remote image hosting.
- Advanced editing (crop, annotate, filters).
- OCR or semantic tagging in this change.

## Decisions

### 1. Store image binary payloads in the local database with metadata columns
- Rationale: Atomic persistence and backup/restore behavior match existing single-user local architecture.
- Alternative considered: filesystem blobs with DB pointers. Rejected for this phase to avoid path portability and orphan cleanup complexity.

### 2. Normalize ingest through a single backend command layer
- Rationale: File import and clipboard paste should share identical validation, hashing, dedup, and metadata extraction paths.
- Alternative considered: separate frontend-specific handlers. Rejected due to divergent behavior and duplicated validation logic.

### 3. Use content hashing for deduplication and idempotent ingest
- Rationale: Users often paste/import the same image repeatedly while authoring cards; hash-based dedup avoids redundant storage and simplifies UX.
- Alternative considered: no dedup. Rejected due to DB bloat and confusing duplicate entries.

### 4. Integrate registry selection into flashcard authoring through image asset IDs
- Rationale: Stable references allow cards to render images without embedding duplicate payloads in each flashcard record.
- Alternative considered: inline base64 image storage in flashcard fields. Rejected because it increases payload size and coupling.

## Risks / Trade-offs

- [Risk] Large images increase DB size and memory usage during decoding. -> Mitigation: enforce max size constraints, reject oversized files, and generate bounded thumbnails.
- [Risk] Clipboard image formats vary by OS and can fail silently. -> Mitigation: explicit clipboard MIME detection and actionable error messages.
- [Risk] Hash collisions are improbable but possible. -> Mitigation: use strong hash (SHA-256) plus byte-size and MIME checks before dedup merge.
- [Trade-off] DB blob storage improves consistency but can increase backup size. -> Mitigation: include future migration path to external blob store if growth exceeds thresholds.

## Migration Plan

1. Add DB migration for `image_assets` table and indexes.
2. Add backend commands for ingest/list/get/delete and flashcard image attachment references.
3. Add frontend image registry view with import and clipboard paste actions.
4. Wire flashcard creation/edit flow to choose one or more registry assets.
5. Rollout guarded by feature toggle in settings for initial verification.

Rollback:
- Disable feature toggle and stop writing new image assets.
- Keep migration in place (non-destructive rollback) and ignore image references until follow-up cleanup is approved.

## Open Questions

- Should flashcards support multiple ordered images or only one in v1?
- What default max image size should be enforced (for example, 10MB vs 25MB)?
- Should delete block when an image is referenced by existing flashcards, or allow soft delete with tombstones?
