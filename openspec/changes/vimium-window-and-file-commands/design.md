## Context

Incrementum has an existing Vimium navigation system with a `:` command bar, a recursive split pane architecture (`tabsStore`), and a comprehensive tab management API. Currently only 12 colon commands are registered (navigation + basic tab ops), while the underlying pane/tab system supports ~20 operations including splits, moves, resizes, and batch closes.

The VimiumCommandBar already supports autocomplete from a registered `VimiumCommand[]` array with aliases — this is the extension point. No store changes or new UI components are needed.

## Goals / Non-Goals

**Goals:**
- Expose existing split pane and tab operations as Vim-style colon commands
- Support command abbreviation (e.g., `:sp` → `:split`, `:tabc` → `:tabclose`) for Vim-familiar workflows
- Provide quick document/file access from the command bar
- Enable session-level operations for power users

**Non-Goals:**
- Modifying the VimiumNavigation keybinding system (normal mode keys) — this is colon commands only
- Building new UI components — all operations map to existing store actions
- Find-and-replace (`:s/old/new/`) — deferred to a future change
- Custom keybinding for each new command — commands are accessible via `:` only initially
- Exposing every tabsStore action — only the most useful/power-user-relevant ones

## Decisions

### 1. Abbreviation via aliases
Each command registers short aliases (e.g., `sp`, `spl`, `split` all map to the same command). This is already supported by the `VimiumCommand.aliases` field — zero code changes to the matching logic.

**Alternative considered**: Prefix-based fuzzy matching in the command bar (match `:sp` to `:split`). Rejected because aliases are simpler, explicit, and already work with the existing autocomplete system.

### 2. Document search via CommandCenter integration
`:edit <query>` reuses the existing `CommandCenter`'s document search rather than building a new search path. The action will dispatch the `command-palette-open` event with the query pre-filled, allowing the existing fuzzy search to handle document matching.

**Alternative considered**: Direct file path matching like Vim's `:e`. Rejected because Incrementum uses database IDs, not file paths — users search by title/content, not navigate filesystem paths.

### 3. Split commands spawn the current tab type
`:sp` and `:vsp` duplicate the current tab's content into the new pane (same as Vim's split behavior). This uses `tabsStore.getState().spawnTabInSplit()` which already supports this pattern.

### 4. No new stores or hooks
All operations are thin wrappers over existing `tabsStore` and `uiStore` actions. New commands are ~5-line action functions registered in `MainLayout.tsx`.

### 5. Commands with optional arguments
- `:split [tab-type]` — splits and optionally opens a specific tab type (e.g., `:split documents`)
- `:tabmove [N]` — moves tab to position N (like Vim's `:tabm`)
- `:edit <query>` — requires a search query

## Risks / Trade-offs

- **Command discovery**: Users may not know these commands exist. Mitigation: update the `?` help overlay to list new commands grouped by category.
- **Argument parsing complexity**: Some commands take optional positional args. Mitigation: keep it simple — single optional arg, no flags or complex parsing.
- **Tab type names are internal**: Users need to know valid tab type names for `:split <type>`. Mitigation: support common aliases (e.g., `docs` → `documents`, `dash` → `dashboard`) and show error message listing valid types on invalid input.
