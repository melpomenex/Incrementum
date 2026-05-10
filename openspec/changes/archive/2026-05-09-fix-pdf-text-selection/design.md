## Context

The app renders PDFs using PDF.js v5 with a custom geometric selection engine (`ENABLE_CUSTOM_PDF_SELECTION = true`). The architecture uses a 4-layer DOM stack:

1. **Canvas** (z-index 1): visual rendering
2. **Highlight layer** (z-index 2): persistent highlights
3. **Text layer** (z-index 3): PDF.js text spans for native selection
4. **Custom selection layer** (z-index 4): geometric selection overlay

When the custom engine is active, the CSS class `customSelectionActive` is applied to ALL `textLayerContainer` elements, which sets `pointer-events: none` and `user-select: none` on the entire text layer. Pointer events are instead captured on the page container and routed to the custom selection engine.

**Failure mode**: If the custom engine fails to extract tokens for a page (e.g., `page.getTextContent()` returns empty items, viewport isn't ready, or an error occurs), the page becomes completely unselectable — the custom engine can't select (no tokens) and native selection is disabled by CSS.

## Goals / Non-Goals

**Goals:**
- Every page with extractable text SHALL be selectable, regardless of whether the custom engine or native text layer handles it
- Failures in token extraction SHALL be visible in console diagnostics, not silent
- The selection experience SHALL feel consistent to the user across fallback and primary paths

**Non-Goals:**
- Replacing the custom selection engine with native DOM selection globally
- Adding new selection features (multi-page, column-aware, etc.)
- Refactoring the 4-layer architecture
- OCR fallback for scanned documents (separate concern)

## Decisions

### 1. Per-page fallback from custom to native selection

Instead of applying `customSelectionActive` globally, apply it per-page only after the custom engine has confirmed successful token indexing for that page. Pages not yet indexed or that failed extraction remain selectable via the native text layer.

**Why per-page**: Some pages may fail extraction (e.g., scanned images) while others work fine. A global switch would disable native selection on all pages when only some have issues.

**Alternative considered**: Try-catch around each selection event, falling back mid-interaction. Rejected because mixing pointer event handlers mid-drag would produce janky behavior.

### 2. Retry-then-fallback for token extraction

When `handlePointerDown` fires on a page that isn't indexed yet (current behavior: `extractPageTokens(pageIndex); return;`), trigger extraction and queue a retry. If extraction completes successfully before a timeout (e.g., 2s), proceed with custom selection. If it fails or times out, remove `customSelectionActive` from that page's text layer to re-enable native selection.

**Why**: The current code silently returns on `handlePointerDown` when the page isn't indexed, meaning the user's click does nothing. This is the most common failure path.

### 3. Track extraction success per page in a ref map

Add a `Map<number, boolean>` (page index → extraction success) alongside the existing `indexedPagesRef`. This provides a clean signal for CSS class toggling.

**Why**: The existing `indexedPagesRef` only tracks whether extraction was attempted, not whether it succeeded (it catches errors but only logs a warning).

## Risks / Trade-offs

- **[Risk] Fallback to native selection loses column detection and geometric precision** → Mitigation: Log a warning when fallback activates so the user/developer can investigate. The custom engine's column detection is a nice-to-have; working selection is the priority.
- **[Risk] Per-page CSS toggling could cause flicker during initial render** → Mitigation: Only toggle after extraction result is known, not on every render cycle. Use a ref-driven approach, not state-driven.
- **[Risk] Race condition between text layer render and extraction** → Mitigation: Token extraction already depends on `page.getTextContent()` which is independent of the text layer DOM. The two pipelines are already decoupled.
