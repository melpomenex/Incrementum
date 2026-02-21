## Why

Incrementum does not currently provide a first-class place to store and reuse images for learning workflows. Users need to import files and paste clipboard images directly into a persistent registry so visuals can be reused when creating flashcards and other study content.

## What Changes

- Add an image registry where users can add images from local file import and clipboard paste.
- Persist imported/pasted images and metadata in the local database with stable IDs.
- Provide image registry browsing and selection flows so images can be inserted into flashcard creation and related learning surfaces.
- Define validation and failure handling for unsupported formats, oversized assets, and clipboard parsing errors.

## Capabilities

### New Capabilities
- `image-registry`: Manage persisted image assets (import, clipboard paste, list, retrieve, and use in flashcard/learning workflows).

### Modified Capabilities
- `document-rating`: Flashcard/review content creation can reference registered image assets alongside existing text-first workflows.

## Impact

- Affected specs: new `image-registry`; updated `document-rating` requirements for image-backed flashcard content.
- Affected code: Tauri backend commands and DB models/migrations under `src-tauri/src/`, frontend registry and flashcard integration in `src/`, clipboard/file import handlers, and API contracts shared between UI/backend.
- Dependencies: image decoding/validation pipeline and DB storage strategy for binary data/paths.
