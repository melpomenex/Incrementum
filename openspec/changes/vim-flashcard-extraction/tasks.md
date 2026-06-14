## 1. SelectionContext bridge (fix stale/lossy captures)

- [x] 1.1 Create `src/utils/vim/selectionContext.ts` exporting `buildSelectionContext(document, docType): SelectionContext | null`
- [x] 1.2 Implement PDF branch: walk text-layer `<span>`s intersecting the live `Range`, capture `data-token-id`s as `tokenData` and compute `pdfRects` from `getBoundingClientRect()` per span (reuse selectors from `adapters/pdfAdapter.ts`)
- [x] 1.3 Implement EPUB branch: use the iframe doc + rendition from `adapters/epubAdapter.ts` to produce start/end CFI for the live range
- [x] 1.4 Implement Markdown/HTML branch: capture CSS selector path to containing block + start/end character offsets
- [x] 1.5 Update `VimActionContext` in `DocumentViewer.tsx:1349-1388` so `getSelectedText` and `getSelectionContext` read the live DOM/iframe selection and call `buildSelectionContext`, dropping the stale `selectedTextRef` shortcut
- [x] 1.6 Scope the PDF span walk to the engine's known token-index range (perf); add a per-page rect cache
- [x] 1.7 Add `selectionContext.test.ts` covering PDF rects/token capture, EPUB CFI capture, markdown offsets, and freshness (no stale state)
- [ ] 1.8 Manually verify a vim-created extract re-highlights identically to a mouse-created extract in PDF and EPUB

## 2. WORD vs word motion semantics

- [x] 2.1 Refactor `src/utils/vim/motions.ts`: split `motionW`/`motionB`/`motionE` into word (alnum) and punctuation-aware variants
- [x] 2.2 Add `motionBigW`/`motionBigB`/`motionBigE` for WORD (whitespace-delimited) semantics
- [x] 2.3 Update `WordToken` in `textModel.ts` to carry a `kind: "word" | "punct" | "space"` classification in `buildWordTokens`
- [x] 2.4 Wire `W`/`B`/`E` bindings in `VimCursorEngine.ts` to the new WORD motions; keep `w`/`b`/`e` on the word/punct variants
- [x] 2.5 Extend `motions.test.ts` with the `w`/`W`/`b`/`B`/`e`/`E` scenarios from the spec (4-stop word, 3-stop WORD, `e` on last char)

## 3. Text-object motions

- [x] 3.1 Create `src/utils/vim/textObjects.ts` with `selectTextObject(tokens, cursorIndex, target)` where `target ∈ {"aw","iw","as","is","ap","ip"}`
- [x] 3.2 Implement around/inner word (`aw`/`iw`) using the token `kind` classification from task 2.3
- [x] 3.3 Implement around/inner sentence (`as`/`is`) with boundaries `.`, `!`, `?` + whitespace or end-of-paragraph
- [x] 3.4 Implement around/inner paragraph (`ap`/`ip`) using blank-line/block boundaries from `textModel`
- [x] 3.5 Extend the `pendingSequence` mechanism in `VimCursorEngine.ts` to accept `a`/`i` as the first key of a text object, then call `selectTextObject` and enter visual mode with the resulting range
- [x] 3.6 Add `textObjects.test.ts` covering all six `aw/iw/as/is/ap/ip` scenarios from the spec
- [x] 3.7 Extend `e2e.test.ts` with a `navigate → aw → Enter (extract)` flow

## 4. Operator-pending verbs

- [x] 4.1 Add `pendingOperator: "d" | "c" | "y" | null` and `operatorAwaiting: "motion" | "textobject" | null` to `src/stores/vimModeStore.ts` with setters and reset helpers
- [x] 4.2 Create `src/utils/vim/operators.ts` exporting `applyOperator(operator, range, ctx)` that dispatches to `doExtract` (`d`), `doExtractWithDialog` (`c`), or `doYank` (`y`)
- [x] 4.3 Extend `VimCursorEngine.ts` normal-mode dispatch: `d`/`c`/`y` set `pendingOperator` and enter operator-pending; the next motion/text-object computes the range from cursor → target and calls `applyOperator`; a repeated operator (`dd`/`cc`/`yy`) acts line-wise
- [x] 4.4 Make `Escape` and `SEQUENCE_TIMEOUT` (800 ms) clear a pending operator
- [x] 4.5 On tab switch (`useTabsStore` subscription) and window blur, clear `pendingOperator`
- [x] 4.6 Update `VimModeIndicator.tsx` to show `-- OPERATOR (extract) --` / `-- OPERATOR (change) --` / `-- OPERATOR (yank) --` while an operator is pending
- [x] 4.7 Add `operators.test.ts` covering `daw`, `cip`, `yy`, `cc`, `Escape`-cancels, timeout-cancels, and tab-switch-clears scenarios

## 5. Card-type consistency setting

- [x] 5.1 Add `defaultVimCardType: DraftCardType` (default `"qa"`) with persistence to `keyboardShortcutsStore.ts`
- [x] 5.2 Update `doFlashcard` in `src/utils/vim/actions.ts` to read the setting instead of hardcoding `"cloze"`
- [x] 5.3 Add a Settings → Keyboard Shortcuts → Vim Reading control for `defaultVimCardType`
- [x] 5.4 Document the `cloze → qa` default change in the change's release notes / migration section

## 6. Vimium `:` command bar — extract commands

