# Anki LaTeX Compatibility

## Import and Render Path Inventory

- APKG parsing and note/card extraction:
  - `src-tauri/src/anki.rs`
  - `src/utils/ankiParserBrowser.ts`
- Learning item creation/storage:
  - `src-tauri/src/anki.rs` (`build_learning_item`)
  - `src-tauri/src/database/repository.rs` (`create_learning_item`)
- Shared flashcard LaTeX normalization/render contract:
  - `src/utils/ankiLatex.ts`
- Flashcard review and preview surfaces using the shared contract:
  - `src/components/review/ReviewCard.tsx`
  - `src/components/review/FlashcardScrollItem.tsx`
  - `src/components/review/ZenReviewMode.tsx`
  - `src/components/learning/LearningCardsList.tsx`
  - `src/components/common/GeneratedCardsPopover.tsx`

## Normalization Contract

- Source card field text is preserved as-is.
- LaTeX wrappers and delimiters are normalized into canonical inline/block math tokens.
- Code contexts are protected (`<code>`, `<pre>`, fenced code, inline backticks).
- Malformed/unsupported expressions are rendered as deterministic fallback spans:
  - `data-latex-fallback="true"`
  - `data-latex-reason="..."`
- Fallback events emit a compatibility signal in the console (`[anki-latex] fallback-render`).

## Rollout Flag

- Feature flag: `VITE_ENABLE_ANKI_LATEX_NORMALIZATION`
- Default behavior: enabled unless explicitly set to `0` or `false`.

### Enable (default)

```bash
VITE_ENABLE_ANKI_LATEX_NORMALIZATION=1 npm run tauri:dev
```

### Rollback (disable normalization)

```bash
VITE_ENABLE_ANKI_LATEX_NORMALIZATION=0 npm run tauri:dev
```

Rollback behavior:
- The app immediately uses the legacy renderer path in `src/utils/ankiLatex.ts`.
- No data migration is needed because source fields remain unchanged.

## Regression Suite

Run compatibility fixtures and renderer tests:

```bash
npm run test:run -- src/utils/__tests__/ankiLatex.test.ts src/components/review/__tests__/FlashcardScrollItem.test.tsx
```
