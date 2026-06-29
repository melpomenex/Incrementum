## Tasks

- [x] Create `ExtractCard` shared component from `ExtractsList` card JSX
- [x] Wire `ExtractCard` into `ExtractsList` (refactor, no behavior change)
- [x] Rebuild `ExtractInbox` to use `ExtractCard` instead of expandable cards
- [x] Add edit, notes, tags, category, highlight color, and disclosure level support to `ExtractInbox`
- [x] Add card generation support to `ExtractInbox` extract cards
- [x] Preserve AI analysis as optional action on `ExtractCard`
- [x] Show source URL / page title on orphaned extract cards
- [ ] Manual verification across extract origins

## Task Details

### Task 1: Create `ExtractCard` shared component from `ExtractsList` card JSX

Extract the per-extract card rendering from `ExtractsList` (lines 507–700 in `ExtractsList.tsx`) into a new `src/components/extracts/ExtractCard.tsx` component.

The new component is purely presentational — all state and callbacks are passed via props:

```tsx
interface ExtractCardProps {
  extract: Extract;
  isSelected: boolean;
  isFocused: boolean;
  highlights: AnchoredTextHighlight[];
  isGenerating: boolean;
  generatedCount?: number;
  onToggleSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPalette: () => void;
  onGenerateCards: () => void;
  onAnalyzeWithAI?: () => void;
  onTextSelection?: (payload: TextSelectionPayload) => void;
  pendingSelection?: TextSelectionPayload | null;
  onCreateFromSelection?: (opts: { highlight: boolean; color?: string }) => void;
  onClearSelection?: () => void;
  showSourceUrl?: boolean;
}
```

Move the following into `ExtractCard.tsx`:
- The card wrapper `div` with selection/focus ring styling
- Checkbox button
- Header with category badge, rich content badge, action buttons (palette, edit, delete)
- Content section: `RichContentRenderer` for HTML extracts, `ExtractTextContent` for plain text
- Pending selection actions (highlight selection / create extract)
- Notes section
- Footer with page number, date, tags
- Progressive disclosure level bars
- Card generation section with `GeneratedCardsPopover`
- The `formatDate` helper (if not already shared)
- The `ExtractTextContent` sub-component (move from `ExtractsList.tsx`)

Also move the `showSourceUrl` feature: when `extract.source_url` or `extract.page_title` exists and `showSourceUrl` is true, render a clickable link above the content showing the source page.

Keep the `Sparkles` (AI analyze) button in the header actions area, rendered only when `onAnalyzeWithAI` is provided.

**Files:** `src/components/extracts/ExtractCard.tsx` (new), `src/components/extracts/ExtractsList.tsx` (extract moved)

---

### Task 2: Wire `ExtractCard` into `ExtractsList` (refactor, no behavior change)

Replace the inline card JSX in `ExtractsList` (lines 507–700) with `<ExtractCard>` components. All existing state management stays in `ExtractsList`:

- `selectedIds`, `setSelected` → `onToggleSelect`
- `handleEdit(extract)` → `onEdit`
- `handleDelete(extract)` → `onDelete`
- `handlePalette(extract)` → `onPalette`
- `handleGenerateCards(extract)` → `onGenerateCards`
- `handleExtractSelection` → `onTextSelection`
- `pendingExtractSelection` / `setPendingExtractSelection` → `pendingSelection` / `onCreateFromSelection` / `onClearSelection`
- `extractHighlightsByParent` → `highlights`
- `generatingIds.has(extract.id)` → `isGenerating`
- `generatedCounts[extract.id]` → `generatedCount`

Do NOT pass `onAnalyzeWithAI` — document-scoped extracts don't need it.
Do NOT pass `showSourceUrl` — document extracts already show the document context.

Verify: all existing `ExtractsList` functionality works identically. No visual or behavioral changes.

**Files:** `src/components/extracts/ExtractsList.tsx`

---

### Task 3: Rebuild `ExtractInbox` to use `ExtractCard` instead of expandable cards

Replace the expandable-card layout in `ExtractInbox` (lines 174–376) with `ExtractCard` components rendered in a grid layout matching `ExtractsList`.

Changes:
- Remove the `expandedId` state (no longer needed — cards are always fully rendered)
- Remove the collapsed content preview (cards always show full content like `ExtractsList`)
- Keep the `aiAnalysis` state for tracking per-extract AI analysis results
- Render each extract as `<ExtractCard>` with:
  - `showSourceUrl={true}` to display `source_url` / `page_title`
  - `onAnalyzeWithAI={() => handleAnalyze(extract)}` to preserve AI analysis
  - `onToggleSelect`, `onEdit`, `onDelete`, `onPalette`, `onGenerateCards` wired to new handlers
