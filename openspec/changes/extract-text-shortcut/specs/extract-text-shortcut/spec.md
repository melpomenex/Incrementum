## ADDED Requirements

### Requirement: App-wide extract shortcut registration
The system SHALL register a customizable keyboard shortcut `edit.extract-text` with default key combo `Ctrl+E` (key: "e", ctrl: true) in the shortcut store's `DEFAULT_SHORTCUTS` array, categorized under `ShortcutCategory.Editing`.

#### Scenario: Shortcut appears in defaults
- **WHEN** the application loads with no prior shortcut customizations
- **THEN** the `edit.extract-text` shortcut is registered with default combo `Ctrl+E`

#### Scenario: Shortcut is user-customizable
- **WHEN** a user navigates to Keyboard Shortcuts settings
- **THEN** the `edit.extract-text` shortcut is listed under the Editing category and can be reassigned to any key combination

### Requirement: Ctrl+E dispatches extract event
When the user presses the `edit.extract-text` shortcut combo (default `Ctrl+E`) and the target is not an editable element, the system SHALL dispatch a custom DOM event `extract-text` on the window object.

#### Scenario: Shortcut pressed while viewing a document
- **WHEN** user presses `Ctrl+E` (or customized equivalent) while a document viewer is active
- **THEN** a `CustomEvent("extract-text")` is dispatched on `window`

#### Scenario: Shortcut ignored in editable fields
- **WHEN** user presses `Ctrl+E` while focus is in an input, textarea, or contenteditable element
- **THEN** the event is NOT dispatched (normal browser behavior)

### Requirement: DocumentViewer creates extract from event
DocumentViewer SHALL listen for the `extract-text` custom event and, when received, create an extract from the current text selection (selectedText + selectionContext) using the existing `createExtract` pipeline with the user's last-used highlight color.

#### Scenario: PDF viewer extract via Ctrl+E
- **WHEN** user has text selected in PDF viewer and presses `Ctrl+E`
- **THEN** an extract is created with the selected text and PDF selection context, a success toast appears, and the selection highlight flashes

#### Scenario: EPUB viewer extract via Ctrl+E
- **WHEN** user has text selected in EPUB viewer and presses `Ctrl+E`
- **THEN** an extract is created with the selected text and EPUB CFI selection context, a success toast appears

#### Scenario: Markdown viewer extract via Ctrl+E
- **WHEN** user has text selected in Markdown viewer and presses `Ctrl+E`
- **THEN** an extract is created with the selected text and text offset selection context, a success toast appears

#### Scenario: No selection does nothing
- **WHEN** user presses `Ctrl+E` while in a document viewer but no text is selected
- **THEN** no extract is created and no toast is shown

### Requirement: YouTube viewer opens time-based extract dialog
YouTubeViewer SHALL listen for the `extract-text` custom event and, when received, open the `CreateVideoExtractDialog` pre-populated with the current playback time as the extract start time.

#### Scenario: YouTube extract via Ctrl+E
- **WHEN** user is viewing a YouTube video with transcript loaded and presses `Ctrl+E`
- **THEN** the `CreateVideoExtractDialog` opens with the current video playback time set as the extract start timestamp

#### Scenario: YouTube extract without transcript
- **WHEN** user is viewing a YouTube video without a transcript and presses `Ctrl+E`
- **THEN** the `CreateVideoExtractDialog` opens, allowing the user to manually define a time range for the extract

### Requirement: Shortcut visible and configurable in settings
The Keyboard Shortcuts settings panel SHALL display the `edit.extract-text` shortcut with its name ("Extract Text"), description ("Create extract from selected text"), current key combo, and allow the user to record a new combo via the shortcut recorder.

#### Scenario: Shortcut listed in settings
- **WHEN** user navigates to Settings > General > Keyboard Shortcuts
- **THEN** "Extract Text" is listed under the Editing category showing its current key combo

#### Scenario: Shortcut recording
- **WHEN** user clicks the record button for "Extract Text" and presses a new key combination
- **THEN** the shortcut is updated to the new combination and conflicts (if any) are highlighted

#### Scenario: Export includes configured shortcut
- **WHEN** user exports shortcuts to JSON
- **THEN** any custom combo for `edit.extract-text` is included in the export

#### Scenario: Reset restores default
- **WHEN** user resets the `edit.extract-text` shortcut to default
- **THEN** the combo reverts to `Ctrl+E`
