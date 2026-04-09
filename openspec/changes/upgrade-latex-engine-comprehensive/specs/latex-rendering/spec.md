## MODIFIED Requirements

### Requirement: Render LaTeX delimiters in markdown content
The system SHALL render LaTeX expressions in markdown-rendered content for supported delimiters, automatically upgrading to display mode when display-mode-only environments are detected.

#### Scenario: Render display math using dollar delimiters
- **WHEN** markdown content contains `$$...$$`
- **THEN** the expression is rendered as display math
- **AND** the raw delimiters are not shown in final output

#### Scenario: Render inline math using dollar delimiters
- **WHEN** markdown content contains `$...$`
- **THEN** the expression is rendered inline with text flow
- **AND** surrounding text remains unchanged

#### Scenario: Render escaped LaTeX delimiters
- **WHEN** markdown content contains `\(...\)` or `\[...\]`
- **THEN** the expression is rendered as inline or display math respectively

#### Scenario: Auto-upgrade inline to display mode for display-only environments
- **WHEN** an inline math expression contains a display-mode-only environment such as `gather`, `split`, `multline`, `flalign`, `alignat`, `align`, or `tag`
- **THEN** the expression MUST be rendered in display mode
- **AND** the visual output MUST show a centered block-level math expression

#### Scenario: Render chemistry notation via mhchem
- **WHEN** a LaTeX expression contains `\ce{...}` or `\pu{...}` commands
- **THEN** the system MUST render chemical formulas and physical units using the KaTeX mhchem extension

### Requirement: Preserve code semantics
The system SHALL NOT treat code spans/blocks as LaTeX content.

#### Scenario: Ignore fenced code blocks
- **WHEN** LaTeX-like delimiters appear inside fenced code blocks
- **THEN** the content remains code
- **AND** no math rendering is applied inside that block

#### Scenario: Ignore inline code
- **WHEN** LaTeX-like delimiters appear inside inline code spans
- **THEN** the content remains inline code
- **AND** no math rendering is applied inside that span

## ADDED Requirements

### Requirement: Expand custom LaTeX macros before rendering
The system SHALL expand user-defined LaTeX macros via `\newcommand`, `\renewcommand`, and `\DeclareMathOperator` before passing expressions to the rendering engine.

#### Scenario: Expand simple newcommand
- **WHEN** a flashcard field contains `\newcommand{\R}{\mathbb{R}}` followed by `x \in \R`
- **THEN** the system MUST expand `\R` to `\mathbb{R}` before rendering
- **AND** the rendered output MUST show the blackboard-bold R

#### Scenario: Expand macro with arguments
- **WHEN** a field contains `\newcommand{\abs}[1]{\left|#1\right|}` followed by `\abs{x+1}`
- **THEN** the system MUST expand the macro with `x+1` substituted for `#1`

#### Scenario: Expand DeclareMathOperator
- **WHEN** a field contains `\DeclareMathOperator{\argmin}{arg\,min}` followed by `\argmin_x f(x)`
- **THEN** the system MUST render `\argmin` as a styled operator name

#### Scenario: Macro scope is per field
- **WHEN** a macro is defined in one flashcard field (e.g., question)
- **THEN** the macro MUST NOT be available in another field (e.g., answer)
- **AND** macros MUST be reset between different card fields

#### Scenario: Recursive macro depth limit
- **WHEN** a macro expansion chain exceeds 10 levels of recursion
- **THEN** the system MUST stop expanding and render the partially expanded expression with a fallback indicator

### Requirement: Provide live LaTeX preview in flashcard editors
The system SHALL show a real-time rendered preview of LaTeX content as users type in flashcard editing surfaces.

#### Scenario: Live preview renders as user types
- **WHEN** a user types LaTeX content in the flashcard editor
- **THEN** a preview panel MUST update within 500ms to show the rendered math
- **AND** the preview MUST use the same rendering pipeline as review surfaces

#### Scenario: Live preview shows fallback for errors
- **WHEN** the typed LaTeX contains syntax errors
- **THEN** the live preview MUST show the fallback rendering with a visual indicator
- **AND** the user MUST still be able to continue typing

### Requirement: Show clear feedback for rendering failures
The system SHALL display a distinct visual indicator when LaTeX rendering fails, including the raw source expression.

#### Scenario: Error indicator with raw source
- **WHEN** KaTeX produces an error-class output for a LaTeX expression
- **THEN** the system MUST wrap the raw source in a visually distinct fallback element
- **AND** the element MUST include a `data-latex-error` attribute with the KaTeX error message

#### Scenario: Display-mode retry on inline error
- **WHEN** KaTeX reports that an environment "can be used only in display mode" while rendering in inline mode
- **THEN** the system MUST automatically retry rendering in display mode
- **AND** if the retry succeeds, the display-mode output MUST be shown
