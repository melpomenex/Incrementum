## ADDED Requirements

### Requirement: Help overlay reads shortcuts from store

The `KeyboardShortcutsHelp` component SHALL read its shortcut list from `useShortcutStore.getState().shortcuts` instead of using the hardcoded `getShortcutGroups()` function.

#### Scenario: Help shows customized shortcuts
- **WHEN** user has rebound `edit.new-flashcard` from `Ctrl+Shift+F` to `Ctrl+Alt+F` in Settings
- **THEN** opening the Keyboard Shortcuts Help overlay displays `Ctrl+Alt+F` (or platform-appropriate format) next to "New Flashcard"

#### Scenario: Help shows default shortcuts when unmodified
- **WHEN** no shortcuts have been customized by the user
- **THEN** opening the Keyboard Shortcuts Help overlay displays the same bindings as the `DEFAULT_SHORTCUTS` array

### Requirement: Help overlay grouping matches Settings categories

The help overlay SHALL group shortcuts using the same `ShortcutCategory` enum values used in Settings (`Navigation`, `Editing`, `View`, `Review`, `Documents`, `Flashcards`, `General`).

#### Scenario: Consistent category grouping
- **WHEN** user opens the Keyboard Shortcuts Help overlay
- **THEN** shortcuts are grouped under the same category labels shown in Settings > Keyboard Shortcuts

### Requirement: Dynamic shortcut formatting

Shortcuts displayed in the help overlay SHALL be formatted using the existing `formatCombo()` or equivalent function from `KeyboardShortcuts.tsx` that converts a `KeyCombo` object to a platform-appropriate string (e.g., `⌘⇧F` on macOS, `Ctrl+Shift+F` on Windows/Linux).

#### Scenario: Platform-appropriate display
- **WHEN** user opens the help overlay on macOS
- **THEN** shortcuts display using `⌘`, `⇧`, `⌥`, `⌃` symbols
- **WHEN** user opens the help overlay on Windows or Linux
- **THEN** shortcuts display using `Ctrl`, `Shift`, `Alt`, `Meta` text
