## Why

The existing Vimium `:` command bar supports navigation and tab commands, but lacks window/file operations that power users expect from a Vim-like interface. The app already has a rich split pane system (`tabsStore.splitPane`, `spawnTabInSplit`) and tab management (`addTab`, `closeTab`, `moveTabToPane`), but these can only be accessed via mouse — a power user workflow gap.

## What Changes

- **Split pane commands**: `:sp[lit]` (horizontal split), `:vsp[lit]` (vertical split), `:on[ly]` (close other panes)
- **Tab management commands**: `:tabnew` (new tab), `:tabc[lose]`, `:tabo[nly]` (close other tabs), `:tabm[ove]` (reorder)
- **File/document commands**: `:e[dit] <query>` (open document by search), `:bd[elete]` (close current tab/viewer)
- **Navigation commands**: `:cd <section>` or `:j[ump] <section>` (jump to app section), `:hist[ory]` (show recently viewed documents)
- **Session commands**: `:qa[ll]` (close all tabs), `:wqa[ll]` (save state and close)
- **Find enhancements**: Support `:s/old/new/` style find-and-replace in documents (stretch goal, noted but not primary)

## Capabilities

### New Capabilities
- `vimium-split-commands`: Colon commands for split pane management (`:sp`, `:vsp`, `:only`)
- `vimium-tab-commands`: Colon commands for advanced tab operations (`:tabnew`, `:tabclose`, `:tabonly`, `:tabmove`)
- `vimium-file-commands`: Colon commands for opening and managing documents (`:edit`, `:bdelete`)
- `vimium-navigation-commands`: Colon commands for jumping between app sections and recent items
- `vimium-session-commands`: Colon commands for session-level operations (`:qall`, `:wqall`)

### Modified Capabilities
<!-- No existing spec-level requirement changes — this extends the VimiumCommand registry, not modifying existing spec behavior -->

## Impact

- **`src/components/layout/MainLayout.tsx`**: New VimiumCommand registrations (lines ~147-299)
- **`src/stores/tabsStore.ts`**: No store changes needed — existing `splitPane`, `spawnTabInSplit`, `closeOtherTabs`, etc. already provide all required operations
- **`src/components/common/VimiumNavigation.tsx`**: Possible minor updates to command bar autocomplete for abbreviated commands
- **`src/components/common/VimiumCommandBar.tsx`**: May need fuzzy matching for abbreviated commands (e.g., `:sp` matching `:split`)
- **No new dependencies required** — all functionality maps to existing store actions
