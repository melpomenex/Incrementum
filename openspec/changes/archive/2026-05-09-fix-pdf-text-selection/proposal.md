## Why

PDF text selection is broken on certain documents. The app uses a custom geometric selection engine (`ENABLE_CUSTOM_PDF_SELECTION = true`) that replaces native DOM text selection. When this engine fails to initialize or extract tokens for a page, pointer events are still captured by the page container but produce no selection — and native text selection is explicitly disabled via CSS (`pointer-events: none`, `user-select: none`). This creates a dead zone where the user can see text but cannot interact with it at all. Additionally, the text layer rendering pipeline has race conditions and silent failure modes that can leave pages without selectable content.

## What Changes

- Fix the custom selection engine's failure recovery: when token extraction fails for a page, fall back to native DOM text selection instead of leaving the page unselectable
- Fix race condition in token extraction: pages that haven't been indexed yet should not silently drop `handlePointerDown` events — queue the selection attempt and retry after extraction completes
- Ensure the text layer container's `customSelectionActive` CSS class is only applied when the custom engine has successfully indexed a page, not globally for all pages
- Fix the text layer rendering pipeline to be more resilient: ensure `buildTextLayer` errors are surfaced clearly and don't leave stale state
- Add a diagnostic mechanism to identify which documents/pages fail text extraction and why

## Capabilities

### New Capabilities
_None — this is a bug fix of existing functionality._

### Modified Capabilities
_None — no spec-level behavior changes, only fixing broken existing behavior._

## Impact

- **`PDFViewer.tsx`**: Conditional `customSelectionActive` class application; text layer pointer-event logic
- **`PDFViewer.css`**: May need per-page granularity for `customSelectionActive` instead of blanket rule
- **`usePdfCustomSelection.ts`**: Token extraction failure recovery and pointer event queuing
- **`pdfTextSelection.ts`**: May need updated capability detection to account for fallback mode
- **`TokenExtractor.ts`**: Better error reporting on extraction failures
