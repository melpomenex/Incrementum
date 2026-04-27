## ADDED Requirements

### Requirement: Every shortcut ID has a handler entry

The `SHORTCUT_ACTION_HANDLERS` map in `App.tsx` SHALL contain a handler function for every `id` in `DEFAULT_SHORTCUTS` (30 shortcuts across 7 categories).

#### Scenario: All defined shortcuts have handlers
- **WHEN** the application loads
- **THEN** for each shortcut in `useShortcutStore.getState().shortcuts`, `SHORTCUT_ACTION_HANDLERS[shortcut.id]` SHALL be a function (not undefined)

### Requirement: New Flashcard shortcut opens the flashcard studio

Pressing `Ctrl+Shift+F` (or the user-customized binding for `edit.new-flashcard`) SHALL open the Flashcard Studio modal.

#### Scenario: New Flashcard shortcut fired from review context
- **WHEN** user presses `Ctrl+Shift+F` while a review or document view is active
- **THEN** the Flashcard Studio modal opens (same as clicking the "New Flashcard" button)

#### Scenario: New Flashcard shortcut ignored in text inputs
- **WHEN** user presses `Ctrl+Shift+F` while focused on an INPUT, TEXTAREA, or contentEditable element
- **THEN** the shortcut SHALL NOT trigger (let the browser handle it)

### Requirement: Sidebar toggle shortcut works

Pressing `Ctrl+B` (or the user-customized binding for `view.sidebar`) SHALL toggle the sidebar visibility.

#### Scenario: Sidebar toggle
- **WHEN** user presses `Ctrl+B`
- **THEN** the sidebar visibility toggles (shown -> hidden, or hidden -> shown)

### Requirement: Screenshot shortcut works

Pressing `Ctrl+Shift+S` (or the user-customized binding for `gen.screenshot`) SHALL trigger a screenshot capture.

#### Scenario: Screenshot capture
- **WHEN** user presses `Ctrl+Shift+S`
- **THEN** the screenshot selection UI activates

### Requirement: Review skip shortcut works

Pressing `S` (or the user-customized binding for `review.skip`) during an active review session SHALL skip the current card.

#### Scenario: Skip card during review
- **WHEN** user presses `S` during an active review session and no text input is focused
- **THEN** the current card is skipped and the next card is shown

#### Scenario: Skip shortcut ignored in text inputs
- **WHEN** user presses `S` while focused on an INPUT, TEXTAREA, or contentEditable element
- **THEN** the `S` character SHALL be typed normally (shortcut not triggered)

### Requirement: Document tab navigation shortcuts work

Pressing `Ctrl+]` (or the user-customized binding for `doc.next`) SHALL navigate to the next open document tab. Pressing `Ctrl+[` (or the user-customized binding for `doc.prev`) SHALL navigate to the previous open document tab.

#### Scenario: Next document tab
- **WHEN** user presses `Ctrl+]` while documents are open
- **THEN** the active document tab advances to the next document

#### Scenario: Previous document tab
- **WHEN** user presses `Ctrl+[` while documents are open
- **THEN** the active document tab moves to the previous document

### Requirement: Document search respects customizable binding

The DocumentViewer's search trigger SHALL use the binding from `useShortcutStore` for `doc.search`, rather than a hardcoded `Ctrl+F`.

#### Scenario: Customizable doc search binding
- **WHEN** user has rebound `doc.search` to `Ctrl+/` in Settings
- **THEN** pressing `Ctrl+/` in the DocumentViewer triggers document search, and `Ctrl+F` triggers browser-native find (or nothing if intercepted by the store)

#### Scenario: Default doc search binding still works
- **WHEN** user has NOT customized `doc.search` (default `Ctrl+F`)
- **THEN** pressing `Ctrl+F` in the DocumentViewer triggers document search (preventing browser-native find via `e.preventDefault()`)

### Requirement: Navigation shortcuts dispatch events

Pressing `Alt+ArrowRight` (`nav.forward`), `Alt+ArrowLeft` (`nav.back`), or `Alt+ArrowUp` (`nav.up`) SHALL dispatch a `CustomEvent("navigate", { detail: { direction } })` that active views can listen for.

#### Scenario: Forward navigation shortcut
- **WHEN** user presses `Alt+ArrowRight`
- **THEN** a `CustomEvent("navigate", { detail: "forward" })` fires

#### Scenario: Back navigation shortcut
- **WHEN** user presses `Alt+ArrowLeft`
- **THEN** a `CustomEvent("navigate", { detail: "back" })` fires

### Requirement: New extract shortcut dispatches event

Pressing `Ctrl+E` with Meta (macOS Cmd) SHALL dispatch `CustomEvent("new-extract")`.

#### Scenario: New extract shortcut
- **WHEN** user presses `Ctrl+E` with Meta/Cmd
- **THEN** a `CustomEvent("new-extract")` fires

### Requirement: Edit save shortcut dispatches event

Pressing `Ctrl+S` (or the user-customized binding for `edit.save`) SHALL dispatch `CustomEvent("save-current")`.

#### Scenario: Save shortcut
- **WHEN** user presses `Ctrl+S`
- **THEN** a `CustomEvent("save-current")` fires, unless the browser handles Ctrl+S natively as page-save
