## ADDED Requirements

### Requirement: All documented keyboard shortcuts work on all platforms
The system SHALL register and handle the following keyboard shortcuts on Linux, macOS, and Windows: Ctrl/Cmd+K (command palette), Ctrl/Cmd+P (command palette alternative), Ctrl/Cmd+, (settings), Ctrl/Cmd+D (dashboard), Ctrl/Cmd+Q (queue), Ctrl/Cmd+R (start review), Ctrl/Cmd+O (open document), Ctrl/Cmd+N (import document), Ctrl/Cmd+/ (show shortcuts help), and ? (show shortcuts help).

#### Scenario: Ctrl+Q navigates to queue on Linux
- **WHEN** user presses Ctrl+Q on Linux
- **THEN** the app navigates to the Queue page

#### Scenario: Cmd+Q navigates to queue on macOS
- **WHEN** user presses Cmd+Q on macOS
- **THEN** the app navigates to the Queue page

#### Scenario: Ctrl+D navigates to dashboard on Linux
- **WHEN** user presses Ctrl+D on Linux
- **THEN** the app navigates to the Dashboard page

#### Scenario: Ctrl+R starts review session
- **WHEN** user presses Ctrl/Cmd+R
- **THEN** the app navigates to the Queue page and dispatches the "start-review-session" event

#### Scenario: Ctrl+O opens document import
- **WHEN** user presses Ctrl/Cmd+O
- **THEN** the app navigates to the Documents page and dispatches the "import-document" event

#### Scenario: Ctrl+N imports document
- **WHEN** user presses Ctrl/Cmd+N
- **THEN** the app navigates to the Documents page and dispatches the "import-document" event

#### Scenario: Shortcuts are suppressed while typing
- **WHEN** user is focused on an INPUT, TEXTAREA, SELECT, or contentEditable element
- **THEN** no global keyboard shortcuts fire

### Requirement: Single authoritative global shortcut handler
The system SHALL have exactly one window-level keydown handler for global navigation shortcuts, registered in App.tsx. No other component SHALL register window-level listeners for the same shortcuts.

#### Scenario: No duplicate handlers for Ctrl+K
- **WHEN** the app is rendered with NewMainLayout
- **THEN** only App.tsx's keydown handler processes Ctrl+K for the command palette (the CommandPalette's own handler acts only on the custom event, not the raw keydown)

#### Scenario: Tabbed layout shortcuts don't conflict
- **WHEN** the app switches to the tabbed MainLayout
- **THEN** global shortcuts still function without duplicate handlers firing

### Requirement: Cross-platform shortcut matching works correctly
The `eventMatchesCombo()` function in `KeyboardShortcuts.tsx` SHALL correctly handle shortcuts defined with `{ctrl: true, meta: true}` as "primary platform modifier" — matching Ctrl on Linux/Windows and Meta/Cmd on macOS.

#### Scenario: Store shortcut matches Ctrl on Linux
- **WHEN** a shortcut is defined with `{ctrl: true, meta: true}` and the user presses Ctrl+key on Linux
- **THEN** `eventMatchesCombo()` returns true

#### Scenario: Store shortcut matches Cmd on macOS
- **WHEN** a shortcut is defined with `{ctrl: true, meta: true}` and the user presses Cmd+key on macOS
- **THEN** `eventMatchesCombo()` returns true

#### Scenario: Store shortcut does not match wrong modifier
- **WHEN** a shortcut is defined with `{ctrl: true, meta: true}` and the user presses only Alt+key (no Ctrl/Cmd)
- **THEN** `eventMatchesCombo()` returns false
