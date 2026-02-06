# search-jump-navigation Specification

## ADDED Requirements

### Requirement: Location-Aware Search Hits in Command Palette
The system SHALL attach a navigable location to each command-palette search hit so selecting a hit can jump to the matching position in the underlying content.

#### Scenario: PDF search hit includes a page location
- **GIVEN** a user has a PDF document indexed for keyword search
- **WHEN** the user searches in the command palette
- **THEN** each PDF search hit SHALL include `pageNumber`

#### Scenario: EPUB search hit includes a CFI location
- **GIVEN** a user has an EPUB document indexed for keyword search
- **WHEN** the user searches in the command palette
- **THEN** each EPUB search hit SHALL include a CFI (or CFI range) that can be opened by the EPUB viewer

#### Scenario: Web import search hit includes a scrollable location
- **GIVEN** a user has a Web Import (HTML) document indexed for keyword search
- **WHEN** the user searches in the command palette
- **THEN** each Web Import search hit SHALL include a location that can be used to scroll near the matching text (e.g. a selector anchor or scroll percent)

#### Scenario: YouTube transcript hit includes a timestamp
- **GIVEN** a user has a YouTube document with a transcript
- **WHEN** the user searches in the command palette and the match is in transcript text
- **THEN** the hit SHALL include a `timeSeconds` timestamp for the matching transcript segment

### Requirement: One Result Per Document with More Matches on Hover
The system SHALL show at most one primary search result row per document in the command palette while allowing access to additional matches from the same document via hover.

#### Scenario: Primary result shown, secondary options on hover
- **GIVEN** a document contains multiple matches for the query
- **WHEN** results are shown in the command palette
- **THEN** the system SHALL show one primary row for that document
- **AND** hovering that row SHALL reveal additional match options from the same document

### Requirement: Selecting a Search Hit Jumps and Highlights
Selecting a search hit in the command palette SHALL open the document at the hit location and highlight the user’s query within the document.

#### Scenario: PDF hit opens page and highlights query
- **GIVEN** a user selects a PDF search hit with `pageNumber`
- **WHEN** the user activates the hit (click or Enter)
- **THEN** the system SHALL open the PDF viewer to that page
- **AND** highlight the query matches on that page

#### Scenario: EPUB hit opens location and highlights query
- **GIVEN** a user selects an EPUB search hit with CFI/CFI range
- **WHEN** the user activates the hit
- **THEN** the system SHALL open the EPUB viewer at that location
- **AND** highlight the query at that location

#### Scenario: Web import hit opens location and highlights query
- **GIVEN** a user selects a Web Import search hit with a location hint
- **WHEN** the user activates the hit
- **THEN** the system SHALL open the HTML viewer and scroll near the matching text
- **AND** highlight the query near that location

#### Scenario: YouTube transcript hit seeks and plays
- **GIVEN** a user selects a YouTube transcript search hit with `timeSeconds`
- **WHEN** the user activates the hit
- **THEN** the system SHALL open the YouTube viewer
- **AND** seek to the timestamp
- **AND** start playing the video
- **AND** highlight the matching segment in the transcript UI

#### Scenario: YouTube title-only match resumes saved position
- **GIVEN** a user selects a YouTube search result that matched only video title/metadata (not transcript text)
- **WHEN** the user activates the hit
- **THEN** the system SHALL open the YouTube viewer and resume from the saved playback position

### Requirement: Highlight Persistence for Jump Navigation
Highlights triggered by command-palette jump navigation SHALL persist until the user closes the document tab.

#### Scenario: Highlights remain while tab is open
- **GIVEN** a user opened a document via command-palette jump navigation
- **WHEN** the user scrolls or navigates within the document
- **THEN** the query highlights SHALL remain visible

#### Scenario: Highlights are cleared on tab close
- **GIVEN** a document has active query highlights from jump navigation
- **WHEN** the user closes the document tab
- **THEN** the system SHALL clear the highlights

