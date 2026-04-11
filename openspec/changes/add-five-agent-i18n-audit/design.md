## Context
This change is a follow-on to `complete-app-internationalization`. That earlier change primarily established translation keys, locale dictionaries, and broad extraction of hardcoded strings. The remaining risk is coverage drift: user-visible strings can still be hardcoded in JSX, tooltips, toast bodies, formatted status text, and inspection panels even when locale files appear complete.

The audit must be parallelized to move quickly without creating overlapping ownership or duplicate edits. The proposal therefore defines five scoped agents with disjoint surface areas and a shared verification contract.

## Goals / Non-Goals
- Goals:
  - Detect and remediate remaining hardcoded or untranslated strings across all supported locales.
  - Start with Review-centric surfaces where missing Chinese translations have already been observed.
  - Produce an auditable artifact of findings instead of relying on ad hoc spot checks.
  - Strengthen regression protection beyond simple key-count parity.
- Non-Goals:
  - Replacing the existing i18n architecture.
  - Adding new locales beyond `en`, `zh`, `es`, `de`, `fr`, and `ja`.
  - Performing native-speaker linguistic style review beyond completeness and obvious correctness.

## Decisions
- Decision: Use five agents with fixed ownership boundaries.
  - Rationale: This reduces merge conflicts and makes it possible to audit the entire app in parallel without ambiguous responsibility.

- Decision: Reserve Agent 1 for Review-first surfaces.
  - Rationale: The user reported missing Chinese translations in Review View, and local inspection already found hardcoded English in `ReviewQueueView.tsx`.

- Decision: Require each agent to maintain a gap inventory before and during remediation.
  - Rationale: The team needs a single source of truth for what was found, what was fixed, and what remains.

- Decision: Pair code audit with verification tooling and manual smoke coverage.
  - Rationale: Locale-key parity alone does not catch untranslated literals, formatted English fragments, or review-flow regressions.

## Agent Ownership
- Agent 1: Review, queue, quick-review widgets, flashcard/review session flows, and mobile review surfaces.
- Agent 2: Navigation, layouts, toolbar, onboarding, shared dialogs, and common reusable components.
- Agent 3: Settings, integrations, import/export, sync, AI, TTS, and media-management panels.
- Agent 4: Documents, readers/viewers, search, analytics, dashboard, browser, and knowledge graph surfaces.
- Agent 5: Locale dictionaries, regression tests, static audit scripts/checks, cross-locale smoke matrix, and consolidation of findings from Agents 1-4.

## Verification Contract
- Every agent must report:
  - file path
  - hardcoded or missing string
  - expected translation key or reason a new key is needed
  - impacted locale(s)
  - fix status
- Agent 5 must consolidate those reports into a single closure checklist and verify:
  - no remaining known hardcoded user-facing English in owned surfaces
  - locale dictionaries remain key-complete
  - Review View renders without English leaks in Chinese and the other supported locales

## Risks / Trade-offs
- Risk: Agents may overlap in shared components.
  - Mitigation: Shared infrastructure and locale/test ownership stay with Agent 5; feature agents change only their assigned product surfaces.

- Risk: Static scanning may produce false positives for developer-only strings or data labels.
  - Mitigation: Findings must be triaged into user-facing vs non-user-facing before remediation.

- Risk: Locale parity can regress while fixes are landing.
  - Mitigation: Keep dictionary updates and coverage checks in the same workstream as UI fixes, with Agent 5 owning final validation.

## Open Questions
- Whether the audit inventory should live only in implementation notes or as a checked-in artifact under `docs/`.
- Whether a lightweight lint or script should be added to flag suspicious hardcoded JSX strings in review-critical components.
