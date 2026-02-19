# Change: Add LaTeX rendering and duration-aware scheduling

## Why
Two high-value gaps remain:
1. Users can generate or import LaTeX math, but core reading/review surfaces do not consistently render LaTeX expressions.
2. Long-form videos/articles can be scheduled too far out when rated positively after only partial coverage, causing recall risk before completion.

## What Changes
- Add first-class LaTeX expression rendering in markdown-driven UI surfaces used by reading/review/assistant content.
- Support common math delimiters: `$$...$$`, `$...$`, `\\(...\\)`, and `\\[...\\]`.
- Preserve safety and compatibility by not rendering LaTeX inside fenced code blocks or inline code.
- Add duration-aware interval capping for long videos/articles when engagement coverage is low.
- Keep existing scheduling behavior for short content or when coverage is adequate.

## Impact
- Affected specs:
  - `specs/latex-rendering/spec.md` (new)
  - `specs/media-aware-scheduling/spec.md` (new)
- Affected code:
  - `src/utils/markdown.ts`, markdown presentation styles
  - `src-tauri/src/commands/algorithm.rs` (document scheduling)
- User-visible outcomes:
  - Math content is readable directly in app content surfaces.
  - Long content receives safer follow-up intervals when partial study is detected.
