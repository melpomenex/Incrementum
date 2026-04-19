## 1. OcrRegionSelector Component

- [x] 1.1 Create `src/components/viewer/OcrRegionSelector.tsx` — a component that renders an absolutely-positioned overlay on the PDF canvas. Accepts `canvasRef`, `isOcrMode`, `onRegionSelected(region)`, `onCancel()` props. Tracks pointer events to draw a dashed-border rectangle selection.
- [x] 1.2 Add floating action bar below the selection rectangle with "OCR this region" and "Cancel" buttons. Position the bar centered below the selection rect.
- [x] 1.3 Handle edge cases: selection outside canvas bounds, very small selections (< 20px threshold), Escape key to cancel, new selection replaces old.

## 2. Canvas Region Capture

- [x] 2.1 Implement `captureCanvasRegion(canvas, rect)` utility that creates an offscreen canvas, draws the cropped region from the source canvas, and returns a PNG data URL. Clip to actual canvas dimensions.
- [x] 2.2 Wire the "OCR this region" button to call `captureCanvasRegion` with the current page's PDF canvas and the selection rectangle coordinates.

## 3. OCR Processing & Progress

- [x] 3.1 Create `src/components/viewer/OcrProgressOverlay.tsx` — a progress indicator that renders over the selected region showing Tesseract.js processing stage and percentage. Use the existing `performOCRWithProgress` from `src/api/ocr.ts`.
- [x] 3.2 Handle OCR failure states: display error message with "Retry" button (re-runs on same image), allow user to dismiss and try a different region.

## 4. Text Preview Panel

- [x] 4.1 Create `src/components/viewer/OcrTextPreview.tsx` — displays an editable textarea with OCR result text, confidence score, language selector dropdown, and "Create Extract" / "Retry" / "Cancel" buttons.
- [x] 4.2 Add language selector using the existing `AVAILABLE_LANGUAGES` from `src/api/ocr.ts`. Default to the user's configured language or English.

## 5. PDF Viewer Integration

- [x] 5.1 Add OCR mode state (`isOcrMode: boolean`) to `PDFViewer.tsx`. Add a toolbar button (Scan/TextCursor icon from lucide-react) and keyboard shortcut handler (Ctrl/Cmd+Shift+O) to toggle OCR mode.
- [x] 5.2 Disable custom selection engine and normal text selection when OCR mode is active. Set cursor to crosshair on the canvas container.
- [x] 5.3 Render `OcrRegionSelector` as a sibling overlay on the PDF page container (z-index above highlight layer, below text layer or above it since we disable text layer interaction). Coordinate with the existing page render loop to attach to the correct page canvas.
- [x] 5.4 Manage the OCR flow state machine in PDFViewer: `idle → selecting → confirming → processing → previewing → done`. Clean up overlays and state at each transition.

## 6. Extract Modal Integration

- [x] 6.1 Wire "Create Extract" from the preview panel to open the existing `CreateExtractDialog` with `selectedText` = edited OCR text, `pageNumber` = current PDF page, `selectionContext` = null.
- [x] 6.2 On extract creation success, dismiss the OCR preview, exit OCR mode, and clear all overlays.

## 7. Polish & Edge Cases

- [x] 7.1 Ensure OCR mode resets when navigating to a different page, switching documents, or closing the PDF viewer.
- [x] 7.2 Test with high-DPI displays — verify canvas coordinate mapping is correct and captured regions are not blurry or offset.
- [x] 7.3 Test in both Tauri desktop and PWA contexts to ensure Tesseract.js WASM loading works in both.
