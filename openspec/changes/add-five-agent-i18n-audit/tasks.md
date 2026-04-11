## 1. Planning
- [ ] 1.1 Confirm this change as a follow-on to `complete-app-internationalization` rather than expanding that existing change.
- [ ] 1.2 Create a shared translation-gap inventory template for all five agents.
- [ ] 1.3 Document ownership boundaries for Agents 1-5 before any code edits begin.

## 2. Agent 1: Review-First Audit
- [ ] 2.1 Audit `src/components/review/`, review routes, and review-related mobile surfaces for hardcoded user-facing strings.
- [ ] 2.2 Fix the known Review View English leaks, including the next-review tooltip and conversion-pathway copy in `ReviewQueueView.tsx`.
- [ ] 2.3 Add or update locale keys for all review-surface findings across `en`, `zh`, `es`, `de`, `fr`, and `ja`.

## 3. Agents 2-4: Remaining Product Surfaces
- [ ] 3.1 Agent 2 audits layout/navigation/onboarding/common components and remediates findings.
- [ ] 3.2 Agent 3 audits settings/integrations/import-export/AI/media components and remediates findings.
- [ ] 3.3 Agent 4 audits documents/readers/search/analytics/dashboard/browser surfaces and remediates findings.
- [ ] 3.4 Each agent updates the shared gap inventory with file references, locale impact, and fix status.

## 4. Agent 5: Verification and Consolidation
- [ ] 4.1 Re-run and extend locale completeness checks so all supported locales match English keys after remediation.
- [ ] 4.2 Add or update regression coverage for untranslated literals or known review-surface translation leaks where practical.
- [ ] 4.3 Execute a manual smoke matrix covering `en`, `zh`, `es`, `de`, `fr`, and `ja` for nav, review, queue, settings, and onboarding.
- [ ] 4.4 Consolidate all agent findings into a final closure report with any residual gaps called out explicitly.

## 5. Validation
- [ ] 5.1 Run `openspec validate add-five-agent-i18n-audit --strict`.
