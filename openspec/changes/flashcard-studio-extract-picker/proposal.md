## Why

Users must leave the AI Flashcard Studio, navigate to a document, switch to the extract view, and only then create or edit flashcards from extracts. This fragmented flow breaks the studio's purpose as a one-stop shop for flashcard creation. Extracts are the primary source material for cards — the studio should surface them directly.

## What Changes

- Add an **extract browser** to FlashcardStudioModal that lists extracts grouped by document, letting users pick source material without leaving the studio
- Allow selecting one or more extracts as context for AI card generation
- Add a **"generate from extract"** shortcut that auto-creates cards from a chosen extract using the existing `generateLearningItemsFromExtract` backend
- Show extract preview (content snippet, highlight color, page number) in the browser
- Filter/search extracts by document title, content, or tags
- Preserve the existing chat-based workflow as the default — the extract browser is an additional entry point, not a replacement

## Capabilities

### New Capabilities

- `flashcard-studio-extract-picker`: An in-studio extract browser that lists extracts grouped by document, with selection, search, and one-click card generation from chosen extracts.

### Modified Capabilities

_(None — this adds new UI surfaces without changing existing spec-level behavior.)_

## Impact

- **FlashcardStudioModal** (`src/components/review/FlashcardStudioModal.tsx`): Major addition — extract browser panel, new state for extract selection, integration with existing context selection
- **API**: Uses existing `getExtracts`, `generateLearningItemsFromExtract`, `getLearningItemsByExtract` — no new backend endpoints needed
- **ExtractsList** (`src/components/extracts/ExtractsList.tsx`): No changes — extract browser in studio is independent
- **Stores**: May add a lightweight store or hooks for extract-by-document fetching within the studio
