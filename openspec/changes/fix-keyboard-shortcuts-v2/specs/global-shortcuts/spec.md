## MODIFIED Requirements

### Requirement: All documented keyboard shortcuts work on all platforms

The system SHALL register and handle the following keyboard shortcuts on Linux, macOS, and Windows. Shortcut combos SHALL be read from the customizable shortcut store and dispatched through the consolidated App.tsx handler. The system SHALL use `eventMatchesCombo()` as the single matching function for all store-defined shortcuts.

#### Scenario: Store-defined shortcuts dispatch through consolidated handler

- **WHEN** user presses any shortcut key combo defined in the customizable shortcut store
- **THEN** App.tsx's single consolidated keydown handler matches it via `eventMatchesCombo()` and dispatches the corresponding action

#### Scenario: Ctrl+Q navigates to queue on Linux

- **WHEN** user presses Ctrl+Q on Linux (or user-customized Queue shortcut)
- **THEN** the app navigates to the Queue page

#### Scenario: Cmd+Q navigates to queue on macOS

- **WHEN** user presses Cmd+Q on macOS (or user-customized Queue shortcut)
- **THEN** the app navigates to the Queue page

#### Scenario: Ctrl+D navigates to dashboard on Linux

- **WHEN** user presses Ctrl+D on Linux (or user-customized Dashboard shortcut)
- **THEN** the app navigates to the Dashboard page

#### Scenario: Ctrl+R starts review session

- **WHEN** user presses Ctrl/Cmd+R (or user-customized Review shortcut)
- **THEN** the app navigates to the Queue page and dispatches the "start-review-session" event

#### Scenario: Ctrl+O opens document import

- **WHEN** user presses Ctrl/Cmd+O (or user-customized Import shortcut)
- **THEN** the app navigates to the Documents page and dispatches the "import-document" event

#### Scenario: Ctrl+N imports document

- **WHEN** user presses Ctrl/Cmd+N (or user-customized New Document shortcut)
- **THEN** the app navigates to the Documents page and dispatches the "import-document" event

#### Scenario: Shortcuts are suppressed while typing

- **WHEN** user is focused on an INPUT, TEXTAREA, SELECT, or contentEditable element
- **THEN** no global keyboard shortcuts fire

### Requirement: Store-backed global shortcut handler with palette fallback

The system SHALL use the App.tsx store-backed keydown handler as the authoritative dispatch path for customizable global navigation shortcuts. The system MAY also register a narrow capture-phase command-palette fallback for the documented default `Ctrl/Cmd+K` and `Ctrl/Cmd+P` shortcuts to preserve reliability when webview or native menu layers intercept later keydown handling.

#### Scenario: Default command palette bridge opens palette early

- **WHEN** the app is rendered with NewMainLayout
- **AND** the user presses the default command palette shortcut
- **THEN** App.tsx's capture-phase command-palette bridge dispatches the shared `command-palette-open` event

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

### Requirement: macOS Meta+K opens command palette

The system SHALL ensure Meta+K (Cmd+K) reliably opens the command palette on macOS through at least one of the delivery paths (native global shortcut, menu accelerator, or JS keydown handler).

#### Scenario: Cmd+K opens command palette on macOS

- **WHEN** user presses Cmd+K on macOS from the app shell
- **THEN** the command palette opens

#### Scenario: Cmd+K opens palette from document viewer on macOS

- **WHEN** user presses Cmd+K on macOS while a document viewer is focused
- **THEN** the command palette opens

## REMOVED Requirements

### Requirement: Single authoritative global shortcut handler (original)

**Reason**: Replaced by updated requirement above that specifies the handler reads from the customizable shortcut store and allows the documented command-palette capture fallback.
**Migration**: The handler still exists in App.tsx but now iterates over store shortcuts instead of using hardcoded key checks; default palette combos retain a narrow early bridge for platform reliability.
