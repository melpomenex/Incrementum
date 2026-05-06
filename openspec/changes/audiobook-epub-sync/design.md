## Context

Incrementum already has a mature audiobook player (`AudiobookViewer`) with transcript sync via Whisper/Groq transcription, and a full-featured EPUB reader (`EPUBViewer`) built on epubjs. These viewers exist in isolation. The existing `TranscriptSegment` model provides `startTime`, `endTime`, and `text` per segment. The EPUB reader supports CFI-based navigation, highlight annotations, and continuous scroll mode.

Users frequently import both the audiobook and EPUB of the same book. The app already has a right-click context menu on `LibraryCard` (in `DocumentsView.tsx` lines 2076-2123) with items like Open, Favorites, Tag, Transcribe, Archive, Delete. There's also a reusable `ContextMenu` component at `src/components/common/ContextMenu.tsx` and fuzzy title matching in `SearchUtils.tsx`.

## Goals / Non-Goals

**Goals:**
- Auto-detect when both an audiobook and EPUB of the same title exist in the library
- Surface this via right-click context menu on both the audiobook and the EPUB
- Display audiobook player and EPUB side-by-side with a resizable split
- Auto-scroll and highlight the EPUB in sync with audiobook playback
- Allow clicking EPUB text to seek the audiobook
- Leverage existing transcription infrastructure — no new ML or services

**Non-Goals:**
- Replacing or modifying the standalone audiobook or EPUB viewers
- Building a general-purpose split-view framework
- Word-level sync precision (segment-level is sufficient for v1)
- Supporting PDF or other formats alongside audiobooks
- Manual linking UI (auto-detection replaces the need for it)

## Decisions

### D1: Auto-detect pairs by fuzzy title matching, no stored link

**Decision**: On context menu open, run a lightweight fuzzy title match against all documents of the complementary type (audio ↔ epub). If a match is found above a threshold, show the "Read Along" menu item. No persistent link stored.

**Alternatives considered**:
- *Store `linkedDocumentId` in metadata*: Adds schema, requires user action to link, can go stale. Auto-detection is zero-config.
- *Manual linking dialog*: Extra step, worse UX. Users already imported both files — the system should just know.
- *Exact title match only*: Too brittle. "The Great Gatsby.epub" vs "Great Gatsby, The - audiobook.m4b" would fail.

**Rationale**: The library is small enough (hundreds, not millions of docs) that a per-context-menu fuzzy scan is instant. Zero user configuration needed — if both formats exist, the option appears.

### D2: Alignment via transcript-to-EPUB fuzzy text matching

**Decision**: Use existing Whisper/Groq transcript segments and fuzzy-match their text against EPUB content to produce `startTime → CFI` mappings. Cached per audiobook-EPUB pair.

**Alternatives considered**:
- *Force-align with Gentle/CTK*: Word-level timestamps but heavy dependencies. Overkill for v1.
- *Chapter metadata only*: Too coarse for scroll-within-chapter.
- *Require SMIL overlays*: Only some EPUB3 audiobooks have them.

**Rationale**: Transcription already exists. Fuzzy-matching transcript segments to EPUB paragraphs gives segment-level precision (5-15 second windows) with zero new infrastructure.

### D3: Resizable split pane — custom CSS, no new dependency

**Decision**: Implement a simple CSS-based resizable split using mouse events. ~50 lines of React.

**Rationale**: Two-panel horizontal layout. A full library is overkill.

### D4: EPUB highlight via existing annotation API

**Decision**: Use epubjs `rendition.annotations.highlight()` (already in `EPUBViewer`) for the current-segment highlight. Move it as playback progresses.

### D5: Chapter-level fast path + segment-level refinement

**Decision**: Two-tier sync:
1. Match `AudiobookChapter` titles to EPUB TOC entries — instant chapter navigation
2. Within-chapter transcript-to-EPUB alignment — passage-level scroll and highlight

**Rationale**: Chapter matching by title is fast and reliable. Segment matching within a chapter is a smaller search space.

## Risks / Trade-offs

- **[False positive pair detection]** → Fuzzy matching might pair unrelated books with similar titles. Mitigation: Use a high confidence threshold (>0.85 Jaccard or Levenshtein ratio); show the matched title in the menu item so the user can verify before clicking.
- **[Transcription quality]** → Whisper segments may not match EPUB text exactly (abridged versions, different translations). Mitigation: Fuzzy matching with configurable threshold; fall back to chapter-level-only sync if segment matching fails.
- **[Performance on large libraries]** → Scanning all documents on every right-click. Mitigation: Pre-compute a title index on load; the scan is O(n) over document titles (not file contents) — fast for hundreds of docs.
- **[Multiple matches]** → An audiobook might match multiple EPUBs (e.g., different editions). Mitigation: Pick the best match automatically; if scores are close, show a submenu to pick.
