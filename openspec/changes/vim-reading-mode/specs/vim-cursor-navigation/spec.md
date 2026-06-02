## ADDED Requirements

### Requirement: Vim mode activation and deactivation
The system SHALL provide a toggle to activate and deactivate Vim Reading Mode. When a document is opened, Vim mode starts as `inactive`. The user SHALL activate Normal mode by pressing `Escape` when no modal or dialog is open. The user SHALL deactivate Vim mode (return to `inactive`) by pressing `Escape` while in Normal mode.

#### Scenario: Activate from inactive state
- **WHEN** the user presses `Escape` and no modal or popup is open
- **THEN** the system enters Normal mode, displays a visible caret at the first word of the visible viewport, and shows a mode indicator reading `-- NORMAL --`

#### Scenario: Deactivate from normal mode
- **WHEN** the user presses `Escape` while in Normal mode
- **THEN** the system removes the caret, hides the mode indicator, and returns to `inactive` mode where standard mouse/keyboard behavior applies

#### Scenario: Activation blocked by open modal
- **WHEN** the user presses `Escape` while a modal or popup is open
- **THEN** the system does NOT activate Vim mode and instead allows the modal to handle the Escape key

### Requirement: Mode indicator display
The system SHALL display a persistent mode indicator in the viewer area showing the current mode: `-- NORMAL --`, `-- VISUAL --`, or `-- VISUAL LINE --`. The indicator SHALL be positioned in the bottom-right corner of the viewer and SHALL use a subtle, non-obtrusive style.

#### Scenario: Mode indicator updates on mode change
- **WHEN** the user transitions from Normal mode to Visual mode
- **THEN** the mode indicator updates from `-- NORMAL --` to `-- VISUAL --`

#### Scenario: Mode indicator hidden when inactive
- **WHEN** Vim mode is `inactive`
- **THEN** no mode indicator is displayed

### Requirement: Caret overlay
The system SHALL render a visible caret overlay at the current cursor position. In Normal mode, the caret SHALL be a block cursor (highlighted background) over the current word. In Visual mode, the caret SHALL be an underline cursor to distinguish selection-end from selection-start.

#### Scenario: Caret renders at current word
- **WHEN** the user moves the cursor to word index 42
- **THEN** a highlighted block appears behind word 42's text in the DOM, and the word scrolls into the visible viewport if not already visible

#### Scenario: Caret style changes with mode
- **WHEN** the user transitions from Normal to Visual mode
- **THEN** the caret changes from a block background highlight to an underline style

#### Scenario: Caret removed on deactivation
- **WHEN** the user deactivates Vim mode
- **THEN** the caret overlay element is removed from the DOM

### Requirement: Word-level text model
The system SHALL build a `WordToken[]` array from the document's text content. Each token SHALL contain: the DOM text node reference, character start/end offsets within that node, the text string, and a cached bounding rectangle. The array SHALL represent all words in reading order.

#### Scenario: Text model built on activation
- **WHEN** the user activates Vim mode in a document
- **THEN** the system walks all text nodes via TreeWalker and builds a WordToken array within 200ms for a typical document chapter

#### Scenario: Text model rebuilt on content change
- **WHEN** the EPUB viewer navigates to a new chapter or the Markdown content changes
- **THEN** the text model is rebuilt and the cursor resets to the first word of the visible viewport

### Requirement: Viewer-specific text adapters
The system SHALL implement a `TextDocumentAdapter` interface for each viewer type. Each adapter SHALL provide: `getTextNodes()` returning all navigable text content, `getScrollContainer()` returning the scrollable element, `getDocument()` returning the document object, and `createOverlay(host)` for injecting the caret element.

#### Scenario: EPUB adapter accesses iframe DOM
- **WHEN** the EPUB adapter's `getTextNodes()` is called
- **THEN** it accesses `iframe.contentDocument.body` and returns text nodes from the iframe's DOM, handling cross-document boundaries

#### Scenario: PDF adapter reads text layer spans
- **WHEN** the PDF adapter's `getTextNodes()` is called
- **THEN** it iterates all `<span>` elements within each page's `.textLayer` div, sorting by visual position (top then left)

#### Scenario: Markdown adapter reads main document
- **WHEN** the Markdown adapter's `getTextNodes()` is called
- **THEN** it walks `contentRef.current` using a standard TreeWalker over the main document

### Requirement: Character motion (h, l)
In Normal mode, `h` SHALL move the cursor to the previous character and `l` SHALL move the cursor to the next character. The cursor SHALL not move past document boundaries.

#### Scenario: Move right by character
- **WHEN** the user presses `l` in Normal mode
- **THEN** the cursor advances one character position to the right within the current word token or to the start of the next token

#### Scenario: Move left by character
- **WHEN** the user presses `h` in Normal mode
- **THEN** the cursor moves one character position to the left within the current word token or to the end of the previous token

