## ADDED Requirements

### Requirement: Vim flashcard entry points share a configurable default card type
All vim-originated flashcard entry points — the vim `F` key, the `:flashcard` command, and the `gf` chain action — SHALL seed Flashcard Studio with the user's configured `defaultVimCardType` setting. The default value of `defaultVimCardType` SHALL be `qa`. The setting SHALL be user-configurable under Settings → Keyboard Shortcuts → Vim Reading and SHALL persist across sessions. Explicit card-type commands (`:cloze`, `:qa`, `:mchoice`) SHALL override the default.

#### Scenario: Vim `F` uses the configured default
- **WHEN** the user has `defaultVimCardType` set to `qa` and presses `F` over a vim selection
- **THEN** Flashcard Studio opens with `draftCardType: "qa"`

#### Scenario: User changes the default to cloze
- **WHEN** the user sets `defaultVimCardType` to `cloze` and presses `F` over a vim selection
- **THEN** Flashcard Studio opens with `draftCardType: "cloze"`

#### Scenario: Explicit command overrides the default
- **WHEN** the user has `defaultVimCardType` set to `qa` and runs `:cloze` over a selection
- **THEN** Flashcard Studio opens with `draftCardType: "cloze"`, ignoring the configured default

### Requirement: Vim provides a one-keystroke extract-to-flashcard chain
After an instant extract created by any vim entry point (vim `Enter`, `d{motion}`, `:extract`, `:e2c`), the engine SHALL record the new extract's id as `lastExtractId` in `vimModeStore`. The user SHALL be able to press `gf` in normal mode to open Flashcard Studio seeded from `lastExtractId` via `generateLearningItemsFromExtract`, mirroring the mouse flow's "Edit → generate cards" path. `lastExtractId` SHALL be cleared on tab/pane switch and after 60 seconds to prevent stale chains.

#### Scenario: `gf` chains from the most recent extract
- **WHEN** the user performs `daw` (instant extract) and then presses `gf`
- **THEN** Flashcard Studio opens seeded from the extract created by `daw`, with card generation running against that extract

#### Scenario: `lastExtractId` clears on tab switch
- **WHEN** the user performs an extract, switches to another document tab, switches back, and presses `gf`
- **THEN** Flashcard Studio does NOT open seeded from the previous extract (the chain is broken); `gf` is a no-op or shows an informational toast

#### Scenario: `lastExtractId` expires after 60 seconds
- **WHEN** the user performs an extract and waits more than 60 seconds before pressing `gf`
- **THEN** `gf` does NOT chain from the stale extract

#### Scenario: `gf` with no prior extract is a no-op
- **WHEN** the user presses `gf` in normal mode without any prior extract in the current tab session
- **THEN** no action is taken and an informational toast may indicate there is nothing to chain from

### Requirement: Vim chain action reuses the existing flashcard-generation pipeline
The `gf` chain action and the `:extract2card` command SHALL invoke the same `generateLearningItemsFromExtract` pipeline used by the mouse flow (`useToastExtract`). The created cards SHALL follow the same scheduling, deck routing, and AI generation rules as cards created from mouse-driven extracts. No new card-creation code path SHALL be introduced.

#### Scenario: Cards from `gf` are scheduled identically to mouse-flow cards
- **WHEN** the user chains via `gf` and a card is generated
- **THEN** the card's `state`, `due_date`, `ease_factor`, and `interval` are computed by the same algorithm and initial values as a card generated from a mouse-driven extract with identical content

#### Scenario: Card-type overrides apply to the chain
- **WHEN** the user has run `:deck biology` and then chains via `gf`
- **THEN** the generated card is seeded with the `biology` deck tag

### Requirement: Vim-extracted content dedupes against existing extracts
When a vim instant extract would create content identical (by trimmed-text hash) to an existing extract in the same document, the system SHALL skip creation, surface the existing extract as a toast action ("Open existing"), and SHALL still update `lastExtractId` to point at the existing extract so the `gf` chain works. This SHALL match the dedupe behaviour of the mouse flow's `useToastExtract` pending-ref logic.

#### Scenario: Duplicate extract is skipped
- **WHEN** the user selects text identical to an existing extract in the same document and runs `:extract`
- **THEN** no new extract is created, a toast offers to open the existing extract, and `lastExtractId` points at the existing extract

#### Scenario: `gf` chains from the deduped existing extract
- **WHEN** the user triggers a dedupe skip and then presses `gf`
- **THEN** Flashcard Studio seeds from the existing extract that was surfaced

### Requirement: Vim capture actions reset visual state consistently
After any vim capture action (extract, extract-dialog, flashcard, chain, highlight), the engine SHALL clear the visual selection in both the parent document and any EPUB iframe, SHALL exit visual/visual-line mode back to normal mode, SHALL clear any pending operator, and SHALL keep the cursor at the start of the former selection. This SHALL match the post-action reset already performed by the existing single-key actions.

#### Scenario: Visual mode exits after an extract
- **WHEN** the user is in visual mode and triggers an extract via `Enter`
- **THEN** after the extract is created the engine is in normal mode, the selection is cleared, and the cursor remains at the selection start

#### Scenario: Pending operator clears after action
- **WHEN** the user completes `daw` (operator + text object) and the extract is created
- **THEN** the pending operator is cleared and the engine is in normal mode
