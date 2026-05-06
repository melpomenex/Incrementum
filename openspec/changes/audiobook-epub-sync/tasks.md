## 1. Auto-Detection & Context Menu

- [x] 1.1 Create `src/utils/documentPairing.ts` — `findCompanionDoc(doc, allDocs)` function that fuzzy-matches a document's title against all docs of the complementary type (audio↔epub), returns the best match (or top matches if scores are close)
- [x] 1.2 Normalize titles for matching — strip common suffixes like "(Audiobook)", "Unabridged", edition numbers, and file extensions before comparison
- [x] 1.3 Build a lightweight title index on library load — pre-group documents by `fileType` and store normalized titles for instant lookup on right-click
- [x] 1.4 Add "Read Along" / "Listen Along" menu item to the `LibraryCard` context menu in `DocumentsView.tsx` (after the "Open" item, lines ~2076-2123) — shown only when a companion doc is found
- [x] 1.5 Add the same menu item to the list-mode row context menu in `DocumentsView.tsx` (lines ~1097-1239)
- [x] 1.6 Add the same menu item to `ScheduleItemRow` context menu in `ScheduleItemRow.tsx` (lines ~470-530)

## 2. Alignment Engine

- [x] 2.1 Define alignment data types (`AlignmentMapping`, `SegmentCFIMap`, `AlignmentResult`) in `src/types/alignment.ts`
- [x] 2.2 Create `src/workers/alignment.worker.ts` — Web Worker that receives transcript segments and EPUB chapter text, runs fuzzy matching, returns CFI mappings
- [x] 2.3 Implement chapter-title matching logic — compare audiobook chapter titles against EPUB TOC entries using normalized string comparison
- [x] 2.4 Implement segment-to-text fuzzy matching within a chapter — slide transcript segment text against EPUB paragraphs, pick best match above threshold, record CFI
- [x] 2.5 Implement alignment caching — save/load `AlignmentResult` JSON via Tauri command to a per-document-pair file in app data dir
- [x] 2.6 Create `useAlignment` hook — orchestrates: check cache → if missing, extract EPUB text → run worker → cache result → return alignment

## 3. Split View Layout

- [x] 3.1 Create `ResizableSplit` component — two-panel horizontal layout with a drag handle, min-width 320px per panel, CSS-based resize via mouse events
- [x] 3.2 Create `AudiobookEpubSyncView` container — receives audiobook doc + EPUB doc, renders `ResizableSplit` with audio panel (left) and EPUB panel (right)
- [x] 3.3 Audio panel: embed `AudiobookViewer` in compact mode (hide transcript/chapter sidebars, keep playback controls)
- [x] 3.4 EPUB panel: embed `EPUBViewer` with stripped-down UI (hide TOC sidebar, keep font controls)
- [x] 3.5 Exit button in `AudiobookEpubSyncView` — returns to standalone viewer without interrupting playback

## 4. Sync Engine

- [x] 4.1 Create `useSyncedPlayback` hook — takes audio `currentTime` and alignment mapping, returns active segment and its CFI
- [x] 4.2 EPUB auto-scroll — on active segment change, scroll EPUB container to bring the CFI into view
- [x] 4.3 EPUB highlight — on active segment change, remove previous annotation, add `rendition.annotations.highlight()` at current segment's CFI
- [x] 4.4 User-scroll detection — track scroll/interaction on EPUB panel, suppress auto-scroll for 5 seconds
- [x] 4.5 Click-to-seek — on EPUB text click, find nearest segment CFI, seek audio to segment's `startTime`
- [x] 4.6 Seek bar and chapter navigation — when user seeks audio or changes chapter, update EPUB position via alignment mapping

## 5. Integration & Polish

- [x] 5.1 Wire `AudiobookEpubSyncView` into `DocumentViewer.tsx` routing — context menu "Read Along" opens the sync view as a new tab
- [x] 5.2 Alignment progress indicator — show loading state in EPUB panel while alignment computes
- [x] 5.3 Low-confidence warning — if alignment match rate < 50%, show dismissable banner suggesting chapter-only sync
- [x] 5.4 Handle edge cases: no transcript yet (prompt to transcribe first), multi-part audiobooks, EPUBs with no TOC
- [ ] 5.5 Test end-to-end with real audiobook+EPUB pairs — verify detection, context menu, alignment, scroll sync, highlight, click-to-seek
