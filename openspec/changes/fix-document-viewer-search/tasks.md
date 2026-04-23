## 1. Wire shared viewer search state

- [ ] 1.1 Replace the `DocumentViewer.tsx` placeholder `handleSearch()` path with a real search controller that owns query, active index, result count, and next/previous actions
- [ ] 1.2 Make `Ctrl/Cmd+F` open the existing viewer search UI and focus the query field for supported document types
- [ ] 1.3 Show consistent status in the toolbar: match count, current position, no-results, and search-unavailable states

## 2. Add format-specific search adapters

- [ ] 2.1 Add PDF find support in `PDFViewer.tsx` with match enumeration, active-match navigation, and visible highlighting
- [ ] 2.2 Add EPUB find support in `EPUBViewer.tsx` using CFI-backed results and active-match navigation
- [ ] 2.3 Add HTML/Markdown find support so the same viewer search bar can highlight and step through rendered text matches
- [ ] 2.4 Refactor `YouTubeViewer.tsx` and `TranscriptSync.tsx` so transcript search can be driven from the shared viewer search state

## 3. Handle unsupported / degraded states clearly

- [ ] 3.1 Distinguish "0 matches" from "document has no searchable text"
- [ ] 3.2 For PDFs without a usable text layer, show guidance to run OCR or extract text instead of silently failing

## 4. Verify behavior

- [ ] 4.1 Verify PDF search highlights matches and next/previous navigation changes page when needed
- [ ] 4.2 Verify EPUB search finds matches across chapters and focuses the active match
- [ ] 4.3 Verify YouTube transcript search highlights matching segments and seeking a result updates playback
- [ ] 4.4 Verify HTML/Markdown viewer search still works with existing command-palette jump highlighting
- [ ] 4.5 Verify Enter and Shift+Enter move forward/backward consistently across supported viewer types
