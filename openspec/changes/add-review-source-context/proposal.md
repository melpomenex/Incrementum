# Change: Source Context During Review

## Why

RemNote's main advantage over Anki is that every flashcard shows its **source context** during review — the parent note, surrounding text, or extract it came from. Andy Matuschak argues atomic cards without context actively harm understanding, because the reviewer loses the connective tissue that gives the card meaning.

Today Incrementum's main `ReviewCard.tsx` shows only card type, tags, interval, and review count. Source context exists **only** as an opt-in hold-Alt peek in `ZenReviewMode.tsx:234-268`. This proposal promotes source context to a first-class, always-visible (collapsible) element on every standard review card whose source can be resolved.

## What Changes

### 1. Backend: `get_card_source_context` command
- New Tauri command that, given a learning-item id, resolves and returns:
  - `document_id`, `document_title` (from the linked document)
  - `extract_id`, `extract_snippet` (first ~200 chars of the source extract's plain-text content)
  - `page_number` (when available)
  - `source_url` (for web extracts)
- Returns `null` when the card has no resolvable source (e.g. imported standalone).

### 2. Frontend: collapsible `CardSourceContext` component
- A new component rendered inside `ReviewCard.tsx` (above the answer, below the question).
- Fetches source context once per card via the new command.
- Collapsed by default (one-line summary: "From: *Document title*"), expandable to show the extract snippet.
- Clicking the document title is a no-op for now (deep-link to the reader is a future enhancement).
- Hidden entirely when no source resolves (no empty placeholder).

### 3. Settings toggle
- Add a `showSourceContext` review preference (default `true`) so users who prefer the Anki-pure experience can disable it.

## Impact

### Affected Specs
- **review-source-context** — New spec for the context resolution contract.

### Affected Code Areas
- `src-tauri/src/commands/review.rs` — New `get_card_source_context` command + registration.
- `src-tauri/src/database/repository.rs` — Helper to resolve item → extract → document.
- `src/components/review/ReviewCard.tsx` — Render new `CardSourceContext`.
- `src/components/review/CardSourceContext.tsx` — New component.
- `src/api/review.ts` — `getCardSourceContext` wrapper + `CardSourceContext` type.
- `src/types/settings.ts` — `showSourceContext` review preference.

### Non-goals
- No deep-linking into the reader from the context panel (future work).
- No change to Zen mode's existing hold-Alt peek (the two coexist).
- No change to extract review (extracts already show their own content).
