## Context

DocumentViewer.tsx is a monolithic component (~4800 lines) that renders all document types and manages three view modes: `document`, `extracts`, and `cards`. When switching from document to extracts/cards, the document content is unmounted entirely.

For **PDF documents**, scroll position is captured via a `[data-document-scroll-container]` attribute on the PDF scroll div, debounced and persisted to localStorage + ViewState. On return, the restoration effect reads the saved state and scrolls to the saved position.

For **HTML documents** (including PDFs converted to HTML via OCR), the content renders inside a sandboxed `<iframe>` with `srcDoc`. The iframe's content scrolls internally — its `contentWindow` has its own scroll position. Currently:
- No `[data-document-scroll-container]` is set on any element in the HTML path
- No scroll event listener is attached to the iframe's `contentWindow`
- `captureScrollState()` returns `null` for HTML documents
- The restoration effect at line 1751 explicitly returns early for non-PDF: `if (docType !== "pdf") return`
- When switching to extracts and back, the iframe is unmounted/remounted, losing all internal state

The existing `readerPosition.ts` module and `ViewState` type already support `scrollTop`, `scrollLeft`, and `scrollPercent` — these fields are sufficient for HTML scroll persistence.

## Goals / Non-Goals

**Goals:**
- Capture scroll position from the HTML iframe during reading (debounced, same cadence as PDF)
- Persist to the same ViewState storage used by PDF (localStorage + `readerPosition.ts`)
- Restore scroll position when returning to document view from extracts/cards
- Work for both standalone HTML documents and PDFs viewed in OCR-HTML mode

**Non-Goals:**
- Restoring position across app restarts for HTML docs (already partially supported via the scroll percent saved to the unified position API)
- Changing how EPUB, Markdown, or YouTube scroll positions work
- Refactoring DocumentViewer.tsx into smaller components
- Capturing scroll position on app-level tab switches (already handled by the visibility change effect)

## Decisions

### 1. Capture iframe scroll via `contentWindow` event listener

**Decision:** Add a scroll event listener on `iframeRef.current.contentWindow` after the iframe loads.

**Alternative considered:** Add `data-document-scroll-container` to the iframe or its parent div and reuse `captureScrollState()`. Rejected because the parent div doesn't scroll — the iframe's internal document does.

**Rationale:** The iframe's `contentWindow` is the scroll container. Listening to `contentWindow.onscroll` gives us the exact scroll position. This is the same pattern browsers use for iframe scroll tracking.

### 2. Persist using the same ViewState mechanism as PDF

**Decision:** Use `persistScrollState` and the ViewState key system, storing `scrollTop`, `scrollLeft`, and `scrollPercent`.

**Alternative considered:** Separate localStorage key for HTML scroll. Rejected because the ViewState infrastructure already supports these fields and handles key resolution, migration, and user namespacing.

**Rationale:** Reusing the existing infrastructure means no new storage keys, no new migration paths, and automatic support for the unified position API.

### 3. Extend the restoration effect to cover HTML documents

**Decision:** Remove the `if (docType !== "pdf") return` guard and add HTML-specific restoration logic that scrolls the iframe's `contentWindow` after load.

**Alternative considered:** Create a separate restoration effect for HTML. Rejected to avoid duplicating the key resolution and state comparison logic.

**Rationale:** The restoration effect already handles key resolution, legacy fallback, and remote state comparison. We just need to let HTML through and apply the scroll to the iframe instead of the PDF viewer.

### 4. Save on view mode switch (same as PDF)

**Decision:** Extend the `savePdfProgress` pattern to also save HTML progress when switching away from document view.

**Rationale:** The existing effect at line 1432 already fires on viewMode change. We just need to remove the `docType !== "pdf"` guard from `savePdfProgress` and make `captureScrollState` work for HTML.

## Risks / Trade-offs

- **[Iframe cross-origin access]** If the iframe's `srcDoc` content navigates or the sandbox restricts access, `contentWindow` may be null or throw. → Mitigation: Guard all iframe access with try/catch and null checks. The `sandbox="allow-same-origin"` attribute already permits parent access to `contentWindow`.

- **[Timing: iframe load vs. restoration]** The iframe must finish loading before we can scroll its `contentWindow`. The `onLoad` handler fires once — we need to coordinate restoration with that event. → Mitigation: Use a ref to queue the restoration and apply it in the `onLoad` callback after the initial-hit scroll attempt.

- **[Iframe remount on view mode switch]** When switching to extracts and back, the iframe is unmounted and remounted. The scroll position must be fully persisted before unmount. → Mitigation: Flush scroll state synchronously in the viewMode change effect, before the component unmounts the iframe.
