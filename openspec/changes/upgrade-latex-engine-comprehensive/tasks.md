## 1. Enable mhchem extension
- [x] 1.1 Add `import "katex/dist/contrib/mhchem"` to `src/utils/mathOcr.ts`
- [x] 1.2 Add mhchem-specific test cases to `ankiLatexFixtures.ts` (e.g., `\ce{CO2 + H2O -> H2CO3}`, `\pu{9.8 m/s^2}`)
- [x] 1.3 Verify mhchem CSS is included (check if katex.min.css already includes it or if additional CSS is needed)
- [x] 1.4 Add unit tests in `mathOcr.test.ts` for `\ce{}` and `\pu{}` expressions

## 2. Auto-detect display-mode requirements
- [x] 2.1 Create `shouldUseDisplayMode(expression: string): boolean` helper in `mathOcr.ts` that regex-matches display-only environment names (`gather`, `split`, `multline`, `flalign`, `alignat`, `align`, `tag`)
- [x] 2.2 Update `latexToHTML()` to accept optional `{ displayMode?: boolean }` parameter
- [x] 2.3 Integrate display-mode detection: when `displayMode` is not explicitly set, auto-detect from expression content
- [x] 2.4 Add display-mode retry fallback: if KaTeX error contains "can be used only in display mode", retry with `displayMode: true`
- [x] 2.5 Update `renderAnkiHtmlWithLatex()` / `normalizeAnkiLatexContent()` to pass display-mode context through the tokenizer for inline expressions
- [x] 2.6 Add tests: inline `$\begin{gather}...\end{gather}$` renders as block, `$\tag{1} E=mc^2$` renders as block
- [x] 2.7 Ensure display-mode auto-upgrade wraps output in `.math-expression-block` container

## 3. Custom macro pre-processor
- [x] 3.1 Create `src/utils/latexMacros.ts` with `MacroExpander` class:
  - `define(cmd: string, argCount: number, body: string): void`
  - `expand(expression: string): string` — recursive expansion with depth cap of 10
  - `reset(): void`
- [x] 3.2 Parse `\newcommand{\name}{body}`, `\newcommand{\name}[n]{body}`, `\renewcommand{...}`, `\DeclareMathOperator{\name}{text}` patterns
- [x] 3.3 Integrate into `latexToHTML()`: strip macro definitions from expression, expand macros in remaining expression
- [x] 3.4 Integrate into `normalizeAnkiLatexContent()`: reset macro scope per field, pass through to `latexToHTML()`
- [x] 3.5 Add tests: simple macro, macro with arguments, DeclareMathOperator, recursive depth limit, cross-field isolation

## 4. Delimiter parsing hardening
- [x] 4.1 Update tokenizer regex in `ankiLatex.ts` to handle escaped dollar signs (`\$`) — skip them as delimiter boundaries
- [x] 4.2 Improve `isLikelyMath` heuristic in `ankiLatex.ts`: catch plain `\command{}` patterns without requiring `=^_{}` or Greek characters; keep currency exclusion
- [x] 4.3 Fix nested delimiter edge case: ensure `$x$ text $$\int$$ text $y$` correctly produces 3 separate tokens
- [x] 4.4 Add tests for: `\$20` is not math, `Price is $5.00` is not math, `\frac{}{}` without delimiters is detected as math, nested mixed delimiters

## 5. Better fallback UX
- [x] 5.1 Update `latexToHTML()` to detect KaTeX error spans in output (`katex-error` class) and wrap in `.math-expression-fallback` with `data-latex-error` attribute
- [x] 5.2 Update `.math-expression-fallback` CSS in `index.css` to show error state more clearly (distinct from current yellow-dashed style)
- [x] 5.3 Add tests: verify error attribute is set, verify fallback contains raw source

## 6. Live LaTeX preview in editors
- [x] 6.1 Create `useLatexPreview(input: string, delay?: number): { html: string; isPending: boolean }` hook in `src/hooks/`
- [x] 6.2 Hook uses debounce (300ms default) calling `renderAnkiHtmlWithLatex()`
- [x] 6.3 Integrate hook into `FlashcardStudioModal.tsx` preview panel
- [ ] 6.4 Integrate hook into any inline card editing surfaces
- [ ] 6.5 Add component test: typing triggers preview update, error expressions show fallback

## 7. Expanded test fixtures
- [x] 7.1 Add chemistry fixtures: `\ce{CO2}`, `\ce{H2SO4}`, `\pu{9.8 m/s^2}`
- [x] 7.2 Add display-mode environment fixtures: `\begin{gather}...\end{gather}`, `\begin{split}...\end{split}`, `\tag{1}`
- [x] 7.3 Add macro fixtures: `\newcommand` + usage, `\DeclareMathOperator` + usage
- [x] 7.4 Add delimiter edge-case fixtures: escaped `\$`, nested delimiters, currency exclusion
- [x] 7.5 Run full regression suite to verify no regressions
