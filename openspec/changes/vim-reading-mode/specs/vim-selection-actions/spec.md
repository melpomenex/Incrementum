## ADDED Requirements

### Requirement: Extract selected text
In Visual or Visual Line mode, pressing `Enter` or `E` SHALL create an extract from the selected text. This SHALL invoke the same extract creation flow as the right-click context menu "Create Extract" action.

#### Scenario: Quick extract from visual selection
- **WHEN** the user selects text in Visual mode and presses `Enter`
- **THEN** the selected text is saved as an extract (instant extraction), the selection is cleared, the system returns to Normal mode, and a toast notification confirms the extraction

#### Scenario: Extract with dialog from visual selection
- **WHEN** the user selects text in Visual mode and presses `E` (shift+e)
- **THEN** the Create Extract dialog opens with the selected text pre-filled, allowing the user to edit, add tags, or set a title before saving

### Requirement: Yank (copy) selected text
In Visual or Visual Line mode, pressing `y` SHALL copy the selected text to the system clipboard. The selection SHALL be cleared and the system SHALL return to Normal mode.

#### Scenario: Copy text to clipboard
- **WHEN** the user selects text in Visual mode and presses `y`
- **THEN** the selected text is copied to the clipboard, the selection is cleared, the mode returns to Normal, and a brief visual indicator confirms the yank

#### Scenario: Yank in EPUB iframe
- **WHEN** the user yanks text inside an EPUB document
- **THEN** the text is copied to the system clipboard using the Tauri clipboard API (not the iframe's `document.execCommand("copy")` which may not work cross-origin)

### Requirement: Highlight selected text
In Visual or Visual Line mode, pressing `H` SHALL toggle a highlight on the selected text using the currently selected highlight color. The highlight SHALL use the same persistence and rendering system as mouse-based highlights.

#### Scenario: Highlight with default color
- **WHEN** the user selects text in Visual mode and presses `H`
- **THEN** the selected text is highlighted with the default highlight color (yellow), the selection is cleared, and the mode returns to Normal

#### Scenario: Highlight persists across sessions
- **WHEN** the user highlights text via Visual mode, closes the document, and reopens it
- **THEN** the highlight is visible in the same location, loaded from the same highlight storage used by mouse-based highlighting

#### Scenario: Highlight color respects user setting
- **WHEN** the user has changed the default highlight color to green in settings
- **THEN** pressing `H` applies a green highlight instead of yellow

### Requirement: Create flashcard from selection
In Visual or Visual Line mode, pressing `F` SHALL open the flashcard creation popup with the selected text pre-filled as the front of a cloze deletion card.

#### Scenario: Create cloze flashcard
- **WHEN** the user selects text in Visual mode and presses `F`
- **THEN** the Cloze Creator popup opens with the selected text, and the user can confirm or edit the cloze deletion

### Requirement: Repeat last action
In Normal mode, pressing `.` (dot) SHALL repeat the last action performed in Visual mode (extract, yank, highlight, or flashcard) on the text that would be selected by repeating the same motion sequence.

#### Scenario: Repeat extract
- **WHEN** the user extracts text from words 5-10 in Visual mode, returns to Normal, moves to word 15, and presses `.`
- **THEN** the system enters Visual mode, selects the same relative range (words 15-20), and extracts it

### Requirement: Action key remapping
The action keys (`Enter`/`E`, `y`, `H`, `F`) SHALL be registered with `useShortcutStore` under the "Vim Reading" category and SHALL be remappable by the user.

#### Scenario: Remap extract key
- **WHEN** the user remaps the "extract selection" action from `Enter` to `x`
- **THEN** pressing `x` in Visual mode creates an extract, and `Enter` no longer triggers extraction
