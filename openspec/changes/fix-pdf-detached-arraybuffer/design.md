## Context

PDF loading fails on Windows 11 (WebView2/Chromium) with `structuredClone: ArrayBuffer already detached`. The root cause is in the data flow from Tauri backend to PDF.js:

1. `DocumentViewer.tsx` reads the PDF file via `readDocumentFile()` → base64 string
2. Decodes base64 to `Uint8Array` via `atob()` + manual byte copy
3. Passes `fileData` as `Uint8Array` to `PDFViewer.tsx`
4. `PDFViewer` calls `pdfjsLib.getDocument({ data: fileData.slice() })`
5. PDF.js internally uses `structuredClone` to send data to its web worker
6. WebView2's `structuredClone` fails because the `ArrayBuffer` backing the `Uint8Array` has been detached (likely by Tauri's IPC transfer semantics or during the base64→binary conversion)

The issue is platform-specific: Linux (WebKitGTK) and macOS work fine. WebView2 on Windows uses Chromium's stricter `structuredClone` implementation that rejects already-detached buffers.

## Goals / Non-Goals

**Goals:**
- Fix PDF loading on Windows 11 WebView2 by ensuring `pdfjsLib.getDocument()` receives a `Uint8Array` backed by a live, non-detached `ArrayBuffer`
- Maintain existing fallback chain (URL source → data source → disableWorker retry)
- Keep performance acceptable (avoid unnecessary full-file copies on every render)

**Non-Goals:**
- Refactoring the PDF import pipeline or base64 decoding approach
- Changing PDF.js worker strategy or configuration
- Fixing unrelated Windows issues

## Decisions

### 1. Defensive copy with `new Uint8Array(fileData)` instead of `fileData.slice()`

`Uint8Array.prototype.slice()` creates a new typed array view but may share the underlying `ArrayBuffer` if the implementation optimizes it as a sub-range copy. Using `new Uint8Array(fileData)` guarantees a completely independent copy with its own `ArrayBuffer`.

**Alternative considered**: Reading from the `fileUrl` via `fetch` as a fallback — already exists as the first source in the fallback chain, but on Windows the Tauri asset protocol may have the same detach issue. The in-memory copy is the more reliable fix.

### 2. Early defensive copy at base64 decode in DocumentViewer.tsx

Copy the buffer immediately after base64 decoding in `DocumentViewer.tsx` (~line 1032-1036). This prevents any downstream consumer from encountering a detached buffer, not just PDF.js. EPUB.js uses the same `fileData` prop path.

**Alternative considered**: Only copying in `PDFViewer.tsx` — narrower change but doesn't protect EPUB loading or other consumers.

### 3. No fetch-based fallback for the data source path

The existing code already tries the `fileUrl` source first. If both fail, the error is shown to the user. Adding a third retry path (fetch the URL into a fresh ArrayBuffer) adds complexity for an edge case that should be resolved by the defensive copy.

## Risks / Trade-offs

- **[Memory]** Double-copy on large PDFs → Mitigation: Only copy in `DocumentViewer.tsx` at decode time (once), not on every `pdfjsLib.getDocument()` call. The `PDFViewer` `fileData.slice()` is already a per-load copy, so replacing it with `new Uint8Array()` is equivalent.
- **[Correctness]** `new Uint8Array()` constructor may not deep-copy if given a `Uint8Array` → Mitigation: Verified — `new Uint8Array(source)` where `source` is a typed array creates a new `ArrayBuffer` and copies the bytes per the ECMAScript spec.
