## Context

The app has two highlight/extract creation paths:

1. **UI-driven** (toolbar button, selection popup "Highlight" action) → opens `CreateExtractDialog` modal with full metadata form (category, tags, color, notes, progressive disclosure)
2. **Keyboard-driven** (Alt+X via `useInlineExtraction`) → instant zero-dialog extract with selection flash animation

The UI-driven path is the default for most users and forces a modal dialog that breaks reading flow. The keyboard path already proves that instant extraction works well — it uses `flashSelection()` for visual feedback and clears the selection silently (errors only show toasts).

The app already has a mature toast system (`Toast.tsx` + `useToast` hook) with success/error/warning/info types, auto-dismiss, progress bars, and action buttons.

## Goals / Non-Goals

**Goals:**
- Make the default highlight/extract action instant and non-disruptive across all viewers (PDF, EPUB, HTML, RSS)
- Show a brief toast notification confirming the highlight was saved
- Allow users to optionally edit the extract (open full dialog) from the toast action button
- Default highlight color to the user's last-used color or a configurable default

**Non-Goals:**
- Removing the `CreateExtractDialog` entirely — it remains available for power users who want metadata
- Changing keyboard shortcut behavior (Alt+X, Alt+Z) — already works well
- Changing the extract data model or backend API
- Changing the extracts sidebar/management UI

## Decisions

### 1. Toast over dialog for primary highlight action

**Decision**: The "Highlight" action in `SelectionPopup` and viewer toolbars SHALL create the extract immediately and show a toast instead of opening `CreateExtractDialog`.

**Rationale**: Aligns with the user's SuperMemo comparison and the existing `useInlineExtraction` pattern. The `flashSelection()` animation already provides immediate visual feedback; the toast adds confirmation.

**Alternative considered**: Collapsible inline form (like Google Docs comments) — rejected as it still requires interaction and adds UI complexity for every viewer type.

### 2. Toast action button for "Edit extract"

**Decision**: The toast SHALL include an optional action button labeled "Edit" that opens `CreateExtractDialog` pre-filled with the just-created extract data.

**Rationale**: Preserves access to advanced metadata (category, tags, progressive disclosure) without forcing it on every highlight. The toast system already supports action buttons.

### 3. Default color from user preference

**Decision**: When creating an extract without dialog, use the last-selected highlight color. Store this in a new Zustand store field or local setting.

**Rationale**: Most users consistently use one highlight color. The dialog currently forces a color choice every time.

### 4. Reuse existing extraction logic

**Decision**: Unify the UI-driven and keyboard-driven extraction paths. Both SHALL call the same underlying extraction function that creates the extract, flashes the selection, and shows a toast.

**Rationale**: `useInlineExtraction.ts` already has the right pattern. The toolbar/popup actions should delegate to a shared extraction function rather than opening a dialog.

## Risks / Trade-offs

- **Users lose immediate access to metadata fields** → Mitigated by toast "Edit" action button and extracts sidebar. Users who need category/tags every time can use the Edit button or a settings toggle to restore the dialog.
- **Highlight created with wrong color** → Mitigated by using last-selected color as default. User can change via Edit dialog or a future quick-color-picker in the toast.
- **Different viewer implementations (PDF, EPUB, HTML, RSS) may need separate integration points** → Each viewer has its own selection/highlight path but they converge on shared extraction logic. Integration is straightforward but requires touching 4+ viewer files.
