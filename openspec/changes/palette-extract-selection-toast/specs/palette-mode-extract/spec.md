## ADDED Requirements

### Requirement: Palette mode text selection detection
When a user selects text in the preview pane of `EditableContentPalette`, the system SHALL detect the selection and propagate the selected text to the parent `DocumentViewer` via the existing `onSelectionChange` callback.

#### Scenario: User selects text in palette preview mode
- **WHEN** user selects text in the preview pane of the palette editor (in `preview` or `split` mode)
- **THEN** the system detects the selection and passes the selected text to `DocumentViewer` via `onSelectionChange`

#### Scenario: User selects text in palette write mode
- **WHEN** user selects text in the raw editor pane (in `write` mode)
- **THEN** no extract selection is triggered — the selection is treated as a normal editing operation

#### Scenario: User clears selection in palette
- **WHEN** user clears the text selection in the palette preview pane
- **THEN** the system propagates an empty string to clear the extract selection state

### Requirement: Floating extract button in palette mode
When text is selected in palette mode, the floating extract button SHALL appear, matching the behavior of the normal document view.

#### Scenario: Extract button appears on palette selection
- **WHEN** user selects text in palette mode and the selection is non-empty
- **THEN** the floating extract button appears at the bottom-right of the screen with the selected text character count

#### Scenario: Extract button creates extract from palette selection
- **WHEN** user clicks the extract button while in palette mode
- **THEN** the system creates an extract using `createInstantExtract` with the selected text, matching the normal document view flow

#### Scenario: Shift+click extract button opens dialog
- **WHEN** user holds Shift and clicks the extract button while in palette mode
- **THEN** the full `CreateExtractDialog` opens with the selected text pre-filled
