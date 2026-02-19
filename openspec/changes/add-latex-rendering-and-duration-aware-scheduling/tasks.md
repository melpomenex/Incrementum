## 1. OpenSpec
- [x] 1.1 Add proposal/design/tasks files for the change.
- [x] 1.2 Add `latex-rendering` spec with delimiter and safety requirements.
- [x] 1.3 Add `media-aware-scheduling` spec with duration-aware cap requirements.

## 2. LaTeX rendering
- [x] 2.1 Extend markdown renderer to parse display + inline LaTeX delimiters.
- [x] 2.2 Ensure fenced code blocks and inline code are excluded from math parsing.
- [x] 2.3 Add styling for rendered math fragments.
- [ ] 2.4 Verify markdown viewer surfaces render math correctly.

## 3. Duration-aware scheduling
- [x] 3.1 Add helper(s) to estimate long-content duration for videos/articles.
- [x] 3.2 Add coverage-based interval capping for Good/Easy in `rate_document`.
- [x] 3.3 Add the same safety cap in `rate_document_engaging`.
- [x] 3.4 Append scheduling reason details when cap is applied.

## 4. Validation
- [x] 4.1 Run targeted frontend tests (markdown/math-related if available).
- [x] 4.2 Run targeted Rust checks/tests for command/scheduler changes.
- [ ] 4.3 Manually verify with sample long video + partial session timing.
