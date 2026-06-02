## Context

Incrementum renders text documents through four viewer types: EPUB (epubjs in an iframe), PDF (pdfjs with transparent text layer spans), Markdown (rendered HTML in a div), and HTML (iframe with srcdoc). Each viewer has its own keyboard handling — the EPUB and PDF viewers already support `j/k` for scrolling and `h/l` for chapter navigation, and a separate VimiumNavigation component provides link-hinting and scroll-based navigation across the app.

None of these systems operate at the **text level** — there is no concept of a cursor position within the document's words. The existing `WordHighlighter` utility already has the core building block: it walks text nodes via `TreeWalker`, maps character offsets to DOM ranges, wraps text in spans, and handles cross-iframe scroll-into-view. This design builds a cursor navigation system on top of that foundation.

## Goals / Non-Goals

**Goals:**
- Provide Vim-like modal editing for reading across EPUB, PDF, Markdown, and HTML viewers
- Implement Normal mode (cursor navigation), Visual mode (text selection), and Visual Line mode
- Support the core Vim motions: `h/l` (char), `w/b/e` (word), `j/k` (line), `0/$` (line start/end), `gg/G` (doc start/end), `{/}` (paragraph)
- Allow extracting, highlighting, and copying text from Visual mode without touching the mouse
- Make the mode state visible (caret overlay + mode indicator bar)
- Integrate with the existing `useShortcutStore` for remappable bindings
- Reuse the existing `WordHighlighter` text-node traversal and the iframe event forwarding pattern from EPUBViewer

**Non-Goals:**
- No Insert mode — this is a reading tool, not a text editor
- No `:command` mode (already exists in VimiumNavigation)
- No `f/F` link hinting (already in VimiumNavigation)
- No `/` search (already in VimiumNavigation and viewer-level search)
- No support for YouTube, video, or audio viewers (non-text)
- No persistent cursor position across sessions
- No multi-window/multi-cursor support

## Decisions

### Decision 1: Abstract text model via adapter pattern

**Choice:** Create a `TextDocumentAdapter` interface with per-viewer implementations (`EpubTextAdapter`, `PdfTextAdapter`, `MarkdownTextAdapter`, `HtmlTextAdapter`). Each adapter provides: `getTextNodes()`, `getScrollContainer()`, `getDocument()`, `createOverlay()`.

**Why over alternatives:**
- Alternative A: Single monolithic cursor engine with `if (docType)` branches → unmaintainable as viewer logic diverges
- Alternative B: Inject cursor logic into each viewer component directly → duplicated motion/selection logic across 4 viewers
- The adapter pattern lets the cursor engine (`VimCursorEngine`) be viewer-agnostic while each adapter handles DOM quirks (iframe access for EPUB, per-page spans for PDF, direct DOM for Markdown)

### Decision 2: Text model as flat word array built from TreeWalker

**Choice:** On activation, build a `WordToken[]` array by walking all text nodes via `TreeWalker(NodeFilter.SHOW_TEXT)`. Each token stores `{ node, startOffset, endOffset, text, boundingRect }`. The cursor is an index into this array.

**Why:**
- Enables O(1) motion computations (move forward N words = jump N indices)
- Bounding rects are cached once, avoiding repeated `getBoundingClientRect()` calls during rapid navigation
- The `WordHighlighter.findTextRanges()` already implements this pattern — we extend it to build a full document model
- For PDF, the "text nodes" are the absolutely-positioned `<span>` elements in the text layer — we treat each span's text content as tokens

**Revalidation:** Tokens are rebuilt on chapter change (EPUB), page change (PDF), or content mutation (Markdown). A `MutationObserver` watches the content container for structural changes.

### Decision 3: Cursor overlay rendered as a positioned `<span>` element

**Choice:** Inject a `<span class="vim-cursor">` element into the document at the current word's DOM position. Style it with a block background or underline depending on mode.

**Why over alternatives:**
- Alternative A: Canvas overlay → doesn't handle text reflow, expensive to synchronize
- Alternative B: CSS `::caret` pseudo-element → not controllable via JS, doesn't work in iframes
- Alternative C: Absolutely-positioned div calculated from `getBoundingClientRect()` → breaks on scroll due to stale coordinates, requires constant recalculation
- A DOM-injected span moves with the text naturally, handles reflow, and works identically in all viewers (including inside EPUB iframes)

