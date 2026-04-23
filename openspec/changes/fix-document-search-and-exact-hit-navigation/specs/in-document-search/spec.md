## ADDED Requirements

### Requirement: All viewers report unified search state
Every document viewer (PDF, EPUB, HTML, Markdown, YouTube transcript) SHALL report search state through a unified `DocumentSearchState` interface containing `available`, `query`, `totalMatches`, `activeMatchIndex`, and optional `activeMatchAnchor`.

#### Scenario: PDF viewer reports search state
- **GIVEN** a PDF is open in the viewer
- **WHEN** the user activates in-document search with a query
- **THEN** the PDF viewer SHALL report `DocumentSearchState` with `available: true`, the query, total match count, and active match index

#### Scenario: EPUB viewer reports search state
- **GIVEN** an EPUB is open in the viewer
- **WHEN** the user activates in-document search with a query
- **THEN** the EPUB viewer SHALL report `DocumentSearchState` with `available: true`, the query, total match count, and active match index

#### Scenario: Markdown viewer reports search state
- **GIVEN** a Markdown document is open in the viewer
- **WHEN** the user activates in-document search with a query
- **THEN** the Markdown viewer SHALL report `DocumentSearchState` with `available: true`, the query, total match count, and active match index

#### Scenario: YouTube transcript reports search state
- **GIVEN** a YouTube video with transcript is open in the viewer
- **WHEN** the user activates transcript search with a query
- **THEN** the viewer SHALL report `DocumentSearchState` with `available: true`, the query, total match count, and active match index

### Requirement: Search activation via keyboard shortcut or toolbar
The DocumentViewer search toolbar SHALL activate in-document search when the user presses Ctrl+F (Linux/Windows) or Cmd+F (macOS), or clicks the magnifying glass icon.

#### Scenario: Keyboard shortcut opens search
- **GIVEN** a document is open and focused
- **WHEN** the user presses Ctrl+F or Cmd+F
- **THEN** the search toolbar SHALL open with the search input focused

#### Scenario: Magnifying glass opens search
- **GIVEN** a document is open in the viewer
- **WHEN** the user clicks the magnifying glass icon in the viewer toolbar
- **THEN** the search toolbar SHALL open with the search input focused

### Requirement: Match count display
When in-document search is active and has results, the search UI SHALL display the total number of matches and the current active match index (e.g., "3 of 12").

#### Scenario: Multiple matches found
- **GIVEN** in-document search is active with a query
- **WHEN** the viewer reports 12 total matches and active index 2
- **THEN** the search UI SHALL display "3 of 12" (1-based display)

#### Scenario: No matches found
- **GIVEN** in-document search is active with a query
- **WHEN** the viewer reports 0 total matches
- **THEN** the search UI SHALL display "0 results" or equivalent

### Requirement: Next and previous match navigation
The search UI SHALL provide next/previous buttons (and keyboard shortcuts) that navigate between matches.

#### Scenario: Navigate to next match
- **GIVEN** in-document search has multiple matches
- **WHEN** the user clicks the next button or presses the next-match shortcut
- **THEN** the viewer SHALL advance to the next match, wrapping from last to first

#### Scenario: Navigate to previous match
- **GIVEN** in-document search has multiple matches
- **WHEN** the user clicks the previous button or presses the previous-match shortcut
- **THEN** the viewer SHALL go to the previous match, wrapping from first to last

### Requirement: Active match highlighting
The viewer SHALL visually distinguish the currently active match from other matches.

#### Scenario: Active match has distinct style
- **GIVEN** in-document search has multiple matches
- **WHEN** the user navigates between matches
- **THEN** the active match SHALL have a distinct highlight style (e.g., different color) from non-active matches

### Requirement: Explicit search unavailable state
When content cannot be searched, the viewer SHALL report `available: false` and the search UI SHALL display an explicit message indicating search is unavailable for this content.

#### Scenario: Image-based PDF reports unavailable
- **GIVEN** a PDF with no text layer (scanned images) is open
- **WHEN** the user activates in-document search
- **THEN** the viewer SHALL report `available: false`
- **AND** the search UI SHALL display a message like "Search unavailable for this document"

#### Scenario: Video without transcript reports unavailable
- **GIVEN** a YouTube video with no available transcript is open
- **WHEN** the user activates transcript search
- **THEN** the viewer SHALL report `available: false`
- **AND** the search UI SHALL display a message indicating transcript search is unavailable

### Requirement: Search closes cleanly
When the user closes the search toolbar, all search highlights SHALL be removed and the search state SHALL be reset.

#### Scenario: Escape closes search
- **GIVEN** in-document search is active
- **WHEN** the user presses Escape or clicks the search close button
- **THEN** the search toolbar SHALL close
- **AND** all search highlights SHALL be removed from the document

### Requirement: EPUB in-viewer search uses DOM fallback
EPUB viewer search SHALL use DOM-based visible-content search as the primary method, falling back to epubjs `book.search()` only when needed for non-visible sections.

#### Scenario: DOM search finds visible matches
- **GIVEN** an EPUB is open and content is rendered
- **WHEN** the user searches for a term present in the visible content
- **THEN** the EPUB viewer SHALL find and highlight the match using DOM traversal of rendered content

#### Scenario: Book search supplements for non-visible content
- **GIVEN** an EPUB is open and the user searches for a term not in the currently rendered section
- **THEN** the EPUB viewer MAY use `book.search()` to find matches in non-visible sections
- **AND** the viewer SHALL navigate to and highlight the match when the user selects it
