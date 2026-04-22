## Context

The repository already contains most of the raw ingredients for highlighting, but they are split across incompatible flows:

- `CreateExtractDialog` persists `color` and `selection_context` through `createExtract()`
- `DocumentViewer` already reloads extracts after extract creation
- `PDFViewer` has a dedicated `HighlightLayer`, but it is fed by `useHighlightManager()` local state instead of persisted extracts
- `EPUBViewer` has search-only highlight support and no persisted user highlight rehydration
- `DocumentViewer` owns the `.html` and `.markdown` reading surfaces and already tracks selected text there, but it does not persist or rehydrate DOM-anchored highlight overlays
- extract list/detail surfaces show color metadata on extracts, but do not function as persistent multi-color highlighted reading surfaces

This produces a misleading UX:

- the user can choose a highlight color
- the app can save an extract with selection metadata
- but the reader itself does not reliably show the saved highlight after reload

## Goals / Non-Goals

**Goals**

- A user-created highlight is visible again after reopening the same document
- Highlight color, note, tags, and category remain attached to the persisted record
- PDF, EPUB, HTML, Markdown, and extract readers render the persisted highlight when a valid locator is available
- "Highlight" and "Create Extract" use one persistence model instead of parallel state systems

**Non-Goals**

- Designing a brand new annotations data model separate from extracts
- Implementing highlighting for unsupported binary/media document types immediately
- Building collaborative highlight sync or threaded annotation discussions
- Solving every historical extract record that lacks usable selection metadata

## Decisions

### 1. Use extracts as the canonical persisted highlight record

**Decision**: Persist highlights through the existing extract model rather than introducing a second annotations table for document-reader highlights.

**Rationale**: The current product already stores the relevant metadata on extracts (`selection_context`, `highlight_color`, `category`, `tags`, `notes`). Reusing that path avoids duplicating persistence, editing, search indexing, and learning-item generation behavior.

### 2. Remove the local-only PDF highlight source of truth

**Decision**: `PDFViewer` highlight creation must call back into the persisted extract/highlight flow. The viewer may keep optimistic UI state briefly, but it must rehydrate from stored extracts and not rely on `useHighlightManager()` as the durable source of truth.

**Rationale**: The current `addStoredHighlight()` path creates the illusion of working highlights during the current session while losing them on remount. That is the core bug behind the inaccurate documentation.

### 3. Render highlights only when the persisted locator is format-valid

**Decision**: Persisted highlights are rendered only when the extract contains a usable locator for the current format:

- PDF: `selection_context.pages[*].pdfRects`
- EPUB: stable EPUB locator data such as CFI/range metadata stored in `selection_context`
- HTML/Markdown document views: stable DOM/range locator data stored in `selection_context`
- Extract views: a stable offset/range locator against the extract's rendered content

Unsupported or locator-less extracts remain normal extracts without reader overlay rendering.

**Rationale**: This prevents false positives where the UI claims a highlight exists but cannot position it reliably in the document.

### 4. Separate "supported highlighting" from "extract with color"

**Decision**: Feature status and UX copy must distinguish between:

- a generic extract that happens to have a color field
- a true persisted reader highlight that can be re-rendered in place

**Rationale**: This is the product/documentation mismatch the proposal is addressing.

### 5. Extract content itself is a supported highlighting surface

**Decision**: The proposal includes highlighting inside extract views, not just source documents.

**Rationale**: The expected behavior spans the main text-reading surfaces the app exposes. Extracts already store content and color metadata, so they are a natural supported surface as long as range anchoring is stable.

## Risks / Trade-offs

- Some legacy extracts may have `highlight_color` but no valid `selection_context`; those will not become in-reader highlights automatically
- EPUB/HTML/Markdown/extract locator persistence may require extending the shape of `selection_context` or adding a small migration/normalization layer
- Unifying PDF highlight creation with extract persistence may expose latency that was previously hidden by local-only optimistic state
- Extract-content highlights may drift if the extract text is edited after highlights are anchored; implementation will need a clear policy for invalidating or remapping stale ranges
