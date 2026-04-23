## Context

Incrementum already persists image assets and exposes basic import/paste plumbing, but the UX is still centered inside flashcard studio. That is not enough for the screenshot-to-flashcard workflow the product should optimize for. Users need to be able to paste a clipboard image into the app with minimal friction, trust that it was saved, and later browse the registry as its own library.

The existing backend should be reused where possible. This change is primarily about product behavior, UI state, and registry management workflows rather than replacing the image storage model.

## Goals / Non-Goals

Goals:
- Make pasted clipboard images feel like a first-class ingest path, not a hidden secondary action.
- Support `Ctrl+V` / `Cmd+V` in the app when the current surface is able to accept image registry intake.
- Show immediate success feedback after paste/upload, with enough context for the user to trust the image was stored.
- Add a dedicated registry library view that supports browsing and common management actions.
- Keep the flashcard creation flow tightly connected to registry assets.

Non-Goals:
- Image editing features such as crop, annotation, or background removal.
- OCR, auto-captioning, or semantic tagging.
- Cloud sync or remote image hosting.

## Decisions

### 1. Treat clipboard paste as a primary ingest action on eligible surfaces
- Decision: When the focused app surface supports image intake, `Ctrl+V` / `Cmd+V` should attempt registry ingest before falling back to normal text paste behavior for image clipboard payloads.
- Eligible surfaces: dedicated image registry library, flashcard studio, and other image-picking contexts added later.
- Rationale: The screenshot workflow should not require users to hunt for an import button after every capture.

### 2. Confirm ingest twice: transient toast plus local visual placement
- Decision: Successful ingest should show both:
  - a toast/snackbar with image count and short status
  - a local UI confirmation in the current surface, such as highlighting the newly added asset in the registry grid or selection tray
- Rationale: Toast-only feedback is easy to miss; local placement gives users a stable place to look next.

### 3. Add a dedicated registry library surface instead of keeping registry access embedded only in flashcard studio
- Decision: The image registry should have its own browsable surface reachable from the app UI, while flashcard studio continues to embed a lightweight picker.
- Rationale: Users need a reusable asset library, not just an authoring-side attachment strip.

### 4. Support practical management actions before expanding into heavy media tooling
- Decision: The first-class library should include:
  - grid browsing with thumbnails
  - larger preview
  - search by filename
  - sorting by newest, oldest, name, and size
  - multi-select
  - delete for unreferenced assets
  - visible referenced state and dimensions/file size metadata
- Rationale: These are the common actions users need to keep the registry usable without introducing editing scope.

## Risks / Trade-offs

- Clipboard behavior can conflict with text-entry expectations.
  - Mitigation: only intercept image payloads on eligible surfaces; plain text paste continues unchanged.
- A dedicated library introduces another navigation surface.
  - Mitigation: keep flashcard studio picker for quick use and add deep links between picker and full library.
- Large registries can make thumbnail rendering sluggish.
  - Mitigation: paginate or virtualize the library grid and avoid decoding full-size assets for browsing.

## Migration Plan

1. Reuse current image registry persistence and ingest commands where sufficient.
2. Add any missing backend fields or query options needed for sorting, searching, or usage state.
3. Add dedicated image registry library navigation and browsing UI.
4. Add clipboard shortcut handling and success feedback across eligible surfaces.
5. Update flashcard authoring to deep-link into the library and preserve selected assets when returning.

## Open Questions

- Should the dedicated image registry live as its own tab, a modal library, or both?
- Should the first release support drag-and-drop image ingestion in addition to file picker and clipboard paste?
