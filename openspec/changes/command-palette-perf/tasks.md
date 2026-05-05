# Tasks

## 1. Remove eager extract loading
- [ ] 1.1 Remove the `useEffect` that calls `loadExtracts()` on `commandPaletteOpen`
- [ ] 1.2 Add `extractsLoadedRef` to track session-level extract loading
- [ ] 1.3 Add lazy extract loading at the start of `handleSearch` (fire-and-forget, only for meaningful queries)

## 2. Remove document content extraction on palette open
- [ ] 2.1 Remove the `useEffect` with `extractDocumentText` loop and `indexedDocsRef` / `indexingRef`
- [ ] 2.2 Verify search still works with title-only matching when content is null

## 3. Stabilize handleSearch with refs
- [ ] 3.1 Add `documentsRef` and sync it from `documents` state
- [ ] 3.2 Add `extractsRef` and sync it from `extracts` state
- [ ] 3.3 Remove `documents` and `extracts` from `handleSearch` `useCallback` deps
- [ ] 3.4 Read from refs inside `handleSearch` instead of closure variables
- [ ] 3.5 Keep theme refs if needed, or use stable selectors

## 4. Verify
- [ ] 4.1 TypeScript compiles with zero errors
- [ ] 4.2 Command palette opens instantly (no data fetching before render)
- [ ] 4.3 Search still returns correct results (title matching, content matching when available)
- [ ] 4.4 No React warnings about stale closures or missing deps
