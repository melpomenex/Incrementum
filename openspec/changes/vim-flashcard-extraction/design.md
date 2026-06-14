## Context

The app already has a working Vim reading mode (custom-built; not CodeMirror/Monaco) and a separate Vimium-style `:` command bar. They were deliberately kept separate by the `vim-reading-mode` design:

- **`VimCursorEngine`** (`src/utils/vim/VimCursorEngine.ts`) owns document-text navigation and a small set of single-key actions (`Enter` extract, `Shift+E` extract-dialog, `y` yank, `Shift+H` highlight, `Shift+F` flashcard). Modes: `inactive → normal → visual → visual-line`. Multi-key sequences today are limited to `gg` (800 ms timeout, `SEQUENCE_TIMEOUT`).
- **`VimiumNavigation`** (`src/components/common/VimiumNavigation.tsx`) owns app-level navigation via the `:` bar (33 commands today — none for extracts/flashcards).
- Selection is performed via the DOM `Range`/`Selection` API in `selectionManager.ts`, then read back inside `DocumentViewer.tsx:1349-1388` through a `VimActionContext`.

Three confirmed gaps motivate this design:

1. **Selection context is lossy.** `VimActionContext.getSelectedText` (`DocumentViewer.tsx:1360`) reads `selectedTextRef.current` first (React state, stale) and never rebuilds a full `SelectionContext` (PDF `pdfRects`/`tokenData`, EPUB CFI). So vim-triggered captures lose precise re-highlighting data.
2. **Motions are too coarse for fast selection.** `motionW`/`motionB`/`motionE` move one token at a time and conflate word/punctuation; there are no text objects (`aw`/`iw`/`as`/`ap`) and no operator-pending verbs (`d`/`c`/`y` + motion) — the canonical vim way to select-and-act in one stroke.
3. **The `:` bar has no capture commands.** Power users who live in the `:` bar must drop to the mouse to extract or make a card.

Stakeholders: keyboard-first readers (the audience the vim mode exists for). All changes are TypeScript/React; no backend schema changes; existing extract/flashcard pipelines are reused.

## Goals / Non-Goals

**Goals:**
- Make vim selection capture a **complete** `SelectionContext` indistinguishable from mouse capture (same PDF rects, EPUB CFI, page number).
- Bring real vim text-selection ergonomics to the reader: WORD vs word, text objects, operator-pending verbs.
- Make the `:` command bar a first-class way to create extracts and flashcards, with sensible selection fallbacks so it works even without an active visual selection.
- Make card-type seeding consistent across all four entry points (vim `F`, context menu, global shortcut, `:` commands) and configurable.
- Provide a one-keystroke "extract → flashcard" chain matching the dominant mouse workflow.

**Non-Goals:**
- Ex-mode (`:s/old/new/`, ranges, `:%s`).
- Cross-chapter EPUB `gg`/`G` (separate proposal).
- Replacing the PDF text-layer selection engine with a fully geometric one (only the vim → `SelectionContext` bridge is in scope).
- Insert/edit mode — the vim layer stays a reading layer by design.
- Adding CodeMirror/Monaco/vim.js. The custom engine is kept.

## Decisions

### D1. Extend the multi-key sequence mechanism rather than introducing a new parser
The engine already supports `gg` via `pendingSequence` + `SEQUENCE_TIMEOUT` (800 ms). We extend the **same** mechanism for text objects (`aw`, `iw`, `as`, `is`, `ap`, `ip`) rather than importing a full vim grammar parser (e.g. monaco-vim / vim.js).

**Why:** The reading-mode keyset is tiny (<40 bindings). A parser is over-engineered and would conflict with the existing capture-phase listener in `useVimReading.ts`. The sequence buffer already handles cancellation (`Escape`) and timeout correctly.

**Alternatives considered:** (a) pull in `vim.js`/CodeMirror vim mode — rejected: no editor lib in `package.json`, +300 KB, and conflicts with the DOM-overlay model. (b) a hand-written state machine per operator — rejected: duplicates `pendingSequence` logic.

### D2. Operator-pending state lives in `vimModeStore` as `pendingOperator`
Add `pendingOperator: "d" | "c" | "y" | null` and `operatorAwaiting: "motion" | "textobject" | null` to `vimModeStore`. When the user presses `d`/`c`/`y` in normal mode, the engine records the operator and enters an "operator-pending" sub-state; the next motion or text object runs against the range from cursor to motion target, then the operator acts on that range. Visual-mode actions (`Enter`/`y`/`F`/`Shift+H`) keep working unchanged.

