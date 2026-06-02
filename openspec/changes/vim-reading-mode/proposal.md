## Why

Readers currently rely on mouse-based text selection to highlight and extract text from documents (EPUB, PDF, Markdown, HTML). This is slow, imprecise, and breaks the flow of keyboard-driven reading. The app already has J/K scroll and basic Vimium navigation, but lacks a true modal editing experience for text — the killer feature that makes Vim powerful. A Vim-like visual mode for reading would let users navigate word-by-word, line-by-line, select text with motion commands, and extract/highlight without ever touching a mouse.

## What Changes

- Add a **Vim-like modal reading layer** over all text document viewers (EPUB, PDF, Markdown, HTML)
- Implement **Normal mode** (default) with cursor navigation: `h/l` word-level, `j/k` line-level, `w/b` word-forward/back, `0/$` line-start/end, `gg/G` document-start/end, `{/}` paragraph jump
- Implement **Visual mode** (press `v` from Normal) for text selection using all the same motions — movements extend the selection
- Implement **Visual Line mode** (press `V` from Normal) for full-line selection
- Provide **action on selection**: `Enter`/`E` to extract selected text, `y` to yank (copy), `H` to highlight with current color
- Add a visible **caret/cursor** overlay showing current position in the text
- Add a **mode indicator** in the viewer (similar to Vim's `-- VISUAL --` status bar)
- Make the system **extensible** via the existing keyboard shortcut customization system

## Capabilities

### New Capabilities
- `vim-cursor-navigation`: Word/line/paragraph/document-level cursor movement in Normal mode across all text viewers
- `vim-visual-selection`: Visual and Visual Line modes for selecting text using Vim motions
- `vim-selection-actions`: Extract, yank, and highlight actions on visually selected text

### Modified Capabilities
<!-- No existing capabilities require requirement changes -->

## Impact

- **EPUBViewer**: Must intercept iframe key events before epubjs; cursor overlay rendered inside iframe DOM
- **PDFViewer**: Cursor navigation over PDF text layer; coordinates mapped via pdfjs TextLayerBuilder
- **MarkdownViewer / HTML viewer**: Cursor navigation over rendered innerHTML
- **DocumentViewer**: Mode indicator UI; coordinates action dispatch (extract, highlight, copy)
- **KeyboardShortcuts system**: New category "Vim Reading" with customizable bindings
- **Existing J/K handlers in EPUBViewer**: Superseded by the new modal system (j/k become cursor motions instead of scroll)
- **Testing**: New unit tests for motion logic, integration tests for mode transitions, e2e tests for extract flow
