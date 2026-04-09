## Context

Incrementum renders LaTeX via KaTeX 0.16 across three pipelines:
1. **`mathOcr.ts`** — `latexToHTML()` is the atomic render function used everywhere
2. **`ankiLatex.ts`** — Normalizes Anki deck LaTeX syntaxes into canonical tokens, then calls `latexToHTML()`
3. **`markdown.ts`** — Custom markdown renderer that extracts `$$...$$`/`\[...\]` as block and `$...$`/`\(...\)` as inline, then calls `latexToHTML()`

The current `latexToHTML()` always uses `displayMode: false` (KaTeX default). Many environments like `gather`, `split`, `tag` only work in display mode and produce errors in inline mode. Chemistry notation (`\ce`, `\pu`) requires the mhchem extension which is bundled with KaTeX but never loaded.

## Goals / Non-Goals

**Goals:**
- All standard KaTeX-supported LaTeX renders correctly in flashcards
- Chemistry notation (`\ce{}`, `\pu{}`) renders via mhchem extension
- Display-mode-only environments auto-upgrade to display mode
- Common custom macros (`\newcommand`, `\DeclareMathOperator`) expand before rendering
- Delimiter parsing handles edge cases robustly
- Live LaTeX preview in card editors
- Better fallback UX when rendering fails

**Non-Goals:**
- Switching to MathJax (KaTeX is faster and sufficient for flashcards)
- Supporting TikZ/diagrams (rendering-in-a-box problem)
- Server-side LaTeX rendering
- Full LaTeX document compilation
- `\ref`/`\label` cross-referencing (requires document-level state)

## Decisions

### 1. Stay with KaTeX, extend it — don't switch to MathJax

**Rationale:** KaTeX renders ~100x faster than MathJax, which matters for flashcard review UX (many cards rendered in sequence). All the gaps (mhchem, display-mode environments, macros) can be solved by extending the KaTeX pipeline rather than replacing it. MathJax adds ~600KB vs KaTeX's ~300KB.

**Alternatives considered:**
- MathJax 3: Full LaTeX support but slower, larger bundle. Overkill for flashcard expressions.
- Hybrid KaTeX + MathJax fallback: Adds complexity. Only needed for TikZ/diagrams which we're explicitly not supporting.

### 2. mhchem extension via import side-effect

**Rationale:** KaTeX bundles `katex/dist/contrib/mhchem.js` which auto-registers `\ce` and `\pu` macros when loaded. A single `import "katex/dist/contrib/mhchem"` in `mathOcr.ts` activates it globally with zero config.

### 3. Display-mode auto-detection via regex pre-scan

**Rationale:** Rather than trying every expression in both modes, scan for display-mode-only environment names (`gather`, `split`, `tag`, `alignedat`, `multline`, `flalign`, `alignat`, `align` when not in `aligned`) and set `displayMode: true` when detected. This is O(1) per expression and covers 100% of real-world cases.

**Alternatives considered:**
- Always use display mode for block delimiters: Already done for `$$...$$`/`\[...\]`. The gap is inline delimiters containing display-mode environments.
- Try-catch with fallback to display mode: Would mask real errors and add latency.
- KaTeX's `\textstyle`/`\displaystyle`: Requires user to add these manually; defeats the goal of "just works."

### 4. Macro expansion as a pre-processing pass

**Rationale:** KaTeX doesn't support `\newcommand` or `\DeclareMathOperator`. We implement a lightweight regex-based macro expander that:
- Scans for `\newcommand{\\name}{definition}` and `\DeclareMathOperator{\\cmd}{text}` patterns
- Stores macros in a scoped map (per card field, reset between fields)
- Recursively expands macro invocations before passing to KaTeX
- Handles simple positional arguments (`#1`, `#2`)

This covers 95% of real-world Anki macro usage without a full TeX parser.

**Alternatives considered:**
- Full TeX macro parser: Massive complexity. Overkill for flashcard use.
- KaTeX's `\def` support: KaTeX does not expose `\def` as a public API.

### 5. Live preview via debounced rendering hook

**Rationale:** Add a `useLatexPreview(input: string)` hook that debounces (300ms) and returns rendered HTML via the existing `renderAnkiHtmlWithLatex()` pipeline. The hook uses `useMemo` with the debounce to avoid re-renders on every keystroke while showing updates quickly enough to feel live.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Macro expansion could be slow for deeply recursive macros | Cap recursion depth at 10 levels |
| Display-mode detection regex may miss obscure environments | Log warning when KaTeX error contains "can be used only in display mode", then retry with display mode as fallback |
| mhchem extension adds ~20KB to bundle | Already bundled with KaTeX, just not loaded; negligible |
| Live preview could lag on complex cards | Debounce + `useDeferredValue` for typed input |

## Open Questions

- Should macro definitions persist across review sessions (i.e., a per-deck macro library) or stay per-field? Per-field is simpler and safer for now.