#### Scenario: Boundary clamping
- **WHEN** the user presses `h` at the first character of the document
- **THEN** the cursor remains at the first character and does not move

### Requirement: Word motion (w, b, e)
In Normal mode, `w` SHALL move to the start of the next word, `b` SHALL move to the start of the previous word, and `e` SHALL move to the end of the current/next word. Word boundaries SHALL be determined by whitespace and punctuation.

#### Scenario: Move to next word
- **WHEN** the user presses `w` in Normal mode
- **THEN** the cursor jumps to the first character of the next word token

#### Scenario: Move to previous word
- **WHEN** the user presses `b` in Normal mode
- **THEN** the cursor jumps to the first character of the previous word token

#### Scenario: Move to end of word
- **WHEN** the user presses `e` in Normal mode
- **THEN** the cursor jumps to the last character of the current word (or the next word if already at the end)

### Requirement: Line motion (j, k)
In Normal mode, `j` SHALL move the cursor to the same horizontal position on the next line, and `k` SHALL move to the same horizontal position on the previous line. Lines SHALL be determined by Y-coordinate grouping of word tokens.

#### Scenario: Move down one line
- **WHEN** the user presses `j` in Normal mode
- **THEN** the cursor moves to the word on the next line closest to the current horizontal position

#### Scenario: Move up one line
- **WHEN** the user presses `k` in Normal mode
- **THEN** the cursor moves to the word on the previous line closest to the current horizontal position

#### Scenario: Maintain horizontal column
- **WHEN** the cursor is at column position 120px and the user presses `j` twice
- **THEN** the cursor lands at the word closest to 120px horizontal on each subsequent line

### Requirement: Line boundary motion (0, $)
In Normal mode, `0` SHALL move the cursor to the first word on the current line, and `$` SHALL move to the last word on the current line.

#### Scenario: Move to line start
- **WHEN** the user presses `0` in Normal mode
- **THEN** the cursor jumps to the first word token on the current line

#### Scenario: Move to line end
- **WHEN** the user presses `$` in Normal mode
- **THEN** the cursor jumps to the last word token on the current line

### Requirement: Document boundary motion (gg, G)
In Normal mode, `gg` SHALL move the cursor to the first word of the document, and `G` SHALL move to the last word of the document. `gg` is a two-key sequence with an 800ms timeout.

#### Scenario: Jump to document start
- **WHEN** the user presses `g` then `g` within 800ms
- **THEN** the cursor moves to the first word token in the document and scrolls to the top

#### Scenario: Jump to document end
- **WHEN** the user presses `G` (shift+g)
- **THEN** the cursor moves to the last word token in the document and scrolls to the bottom

#### Scenario: gg sequence timeout
- **WHEN** the user presses `g` and waits more than 800ms before pressing `g` again
- **THEN** the sequence is discarded and the cursor does not move

### Requirement: Paragraph motion ({, })
In Normal mode, `{` SHALL move to the start of the previous paragraph (empty line or block boundary), and `}` SHALL move to the start of the next paragraph.

#### Scenario: Move to previous paragraph
- **WHEN** the user presses `{` in Normal mode
- **THEN** the cursor jumps to the first word of the previous paragraph (block-level element or empty-line gap)

#### Scenario: Move to next paragraph
- **WHEN** the user presses `}` in Normal mode
- **THEN** the cursor jumps to the first word of the next paragraph

### Requirement: Scroll-to-center on cursor movement
When the cursor moves to a word that is outside the visible viewport, the system SHALL scroll the document to center the cursor vertically in the viewport. Scrolling SHALL use smooth behavior.

#### Scenario: Cursor moves below viewport
- **WHEN** the cursor moves to a word below the visible area
- **THEN** the document scrolls smoothly to center the cursor word in the viewport

#### Scenario: Cursor moves above viewport
- **WHEN** the cursor moves to a word above the visible area
- **THEN** the document scrolls smoothly to center the cursor word in the viewport

### Requirement: Key remapping support
All Vim motion keybindings SHALL be registered with the existing `useShortcutStore` under a new category `"Vim Reading"`. Users SHALL be able to remap any motion key via the Keyboard Shortcuts settings.

#### Scenario: Custom keybinding for word forward
- **WHEN** the user remaps "word forward" from `w` to `Tab` in settings
- **THEN** pressing `Tab` in Normal mode moves to the next word, and `w` no longer triggers word motion

### Requirement: Cross-viewer consistency
The cursor navigation motions SHALL behave identically across EPUB, PDF, Markdown, and HTML viewers, differing only in the adapter implementation for DOM access.

#### Scenario: Same motions in EPUB and Markdown
- **WHEN** the user presses `w w w` in Normal mode in both an EPUB and a Markdown document
- **THEN** the cursor advances by exactly 3 words in both viewers with identical visual behavior
