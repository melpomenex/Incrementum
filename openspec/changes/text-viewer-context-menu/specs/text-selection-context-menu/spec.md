## ADDED Requirements

### Requirement: Context menu appears on right-click with text selected
The system SHALL display a context menu when the user right-clicks on selected text in EPUBViewer or MarkdownViewer. The menu SHALL appear at the cursor position and contain actions relevant to the selected text.

#### Scenario: Right-click on selected text in markdown viewer
- **WHEN** user selects text in a markdown document and right-clicks
- **THEN** the system SHALL display a context menu at the cursor position with the following items: Create Extract, Create Extract (with dialog), Highlight (submenu), Copy, Dictionary Lookup, Create Flashcard

#### Scenario: Right-click on selected text in epub viewer
- **WHEN** user selects text in an epub document and right-clicks
- **THEN** the system SHALL display a context menu at the cursor position with the same items as the markdown viewer

#### Scenario: Right-click with no text selected
- **WHEN** user right-clicks without selecting text
- **THEN** the system SHALL NOT display the custom context menu (native browser menu or no menu)

### Requirement: Create Extract action
The context menu SHALL include a "Create Extract" action that instantly creates an extract from the selected text using the same logic as the floating extract button.

#### Scenario: Instant extract from context menu
- **WHEN** user right-clicks selected text and clicks "Create Extract"
- **THEN** the system SHALL call `createInstantExtract` with the selected text and selection context, show a success toast, and close the context menu

### Requirement: Create Extract with dialog action
The context menu SHALL include a "Create Extract" action with dialog variant (Shift+click equivalent) that opens the full CreateExtractDialog.

#### Scenario: Extract dialog from context menu
- **WHEN** user right-clicks selected text and clicks "Create Extract (with dialog)"
- **THEN** the system SHALL open the CreateExtractDialog pre-filled with the selected text and selection context

### Requirement: Highlight action with color submenu
The context menu SHALL include a "Highlight" submenu with 5 color options (yellow, green, blue, pink, purple). Selecting a color SHALL create an extract with the highlight color.

#### Scenario: Highlight with color from submenu
- **WHEN** user hovers over "Highlight" in the context menu, then clicks a color option
- **THEN** the system SHALL create an extract with the selected text and the chosen highlight color, identical to the PDF SelectionPopup highlight behavior

### Requirement: Copy action
The context menu SHALL include a "Copy" action that copies the selected text to the clipboard.

#### Scenario: Copy from context menu
- **WHEN** user right-clicks selected text and clicks "Copy"
- **THEN** the system SHALL copy the selected text to the clipboard via `navigator.clipboard.writeText` and close the context menu

### Requirement: Dictionary Lookup action
The context menu SHALL include a "Dictionary Lookup" action that looks up the first word of the selected text.

#### Scenario: Dictionary lookup from context menu
- **WHEN** user right-clicks selected text and clicks "Dictionary Lookup"
- **THEN** the system SHALL look up the first word of the selected text using `handleDictionaryLookup` and display the dictionary result panel

### Requirement: Create Flashcard action
The context menu SHALL include a "Create Flashcard" action that opens the FlashcardStudioModal with a pre-filled QA draft from the selected text.

#### Scenario: Flashcard creation from context menu
- **WHEN** user right-clicks selected text and clicks "Create Flashcard"
- **THEN** the system SHALL open the FlashcardStudioModal with the selected text as an excerpt, draft card type "qa", and auto-edit enabled

### Requirement: Context menu dismissal
The context menu SHALL dismiss on click-outside, Escape key, or after an action is selected.

#### Scenario: Dismiss on click outside
- **WHEN** the context menu is visible and user clicks outside it
- **THEN** the menu SHALL close without performing any action

#### Scenario: Dismiss on Escape
- **WHEN** the context menu is visible and user presses Escape
- **THEN** the menu SHALL close without performing any action

### Requirement: Keyboard navigation in context menu
The context menu SHALL support keyboard navigation with arrow keys and Enter.

#### Scenario: Navigate with arrow keys
- **WHEN** the context menu is visible
- **THEN** user SHALL be able to navigate between items using ArrowUp/ArrowDown and activate the focused item with Enter

### Requirement: No context menu for PDF documents
The custom context menu SHALL NOT appear for PDF documents. PDFViewer already has its own SelectionPopup.

#### Scenario: Right-click in PDF viewer
- **WHEN** user right-clicks in the PDF viewer
- **THEN** the custom text selection context menu SHALL NOT appear (PDF's SelectionPopup handles this)
