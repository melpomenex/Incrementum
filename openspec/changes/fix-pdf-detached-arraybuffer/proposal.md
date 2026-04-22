## Why

On Windows 11 with v1.22, adding PDF files triggers: `Failed to load PDF: Failed to execute 'structuredClone' on 'Window': ArrayBuffer at index 0 is already detached.`

This is a WebView2 (Chromium) issue. When `pdfjs-dist`'s `getDocument()` receives a `Uint8Array` source, Chromium's `structuredClone` (used internally by PDF.js for message passing to workers) can fail because the underlying `ArrayBuffer` has been detached — likely during the base64 → `Uint8Array` conversion in `DocumentViewer.tsx` or from Tauri's asset protocol transferring ownership.

## What Changes

- Copy the `Uint8Array` with its own `ArrayBuffer` before passing to `pdfjsLib.getDocument()` in `PDFViewer.tsx`, ensuring the buffer is never shared/detached
- Guard the `fileData.slice()` call in the PDF source construction with `new Uint8Array(fileData)` to create a fully independent copy with a new backing buffer, not just a view
- Add a try/catch around the `structuredClone`-sensitive path with a fallback that reads via `fetch` + `arrayBuffer()` when in-memory data fails

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

_None_ — this is a bug fix in existing PDF loading logic, not a behavioral change.

## Impact

- **`src/components/viewer/PDFViewer.tsx`**: PDF source construction and loading logic (~line 526-532)
- **`src/components/viewer/DocumentViewer.tsx`**: base64→Uint8Array conversion (~line 1032-1036) — may need a defensive copy here too
- **Risk**: Low — defensive copies and fallback paths only; no API or data model changes
