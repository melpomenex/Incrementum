## Context

`PDFViewer` already renders both canvas and a PDF.js text layer (`TextLayerBuilder`) and emits `onSelectionChange` with `PdfSelectionContext`. `DocumentViewer` consumes that signal and drives the floating "Create Extract" action and `CreateExtractDialog` payload. Current issues are primarily reliability and UX consistency: text selection can be fragile, and the UI implies selection is always available even for PDFs/pages without a usable text layer.

## Goals / Non-Goals

**Goals:**
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
- Rationale: Existing integration is already in place and includes per-page viewport mapping.
- Alternative considered: custom text overlay generation; rejected due to higher complexity and greater drift risk from PDF.js layout behavior.

2. Add explicit text-layer availability state per rendered page and aggregate document-level availability.
- Rationale: Lets UI and actions reflect real capability instead of assuming "Text selection enabled" globally.
- Alternative considered: infer availability only from current selection events; rejected because it is reactive and does not inform users before attempting selection.

3. Tighten selection filtering to text-layer roots only before emitting selection context.
- Rationale: Avoid accidental capture from surrounding UI and keep extract content semantically tied to PDF text.
- Alternative considered: rely on broad page container checks; rejected because it can include non-text-layer DOM.

4. Keep extract creation pipeline unchanged but enforce preconditions at integration boundary.
- Rationale: Existing `DocumentViewer` + `CreateExtractDialog` flow already supports selected text and page context; we only need stricter guards for empty/invalid selections.
- Alternative considered: add separate PDF-only extract endpoint; rejected because behavior is UI-level gating, not API divergence.

## Risks / Trade-offs

- [Risk] Some PDFs expose partial or malformed text layers, causing intermittent selection quality. → Mitigation: Treat availability as best-effort per page and preserve clear disabled behavior when no valid selected text exists.
- [Risk] Stricter selection filtering may reduce edge-case selections that previously worked accidentally. → Mitigation: Validate across representative PDFs and adjust intersection logic to accept legitimate multi-span selections.
- [Risk] Additional selection-state bookkeeping can introduce regressions in scroll/drag interactions. → Mitigation: Add focused regression tests around selection persistence, drag boundaries, and extract-button visibility.

## Migration Plan

1. Update `PDFViewer` to track and expose page/document text-layer availability and stricter selection-origin checks.
2. Update `DocumentViewer` UI copy/states so extract affordances and helper text reflect actual selection capability.
3. Add/expand tests for text-layer availability, valid selection emission, and extract action gating.
4. Roll out with no data migration. If regressions appear, rollback by restoring previous selection guards while keeping instrumentation.

## Open Questions

- Should we show an inline suggestion to run OCR when no text layer is detected, or only disable selection-based extract actions for now?
- Should availability be page-scoped in UI (for mixed PDFs) or simplified to document-level messaging?
