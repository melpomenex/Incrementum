## Why

Incrementum currently fails on some LaTeX patterns found in real Anki decks, which breaks card comprehension and review quality. We need parity with Anki-style LaTeX handling so any LaTeX encountered on imported flashcards renders reliably.

## What Changes

- Add full LaTeX compatibility requirements for Anki flashcard content, including inline and block expressions commonly found in `.apkg` imports.
- Define deterministic handling for unsupported or malformed LaTeX so cards remain usable instead of failing silently.
- Add normalization and rendering expectations so imported LaTeX content is preserved and displayed consistently in review UI.
- Add compatibility validation coverage using representative Anki LaTeX fixtures.

## Capabilities

### New Capabilities
- `anki-latex-compatibility`: Guarantees that LaTeX present in imported Anki flashcards is preserved, interpreted, and rendered with behavior consistent with supported Incrementum review surfaces.

### Modified Capabilities
- _None._

## Impact

- Affected code: Anki/APKG import parsing, flashcard content normalization pipeline, review renderer components, and error/fallback handling paths.
- Affected tests: parser/normalizer unit tests, renderer integration tests, and fixture-based compatibility regression tests.
- Dependencies/systems: existing math rendering stack (KaTeX/MathJax or equivalent), APKG import pipeline, and client rendering performance constraints.