**Why:** Keeping state in Zustand (not just engine-local) lets `VimModeIndicator` show `-- OPERATOR (d) --`, lets `useVimReading` reset it on mode exit/blur, and lets the `:` commands inspect it.

**Mapping:**
- `d` + motion → extract the range **instantly** (no dialog) and leave the cursor at the range start. "Delete" here means "remove from attention", not edit the document; we **do not** mutate document text. Rationale: matches the user's mental model of "yank this out into a note".
- `c` + motion → extract the range **with dialog** (change = opens editor).
- `y` + motion → yank the range to clipboard (alias of existing visual `y`).

**Alternatives considered:** (a) make `d` actually delete text — rejected: documents are read-only in this app. (b) skip operator-pending and only do text objects — rejected: `daw`/`cip` is the highest-value vim idiom and requires operators.

### D3. `SelectionContext` is rebuilt inside the action context, not in the engine
Add `buildSelectionContext(document, docType): SelectionContext | null` to a new `src/utils/vim/selectionContext.ts`. The engine's `selectionManager` already sets a DOM `Range` over the token array; the new helper reads that range and constructs the right `SelectionContext` variant:

- **PDF**: walk text-layer `<span>`s intersecting the range (same selector `pdfAdapter.ts` already uses), capture their `data-token-id`s as `tokenData` and compute `pdfRects` from `getBoundingClientRect()` per span — exactly what the mouse path produces via `pdfTextSelection.ts`.
- **EPUB**: ask `epubjs` (via the existing rendition in `EPUBViewer.tsx`) for the CFI at range start/end.
- **Markdown/HTML**: record `{ startOffset, endOffset, selectorPath }`.

`VimActionContext.getSelectedText` and `getSelectionContext` are then changed to call this helper on the **live** `window.getSelection()` (or iframe selection for EPUB), dropping the stale `selectedTextRef` shortcut.

**Why:** The PDF/EPUB paths already exist for the mouse; reusing them guarantees vim captures are bit-equivalent for re-highlighting. Centralising in one helper means future selection sources (OCR regions, etc.) get it for free.

**Alternatives considered:** (a) make the engine emit structured selection events — rejected: would force every adapter to learn a new protocol. (b) keep `selectedTextRef` but update it from a `Selection` mutation observer — rejected: racy and still doesn't carry PDF rects.

### D4. `:` commands are registered in `MainLayout.tsx` next to the existing 33, not in a new registry
The existing `vimiumCommands` array (`MainLayout.tsx:323-770`) is the single source of truth the `:` bar reads. We add ~10 entries with aliases (`:extract`/`:ex`, `:flashcard`/`:fc`, `:cloze`/`:cl`, `:qa`, `:mchoice`/`:mc`, `:extract-dialog`/`:exd`, `:extract2card`/`:e2c`, `:highlight`/`:hl`, `:deck`). Each command dispatches a custom `window` event (`vimium:extract`, `vimium:flashcard`, …) carrying `{ cardType?, deckTag?, fallbackTarget }`.

`DocumentViewer` adds a single listener that resolves the active selection with this priority:

1. Vim visual selection (if `vimModeStore.mode` is visual and a non-empty range exists).
2. Cursor paragraph (if vim normal mode active) — expand to the surrounding paragraph via `textModel`'s paragraph grouping.
3. Current mouse `window.getSelection()` (existing behavior).
4. Empty → toast "Select something first".

**Why:** Reuses the proven event-dispatch pattern (`extract-text-shortcut` already uses a global `extract-text` event). Keeps command *declaration* in `MainLayout` (where the 33 live) and *handling* in `DocumentViewer` (where the selection lives). The `VimiumCommand` type gains an optional `requiresSelection?: boolean` and `cardType?: DraftCardType` descriptor purely so the autocomplete/help can render hints — no behavioural change to the bar itself.

**Alternatives considered:** (a) a new `vimCommandRegistry.ts` — rejected: fragments ownership, forces a refactor of the 33 existing commands. (b) calling `useToastExtract` directly from `MainLayout` — rejected: `MainLayout` doesn't know which document is active in the focused pane.

### D5. Card-type consistency via a single setting + explicit overrides
Add `defaultVimCardType: DraftCardType` (default `"qa"`) to the existing keyboard-shortcuts settings store (`keyboardShortcutsStore.ts`) — it already persists per-user customization. All four entry points read it:

