## ADDED Requirements

### Requirement: Sub-hit selection navigates to exact occurrence
When a command-palette search result has multiple content matches within a single document, selecting a specific sub-hit SHALL open the document and navigate to that exact occurrence, not the first match or top of document.

#### Scenario: PDF sub-hit navigates to correct page
- **GIVEN** a command-palette search finds 3 matches in a PDF on pages 5, 12, and 45
- **WHEN** the user clicks the sub-hit for the page-12 match
- **THEN** the PDF viewer SHALL open to page 12 and highlight the matched text

#### Scenario: EPUB sub-hit navigates to correct location
- **GIVEN** a command-palette search finds multiple matches in an EPUB
- **WHEN** the user clicks a specific sub-hit
- **THEN** the EPUB viewer SHALL navigate to the exact match location and highlight it

#### Scenario: Markdown sub-hit navigates to correct position
- **GIVEN** a command-palette search finds multiple matches in a Markdown document
- **WHEN** the user clicks a specific sub-hit
- **THEN** the Markdown viewer SHALL scroll to the exact match and highlight it

#### Scenario: YouTube sub-hit navigates to correct timestamp
- **GIVEN** a command-palette search finds multiple matches in a YouTube transcript
- **WHEN** the user clicks a specific sub-hit
- **THEN** the YouTube viewer SHALL seek to the matching segment timestamp and highlight it in the transcript

### Requirement: EPUB command-palette hits carry usable anchors
Command-palette search results for EPUBs SHALL include a `textQuote` and `matchIndex` in the `ExactSearchHitLocation` so the viewer can resolve the anchor at open time.

#### Scenario: EPUB hit includes text quote
- **GIVEN** the command palette searches an EPUB's content and finds a match
- **WHEN** the SearchHit is created
- **THEN** the hit's location SHALL include `textQuote` with the matched text excerpt
- **AND** the hit's location SHALL include `matchIndex` to disambiguate multiple occurrences

#### Scenario: Viewer resolves empty CFI at open time
- **GIVEN** a command-palette result for an EPUB has `cfi: ""` but has `textQuote` and `matchIndex`
- **WHEN** the EPUB viewer receives the `initialJump`
- **THEN** the viewer SHALL search the rendered content for the text quote
- **AND** navigate to the match at the specified index
- **AND** generate a CFI for that location for subsequent navigation

### Requirement: PDF page estimation uses stored offsets
CommandCenter SHALL use stored page-break character offsets for PDF page estimation when available, falling back to linear percentage estimation when offsets are not stored.

#### Scenario: Stored offsets available
- **GIVEN** a PDF document has page-break offsets stored in metadata
- **WHEN** CommandCenter creates a SearchHit for a match at character offset 15000
- **THEN** it SHALL determine the page number by finding the page whose offset range contains 15000

#### Scenario: No stored offsets
- **GIVEN** a PDF document has no page-break offsets in metadata
- **WHEN** CommandCenter creates a SearchHit
- **THEN** it SHALL fall back to linear percentage estimation (current behavior)

### Requirement: Initial jump waits for viewer readiness
DocumentViewer SHALL wait for the child viewer to report readiness before attempting to resolve an `initialJump` anchor.

#### Scenario: EPUB viewer waits for rendering
- **GIVEN** a command-palette result opens an EPUB with an initial jump
- **WHEN** the EPUB viewer is still rendering the book
- **THEN** the initial jump resolution SHALL wait until the viewer reports content is rendered
- **AND** then navigate to the exact match

#### Scenario: Timeout fallback for slow rendering
- **GIVEN** a viewer takes more than 3 seconds to report readiness after document load
- **WHEN** an initial jump is pending
- **THEN** DocumentViewer SHALL log a warning and skip exact navigation (document opens at default position)

### Requirement: HTML viewer scrolls to exact text match
When a command-palette result targets an HTML document, the HTML viewer SHALL locate the exact text in the rendered iframe and scroll to it.

#### Scenario: HTML text match found and scrolled
- **GIVEN** a command-palette result includes a text quote match in an HTML document
- **WHEN** the HTML viewer opens with an initial jump
- **THEN** it SHALL search the iframe DOM for the text quote
- **AND** scroll the matching element into view with highlighting