### Decision 4: Mode state managed by a new Zustand store `useVimModeStore`

**Choice:** Create `stores/vimModeStore.ts` with state: `{ mode: "inactive" | "normal" | "visual" | "visual-line", cursorIndex: number, selectionAnchor: number, activeDocId: string | null }`.

**Why:**
- The existing `useShortcutStore` manages keybindings but not stateful modes
- A Zustand store allows any component to read mode state (for the mode indicator, for disabling default handlers, etc.)
- Decouples the cursor engine from the React component tree — the engine operates on the store directly
- `mode: "inactive"` means the vim system is off (user hasn't pressed the activation key)

### Decision 5: Activation via dedicated key (default: `Escape` or `i` to toggle)

**Choice:** The vim reading mode is **opt-in per document session**. Press `Escape` when no modal/dialog is open to activate Normal mode. Press `Escape` again in Normal mode to deactivate (return to regular mouse-based reading). `i` can also toggle.

**Why:**
- Not all users want vim keys while reading — activation must be deliberate
- `Escape` is the natural "enter normal mode" key in Vim
- Double-`Escape` to exit is intuitive for vim users
- The system checks for open modals/popups before activating to avoid conflicts

### Decision 6: Key handling via capture-phase listener with priority check

**Choice:** When vim mode is active (`mode !== "inactive"`), a capture-phase `keydown` listener intercepts keys before any viewer-specific handlers. Motions are processed by the engine. Unrecognized keys fall through to the default handlers.

**Why:**
- The EPUB viewer already uses capture-phase listeners inside the iframe (line 708)
- Capture phase ensures vim motions take priority over existing `j/k` scroll handlers
- Unrecognized keys (like `Ctrl+C` for copy) pass through naturally

### Decision 7: Visual selection rendered via DOM Range and `Selection` API

**Choice:** In Visual/Visual Line mode, use `window.getSelection()` + `Range` to highlight selected text. The selection spans from `selectionAnchor` to `cursorIndex` in the word array.

**Why:**
- The browser's native selection rendering is visually consistent with mouse-based selection
- The existing extract/highlight system reads from `window.getSelection()` — so actions on visual-selected text reuse all existing extract, highlight, and copy infrastructure without modification
- No custom selection overlay needed

### Decision 8: Actions dispatched through existing viewer context menu pipeline

**Choice:** When the user presses `Enter`/`E` (extract), `y` (yank), or `H` (highlight) in Visual mode, the system creates a synthetic selection from the selected range, then calls the same handlers that the right-click context menu uses.

**Why:**
- The existing `DocumentViewer` context menu already handles extract creation, highlighting (with color picker), copying, and flashcard creation for all document types
- Reusing this pipeline means no new backend API calls, no new Tauri commands — just a different trigger (keyboard vs right-click)

## Risks / Trade-offs

- **PDF text layer accuracy** → PDF text spans are absolutely-positioned and may not correspond to visual reading order (columns, sidebars). Mitigation: sort spans by `(top, left)` during tokenization and group into lines by Y-proximity threshold.

- **EPUB chapter boundaries** → The word array is per-chapter; `G`/`gg` and long-range motions stop at chapter edges. Mitigation: show a mode-line hint when at chapter boundary; consider chapter-crossing motions as a future enhancement.

- **Performance on large chapters** → Walking all text nodes and computing bounding rects for a 100K-word chapter could be slow. Mitigation: lazy tokenization — only build tokens for the visible viewport + buffer zone, expand as the cursor moves. Initial target viewport can be built in <50ms for typical chapters.

- **Conflict with existing keyboard shortcuts** → When vim mode is active, `j/k/h/l` are consumed by the cursor engine and don't trigger scroll/chapter-nav. Mitigation: vim mode is opt-in (must be activated), and the mode indicator makes it clear when vim keys are active. Users can deactivate with `Escape`.

- **Iframe focus issues** → EPUB content lives in an iframe; key events inside the iframe may not reach the parent. Mitigation: follow the existing EPUBViewer pattern — forward iframe keydown events to the parent handler via `contents.window.addEventListener("keydown", handler, true)`.

- **Screen reader / accessibility** → The caret overlay needs ARIA attributes to be accessible. Mitigation: add `role="cursor"`, `aria-label="reading position"`, and announce mode changes via `aria-live` region.
