# Proposal: Command Palette Performance on Large Collections

## Intent
The command palette (GlobalSearch/CommandCenter) freezes the UI when opening on collections with 3000+ items. This is a bug, not an OS issue — the root causes are in the React frontend.

## Scope
**In scope:**
- Fixing the freeze when opening the command palette on large collections
- Making search debouncing and data loading lazy/efficient

**Out of scope:**
- Search result quality improvements
- New search features
- Backend query optimization (already uses `list_documents` without content)

## Root Causes

### 1. Extracts loaded eagerly on palette open
`CommandCenter` has a `useEffect` that calls `loadExtracts()` (no doc filter) when `commandPaletteOpen` becomes true. With 3000+ items, this fetches ALL extracts from the DB in one shot, causing a synchronous React state update that freezes the UI.

### 2. Document content extraction runs on every palette open
Another `useEffect` iterates all documents missing content and calls `extractDocumentText()` one-by-one. While the `indexedDocsRef` prevents re-extraction, the initial scan of all documents (O(n) filter) and the sequential async calls still trigger heavy work on first open or when new docs are added.

### 3. `handleSearch` callback recreated on document/extract changes
The `useCallback` for `handleSearch` has `documents` and `extracts` in its dependency array. Any document or extract state change invalidates the callback, which can cascade re-renders. More importantly, the search function itself does O(n) scanning of all documents and extracts in a tight loop — on a 3000-item collection this is noticeable.

### 4. No virtualization in results list
The results are rendered as a flat list with `max-h-96 overflow-y-auto`. With many matching documents, React renders all result items in the DOM.

## Approach
1. **Lazy extract loading** — Don't load extracts on palette open. Instead, only load them when a content search is actually performed (query has meaningful terms). Cache the result for the session.
2. **Remove eager content extraction** — The extraction loop should not run on palette open. Content should be fetched lazily per-document during search (with caching), or pre-indexed in the background at app startup, not on-demand when the palette opens.
3. **Debounce and limit search work** — Add early termination to the document scan loop, limit content scanning, and use requestIdleCallback for heavy work.
4. **Optimize `handleSearch` dependencies** — Use refs for documents/extracts to avoid callback recreation on every state change.
