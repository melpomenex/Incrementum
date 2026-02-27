## 1. Parser and Normalization Foundation

- [x] 1.1 Inventory current APKG import and flashcard render paths where LaTeX is parsed or transformed.
- [x] 1.2 Implement an Anki-focused LaTeX normalization module that converts supported delimiters/wrappers into canonical math tokens.
- [x] 1.3 Ensure normalized output preserves expression text and distinguishes inline vs display math modes.
- [x] 1.4 Add non-math guardrails (escaping/code contexts) to prevent false-positive math tokenization.

## 2. Source Preservation and Data Flow

- [x] 2.1 Update import/storage flow to preserve original flashcard source text without destructive LaTeX rewrites.
- [x] 2.2 Store normalization metadata as derived data tied to flashcard fields.
- [x] 2.3 Add re-processing path that can regenerate normalization metadata from preserved source.

## 3. Rendering and Fallback Behavior

- [x] 3.1 Wire canonical math tokens into shared flashcard rendering components across review surfaces.
- [x] 3.2 Implement deterministic non-fatal fallback rendering for malformed or unsupported LaTeX.
- [x] 3.3 Add compatibility telemetry/error markers for fallback-triggered expressions.
- [x] 3.4 Verify desktop/mobile surfaces consume the same normalization contract.

## 4. Compatibility Test Coverage

- [x] 4.1 Build fixture corpus for representative Anki LaTeX syntaxes (`$...$`, `$$...$$`, `\\(...\\)`, `\\[...\\]`, `[latex]`, `[$]`, `[$$]`).
- [x] 4.2 Add parser/normalizer unit tests asserting canonical token output from fixtures.
- [x] 4.3 Add renderer integration tests asserting readable output and graceful fallback behavior.
- [x] 4.4 Add regression checks so normalization/render fixture mismatches fail CI.

## 5. Rollout and Validation

- [x] 5.1 Gate the new normalization path behind a feature flag for staged rollout.
- [x] 5.2 Add lazy backfill behavior for existing cards missing normalization metadata.
- [x] 5.3 Run end-to-end validation with real Anki decks containing diverse LaTeX patterns.
- [x] 5.4 Define rollback switch behavior and document operator steps.
