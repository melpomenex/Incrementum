## ADDED Requirements

### Requirement: Remove Hide Assistant button from scroll mode
The system SHALL NOT render the "Hide Assistant" floating button in `QueueScrollPage`. The assistant panel's built-in collapse chevron SHALL remain the sole way to collapse the assistant.

#### Scenario: No Hide Assistant button in scroll mode
- **WHEN** a user views any item type (document, RSS, flashcard, extract) in scroll mode
- **THEN** no "Hide Assistant" / "Show Assistant" floating button appears in the bottom-left corner

#### Scenario: Assistant panel remains collapsible
- **WHEN** a user clicks the collapse chevron in the AssistantPanel header
- **THEN** the assistant panel collapses to a thin strip, and the expand chevron restores it

### Requirement: Scroll mode toolbar for document and RSS items
The system SHALL display a minimal toolbar at the top of the overlay controls area when viewing a document or RSS item in scroll mode. The toolbar SHALL include view mode toggle buttons (Document, Extracts, Learning Cards) and a Create Extract button.

#### Scenario: Toolbar appears for document items
- **WHEN** the current scroll item is of type "document"
- **THEN** a toolbar is visible at the top with view mode toggle (Document / Extracts / Learning Cards) and a Create Extract (Lightbulb icon) button

#### Scenario: Toolbar appears for RSS items
- **WHEN** the current scroll item is of type "rss"
- **THEN** a toolbar is visible at the top with view mode toggle (Document / Extracts / Learning Cards) and a Create Extract button

#### Scenario: Toolbar does not appear for flashcard items
- **WHEN** the current scroll item is of type "flashcard"
- **THEN** no toolbar is rendered at the top

#### Scenario: Toolbar does not appear for extract items
- **WHEN** the current scroll item is of type "extract"
- **THEN** no toolbar is rendered at the top

### Requirement: View mode toggle in scroll mode toolbar
The system SHALL allow switching between document, extracts, and learning cards views within scroll mode for document and RSS items. The active view mode SHALL be visually indicated.

#### Scenario: Switch to extracts view
- **WHEN** the user clicks the Extracts (List icon) button in the toolbar
- **THEN** the document content area is replaced with an ExtractsList filtered to the current document

#### Scenario: Switch to learning cards view
- **WHEN** the user clicks the Learning Cards (Brain icon) button in the toolbar
- **THEN** the document content area is replaced with a LearningCardsList filtered to the current document

#### Scenario: Switch back to document view
- **WHEN** the user clicks the Document (FileText icon) button in the toolbar
- **THEN** the document content area shows the document viewer again

#### Scenario: View mode resets on item change
- **WHEN** the user scrolls to a different queue item
- **THEN** the view mode resets to "document" regardless of the previous view mode

### Requirement: Create Extract from scroll mode toolbar
The system SHALL provide a Create Extract button in the scroll mode toolbar that opens the extract creation dialog for the current document.

#### Scenario: Open extract creation dialog
- **WHEN** the user clicks the Create Extract (Lightbulb icon) button in the toolbar
- **THEN** the CreateExtractDialog opens for the current document, allowing the user to create an extract

### Requirement: Scroll mode toolbar auto-hide behavior
The scroll mode toolbar SHALL follow the same auto-hide behavior as existing overlay controls — visible when `showControls` is true, fading out after 3 seconds of mouse idle.

#### Scenario: Toolbar fades with other controls
- **WHEN** the user is idle for 3 seconds while in scroll mode
- **THEN** the toolbar fades out alongside the other overlay controls (top bar, rating buttons)

#### Scenario: Toolbar reappears on mouse move
- **WHEN** the user moves the mouse after controls have faded
- **THEN** the toolbar reappears alongside the other overlay controls