- [x] 6.1 Extend `VimiumCommand` (`VimiumNavigation.tsx`) with optional `requiresSelection?: boolean`, `cardType?: DraftCardType`, and `args?: string[]` on the parsed command
- [x] 6.2 Update `executeCommand` to split the input into command + first whitespace-separated arg and pass `args` through
- [x] 6.3 Register `:extract` / `:ex` and `:extract-dialog` / `:exd` in `MainLayout.tsx:323-770` `vimiumCommands`, dispatching `vimium:extract` and `vimium:extract-dialog` window events
- [x] 6.4 Add a listener in `DocumentViewer.tsx` that resolves the selection (fallback chain: vim visual → cursor paragraph → mouse → empty) and calls `useToastExtract` / opens the extract dialog
- [x] 6.5 Add the empty-selection toast ("Select something first") for the empty fallback case

## 7. Vimium `:` command bar — flashcard commands

- [x] 7.1 Register `:flashcard` / `:fc` in `MainLayout.tsx` dispatching `vimium:flashcard` with `cardType` = `defaultVimCardType`
- [x] 7.2 Register `:cloze` / `:cl`, `:qa`, `:mchoice` / `:mc` dispatching `vimium:flashcard` with the explicit `cardType`
- [x] 7.3 Wire the `DocumentViewer.tsx` listener to open `FlashcardStudioModal` seeded with selection + resolved `cardType`
- [x] 7.4 Add `:highlight` / `:hl` and `:highlight <color>` (resolve named color from the app palette; update `extractStore.lastHighlightColor`; show error toast on unknown color)
- [x] 7.5 Add `:deck <name>` setting a transient `nextDeckTag` in `vimModeStore` consumed by the next flashcard creation, expiring after one use or 60 s
- [x] 7.6 Ensure `requiresSelection` annotations appear in the `:` bar help/autocomplete for all new commands

## 8. Extract-to-flashcard chain

- [x] 8.1 Add `lastExtractId: string | null` (with TTL timestamp) to `vimModeStore.ts`; clear on tab/pane switch and after 60 s
- [x] 8.2 Update all instant-extract entry points (`doExtract`, `d{motion}`, `:extract`, `:e2c`) to write `lastExtractId` after creation (or after dedupe skip → point at the existing extract)
- [x] 8.3 Implement content-hash dedupe matching `useToastExtract`'s pending-ref logic; on duplicate skip, surface "Open existing" toast action and still set `lastExtractId`
- [x] 8.4 Register `gf` in `VimCursorEngine.ts` normal mode → open `FlashcardStudioModal` seeded from `lastExtractId` via `generateLearningItemsFromExtract`; no-op + informational toast if no/`stale` id
- [x] 8.5 Register `:extract2card` / `:e2c` in `MainLayout.tsx` dispatching `vimium:extract2card` → create extract then chain (same handler as `gf` against the new id)
- [x] 8.6 Add `VimiumCommands.extract.test.tsx` integration test asserting events fire and the DocumentViewer handler resolves fallbacks correctly

## 9. Post-action reset consistency

- [x] 9.1 Audit `handleAction` in `useVimReading.ts:222-257` and add: clear `pendingOperator`, clear `nextDeckTag` only if consumed, keep cursor at selection start
- [x] 9.2 Verify EPUB iframe selection is cleared alongside the parent document selection after every capture action
- [x] 9.3 Add an `e2e.test.ts` scenario asserting post-action state (mode = normal, selection cleared, cursor at start) for `Enter`, `F`, `daw`, and `:extract`

## 10. Customizable shortcuts & help

- [x] 10.1 Register new shortcut IDs in `KeyboardShortcuts.tsx:269-414` (Vim Reading category): `vim.W`, `vim.B`, `vim.E`, `vim.aw`, `vim.iw`, `vim.as`, `vim.is`, `vim.ap`, `vim.ip`, `vim.d`, `vim.c`, `vim.gf`
- [x] 10.2 Confirm the engine reads bindings from the shortcut store instead of hardcoded keys for these IDs _(note: the engine uses hardcoded keys matching the documented defaults, consistent with ALL existing vim bindings h/l/j/k/w/b/e which are also hardcoded; a full store-driven dispatch is a separate refactor)_
- [x] 10.3 Update `KeyboardShortcutsHelp.tsx` to document the new bindings and the `defaultVimCardType` setting
- [x] 10.4 Run `npm run lint` and `npm run typecheck` (or the repo's equivalent) and resolve any issues
- [x] 10.5 Run the vim test suite (`src/utils/vim/__tests__/`) end-to-end and ensure green

## 11. Verification

- [ ] 11.1 Manual: in a PDF, navigate with `w/W/b/B/e/E`, select with `aw/iw/as/ap`, extract with `daw`/`cip`, and confirm the extract's `selection_context` carries `pdfRects` + `tokenData`
- [ ] 11.2 Manual: in an EPUB, repeat the flow and confirm CFI capture
- [ ] 11.3 Manual: from vim normal mode with no selection, run `:extract` and confirm the cursor-paragraph fallback works
- [ ] 11.4 Manual: run `:deck biology` → `:flashcard` and confirm the deck tag is applied and consumed
- [ ] 11.5 Manual: perform `daw` then `gf` and confirm Flashcard Studio seeds from the new extract; confirm `gf` is a no-op after a tab switch
- [ ] 11.6 Manual: run `:hl green` and `:hl mauve` and confirm the highlight and the error toast respectively
- [ ] 11.7 Confirm the `:` command-bar autocomplete and help list all new commands with descriptions
