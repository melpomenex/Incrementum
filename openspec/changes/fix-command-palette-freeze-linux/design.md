# Design: Fix command palette freeze on Linux

## Architecture Overview

The command palette freeze is a main-thread blocking problem. The fix layers three strategies:

```
┌─────────────────────────────────────────────┐
│  Palette Open (Ctrl+K)                      │
│  ┌───────────────────────────────────────┐  │
│  │  Phase 1: Instant render              │  │
│  │  - Show empty palette immediately     │  │
│  │  - Cancel any pending heavy ops       │  │
│  │  - Schedule deferred init via rIC     │  │
│  └──────────────┬────────────────────────┘  │
│                 │ requestIdleCallback        │
│  ┌──────────────▼────────────────────────┐  │
│  │  Phase 2: Background preload          │  │
│  │  - Extracts: count-only preload       │  │
│  │  - Documents: snapshot from store     │  │
│  │  - Text index: one-doc-at-a-time      │  │
│  └──────────────┬────────────────────────┘  │
│                 │                            │
│  ┌──────────────▼────────────────────────┐  │
│  │  Phase 3: Responsive search           │  │
│  │  - Debounced input (150ms)            │  │
│  │  - Pre-computed HTML text cache       │  │
│  │  - Bounded doc scan (500 cap)         │  │
│  │  - Parallel transcript fetches        │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Defer extraction, don't remove it
The current `extractDocumentText` loop on palette open is valuable for search quality. Rather than removing it, we:
- Run it in the background (not blocking palette render)
- Process one document at a time with `requestIdleCallback` yielding
- Abort if the palette closes

### 2. Pre-compute HTML text on document load, not on search
Currently `getHtmlText()` parses HTML with `DOMParser` inside the search callback. This means every keystroke re-parses every HTML doc. Move this to:
- A computed/cached value in the document store
- Or a `useEffect` that pre-processes docs when they load (not when search runs)

### 3. Debounce at the CommandCenter level
Add `useDeferredValue` or manual debounce to the search query before passing to `handleSearch`. This prevents rapid-fire search calls during typing.

### 4. Platform-aware caps
```typescript
const maxDocsToScan = isWeb ? 500 : 500;  // was: Infinity for Tauri
const maxTranscriptFetches = isWeb ? 5 : 3; // was: 20 for Tauri
const maxExtractsToScan = isWeb ? 1000 : 500;
```

### 5. Abort controller for search cancellation
When a new search starts, abort the previous one. Prevents stale results from overwriting current results and reduces parallel work.

## Component Changes

### CommandCenter.tsx
- Extract the `extractDocumentText` loop into a separate `useEffect` gated behind `requestIdleCallback`
- Add debounce to search input (150ms)
- Add `AbortController` to `handleSearch` for cancellation
- Replace `Infinity` scan caps with bounded values
- Replace sequential transcript fetches with `Promise.allSettled`

### GlobalSearch.tsx
- Accept an `abortSignal` prop
- Early-return on aborted searches

### documentStore.ts (optional enhancement)
- Add `precomputedText` field that gets populated once per document load
- Populate via a background effect, not inline in search

## Testing Strategy
1. Create a test library with 200+ documents (mix of PDF, EPUB, HTML)
2. Measure palette open time with `performance.mark()`/`measure()`
3. Verify search results are identical before/after changes
4. Test rapid typing (mash keys) — should not queue up work
5. Test on Linux AppImage specifically — compare before/after freeze behavior
6. Verify macOS is not regressed
