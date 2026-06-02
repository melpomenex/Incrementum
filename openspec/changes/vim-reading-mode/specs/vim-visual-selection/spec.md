## ADDED Requirements

### Requirement: Enter Visual mode
In Normal mode, pressing `v` SHALL enter Visual mode. The current cursor position becomes the selection anchor. All subsequent motions extend the selection from the anchor to the new cursor position.

#### Scenario: Enter visual mode from normal
- **WHEN** the user presses `v` in Normal mode
- **THEN** the system enters Visual mode, the mode indicator shows `-- VISUAL --`, and the current word is selected as both anchor and end point

#### Scenario: Selection extends with motions
- **WHEN** the user enters Visual mode and then presses `w` three times
- **THEN** text from the anchor word to three words forward is selected, highlighted with the browser's native selection rendering

### Requirement: Enter Visual Line mode
In Normal mode, pressing `V` (shift+v) SHALL enter Visual Line mode. The entire line containing the cursor becomes selected. Subsequent `j`/`k` motions extend the selection by full lines.

#### Scenario: Enter visual line mode
- **WHEN** the user presses `V` in Normal mode
- **THEN** the system enters Visual Line mode, the mode indicator shows `-- VISUAL LINE --`, and the entire current line is selected

#### Scenario: Extend line selection downward
- **WHEN** the user is in Visual Line mode and presses `j`
- **THEN** the selection extends to include the next line below, so the full line range from anchor to cursor line is selected

#### Scenario: Extend line selection upward
- **WHEN** the user is in Visual Line mode and presses `k`
- **THEN** the selection extends to include the previous line, so the full line range from cursor line to anchor is selected

### Requirement: All motions work in Visual mode
In Visual and Visual Line modes, all Normal mode motions SHALL be available and SHALL extend or contract the selection: `h`, `l`, `w`, `b`, `e`, `j`, `k`, `0`, `$`, `gg`, `G`, `{`, `}`.

#### Scenario: Word motion extends selection
- **WHEN** the user is in Visual mode with anchor at word 10 and presses `w` to word 11
- **THEN** words 10 through 11 are selected

#### Scenario: Line-end motion extends selection
- **WHEN** the user is in Visual mode with anchor mid-line and presses `$`
- **THEN** the selection extends from the anchor to the end of the current line

#### Scenario: Paragraph motion extends selection
- **WHEN** the user is in Visual mode and presses `}`
- **THEN** the selection extends from the anchor to the start of the next paragraph

### Requirement: Selection direction is bidirectional
The selection SHALL work regardless of whether the cursor moves forward or backward from the anchor. If the cursor moves behind the anchor, the selection covers from the cursor position to the anchor.

#### Scenario: Selection extends backward
- **WHEN** the user enters Visual mode at word 20 and presses `b` three times to word 17
- **THEN** words 17 through 20 are selected

#### Scenario: Selection flips direction
- **WHEN** the user enters Visual mode at word 10, presses `w` to word 12, then presses `b` back to word 9
- **THEN** words 9 through 10 are selected (the anchor remains at 10)

### Requirement: Exit Visual mode
In Visual or Visual Line mode, pressing `Escape` SHALL exit to Normal mode. The selection SHALL be cleared and the cursor SHALL remain at its current position.

#### Scenario: Exit visual mode
- **WHEN** the user presses `Escape` in Visual mode
- **THEN** the selection is cleared, the mode returns to Normal, and the cursor stays at the word where it was

#### Scenario: Exit visual line mode
- **WHEN** the user presses `Escape` in Visual Line mode
- **THEN** the line selection is cleared and the mode returns to Normal

### Requirement: Switch between Visual and Visual Line mode
In Visual mode, pressing `V` SHALL switch to Visual Line mode. In Visual Line mode, pressing `v` SHALL switch to Visual mode. The anchor position is preserved.

#### Scenario: Switch from Visual to Visual Line
- **WHEN** the user is in Visual mode and presses `V`
- **THEN** the system switches to Visual Line mode, the entire line containing the anchor is selected, and the mode indicator updates to `-- VISUAL LINE --`

#### Scenario: Switch from Visual Line to Visual
- **WHEN** the user is in Visual Line mode and presses `v`
- **THEN** the system switches to Visual mode, the selection reduces to just the anchor word, and the mode indicator updates to `-- VISUAL --`

### Requirement: Selection uses native browser Selection API
The visual selection SHALL be rendered using `window.getSelection()` and DOM `Range` objects. This ensures visual consistency with mouse-based selections and compatibility with the existing extract/highlight pipeline.

#### Scenario: Selection visible to window.getSelection()
- **WHEN** text is selected in Visual mode
- **THEN** `window.getSelection().toString()` returns the selected text, and the selection can be read by the existing context menu handlers

#### Scenario: Selection works inside EPUB iframe
- **WHEN** text is selected in Visual mode inside an EPUB document
- **THEN** the selection is created using the iframe's `contentWindow.getSelection()` and is readable by the extract handlers that already operate inside the iframe context
