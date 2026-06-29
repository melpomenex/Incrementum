## Context

The app has two paths for viewing extracts:

1. **`ExtractsList`** (in `DocumentViewer` viewMode `"extracts"`): Full-featured extract cards with edit dialog, notes, tags, category, highlight color, disclosure level, card generation, bulk operations, and text selection for sub-extracts. Requires a `documentId` to fetch extracts — only shows extracts belonging to a specific document.

2. **`ExtractInbox`**: A standalone component for browser-sent extracts. Fetches all extracts (`getExtracts("")`) without a document filter, shows last 50 sorted by date. Renders expandable cards with rich HTML and AI analysis. Lacks editing, notes, tags, categories, highlight colors, disclosure levels, and card generation.

Both components use the same `Extract` type from `src/api/extracts.ts`. The data model is identical — browser extension extracts have `html_content`, `source_url`, `page_title`, and pre-populated FSRS data, but share all other fields with manual extracts.

The `EditExtractDialog` is document-agnostic — it takes an `Extract` and updates it via `updateExtract(extract.id, payload)`. It doesn't depend on `documentId`.

## Goals / Non-Goals

**Goals:**
- Browser-imported extracts render with the same card layout and capabilities as document extracts (edit, notes, tags, category, highlight color, disclosure level, card generation, delete)
- The extract inbox header ("from Browser") and branding is preserved
- The AI analysis feature (summary, key points, questions) is preserved as an action on each extract card
- Extracts are displayed in a centered, scrollable layout matching the document extracts view
- No regression in document-scoped extract viewing

**Non-Goals:**
- Changing the browser extension payload or server-side handling
- Modifying the `ExtractsList` component's document-scoped behavior (sub-extracts, text selection context)
- Adding rating/orb UI (not currently in either component)
- Changing how extracts are stored or queried in the backend
- Refactoring `ExtractsList` into a shared component for other consumers (this change focuses on ExtractInbox only)

## Decisions

### 1. Rebuild `ExtractInbox` using the `ExtractsList` card rendering pattern

**Decision**: Replace `ExtractInbox`'s expandable-card layout with the same card rendering pattern used by `ExtractsList` (lines 507–700). The `ExtractInbox` will render each extract using the same structure: checkbox, category badge, rich content badge, edit/palette/delete buttons, rich content renderer or plain text, notes section, footer with date/tags, disclosure level bars, and card generation popover.

**Rationale**: This gives users an identical visual and functional experience regardless of extract origin. The card pattern in `ExtractsList` is well-tested and handles all the features the user wants.

**How**: Extract the per-extract card JSX from `ExtractsList` into a new `ExtractCard` component. Both `ExtractsList` and `ExtractInbox` consume `ExtractCard`. This avoids duplicating 200+ lines of JSX and ensures visual parity.

### 2. Extract `ExtractCard` as a shared component

**Decision**: Create `src/components/extracts/ExtractCard.tsx` that encapsulates the rendering of a single extract card, including content display, actions, notes, footer, disclosure bars, and card generation popover. It accepts an `Extract` prop plus callbacks for edit, delete, palette, selection, bulk select, and AI analysis.

**Rationale**: Both `ExtractsList` and `ExtractInbox` need the same card rendering. Extracting it avoids duplication and ensures future changes to card rendering apply everywhere.

**Props**:
```tsx
interface ExtractCardProps {
  extract: Extract;
  isSelected: boolean;
  isFocused: boolean;
  highlights: AnchoredTextHighlight[];
  generating: boolean;
  generatedCount?: number;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPalette: () => void;
  onGenerateCards: () => void;
  onAnalyzeWithAI?: () => void;
  onTextSelection?: (payload: TextSelectionPayload) => void;
  pendingSelection?: TextSelectionPayload | null;
  onCreateFromSelection?: (opts: { highlight: boolean; color?: string }) => void;
  onClearSelection?: () => void;
}
```

### 3. Preserve AI analysis as an optional per-extract action

**Decision**: Add an "Analyze with AI" button (Sparkles icon) to the `ExtractCard` header actions, shown only when `onAnalyzeWithAI` is provided. `ExtractInbox` provides this callback; `ExtractsList` does not (no-op).

**Rationale**: The AI analysis feature is unique to the inbox context but useful enough to keep. By making it optional via props, it doesn't clutter the document-scoped extract view.

### 4. Show source URL / page title on cards without a parent document

**Decision**: When an extract has `source_url` or `page_title` but no associated document name, `ExtractCard` shows a clickable source link above the content. This replaces the `ExtractInbox`'s title display.

**Rationale**: Browser-imported extracts often lack a parent document in the user's mental model — they know the source web page, not a document ID. Showing the source URL provides the same context the old inbox had.

### 5. Keep `ExtractInbox` as the container, reuse card rendering

**Decision**: `ExtractInbox` remains the container component that fetches all extracts and manages inbox-specific state (loading, AI analysis state, refresh). Internally it renders `ExtractCard` instances instead of expandable cards.

**Rationale**: Minimal structural change. The inbox still manages its own data fetching and AI analysis logic. Only the rendering of individual extracts changes.

## Risks / Trade-offs

- **`ExtractCard` extraction is a refactor of `ExtractsList`**: Extracting the card JSX from `ExtractsList` touches a heavily-used component. Any regression in document-scoped extract viewing is a significant UX regression. Mitigation: the refactor is purely structural (extract JSX into a child component with the same props), no logic changes.

- **Text selection for sub-extracts may not work on orphaned extracts**: `ExtractsList`'s text selection feature creates sub-extracts linked to the parent document. Browser-imported extracts may not have a `document_id`. Mitigation: the `ExtractCard` shows text selection only when `onTextSelection` is provided. `ExtractInbox` can omit this callback for extracts without a `document_id`.

- **`ExtractsList` has many internal state dependencies**: Selection state, generating state, generated counts, highlights, pending selections, undo operations. These stay in `ExtractsList` and are passed down to `ExtractCard` via props. This keeps `ExtractCard` purely presentational.
