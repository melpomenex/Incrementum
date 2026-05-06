## Why

Users who listen to audiobooks often want to follow along in the text — for language learning, deep study, or simply to stay oriented. Many users import both the audiobook and EPUB of the same book. Currently, these are separate, disconnected documents with no way to view them together. The app should automatically recognize when both formats of the same title exist and offer a seamless split-screen experience.

## What Changes

- Add **auto-detection of audiobook+EPUB pairs** — fuzzy-match titles across the document library to find audiobook-EPUB pairs of the same book
- Add a **"Read Along" context menu option** — when right-clicking an audiobook that has a matching EPUB (or vice versa), offer "Read Along with [title]" to open the split view
- Add a **split-screen mode** that displays the audiobook player and EPUB side-by-side in a single resizable view
- Implement **transcript-to-EPUB alignment** — match existing Whisper/Groq transcript segments to EPUB text positions for sync
- Add **auto-scroll and highlight sync** — the EPUB scrolls to and highlights the current passage as the audiobook plays
- Allow **bidirectional navigation** — clicking EPUB text seeks the audiobook; seeking the audiobook scrolls the EPUB

## Capabilities

### New Capabilities
- `audiobook-epub-pairing`: Auto-detect audiobook+EPUB pairs in the library by fuzzy-matching document titles; expose via context menu on both the audiobook and EPUB sides
- `split-view-player`: Side-by-side resizable layout combining the audiobook player and EPUB viewer in a single screen
- `transcript-epub-alignment`: Align transcript segments (from existing Whisper/Groq transcription) to EPUB text positions using fuzzy text matching, producing timestamped CFI mappings
- `synced-scroll-highlight`: Real-time EPUB scroll and highlight driven by audiobook playback position, using the aligned timestamp-to-CFI mapping

### Modified Capabilities
*(None — this builds entirely on existing audiobook, EPUB, transcription, and context menu infrastructure without changing their specs)*

## Impact

- **Components**: New `AudiobookEpubSyncView` container; new `findMatchingPair()` utility; additions to existing context menus in `DocumentsView` (LibraryCard list/grid) and `ScheduleItemRow`
- **Data model**: No schema changes — pairing is computed on-the-fly from existing titles
- **Dependencies**: No new npm dependencies — fuzzy matching already exists in `SearchUtils.tsx`; resizable split implemented in CSS
- **Existing systems**: Leverages existing `TranscriptSegment` model, Whisper/Groq transcription pipeline, epubjs CFI navigation, and `ContextMenu` component
