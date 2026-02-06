# Change: Update search result jumps and PDF scroll performance

## Why
Search results in the command palette (Ctrl/Cmd+K) currently open the target document but do not navigate to the match location or highlight the query. PDF scrolling is also laggy (notably on Arch Linux), likely due to eager full-document rendering and expensive per-scroll work.

## What Changes
- Add location-aware search results so selecting a result can jump to the match location and highlight the query.
- Show only the top (most likely) match per document in the command palette, with additional match options revealed on hover for that document.
- Support jump + highlight across: PDF, EPUB, Web Import (HTML), and YouTube transcript (seek and start playback).
- Improve PDF scroll performance by switching from eager “render all pages” behavior to windowed/lazy rendering and reducing per-scroll overhead.

## Impact
- Affected specs (delta):
  - `search-jump-navigation` (new capability)
  - `pdf-scroll-performance` (new capability)
- Related prior specs/changes:
  - `openspec/changes/add-comprehensive-ux-improvements/specs/search-discovery/spec.md` (click result opens at matching position)
  - `openspec/changes/add-semantic-transcript-search/specs/transcript-search/spec.md` (jump to timestamp + highlight segment)
- Affected code (expected):
  - `src/components/search/CommandCenter.tsx`
  - `src/components/search/GlobalSearch.tsx`
  - `src/components/viewer/DocumentViewer.tsx`
  - `src/components/viewer/PDFViewer.tsx`
  - `src/components/viewer/EPUBViewer.tsx`
  - `src/components/viewer/YouTubeViewer.tsx`
  - `src/components/media/TranscriptSync.tsx`

