## ADDED Requirements

### Requirement: OCR region select mode toggle
The PDF viewer SHALL provide a toggle to enter OCR region-select mode via a toolbar button and a keyboard shortcut (Ctrl/Cmd+Shift+O).

#### Scenario: User activates OCR mode via toolbar
- **WHEN** the user clicks the "OCR Select" button in the PDF viewer toolbar
- **THEN** the viewer enters OCR region-select mode, the cursor changes to crosshair, and normal text selection/highlighting is disabled

#### Scenario: User activates OCR mode via keyboard shortcut
- **WHEN** the user presses Ctrl+Shift+O (Cmd+Shift+O on macOS)
- **THEN** the viewer enters OCR region-select mode, identical to clicking the toolbar button

#### Scenario: User deactivates OCR mode
- **WHEN** the user presses Escape, clicks the toolbar button again, or finishes/cancels a selection
- **THEN** the viewer exits OCR region-select mode and restores normal cursor and interaction behavior

### Requirement: Region selection by drag
The system SHALL allow the user to draw a selection rectangle on the PDF canvas by clicking and dragging in OCR region-select mode.

#### Scenario: User draws a selection rectangle
- **WHEN** the user presses pointer down, drags, and releases within the PDF canvas area while in OCR mode
- **THEN** a semi-transparent rectangle overlay with dashed border is rendered from the pointer-down point to the pointer-up point

#### Scenario: Selection rectangle stays visible after drawing
- **WHEN** the user completes the drag gesture
- **THEN** the selection rectangle remains visible with a small floating action bar showing "OCR this region" and "Cancel" options

#### Scenario: User cancels region selection
- **WHEN** the user clicks "Cancel" on the floating action bar or presses Escape
- **THEN** the selection rectangle is removed and the user remains in OCR mode to draw a new selection

#### Scenario: User starts a new selection while one exists
- **WHEN** the user begins a new drag while a selection rectangle is visible
- **THEN** the previous selection is replaced by the new one

### Requirement: Canvas region capture
The system SHALL capture the selected region of the PDF canvas as an image for OCR processing.

#### Scenario: Capture selected region
- **WHEN** the user confirms "OCR this region" on the floating action bar
- **THEN** the system extracts the selected rectangle from the PDF page canvas using an offscreen canvas crop, producing a PNG image of only the selected area

#### Scenario: Canvas capture respects page boundaries
- **WHEN** the selected rectangle extends beyond the visible canvas area
- **THEN** the capture is clipped to the actual canvas dimensions