- Vim `F` and `:flashcard` → `defaultVimCardType` (was hardcoded `"cloze"` — **BREAKING** at the keystroke level but trivially restorable via settings).
- `:cloze`/`:qa`/`:mchoice` → explicit override (ignore default).
- Mouse context menu and global `edit.new-flashcard` → unchanged (`"qa"`), but the proposal allows them to honour the same default in a follow-up.

**Why:** One source of truth; users who want `cloze` set it once. Explicit `:` overrides cover power users.

### D6. Chain action stores `lastExtractId` in `vimModeStore`
After any instant extract (vim `Enter`, `d{motion}`, `:extract`, `:extract2card`), the action handler writes `lastExtractId` to `vimModeStore`. Then `gf` (normal mode) or `:e2c` calls `generateLearningItemsFromExtract(lastExtractId)` and opens `FlashcardStudioModal` seeded from the new extract — the exact pipeline `useToastExtract.ts:56` uses for the mouse flow's "Edit" action.

**Why:** Mirrors the existing mouse flow 1:1, so AI generation, deck routing, and review scheduling are identical. `lastExtractId` clears on tab switch or after 60 s (configurable) to avoid stale chains.

### D7. Test strategy
Extend `src/utils/vim/__tests__/`:
- `motions.test.ts` — WORD vs word, punctuation skipping.
- New `textObjects.test.ts` — `aw/iw/as/is/ap/ip` ranges.
- New `operators.test.ts` — `dw`, `cip`, `daw`, `yy`, cancellation, timeout.
- New `selectionContext.test.ts` — PDF rect/token capture, EPUB CFI capture, markdown offset capture.
- Extend `e2e.test.ts` — full "navigate → select → extract → gf → flashcard" flow.
- `:` commands are integration-tested via a new `VimiumCommands.extract.test.tsx` that asserts the events fire and the DocumentViewer handler resolves fallbacks correctly.

## Risks / Trade-offs

- **[Operator-pending ambiguity with existing `dd`/`yy`]** → In real vim, `dd`/`yy` are line-wise. We honour that: a repeated operator key (`dd`, `yy`, `cc`) acts on the current visual line. Documented in the help overlay.
- **[PDF rect capture perf]** Walking all intersecting text-layer spans on every `d{motion}` could be slow on dense pages. → Mitigation: scope the walk to the engine's known token-index range (already tracked) rather than the full document; cache per page.
- **[EPUB iframe selection]** EPUB renders in an iframe; the `SelectionContext` CFI extraction must run inside the iframe's document. → Mitigation: `epubAdapter.ts` already exposes an `iframeDoc` handle; the new helper uses it. Test with reflowed + fixed-layout EPUBs.
- **[`:deck <name>` argument parsing]** The current `:` bar matches command names but doesn't parse arguments. → Mitigation: extend `executeCommand` to split the first whitespace-separated token as the command and pass the remainder as `args`. Minimal change; documented in `VimiumCommand` type.
- **[Operator `d` is not "delete"]** Calling extract "delete" may confuse users expecting text removal. → Mitigation: indicator shows `-- OPERATOR (extract) --` rather than `(d)`; help text explicitly says "extract (vim calls this `d` for the operator grammar)".
- **[Card-type BREAKING]** Vim `F` default changes from `cloze` to `qa`. → Mitigation: settings toggle; release notes call this out; default aligns with the rest of the app.
- **[Stale `lastExtractId`]** A user extracts, switches tabs, comes back, hits `gf` and chains off the wrong extract. → Mitigation: clear on tab/pane change and after a 60 s TTL.

## Migration Plan

No data migration. Behaviour is additive. The only user-visible breaking change is the vim `F` default card type (`cloze` → `qa`), which is restorable via Settings → Keyboard Shortcuts → Vim Reading → `defaultVimCardType`. Rollback = revert the change; no persistent state to migrate.

**Rollout order** (each step independently shippable):
1. Selection-context fix (D3) — immediate bug fix, no UX change.
2. Motion upgrades (WORD/word) + text objects (D1) — additive.
3. Operator-pending (D2) + chain action (D6).
4. `:` commands (D4) + card-type setting (D5).

## Open Questions

- Should `d` over a range that already has an extract dedupe (skip creation) or re-extract? Proposal: dedupe via content hash (matching `useToastExtract`'s pending-ref logic), configurable.
- Should `:extract2card` auto-dismiss the Flashcard Studio if generation yields zero cards, or stay open for manual editing? Proposal: stay open (current mouse behaviour).
- Do we want `:marks` to also remember recent extract locations for `gb`-style jump-back? Defer to a follow-up.
