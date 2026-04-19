## Context

The PDF viewer uses PDF.js with a 3-layer architecture: canvas (rendered page), highlight layer, and text layer. For scanned/image-only PDFs, the text layer has no content, making text selection impossible. The project already has two OCR paths:

1. **Frontend Tesseract.js** (`src/api/ocr.ts`) — runs in-browser via WebAssembly, supports progress callbacks, supports 20+ languages
2. **Backend OCR** (`src-tauri/src/commands/ocr.rs`) — Tauri commands `ocr_image_bytes` (takes base64) and `ocr_image_file`, supports Tesseract and GLM-OCR providers

The existing `CreateExtractDialog` accepts `selectedText`, `pageNumber`, and `selectionContext` props — it is already decoupled from how text is obtained.

The PDF viewer already has a custom geometric selection engine (`src/components/viewer/selection/`) for selecting text with character-level precision. A region-select for OCR is a simpler geometric operation — no token matching needed.

## Goals / Non-Goals

**Goals:**
- Let users drag a rectangle on any PDF page to select a region, regardless of whether the page has a text layer
- OCR the selected region using local OCR (Tesseract.js frontend for portability; backend `ocr_image_bytes` as an alternative)
- Open the existing Extract Modal pre-populated with OCR'd text so the user can create extracts normally
- Show clear progress and error feedback during OCR processing

**Non-Goals:**
- Auto-OCR of entire PDFs (this already exists via `ocrPdfFile` command)
- OCR-based text layer replacement (the `ocr-html` view mode already handles this)
- Supporting cloud OCR providers for region select (local only for low latency)
- Persisting OCR region selections or highlighting OCR'd regions

## Decisions

### 1. Use canvas `toDataURL` to capture the selected region

**Decision**: Extract the region by calling `canvas.toDataURL("image/png")` on the full PDF page canvas, then cropping to the selected rectangle using an offscreen canvas.

**Alternative considered**: Use the existing `capture_screenshot` Tauri command to capture the window and crop. Rejected because this requires the `screenshot` feature flag, captures the entire window (not just the canvas), and depends on screen coordinates that may not match canvas coordinates.

**Rationale**: The canvas is already rendered with the PDF page content. `toDataURL` is synchronous, works in all environments (Tauri, PWA, browser), and the region coordinates map directly to canvas pixel coordinates. This avoids any dependency on the screenshot module.

### 2. Frontend Tesseract.js for OCR (with backend fallback option)

**Decision**: Use the existing `performOCRWithProgress` from `src/api/ocr.ts` (Tesseract.js WASM) as the primary OCR engine for region selections. This runs entirely in-browser with no backend dependency.

**Alternative considered**: Use `ocr_image_bytes` Tauri command (backend Tesseract/GLM-OCR). Rejected as primary because it adds latency (IPC round-trip), doesn't work in PWA mode, and the user specifically asked for "LOCAL OCR" that works at the point of reading.

**Rationale**: Tesseract.js is already a dependency, supports progress callbacks (for UX feedback), and runs entirely client-side. It works in both Tauri and PWA contexts. For users with GLM-OCR configured, a future enhancement could offer a "better OCR" toggle.

### 3. Reuse the geometric selection overlay pattern

**Decision**: Create a lightweight `OcrRegionSelector` component that renders a semi-transparent rectangle overlay on the PDF canvas. It uses pointer events (mousedown/mousemove/mouseup) to track the selection rectangle, rendered as an absolutely-positioned div with a dashed border.

**Alternative considered**: Reuse the existing `SelectionRenderer` from the custom selection engine. Rejected because that renderer is tightly coupled to the token-based selection engine (it renders around individual tokens/spans). The OCR region selector is simpler — it just needs a rectangle.

**Rationale**: The overlay needs only a bounding box, not token-level precision. A simple div overlay with pointer event handling is ~50 lines vs. integrating with the complex selection engine state machine.

### 4. Trigger via toolbar button + keyboard shortcut

**Decision**: Add an "OCR Select" button (Scan/TextCursor icon) to the PDF toolbar that toggles region-select mode. Also support a keyboard shortcut (Ctrl/Cmd+Shift+O). In OCR mode, the cursor changes to crosshair, and dragging draws the selection rectangle.

**Rationale**: A distinct mode avoids conflicts with normal text selection, highlighting, and panning. The toolbar makes it discoverable; the shortcut makes it fast for power users.

### 5. Flow: region select → OCR → preview → extract modal

**Decision**: After the user draws a rectangle:
1. Show a small floating toolbar with "OCR this region" and "Cancel" buttons
2. On confirm, show an inline progress indicator over the selected region
3. When OCR completes, show a text preview panel (editable textarea) alongside the region
4. On "Create Extract", open the existing `CreateExtractDialog` pre-populated with the OCR text

**Alternative considered**: Skip the preview and go straight to the extract modal with OCR text. Rejected because OCR quality varies — users need to see and correct the text before committing it.

**Rationale**: The preview step is critical for OCR workflows. Users can fix misrecognized characters before creating the extract.

## Risks / Trade-offs

- **[Tesseract.js accuracy on mathematical/scientific content]** → The preview panel lets users correct text before creating the extract. For scientific PDFs, users may prefer GLM-OCR — a future "use better OCR" option could be added.
- **[Large canvas on high-DPI screens]** → `toDataURL` on a 4K canvas can produce large images. Mitigate by limiting the captured region to the selection rectangle (cropped via offscreen canvas), not the full page.
- **[Tesseract.js WASM bundle size]** → The WASM binary is ~2MB and language data is ~10MB for English. Mitigate by lazy-loading (already done via dynamic `import()`) and reusing the worker across multiple OCR operations.
- **[Conflict with custom selection engine]** → The OCR mode is explicitly toggled, so the custom selection engine's pointer handlers can be disabled when OCR mode is active.
