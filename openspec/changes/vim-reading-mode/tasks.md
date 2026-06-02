## 1. Core Text Model & Adapter Infrastructure

- [x] 1.1 Create `src/utils/vim/textModel.ts` — `WordToken` type, `buildWordTokens(adapter)` function that walks text nodes via TreeWalker and returns flat `WordToken[]` with cached bounding rects
- [x] 1.2 Create `src/utils/vim/lineGrouper.ts` — group `WordToken[]` into lines by Y-coordinate proximity (threshold: 4px), compute line-level horizontal positions for `j`/`k` column tracking
- [x] 1.3 Create `src/utils/vim/adapters/types.ts` — `TextDocumentAdapter` interface: `getTextNodes()`, `getScrollContainer()`, `getDocument()`, `createOverlay(host)`, `dispose()`
- [x] 1.4 Create `src/utils/vim/adapters/markdownAdapter.ts` — implementation for MarkdownViewer: walks `contentRef.current` DOM
- [x] 1.5 Create `src/utils/vim/adapters/htmlAdapter.ts` — implementation for HTML iframe viewer: accesses `iframe.contentDocument.body`
- [x] 1.6 Create `src/utils/vim/adapters/epubAdapter.ts` — implementation for EPUBViewer: accesses epubjs iframe DOM via `contents.document`, handles chapter change events
- [x] 1.7 Create `src/utils/vim/adapters/pdfAdapter.ts` — implementation for PDFViewer: reads `<span>` elements from each page's `.textLayer`, sorts by visual position, handles multi-page token concatenation
- [x] 1.8 Write unit tests for `buildWordTokens()` with mock DOM (jsdom), verifying word boundaries, offset calculation, and bounding rect caching
- [x] 1.9 Write unit tests for `lineGrouper` verifying Y-threshold grouping and column-position matching

## 2. Cursor Engine & Motion System

- [x] 2.1 Create `src/stores/vimModeStore.ts` — Zustand store with state: `mode` (inactive/normal/visual/visual-line), `cursorIndex`, `selectionAnchor`, `activeDocId`, `desiredColumn` (for j/k column tracking), actions: `activate()`, `deactivate()`, `setMode()`, `moveCursor()`, `resetOnContentChange()`
- [x] 2.2 Create `src/utils/vim/motions.ts` — pure functions for each motion: `motionH`, `motionL`, `motionW`, `motionB`, `motionE`, `motionJ`, `motionK`, `motion0`, `motionDollar`, `motionGG`, `motionG`, `motionOpenBrace`, `motionCloseBrace`. Each takes `(tokens, lines, cursorIndex, desiredColumn)` and returns new `{ cursorIndex, desiredColumn }`
- [x] 2.3 Create `src/utils/vim/VimCursorEngine.ts` — orchestrator class: holds adapter reference, word tokens, line groups; processes key events via `handleKeyDown(e)`; delegates to motion functions; updates store; triggers caret re-render and scroll-to-center
- [x] 2.4 Write unit tests for all 12 motion functions with synthetic token/line fixtures covering boundary conditions (first word, last word, empty lines, single-word lines)
- [x] 2.5 Write integration test for `VimCursorEngine` verifying mode transitions (inactive→normal→visual→normal→inactive) and motion dispatch

## 3. Caret Overlay & Mode Indicator UI

- [x] 3.1 Create `src/utils/vim/caretOverlay.ts` — functions to create, update position, change style (block vs underline), and remove the `<span class="vim-cursor">` element from the document DOM, handling cross-iframe injection for EPUB
- [x] 3.2 Create `src/components/viewer/VimModeIndicator.tsx` — React component that reads `useVimModeStore` and renders the mode indicator (`-- NORMAL --`, `-- VISUAL --`, `-- VISUAL LINE --`) in the bottom-right of the viewer area
- [x] 3.3 Add caret overlay CSS styles to `src/index.css` — `.vim-cursor` (block highlight for Normal), `.vim-cursor-visual` (underline for Visual), with appropriate z-index and pointer-events:none
- [x] 3.4 Write tests verifying caret overlay creation/removal and style transitions between Normal and Visual modes

## 4. Visual Mode & Selection

