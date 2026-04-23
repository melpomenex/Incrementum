# document-viewer-search Specification

## ADDED Requirements

### Requirement: Viewer search executes from the shared document toolbar
The system SHALL execute in-document search from the main document viewer search control instead of showing a non-functional search field.

#### Scenario: Keyboard shortcut opens functional viewer search
- **GIVEN** a user is viewing a searchable document
- **WHEN** the user presses `Ctrl/Cmd+F`
- **THEN** the document viewer SHALL open and focus the in-document search control
- **AND** entering a query SHALL execute search for the current document type

#### Scenario: Toolbar search and keyboard search are the same flow
- **GIVEN** a user opens viewer search from the toolbar button
- **WHEN** they enter a query and navigate matches
- **THEN** the system SHALL use the same search state and navigation behavior as the keyboard shortcut flow

### Requirement: Search shows navigable match state
The system SHALL provide match counts and next/previous navigation for supported in-document search surfaces.

#### Scenario: Match count is shown
- **GIVEN** a supported document contains one or more matches for the query
- **WHEN** search results are resolved
- **THEN** the viewer SHALL show the total number of matches
- **AND** SHALL identify the active match position

#### Scenario: Next and previous navigate deterministically
- **GIVEN** a supported document contains multiple matches
- **WHEN** the user presses Enter or activates the next control
- **THEN** the viewer SHALL move to the next match
- **AND** Shift+Enter or the previous control SHALL move to the previous match

#### Scenario: No matches are explicit
- **GIVEN** a supported document contains no matches for the query
- **WHEN** search executes
- **THEN** the viewer SHALL show a visible "0 matches" state

### Requirement: PDF viewer search highlights and navigates matches
The PDF viewer SHALL support in-document search across searchable PDF text and navigate to the active match.

#### Scenario: PDF search highlights visible matches
- **GIVEN** a PDF document contains searchable text matching the query
- **WHEN** the user runs in-document search
- **THEN** the PDF viewer SHALL highlight matching text
- **AND** the active match SHALL be visually distinct

#### Scenario: PDF search changes page for the active match
- **GIVEN** the next match is on a different PDF page
- **WHEN** the user navigates to that match
- **THEN** the PDF viewer SHALL move to the page containing the active match
- **AND** scroll the active match into view

#### Scenario: PDF without searchable text reports unavailable search
- **GIVEN** a PDF has no usable text layer or extracted text for search
- **WHEN** the user runs in-document search
- **THEN** the viewer SHALL report that search is unavailable for this PDF
- **AND** SHALL suggest OCR or text extraction instead of silently reporting zero results

### Requirement: EPUB viewer search highlights and navigates matches
The EPUB viewer SHALL support in-document search across the book and navigate to exact chapter locations.

#### Scenario: EPUB search finds matches across sections
- **GIVEN** an EPUB contains matches in multiple chapters or spine items
- **WHEN** the user runs in-document search
- **THEN** the EPUB viewer SHALL resolve the matching CFIs or equivalent anchors
- **AND** navigating matches SHALL open the active match location

#### Scenario: EPUB active match is emphasized
- **GIVEN** an EPUB search has multiple results
- **WHEN** the user moves between matches
- **THEN** the active match SHALL be highlighted distinctly from other matches

### Requirement: Transcript search is integrated with viewer search
YouTube transcript search SHALL be controllable from the main viewer search UI.

#### Scenario: Viewer search finds transcript segments
- **GIVEN** a YouTube document has a loaded transcript
- **WHEN** the user runs in-document search from the viewer
- **THEN** matching transcript segments SHALL be found from the shared viewer query
- **AND** the viewer SHALL show match count and active-match position

#### Scenario: Navigating transcript matches seeks playback
- **GIVEN** a YouTube transcript search has multiple matches
- **WHEN** the user navigates to the next or previous match
- **THEN** the viewer SHALL seek playback to the active segment timestamp
- **AND** highlight and scroll that segment into view

#### Scenario: Missing transcript is explicit
- **GIVEN** a YouTube document has no transcript available
- **WHEN** the user runs in-document search
- **THEN** the viewer SHALL report that transcript search is unavailable
- **AND** SHALL NOT behave as though the query simply had zero matches

### Requirement: Rendered text surfaces participate in shared viewer search
HTML and markdown reading surfaces SHALL participate in the same viewer-driven search flow so behavior stays consistent across document types.

#### Scenario: HTML document search highlights rendered content
- **GIVEN** an HTML document contains the search query
- **WHEN** the user runs in-document search
- **THEN** the rendered HTML surface SHALL highlight matches
- **AND** next/previous navigation SHALL scroll the active match into view

#### Scenario: Markdown document search highlights rendered content
- **GIVEN** a markdown document contains the search query
- **WHEN** the user runs in-document search
- **THEN** the rendered markdown surface SHALL highlight matches
- **AND** next/previous navigation SHALL scroll the active match into view
