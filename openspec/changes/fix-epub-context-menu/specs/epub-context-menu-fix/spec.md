## ADDED Requirements

### Requirement: EPUB context menu actions receive correct selection context
The system SHALL ensure that when a user selects text in an EPUB and right-clicks to open the context menu, all actions (Extract, Highlight, Copy, Dictionary, Flashcard) execute with the correct `EpubSelectionContext` including CFI range and chapter metadata.

#### Scenario: Extract from right-click after text selection
- **WHEN** user selects text in an EPUB document and right-clicks to open the context menu
- **THEN** the Extract action SHALL create an extract with the correct page number and EPUB location metadata derived from `selectionContext`

#### Scenario: Highlight from right-click after text selection
- **WHEN** user selects text in an EPUB document and right-clicks, then chooses a highlight color
- **THEN** the Highlight action SHALL create a colored extract with correct `selectionContext` including CFI range

#### Scenario: Copy from right-click works without context
- **WHEN** user selects text in an EPUB and right-clicks, then chooses Copy
- **THEN** the selected text SHALL be copied to clipboard regardless of `selectionContext` state

### Requirement: EPUB selection context survives generic selection change events
The system SHALL preserve the `EpubSelectionContext` from `rendition.on("selected")` even when a generic `selectionchange` event fires afterward with no context.

#### Scenario: Rapid selection events preserve context
- **WHEN** `rendition.on("selected")` fires with a full `EpubSelectionContext`, followed by `handleSelectionChange` firing with `context === undefined`
- **THEN** the stored `selectionContext` SHALL retain the `EpubSelectionContext` value

#### Scenario: Explicit context clear still works
- **WHEN** `updateSelection` is called with `context === null`
- **THEN** `selectionContext` SHALL be cleared to null

### Requirement: Context menu callback includes selection context
The `onContextMenu` callback from EPUBViewer SHALL include the current `selectionContext` alongside position and text, so that DocumentViewer can use it directly when building context menu actions.

#### Scenario: Context menu receives selection context from ref
- **WHEN** user right-clicks on selected text in an EPUB
- **THEN** the `onContextMenu` callback SHALL include the `selectionContext` from the most recent `rendition.on("selected")` event
