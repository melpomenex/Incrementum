## 1. Audio Cache System

- [x] 1.1 Create `src/utils/ttsCache.ts` with IndexedDB-based cache manager (cache key = `provider:voice:speed:textHash`), JSON index, and read/write helpers
- [x] 1.2 Implement LRU eviction with configurable max size (default 500 MB) and periodic cleanup pass
- [x] 1.3 Integrate cache check into `src/api/tts.ts`: check cache before API call, write to cache after generation
- [x] 1.4 Rewrite pre-buffering in `ReaderTTSControls.tsx` to use unified waterfall strategy with `BUFFER_TARGET_SEC = 60` target across all providers
- [x] 1.5 Cache uses IndexedDB (works in Tauri and browser), removed need for Tauri `fs` permission

## 2. Position-Aware TTS

- [x] 2.1 Create `TextPositionIndex` utility in `src/utils/ttsTextExtraction.ts` that maps document positions (page numbers, scroll percent) to chunk indices and word offsets
- [x] 2.2 Update `ReaderTTSControls.tsx` to accept `startPosition` and `docType` props, build `TextPositionIndex`, and use it to determine starting chunk
- [x] 2.3 Wire position state from `DocumentViewer.tsx` (page number for PDF, scroll percent for Markdown/HTML) into `ReaderTTSControls` as `startPosition`
- [x] 2.4 Implement EPUB chapter auto-advance via `advanceChapterSignal` prop on EPUBViewer, triggered in `handleTTSComplete`
- [x] 2.5 Position-aware start works: scroll-based docs (Markdown, HTML) via scroll percent; EPUB via scroll percent; PDF via page number (requires per-page char offsets to be populated for exact page mapping)

## 3. Word Highlighting

- [x] 3.1 Create `WordHighlighter` utility in `src/utils/wordHighlighter.ts` that maps word-level character offsets to DOM ranges/elements
- [x] 3.2 Markdown and generic word mapping handled by WordHighlighter tree walker
- [x] 3.3 EPUB word mapping handled by passing container ref to WordHighlightLayer
- [x] 3.4 Markdown word mapping handled by WordHighlighter generic DOM traversal
- [x] 3.5 HTML word mapping handled via iframeWindow prop on WordHighlightLayer
- [x] 3.6 Create `WordHighlightLayer` component that renders highlight overlay for the active word/chunk
- [x] 3.7 Add word-highlighting toggle button to `ReaderTTSControls` and wire it to enable/disable highlighting
- [x] 3.8 Fallback to chunk-level highlighting when word-level fails (built into WordHighlighter)

## 4. Auto-Scroll

- [x] 4.1 Implement auto-scroll in `DocumentViewer.tsx` for Markdown/HTML: scroll viewport to TTS position via handleTTSChunkChange
- [x] 4.2 Add debounced scroll updates (100ms) with smooth scrolling
- [x] 4.3 Pause auto-scroll on manual user scroll, show "Re-center" button in ReaderTTSControls
- [x] 4.4 Implement "Re-center" action via handleTTSReCenter callback
- [x] 4.5 PDF page auto-advance preserved via `setPageNumber(nextPage)` in `handleTTSComplete`; EPUB now advances via `advanceChapterSignal`
