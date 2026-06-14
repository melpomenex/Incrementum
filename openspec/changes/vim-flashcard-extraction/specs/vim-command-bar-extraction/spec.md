## ADDED Requirements

### Requirement: Vimium command bar supports extract commands
The Vimium `:` command bar SHALL accept the commands `:extract` (alias `:ex`) and `:extract-dialog` (alias `:exd`). `:extract` SHALL create an instant extract of the current selection (no dialog), matching the behaviour of the vim `Enter` key. `:extract-dialog` SHALL open the extract edit dialog pre-filled with the current selection, matching the vim `Shift+E` key. Both commands SHALL reuse the existing extract pipeline (`useToastExtract` and the extract dialog).

#### Scenario: `:extract` creates an instant extract
- **WHEN** the user has an active vim visual selection and types `:extract` followed by Enter
- **THEN** an extract is created from the selection, a toast confirmation is shown, and no dialog opens

#### Scenario: `:ex` alias works identically
- **WHEN** the user types `:ex` followed by Enter with an active selection
- **THEN** the result is identical to `:extract`

#### Scenario: `:extract-dialog` opens the editor
- **WHEN** the user types `:extract-dialog` followed by Enter with an active selection
- **THEN** the extract dialog opens with the selected text pre-filled in the content field

### Requirement: Vimium command bar supports flashcard commands with explicit card types
The Vimium `:` command bar SHALL accept the commands `:flashcard` (alias `:fc`), `:cloze` (alias `:cl`), `:qa`, and `:mchoice` (alias `:mc`). `:flashcard` SHALL open Flashcard Studio seeded with the user's configured default card type. `:cloze`, `:qa`, and `:mchoice` SHALL open Flashcard Studio seeded with the explicit `DraftCardType` (`cloze`, `qa`, `multiple-choice` respectively), overriding any default. The seed SHALL include the current selection text and selection context.

#### Scenario: `:flashcard` honours the default card type
- **WHEN** the user's `defaultVimCardType` setting is `qa` and they type `:flashcard` with a selection
- **THEN** Flashcard Studio opens with `draftCardType: "qa"` seeded from the selection

#### Scenario: `:cloze` overrides the default
- **WHEN** the user's `defaultVimCardType` setting is `qa` and they type `:cloze` with a selection
- **THEN** Flashcard Studio opens with `draftCardType: "cloze"` seeded from the selection

#### Scenario: `:mchoice` seeds multiple-choice
- **WHEN** the user types `:mchoice` with a selection
- **THEN** Flashcard Studio opens with `draftCardType: "multiple-choice"` seeded from the selection

### Requirement: Vimium command bar supports an extract-to-flashcard chain command
The Vimium `:` command bar SHALL accept the command `:extract2card` (alias `:e2c`). This command SHALL first create an instant extract of the current selection, then immediately invoke flashcard generation from that extract (via `generateLearningItemsFromExtract`) and open Flashcard Studio seeded from the new extract. The command SHALL surface an error toast if the selection is empty.

#### Scenario: `:e2c` chains extract then flashcard
- **WHEN** the user types `:e2c` with an active selection
- **THEN** an extract is created AND Flashcard Studio opens seeded with that extract, ready to generate cards

#### Scenario: `:e2c` with no selection shows an error
- **WHEN** the user types `:e2c` with no active selection and no cursor paragraph available
- **THEN** no extract is created and a toast reading "Select something first" (or equivalent) is shown

### Requirement: Vimium command bar supports a highlight command
The Vimium `:` command bar SHALL accept the command `:highlight` (alias `:hl`) and `:highlight <color>` where `<color>` is a named color from the app's highlight palette. With no argument, the command SHALL highlight the current selection using the last-used highlight color (from `extractStore.lastHighlightColor`). With an argument, the command SHALL highlight using the named color and SHALL surface an error toast if the color name is unknown.

#### Scenario: `:hl` highlights with the last color
- **WHEN** the user types `:hl` with a selection and the last-used highlight color was yellow
- **THEN** the selection is highlighted in yellow

#### Scenario: `:hl green` highlights in the named color
- **WHEN** the user types `:hl green` with a selection
- **THEN** the selection is highlighted in green and `lastHighlightColor` is updated to green

#### Scenario: Unknown color surfaces an error
- **WHEN** the user types `:hl mauve` with a selection
- **THEN** no highlight is created and a toast indicates `mauve` is not a valid color

### Requirement: Vimium command bar supports a deck-seed command with argument parsing
The Vimium `:` command bar SHALL accept the command `:deck <name>`. This command SHALL set a transient "next deck tag" used as the default deck for the next flashcard created by any vim entry point (`F`, `:flashcard`, `:cloze`, `:qa`, `:mchoice`, `:e2c`). The transient deck tag SHALL be consumed by the next flashcard creation and SHALL expire after one use or after 60 seconds. The command bar SHALL parse whitespace-separated arguments so `<name>` may contain hyphens and underscores.

#### Scenario: `:deck biology` seeds the next card
- **WHEN** the user types `:deck biology` and then types `:flashcard` with a selection
- **THEN** Flashcard Studio opens with the `biology` deck tag pre-applied

#### Scenario: Deck seed is consumed after one use
- **WHEN** the user types `:deck biology`, then `:flashcard`, then `:flashcard` again
- **THEN** the second `:flashcard` does NOT carry the `biology` deck tag

#### Scenario: Deck seed expires after 60 seconds
- **WHEN** the user types `:deck biology` and waits more than 60 seconds before creating a flashcard
- **THEN** the flashcard is NOT tagged with `biology`

### Requirement: Vimium capture commands resolve selection with a documented fallback chain
All extract/flashcard/highlight commands SHALL resolve their target text using this priority: (1) an active vim visual selection if non-empty; (2) the paragraph surrounding the vim cursor if vim normal mode is active; (3) the current native mouse `Selection`; (4) empty, in which case the command SHALL show a "Select something first" toast and perform no action. The resolution logic SHALL be shared across all capture commands.

#### Scenario: Visual selection wins
- **WHEN** the user is in vim visual mode with a non-empty selection and runs `:extract`
- **THEN** the extract is created from the visual selection

#### Scenario: Cursor paragraph fallback
- **WHEN** the user is in vim normal mode (no visual selection) and runs `:extract`
- **THEN** the extract is created from the paragraph containing the cursor

#### Scenario: Mouse selection fallback
- **WHEN** vim mode is inactive but the user has selected text with the mouse and runs `:extract`
- **THEN** the extract is created from the mouse selection

#### Scenario: Empty selection shows a toast
- **WHEN** no selection exists by any path and the user runs `:extract`
- **THEN** no extract is created and a toast prompts the user to select text

### Requirement: Vimium capture commands appear in autocomplete and help
The new commands and their aliases SHALL appear in the `:` command-bar autocomplete as the user types, and SHALL appear in the command-bar help listing with a one-line description. Each command entry SHALL declare whether a selection is recommended (`requiresSelection: true` for capture commands) so the help UI can annotate it.

#### Scenario: Autocomplete suggests `:extract`
- **WHEN** the user opens the `:` bar and types `ext`
- **THEN** the autocomplete dropdown shows `:extract` and `:extract-dialog` with descriptions

#### Scenario: Help lists all new commands
- **WHEN** the user views the `:` command help
- **THEN** `:extract`, `:flashcard`, `:cloze`, `:qa`, `:mchoice`, `:extract2card`, `:highlight`, and `:deck` are all listed
