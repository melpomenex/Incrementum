# Change: Upgrade LaTeX Engine — Comprehensive Coverage

## Why

Incrementum uses KaTeX 0.16 with `throwOnError: false` and `strict: false`, which silently swallows unsupported commands and produces degraded output for many common LaTeX use cases. Users importing Anki decks with chemistry notation, display-mode environments, custom macros, or complex delimiter patterns get broken or ugly renders instead of correct math. The editing experience has no live preview, so users cannot verify LaTeX before saving.

## What Changes

- **Enable mhchem extension** — Load `katex/dist/contrib/mhchem` so `\ce{}` and `\pu{}` render chemistry notation and units
- **Auto-detect display-mode requirements** — Environments like `gather`, `split`, `aligned`, `tag`, `cases` etc. require `displayMode: true`; add a pre-render heuristic that sets display mode when block environments are detected inside what was parsed as inline math
- **Custom macro pre-processor** — Implement a `\newcommand`/`\renewcommand`/`\DeclareMathOperator` expansion pass before KaTeX rendering; macros scoped per card field; reset between fields
- **Delimiter parsing hardening** — Fix edge cases: nested `$` inside `$$`, escaped delimiters `\$`, improve `isLikelyMath` heuristic to reduce currency false positives while catching plain LaTeX (e.g. `\frac{}{}` without delimiters), handle mixed/malformed Anki delimiters more robustly
- **Live LaTeX preview** — Add real-time rendered preview in flashcard editor surfaces (FlashcardStudioModal and inline card editing) so users see rendered math as they type
- **Better fallback UX** — When KaTeX produces an error class, show a clear visual indicator with the raw source and a tooltip explaining the issue, rather than the current silent degraded render

## Impact

- Affected specs: `latex-rendering`, `anki-latex-compatibility`
- Affected code:
  - `src/utils/mathOcr.ts` — KaTeX configuration, macro expansion, display-mode detection
  - `src/utils/ankiLatex.ts` — Normalization tokenizer, delimiter parsing
  - `src/utils/markdown.ts` — Inline/block math rendering with display-mode awareness
  - `src/components/review/FlashcardStudioModal.tsx` — Live preview
  - `src/index.css` — Fallback styling improvements
  - `src/utils/__tests__/` — Expanded test fixtures and coverage