- Add `selectedIds` state and select-all/deselect-all header (matching `ExtractsList`)
- Use the same grid layout: `<div className="grid gap-4">` with `p-6 bg-background h-full overflow-auto`

Keep the inbox header ("from Browser", extract count, refresh button) unchanged.

**Files:** `src/components/extracts/ExtractInbox.tsx`

---

### Task 4: Add edit, notes, tags, category, highlight color, and disclosure level support to `ExtractInbox`

Add state and handlers to `ExtractInbox` for full extract editing:

- Add `editingExtract` state (the extract being edited, or null)
- Add `isEditDialogOpen` state
- Wire `onEdit` callback to open `EditExtractDialog` with the selected extract
- Import and render `EditExtractDialog` from `./EditExtractDialog`
- On successful update from the dialog, refresh the extract in the local list (call `updateExtract` API, then update state)
- The `EditExtractDialog` already supports all editing features: content, notes, category, tags, highlight color, disclosure level
- Add `editableContentPalette` state and render `EditableContentPalette` when palette is toggled (matching `ExtractsList`'s palette behavior)

Notes: The `EditExtractDialog` is document-agnostic — it calls `updateExtract(extract.id, payload)` which works for any extract regardless of `document_id`. No changes needed to `EditExtractDialog`.

**Files:** `src/components/extracts/ExtractInbox.tsx`

---

### Task 5: Add card generation support to `ExtractInbox` extract cards

Wire card generation into `ExtractInbox`:

- Add `generatingIds` state (same pattern as `ExtractsList`)
- Add `generatedCounts` state (same pattern as `ExtractsList`)
- Wire `onGenerateCards` callback to call `generateLearningItemsFromExtract(extract.id)` and update `generatingIds`/`generatedCounts`
- The `GeneratedCardsPopover` in `ExtractCard` already handles displaying generated cards
- Optionally add bulk generate cards support when multiple extracts are selected

**Files:** `src/components/extracts/ExtractInbox.tsx`

---

### Task 6: Preserve AI analysis as optional action on `ExtractCard`

This is handled by the `onAnalyzeWithAI` prop on `ExtractCard` (designed in Task 1). Verify:

- `ExtractInbox` passes `onAnalyzeWithAI={() => handleAnalyze(extract)}` for each card
- `ExtractsList` does NOT pass this prop (AI analysis is not available in document-scoped view)
- The Sparkles button appears in the card header actions only when the prop is provided
- Clicking the button triggers the same `handleAnalyze` logic from the current `ExtractInbox` (summary, key points, questions)
- AI analysis results display in a collapsible section below the extract content (similar to current `ExtractInbox` expanded state)

The AI results section can either be part of `ExtractCard` (when `onAnalyzeWithAI` is provided) or rendered by the parent. Prefer keeping it in `ExtractCard` for encapsulation — pass `aiAnalysisResult` as an optional prop.

**Files:** `src/components/extracts/ExtractCard.tsx`, `src/components/extracts/ExtractInbox.tsx`

---

### Task 7: Show source URL / page title on orphaned extract cards

In `ExtractCard`, when `showSourceUrl` is true and the extract has `source_url` or `page_title`:

- Render a clickable source link above the extract content
- Format: `{page_title}` as a truncated link, with the URL shown on hover as a tooltip
- Clicking opens the URL in the system default browser (use Tauri's `shell.open` or a simple `<a href={source_url} target="_blank" rel="noopener noreferrer">`)
- Style: small muted text with an external-link icon, matching the existing footer styling

This replaces the title display that was in the old `ExtractInbox` expandable card header.

**Files:** `src/components/extracts/ExtractCard.tsx`

---

### Task 8: Manual verification across extract origins

Verify the following scenarios:

1. **Document-scoped extracts** (existing flow): Open a document → switch to Extracts view → verify all extract cards render identically to before the refactor. Check: edit, notes, tags, delete, palette, text selection, card generation, disclosure bars.

2. **Browser-imported extracts via ExtractInbox**: Navigate to extract inbox → verify extracts render as full cards (not expandable). Check: edit dialog opens and saves, notes display, tags show, AI analysis works, source URL is clickable, card generation works, delete works.

3. **Browser extracts with html_content**: Verify rich HTML renders correctly via `RichContentRenderer` in the unified card (same as document-scoped extracts with HTML).

4. **Browser extracts without document_id** (orphaned): Verify they display and edit correctly. Verify source URL shows as a clickable link.

5. **Mixed origin extracts**: If the inbox shows both browser-imported and manually-created extracts, verify both render correctly.

**Files:** No code changes; fix any regressions found.
