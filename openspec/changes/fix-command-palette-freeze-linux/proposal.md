# Change: Fix command palette freeze on Linux (AppImage)

## Why
Opening the command palette (Ctrl+K) on Linux via AppImage causes a hard freeze of the entire application window. The UI becomes unresponsive until the process is killed. This appears specific to the Linux/AppImage distribution — the same feature works on macOS.

## Root Cause Analysis

The command palette (`CommandCenter.tsx`, ~970 lines) triggers several expensive operations synchronously or near-synchronously when opened:

1. **Full document text extraction** — On palette open, an effect iterates over all PDF/EPUB/HTML documents missing content and calls `extractDocumentText()` sequentially in a `for...of` loop. On large libraries this blocks the main thread.
2. **Heavy DOM parsing in search** — `handleSearch` calls `DOMParser.parseFromString()` for every HTML document in the library with each keystroke, with no debouncing visible in the search callback.
3. **Unbounded document scanning** — `maxDocsToScan` is set to `Infinity` when `isTauri()` is true (line 270), meaning the palette will scan every document in the library on every search.
4. **Sequential transcript fetching** — YouTube transcript fetches happen inside the search handler with `await` in a loop, blocking result rendering.
5. **No lazy loading of extracts** — The palette opens and triggers `loadExtracts()` if extracts haven't loaded yet, pulling the entire extract database into memory on first open.

On Linux, the Tauri WebView (WebKitGTK) appears more sensitive to main-thread blocking than macOS's WKWebView. Operations that cause brief jank on macOS result in a full freeze on Linux.

## What Changes

### Phase 1: Make palette open instant (critical)
- Defer all heavy data loading to after the palette renders (use `requestIdleCallback` or `setTimeout(0)`)
- Remove the `extractDocumentText` loop from the palette open effect — move to a background worker or lazy one-at-a-time extraction
- Gate `loadExtracts()` behind a lighter "extract count only" preload or skip it entirely on open
- Add `isTauri()`-aware `maxDocsToScan` cap (e.g., 500 for Tauri) instead of `Infinity`

### Phase 2: Fix the search handler
- Debounce `handleSearch` calls (150–200ms) to avoid per-keystroke heavy computation
- Move `DOMParser` HTML text extraction out of the hot search path — precompute and cache on document load, not on search
- Cap `maxTranscriptFetches` to 3 for Tauri (currently 20) and run them in parallel with `Promise.allSettled`
- Use a web worker for text search across document content

### Phase 3: Linux-specific hardening
- Profile with `perf`/`sysprof` on Linux to identify remaining bottlenecks
- Consider reducing Tauri `withGlobalTauri` overhead by lazy-importing Tauri APIs only when needed
- Test with `WEBKIT_DISABLE_DMABUF_RENDERER=1` environment variable (known WebKitGTK rendering fix)

## Impact
- **Affected code**: `CommandCenter.tsx`, `GlobalSearch.tsx`, `commandPaletteEvents.ts`, `documentStore.ts`, `extractStore.ts`
- **Affected specs**: `specs/command-palette-performance/spec.md` (new)
- **Risk**: Low — changes are additive (debouncing, capping, deferring). No behavior changes for existing functionality.
- **Platforms**: Linux AppImage primarily, but improvements benefit all platforms

## Non-Goals
- Replacing the search engine (e.g., with SQLite FTS5 or tantivy) — that's a separate change
- Redesigning the command palette UI
- Changing the keyboard shortcut or activation mechanism

## Success Criteria
- Command palette opens instantly (<100ms) on Linux AppImage with a library of 100+ documents
- Search results render progressively, not all-at-once after blocking
- No main-thread freeze regardless of library size
- macOS behavior remains unchanged or improves
