## Why

Incrementum has the backend foundations for an image registry, but the user flow is still too hidden and too authoring-modal-centric. The intended workflow is simpler: a user takes a screenshot, it lands on the clipboard, they press `Ctrl+V` / `Cmd+V` while working in the app, and the image is immediately available for flashcard creation.

That workflow needs a stronger product contract. Users need a clear paste/upload entry point, immediate confirmation that the image was added, and a dedicated image library where they can review and manage stored assets instead of relying on a narrow strip of thumbnails inside flashcard authoring.

## What Changes

- Add a clipboard-first ingestion UX for the image registry on relevant app surfaces, including `Ctrl+V` / `Cmd+V` when the user is in the registry or flashcard authoring flows.
- Add explicit post-ingest feedback with visual confirmation, including a thumbnail preview and a direct way to continue into registry browsing or flashcard use.
- Add a dedicated image registry library surface for browsing, searching, sorting, previewing, selecting, and deleting stored images.
- Define common management behaviors for the registry, including multi-select actions, metadata visibility, duplicate handling, and referenced-image safeguards.

## Capabilities

### Modified Capabilities
- `image-registry`: Expand the registry from basic storage APIs into a first-class user-facing library with clipboard-driven intake and management UX.

## Impact

- Affected specs: `image-registry`
- Affected code: image registry UI routes/components in `src/`, flashcard studio registry hooks, keyboard/paste handling, image registry API contracts, and any supporting backend metadata/query commands in `src-tauri/src/`
- Dependencies: existing `add-image-registry` change package and the current `image_assets` persistence model
