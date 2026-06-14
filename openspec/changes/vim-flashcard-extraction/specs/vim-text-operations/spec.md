## ADDED Requirements

### Requirement: Vim word motions distinguish WORD, word, and punctuation
The vim cursor engine SHALL provide `w`, `b`, `e` motions that match real vim semantics: `w`/`b`/`e` operate on "words" (alphanumeric sequences), and the uppercase variants operate on "WORDs" (whitespace-delimited runs). Punctuation runs SHALL be treated as distinct stops, not collapsed into adjacent words. The engine SHALL also expose `W`/`B`/`E` bindings mapped to the WORD variants.

#### Scenario: `w` stops on each word and each punctuation run
- **WHEN** the cursor is at the start of `"foo, bar baz"` in normal mode and the user presses `w`
- **THEN** the cursor visits `foo` → `,` → `bar` → `baz` in successive presses (4 stops, not 3)

#### Scenario: `W` skips punctuation runs
- **WHEN** the cursor is at the start of `"foo, bar baz"` in normal mode and the user presses `W`
- **THEN** the cursor visits `foo,` → `bar` → `baz` in successive presses (3 stops)

#### Scenario: `e` lands on the last character of each word
- **WHEN** the cursor is at the start of `"foo bar"` and the user presses `e`
- **THEN** the cursor lands on the `o` of `foo`, then the `r` of `bar`

### Requirement: Vim text-object motions select without entering visual mode
The engine SHALL support the text-object keystrokes `aw`, `iw`, `as`, `is`, `ap`, `ip`. Pressing one SHALL immediately set a visual selection over the corresponding range (around-word, inner-word, around-sentence, inner-sentence, around-paragraph, inner-paragraph) and leave the engine in visual mode. Sentence boundaries SHALL be `.`, `!`, `?` followed by whitespace or end-of-paragraph. Paragraph boundaries SHALL be blank lines (block-level elements with no text in `textModel`).

#### Scenario: `aw` selects a word including surrounding whitespace
- **WHEN** the cursor is on the word `bar` in `"foo bar baz"` and the user types `aw`
- **THEN** the selection covers `" bar "` (with one trailing space) and the engine is in visual mode

#### Scenario: `iw` selects only the inner word
- **WHEN** the cursor is on the word `bar` in `"foo bar baz"` and the user types `iw`
- **THEN** the selection covers exactly `"bar"` and the engine is in visual mode

#### Scenario: `as` selects a sentence including trailing whitespace
- **WHEN** the cursor is in the first sentence of `"Hello world. Second sentence."` and the user types `as`
- **THEN** the selection covers `"Hello world. "`

#### Scenario: `ap` selects a paragraph including the trailing blank line
- **WHEN** the cursor is inside the first of two newline-separated paragraphs and the user types `ap`
- **THEN** the selection covers the entire first paragraph plus the separating blank line

### Requirement: Vim operator-pending verbs combine with motions and text objects
The engine SHALL support operator-pending verbs `d`, `c`, `y` in normal mode. After pressing an operator key, the engine SHALL enter an operator-pending state and wait for either a motion, a text object, or a repeated operator key (line-wise). `d{motion}` SHALL perform an instant extract over the resulting range, `c{motion}` SHALL open the extract dialog over the range, and `y{motion}` SHALL copy the range to the clipboard. A repeated operator (`dd`, `cc`, `yy`) SHALL act on the current visual line. `Escape` SHALL cancel a pending operator and return to normal mode.

#### Scenario: `daw` extracts the around-word range instantly
- **WHEN** the cursor is on `bar` in `"foo bar baz"` and the user types `daw`
- **THEN** an extract is created whose content is `" bar "`, the extract dialog is NOT opened, and the cursor is left at the start of the former `bar` position

#### Scenario: `cip` opens the extract dialog for the inner paragraph
- **WHEN** the cursor is inside a paragraph and the user types `cip`
- **THEN** the extract dialog opens pre-filled with the paragraph text

#### Scenario: `yy` copies the current line
- **WHEN** the cursor is on a line and the user types `yy`
- **THEN** the line's text is on the clipboard and no extract is created

#### Scenario: `Escape` cancels a pending operator
- **WHEN** the user has pressed `d` (operator pending) and then presses `Escape`
- **THEN** the engine returns to normal mode, no motion is awaited, and no action fires

### Requirement: Operator-pending state is visible and reset-safe
The `VimModeIndicator` SHALL display a distinct indicator while an operator is pending (e.g. `-- OPERATOR (extract) --`). The pending operator SHALL be stored in `vimModeStore` (not engine-local) so that mode exits, tab switches, and window blur all clear it. A pending operator SHALL auto-clear after the existing `SEQUENCE_TIMEOUT` (800 ms) if no motion follows.

#### Scenario: Indicator reflects pending operator
- **WHEN** the user presses `d` in normal mode
- **THEN** the indicator shows the operator-pending label until either a motion is completed or the operator is cancelled

#### Scenario: Tab switch clears a pending operator
- **WHEN** the user presses `d` and then switches to another document tab without completing the operator
- **THEN** returning to the original tab shows `-- NORMAL --` with no pending operator

### Requirement: Vim selection captures a complete SelectionContext
When a vim action creates an extract, the system SHALL build a `SelectionContext` equivalent to what the mouse path produces for the same range. For PDF documents the context SHALL include `pdfRects` and `tokenData` (token IDs of intersecting text-layer spans). For EPUB documents the context SHALL include the `cfi` at the range start and end. For Markdown/HTML documents the context SHALL include the selector path and character offsets. The system SHALL read the live DOM/iframe selection at action time rather than a stale React state mirror.

#### Scenario: PDF vim extract carries rects and token IDs
- **WHEN** the user selects a range with vim motions in a PDF and triggers an extract
- **THEN** the created extract's `selection_context.pages[*].pdfRects` and `selection_context.pages[*].tokenData` are non-empty and match the spans covered by the selection

#### Scenario: EPUB vim extract carries a CFI range
- **WHEN** the user selects a range with vim motions in an EPUB and triggers an extract
- **THEN** the created extract's `selection_context` contains a start CFI and end CFI that resolve to the selected text

#### Scenario: Markdown vim extract carries offsets
- **WHEN** the user selects a range with vim motions in a Markdown document and triggers an extract
- **THEN** the created extract's `selection_context` contains the start/end character offsets and the CSS selector path to the containing block

#### Scenario: Selection context is fresh, not stale
- **WHEN** the user changes the vim selection after a previous extract and triggers another extract
- **THEN** the new extract's content and context reflect the current selection, not the previous one

### Requirement: Vim motion and selection behavior is customizable and documented
All new vim bindings (WORD/word motions, text objects, operator-pending verbs) SHALL be registered in the Keyboard Shortcuts system under the existing "Vim Reading" category, SHALL be user-customizable, and SHALL appear in the keyboard-shortcuts help overlay. Defaults SHALL match canonical vim (e.g. `w`, `W`, `b`, `B`, `e`, `E`, `aw`, `iw`, `as`, `is`, `ap`, `ip`, `d`, `c`, `y`).

#### Scenario: User remaps a text object
- **WHEN** the user opens Settings → Keyboard Shortcuts → Vim Reading and remaps `aw` to a different key
- **THEN** the new key invokes around-word selection and the default `aw` no longer does

#### Scenario: Help overlay lists the new bindings
- **WHEN** the user opens the keyboard-shortcuts help
- **THEN** text objects, operator-pending verbs, and WORD motions are listed with their current bindings