- [x] 4.1 Create `src/utils/vim/selectionManager.ts` — functions to create/extend/clear browser Selection using DOM Range; `setSelection(doc, anchorIndex, cursorIndex, tokens)` creates a Range spanning from anchor token's start to cursor token's end; handles forward and backward (anchor > cursor) selection
- [x] 4.2 Add Visual mode entry/exit to `VimCursorEngine.handleKeyDown`: `v` → visual, `V` → visual-line, `Escape` → back to normal, mode switching between visual/visual-line
- [x] 4.3 Implement Visual Line mode selection: when in visual-line mode, select all tokens on all lines between anchor line and cursor line
- [x] 4.4 Ensure all motions in motion functions work in both Visual and Visual Line modes — the engine calls `selectionManager.setSelection()` after every motion when mode is visual/visual-line
- [x] 4.5 Write integration tests for Visual mode: enter visual, move by word/line, verify selection text matches expected range, exit visual and verify selection cleared
- [x] 4.6 Write integration tests for Visual Line mode: enter visual-line, extend with j/k, verify full lines selected

## 5. Selection Actions

- [x] 5.1 Create `src/utils/vim/actions.ts` — action handlers: `doExtract(selection, context)`, `doExtractWithDialog(selection, context)`, `doYank(selection)`, `doHighlight(selection, color)`, `doFlashcard(selection)`. Each creates a synthetic selection event/context that maps to the existing DocumentViewer context menu handlers
- [x] 5.2 Wire `Enter` → `doExtract` (instant), `E` → `doExtractWithDialog`, `y` → `doYank` (uses Tauri clipboard for EPUB iframe context), `H` → `doHighlight`, `F` → `doFlashcard` in `VimCursorEngine.handleKeyDown`
- [x] 5.3 After action execution: clear selection, return to Normal mode, show toast confirmation
- [x] 5.4 Write tests for action dispatch verifying correct handler invocation for each action key
- [x] 5.5 Write e2e test: activate vim mode → navigate to word → enter visual → select 3 words → press Enter → verify extract created in store

## 6. Integration with Existing Viewer Components

- [x] 6.1 Create `src/hooks/useVimReading.ts` — React hook that: creates adapter for current viewer type, instantiates `VimCursorEngine`, registers capture-phase keydown listener (and iframe listener for EPUB), handles activation/deactivation, cleans up on unmount
- [x] 6.2 Integrate `useVimReading` into `DocumentViewer.tsx` — call hook when docType is epub/pdf/markdown/html, pass viewer-specific refs; pass `VimModeIndicator` render location
- [x] 6.3 Modify EPUBViewer keydown forwarding to check vim mode state — when vim mode is active, suppress existing j/k scroll and h/l chapter-nav handlers so the cursor engine handles them
- [x] 6.4 Modify PDFViewer keydown handler similarly — suppress j/k scroll when vim mode is active
- [x] 6.5 Handle EPUB chapter changes — listen to epubjs `rendition.on("locationChanged")` to rebuild text model and reset cursor
- [x] 6.6 Handle PDF page changes — watch scroll position for significant page changes, rebuild text model for newly visible pages
- [x] 6.7 Handle MutationObserver for Markdown/HTML — rebuild text model when content changes (e.g., search highlight injection)

## 7. Shortcut Store Integration & Settings

- [x] 7.1 Add "Vim Reading" category to `useShortcutStore` with default bindings: Escape (toggle), v (visual), V (visual-line), h/l/w/b/e/j/k/0/$/G/gg/{/} (motions), Enter/E/y/H/F (actions)
- [x] 7.2 Register these shortcuts via `useKeyboardShortcuts` hook so they appear in the Keyboard Shortcuts settings panel and are remappable
- [x] 7.3 Update `KeyboardShortcutsSettings.tsx` to display the new "Vim Reading" category with description of each binding
- [x] 7.4 Write test verifying shortcut registration and that remapped keys are respected by the cursor engine

## 8. Accessibility & Polish

- [x] 8.1 Add ARIA attributes to caret overlay: `role="cursor"`, `aria-label="reading position"`, and announce mode changes via an `aria-live="polite"` region near the mode indicator
- [x] 8.2 Add visual feedback for actions: brief flash animation on yank, subtle border animation on highlight, toast on extract
- [x] 8.3 Add key sequence indicator for pending multi-key sequences (e.g., show `g...` in mode bar after first `g`, before `g` or timeout)
- [x] 8.4 Write accessibility test verifying ARIA announcements on mode transitions

## 9. End-to-End Testing

- [x] 9.1 E2E test: activate vim mode in EPUB → navigate with w/b/j/k → enter visual → select text → extract → verify extract saved
- [x] 9.2 E2E test: activate vim mode in Markdown → use 0/$/{/}/gg/G → enter visual-line → highlight → verify highlight rendered
- [x] 9.3 E2E test: activate vim mode in PDF → navigate across pages → enter visual → yank → verify clipboard content
- [x] 9.4 E2E test: verify vim mode does not activate when modal is open (Escape closes modal instead)
- [x] 9.5 E2E test: remap a vim keybinding in settings → verify new binding works and old binding does not
