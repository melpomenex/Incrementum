## Context

The command palette (`CommandCenter` → `GlobalSearch`) already has action handlers on results, but there are two competing navigation systems that cause unreliable behavior:

1. **Page-based** (`setCurrentPage`): Used by sidebar clicks and default commands from `CommandPalette.tsx` that dispatch `window.dispatchEvent(new CustomEvent('navigate', ...))`. App.tsx listens and calls `setCurrentPage()`.
2. **Tab-based** (`addTab`): Used by inline commands in `CommandCenter.tsx` (dashboard, documents, queue, analytics, settings, review) which call `addTab()` from `tabsStore`.

The `handleResultClick` in CommandCenter handles Command results by calling `metadata.action()`, and Document/Extract results by calling `openDocumentInTab()`. This is correct in structure, but the `navigate` CustomEvent path (used by default commands like `go-image-registry`) may silently fail if the event fires after the palette closes and React state has already been cleaned up, or if `setCurrentPage` doesn't produce a visible change in the tab-based layout.

Additionally, several inline navigation commands (nav-dashboard, nav-documents, etc.) are excluded from `allCommands` in the search matching phase (CommandCenter.tsx:569-580), meaning they never appear as command results. The sections from `sectionRegistry.ts` fill this gap but use the `navigate` event fallback instead of `addTab`.

## Goals / Non-Goals

**Goals:**
- Every command palette result triggers a visible, reliable navigation when selected
- Unified navigation: all palette results use `addTab()` for in-app destinations (consistent with the tab-based layout)
- Image registry accessible via command palette as a tab
- `navigate` CustomEvent remains as a fallback for any code still dispatching it

**Non-Goals:**
- Redesigning the command palette UI or search ranking
- Adding new commands or features beyond what's already registered
- Fixing the separate `fix-platform-keyboard-shortcuts` issue (keyboard shortcut registration on Windows/macOS)

## Decisions

### 1. Use `addTab()` as the primary navigation mechanism for palette commands

**Decision**: All inline commands in CommandCenter (and any new ones like image registry) will use `addTab()` to open their target as a tab, matching the existing pattern for dashboard/documents/queue.

**Alternative considered**: Use `setCurrentPage()` via `navigate` events for everything. Rejected because the app layout is tab-based — `addTab` produces a visible, accessible navigation while `setCurrentPage` may not render visibly when tabs are active.

### 2. Stop excluding navigation commands from search results

**Decision**: Remove the exclusion lists on lines 569-580 of CommandCenter.tsx so that inline nav commands (nav-dashboard, nav-documents, etc.) appear as searchable results alongside sections.

**Rationale**: The exclusions were presumably added to avoid duplicates with sections, but having explicit commands with proper `addTab` actions is more reliable than depending on section fallbacks. If duplicates are a concern, prefer commands over sections in the result ordering.

### 3. Add image registry as a tab target in CommandCenter

**Decision**: Add an `openImageRegistry()` function and `nav-image-registry` command to CommandCenter, and include `"go-image-registry"` in the exclusion list for `getDefaultCommands()` so only the `addTab`-based version appears.

**Alternative considered**: Fix the `navigate` event path for image registry. Rejected because it's fragile and inconsistent with how other destinations are opened from the palette.

### 4. Keep `navigate` event listener as a safety net

**Decision**: Don't remove the `navigate` CustomEvent listener in App.tsx. Other parts of the codebase may still dispatch it, and it provides a fallback.

## Risks / Trade-offs

- **Duplicate results**: Removing exclusions may show both section matches and command matches for the same destination. Mitigated by letting commands take priority in result sorting (commands have score 0.8 vs section fuzzy scores).
- **Tab proliferation**: Every palette selection opens a new tab rather than navigating the existing one. This is the existing behavior for most commands and is consistent, but may accumulate tabs. Future improvement could check if a tab of that type already exists and focus it instead.
- **Stale closures**: The `handleSearch` callback defines `openX` functions that capture `addTab`. Since `addTab` comes from Zustand (stable reference), this is safe. But the functions themselves are recreated on every search call. Acceptable since they're only invoked on user selection.
