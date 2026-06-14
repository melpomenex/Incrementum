## Why

The app ships a custom Vim reading mode (`src/utils/vim/`) and a Vimium-style `:` command bar (`src/components/common/VimiumNavigation.tsx`), but the two are disconnected from the app's core value loop: capturing passages and turning them into flashcards. Today, vim users can move a cursor and trigger an extract/flashcard via single keys (`Enter`, `Shift+F`), but selection is fragile (stale `selectedTextRef`, no PDF rect/token context, simplistic `w/b/e`), there are no text-object motions (`aw`/`iw`/`as`/`ap`) or operator-pending verbs (`d`/`c`/`y` + motion), and the 33-command `:` bar has **zero** commands for creating extracts or cards. Power users who came for keyboard-driven reading are forced back to the mouse for the most important action in the app. This change closes that gap and makes vim the fastest path from "reading" to "learned".

## What Changes

### Fixes to vim text selection & navigation
- Fix stale-selection bug in the vim action context (`DocumentViewer.tsx:1360`) so vim-triggered extracts carry the correct `SelectionContext` (page number, PDF rects/tokenData, EPUB CFI) instead of stale/empty state.
- Make vim selection populate PDF `pdfRects` + `tokenData` (currently only native DOM `Range`), so vim-selected PDF text re-highlights with the same precision as mouse selection.
- Upgrade `motionW`/`motionB`/`motionE` (`src/utils/vim/motions.ts`) to distinguish WORD vs word and skip punctuation, matching real vim semantics.
- Add text-object motions: `aw`/`iw` (around/inner word), `as`/`is` (sentence), `ap`/`ip` (paragraph) for one-keystroke selection without entering visual mode.
- Add operator-pending mode: `d` (extract-and-delete-from-view), `c` (extract-and-open-dialog), `y` (yank-to-clipboard alias of existing `y`) followed by a motion or text object.

### New `:` command-bar actions for extraction & flashcards
- Add extract commands: `:extract` / `:ex` (instant extract of current selection), `:extract-dialog` / `:exd` (extract with edit dialog).
- Add flashcard commands: `:flashcard` / `:fc` (opens Flashcard Studio seeded with selection), `:cloze` / `:cl`, `:qa` (seed with explicit card type — fixing the current `cloze` vs `qa` inconsistency), `:mchoice` / `:mc` (multiple-choice).
- Add workflow commands: `:extract2card` / `:e2c` (extract the selection then immediately generate flashcards from the new extract), `:deck <name>` (seed the next card with a target deck tag), `:highlight [<color>]` / `:hl`.
- All `:` commands operate on the current vim visual selection if active, else on the paragraph at the cursor, else on the reader's mouse selection (graceful fallback).

### Integrated extract → flashcard workflow
- Unify the card-type seed so vim `F`, context menu, `:` commands, and the global shortcut all default consistently (configurable, default `qa`).
- Add a "chain" action: after an instant extract via vim, a follow-up key (`gf` — "go to flashcard") opens Flashcard Studio seeded from the just-created extract, mirroring the mouse flow's `generateLearningItemsFromExtract`.

## Capabilities

### New Capabilities
- `vim-text-operations`: Improved vim motions, text-object selections (`aw`/`iw`/`as`/`is`/`ap`/`ip`), operator-pending verbs (`d`/`c`/`y` + motion), WORD vs word semantics, and correct `SelectionContext` propagation (PDF rects/tokenData, EPUB CFI) for vim-triggered captures.
- `vim-command-bar-extraction`: New extract/flashcard/highlight commands in the Vimium `:` command bar (`:extract`, `:flashcard`, `:cloze`, `:qa`, `:extract2card`, `:deck`, `:highlight`) with sensible selection fallbacks.
- `vim-extract-flashcard-workflow`: The integrated capture-to-card flow — consistent card-type seeding across all entry points and an extract→flashcard chain action.

### Modified Capabilities
<!-- No existing specs in openspec/specs/ cover vim, extraction, or flashcards. These are all net-new capabilities. -->

## Impact

**Affected code**
- `src/utils/vim/` — `VimCursorEngine.ts` (operator-pending state machine, multi-key sequence extension), `motions.ts` (WORD/word, text objects), `textModel.ts` (sentence/paragraph token classification), `selectionManager.ts` (PDF rect/token capture), `actions.ts` (consistent card-type seed, chain action). New files: `textObjects.ts`, `operators.ts`.
- `src/components/viewer/DocumentViewer.tsx:1349-1388` — `VimActionContext` fix to read live selection + build full `SelectionContext` (PDF/EPUB/markdown).
- `src/components/layout/MainLayout.tsx:323-770` — register ~10 new `vimiumCommands` entries with aliases and selection-aware handlers.
- `src/components/common/VimiumNavigation.tsx` — extend `VimiumCommand` to carry an optional `requiresSelection`/`cardType`/`fallbackTarget` descriptor; command-bar autocomplete surfaces new commands.
- `src/hooks/useVimReading.ts` — wire operator-pending + text-object dispatch; reset operator state on mode exit.
- `src/stores/vimModeStore.ts` — add `pendingOperator`, `lastExtractId` (for the chain action).
- `src/components/common/KeyboardShortcuts.tsx:269-414` — register new shortcut IDs for text objects and operator-pending keys (customizable, Vim Reading category).

**Data / APIs**
- No schema changes to `Extract` or `LearningItem`. The `:` commands reuse existing `create_extract` / `FlashcardStudioModal` seed / `generateLearningItemsFromExtract` pipelines.

**Tests**
- Extend `src/utils/vim/__tests__/` with text-object, operator-pending, WORD-motion, and selection-context tests. Add `:` command tests for the new extract/flashcard commands.

**Dependencies**
- None added. Pure TypeScript + existing React/Zustand/Tauri stack.

**Non-goals**
- Full Ex-mode (`:s/old/new/`, `:%s`, ranges) — out of scope.
- Cross-chapter EPUB `G`/`gg` — tracked separately in `vim-reading-mode`.
- Rewriting PDF selection to use the custom geometric engine end-to-end — only the vim → `SelectionContext` bridge is in scope.
