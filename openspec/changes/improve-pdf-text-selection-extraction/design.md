## Context

`PDFViewer` renders PDF pages into canvas elements instead of delegating to the browser's native PDF viewer, so browser-grade text selection only works when the app correctly mounts and preserves a PDF.js text layer above each rendered page. The viewer already attempts to render that layer with `TextLayerBuilder` and emits `onSelectionChange` with `PdfSelectionContext`, while `DocumentViewer` consumes that signal for the floating "Create Extract" action and `CreateExtractDialog` payload. Current issues are primarily reliability and UX consistency: the text layer is not consistently exposed as a usable selection surface, selection can be fragile or unavailable even on text-backed PDFs, and the UI implies selection is always available even for PDFs/pages without a usable text layer.

## Goals / Non-Goals

**Goals:**
- Expose the PDF.js text layer reliably enough that text-backed PDFs behave like normal browser-readable documents for select/copy interactions.
- Make text selection consistently usable on PDFs that provide a text layer.
- Ensure selection-origin validation prevents non-PDF UI text from entering PDF extract flows.
- Ensure extract creation from selection remains one-step and preserves page/document context.
- Provide explicit behavior when a page has no selectable text layer.

**Non-Goals:**
- OCR implementation for image-only/scanned PDFs.
- Replacing PDF.js rendering pipeline with a different PDF engine.
- Redesigning extract data model beyond required selection-context fields.

## Decisions

1. Keep PDF.js `TextLayerBuilder` as the source of truth for selection.
- Rationale: Existing integration is already in place, includes per-page viewport mapping, and is the correct mechanism for exposing selectable/copyable text on top of canvas-rendered PDF pages.
- Alternative considered: custom text overlay generation; rejected due to higher complexity and greater drift risk from PDF.js layout behavior.

2. Add explicit text-layer availability state per rendered page and aggregate document-level availability.
- Rationale: Lets UI and actions reflect real capability instead of assuming "Text selection enabled" globally.
- Alternative considered: infer availability only from current selection events; rejected because it is reactive and does not inform users before attempting selection.

3. Tighten selection filtering to text-layer roots only before emitting selection context.
- Rationale: Avoid accidental capture from surrounding UI and keep extract content semantically tied to PDF text.
- Alternative considered: rely on broad page container checks; rejected because it can include non-text-layer DOM.

4. Keep extract creation pipeline unchanged but enforce preconditions at integration boundary.
- Rationale: Existing `DocumentViewer` + `CreateExtractDialog` flow already supports selected text and page context; we only need stricter guards for empty/invalid selections once the viewer reliably exposes text selections from the PDF layer.
- Alternative considered: add separate PDF-only extract endpoint; rejected because behavior is UI-level gating, not API divergence.

5. Treat normal browser copy/select behavior as the acceptance baseline for text-backed PDFs.
- Rationale: Users expect to drag-select and copy words or paragraphs directly from a readable PDF, so the proposal should optimize for parity with mainstream browser/native PDF readers rather than a custom selection-only interaction model.
- Alternative considered: support extract creation without guaranteeing standard copy behavior; rejected because extract workflows and plain copy/select both depend on the same text-layer exposure problem.

## Risks / Trade-offs

- [Risk] Some PDFs expose partial or malformed text layers, causing intermittent selection quality. → Mitigation: Treat availability as best-effort per page and preserve clear disabled behavior when no valid selected text exists.
- [Risk] Stricter selection filtering may reduce edge-case selections that previously worked accidentally. → Mitigation: Validate across representative PDFs and adjust intersection logic to accept legitimate multi-span selections.
- [Risk] Additional selection-state bookkeeping can introduce regressions in scroll/drag interactions. → Mitigation: Add focused regression tests around selection persistence, drag boundaries, and extract-button visibility.

## Migration Plan

1. Update `PDFViewer` to reliably expose the text layer above rendered canvas pages, including the CSS and event-handling needed for standard text select/copy behavior.
2. Update `DocumentViewer` UI copy/states so extract affordances and helper text reflect actual selection capability.
3. Add/expand tests for text-layer availability, valid selection emission, and extract action gating.
4. Roll out with no data migration. If regressions appear, rollback by restoring previous selection guards while keeping instrumentation.

## Open Questions

- Should we show an inline suggestion to run OCR when no text layer is detected, or only disable selection-based extract actions for now?
- Should availability be page-scoped in UI (for mixed PDFs) or simplified to document-level messaging?
