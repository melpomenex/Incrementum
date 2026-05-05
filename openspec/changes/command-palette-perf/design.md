# Design: Command Palette Performance

## Changes

### 1. Remove eager extract loading on palette open
**File:** `src/components/search/CommandCenter.tsx`

**Current behavior:** `useEffect` calls `loadExtracts()` when `commandPaletteOpen` becomes true.

**Fix:** Remove the effect. Instead, load extracts lazily inside `handleSearch` only when a meaningful content search is being performed. Use a ref to track whether extracts have been loaded this session.

```tsx
// BEFORE
useEffect(() => {
  if (commandPaletteOpen && !extractsLoading && extracts.length === 0) {
    void loadExtracts();
  }
}, [commandPaletteOpen, extracts.length, extractsLoading, loadExtracts]);

// AFTER
// Remove entirely. Load extracts inside handleSearch if needed.
const extractsLoadedRef = useRef(false);

// Inside handleSearch, at the start:
if (allowContentSearch && !extractsLoadedRef.current) {
  extractsLoadedRef.current = true;
  void loadExtracts(); // fire-and-forget; next search will have them
}
```

### 2. Remove document content extraction on palette open
**File:** `src/components/search/CommandCenter.tsx`

**Current behavior:** `useEffect` iterates all documents missing content and calls `extractDocumentText()` sequentially.

**Fix:** Remove the entire effect. Content extraction is heavy I/O work that has no business running when the user just wants to type a search query. The search function already handles missing content gracefully (it falls back to title-only matching when content is empty).

If content-based search is needed, individual document content can be fetched during search (lazily, with caching) — but this is a follow-up optimization, not required for the initial fix.

### 3. Use refs for stable handleSearch dependencies
**File:** `src/components/search/CommandCenter.tsx`

**Current behavior:** `handleSearch` `useCallback` depends on `documents`, `extracts`, `theme.id`, etc. Every change recreates the callback.

**Fix:** Move `documents`, `extracts`, and theme data into refs. The callback reads from refs at call time instead of capturing state values in its closure. This prevents unnecessary callback recreation and the cascade re-renders it causes.

```tsx
const documentsRef = useRef(documents);
documentsRef.current = documents;
const extractsRef = useRef(extracts);
extractsRef.current = extracts;
// Read from refs inside handleSearch
```

### 4. Add Web Worker or chunked search for large collections (optional/follow-up)
Not in scope for this fix. The above changes should eliminate the freeze. If search itself is still slow on 3000+ items with content, a web worker could offload the scanning — but debouncing + lazy loading should be sufficient.

## File Changes
- `src/components/search/CommandCenter.tsx` — Remove 2 useEffects, refactor handleSearch dependencies
