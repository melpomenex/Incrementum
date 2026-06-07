## ADDED Requirements

### Requirement: Auto-proceed queue setting
The system SHALL provide a settings option to auto-proceed to the next item in the queue when the current video or audio media finishes playing.

#### Scenario: Option is enabled and video ends
- **WHEN** the user has enabled the auto-proceed option in queue settings, and a YouTube video or local video/audio finishes playing
- **THEN** the system SHALL automatically transition and navigate to the next item in the queue.

#### Scenario: Option is disabled and video ends
- **WHEN** the user has disabled the auto-proceed option in queue settings, and a YouTube video or local video/audio finishes playing
- **THEN** the system SHALL remain on the current item and not automatically navigate.

### Requirement: Selection context menu functionality in queue
The system SHALL ensure that clicking inside the text selection context menu or its submenus does not prematurely close the menu or clear the active text selection before the associated action can execute.

#### Scenario: Selecting highlight color in context menu
- **WHEN** the user selects text inside a document, right-clicks to open the context menu, hovers to open the highlight submenu, and clicks a highlight color
- **THEN** the system SHALL apply the selected highlight color to the selection, save the highlight, and close the context menu.

#### Scenario: Creating a note or flashcard from context menu
- **WHEN** the user selects text inside a document, right-clicks to open the context menu, and clicks "Add Note" or "Create Flashcard..."
- **THEN** the system SHALL open the note creation dialog or the flashcard studio modal pre-seeded with the selected text, and close the context menu.
