# Tasks: Fix command palette freeze on Linux

## Phase 1: Instant palette open

- [ ] **1.1** Remove the `extractDocumentText` loop from the `commandPaletteOpen` useEffect — replace with a `requestIdleCallback`-based background processor that yields between documents and aborts on palette close
- [ ] **1.2** Gate `loadExtracts()` to only fire if the store hasn't been initialized (add an `extractsInitialized` flag to extractStore), rather than checking `extracts.length === 0`
- [ ] **1.3** Replace `Infinity` `maxDocsToScan` / `maxExtractsToScan` / `maxTranscriptFetches` values with bounded caps (500 / 500 / 3) for the Tauri path
- [ ] **1.4** Add performance instrumentation (`performance.mark`/`measure`) around palette open to track render time

## Phase 2: Responsive search

- [ ] **2.1** Add 150ms debounce to the search query in CommandCenter before calling `handleSearch` (use `useDeferredValue` from React 19 or a manual debounce ref)
- [ ] **2.2** Add `AbortController` to `handleSearch` — create a new signal on each call, pass to async work, check before returning results
- [ ] **2.3** Replace sequential `for...of` transcript fetches with `Promise.allSettled` with a concurrency limit (max 3 in-flight)
- [ ] **2.4** Move `getHtmlText()` (DOMParser parsing) out of the hot search loop — precompute and cache HTML text content when documents are loaded into the store, not inline during search

## Phase 3: Linux-specific hardening

- [ ] **3.1** Test with `WEBKIT_DISABLE_DMABUF_RENDERER=1` env var on Linux to check if the freeze is a WebKitGTK rendering issue vs a JS blocking issue
- [ ] **3.2** If rendering-related: add a transparent overlay or `visibility: hidden` step during heavy DOM work to prevent layout thrash
- [ ] **3.3** Profile the fixed build with `perf record -g` on Linux and verify no remaining >50ms main-thread blocks during palette open/search
- [ ] **3.4** Test with a library of 200+ documents on Linux AppImage — confirm <100ms palette open, no freeze
- [ ] **3.5** Regression test on macOS — confirm search results identical and no performance regression

## Phase 4: Polish

- [ ] **4.1** Add a loading skeleton/placeholder in the palette while deferred data loads
- [ ] **4.2** Remove debug `performance.mark` instrumentation or gate behind a `DEBUG_PERF` flag
- [ ] **4.3** Update changelog with performance improvements
