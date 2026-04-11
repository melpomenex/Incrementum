# Change: Add Five-Agent Localization Audit for Review and App Coverage

## Why
The existing `complete-app-internationalization` change established broad locale coverage, but the current codebase still exposes untranslated or hardcoded English strings in user-facing surfaces. The Review View is an immediate example: [ReviewQueueView.tsx](/home/ubuntu/Code/incrementum-tauri/src/components/review/ReviewQueueView.tsx:955) still renders an English-only next-review tooltip, and [ReviewQueueView.tsx](/home/ubuntu/Code/incrementum-tauri/src/components/review/ReviewQueueView.tsx:1105) hardcodes `Reading → Extract → Cloze → Review`.

The current test suite verifies locale key parity, but it does not verify that every user-visible string is actually routed through `t()`/`useI18n()`, nor that each supported locale renders complete flows without fallback leaks. A structured multi-agent audit is needed to close the gap between dictionary completeness and real UI completeness.

## What Changes
- Define a five-agent audit and remediation workflow for internationalization coverage across the app.
- Prioritize Review and Queue surfaces first, then fan out across remaining product areas with explicit ownership boundaries.
- Require each agent to produce a translation-gap inventory with file references, affected locale(s), string samples, and remediation status.
- Add stronger verification for hardcoded user-facing strings, locale parity, and manual smoke coverage across `en`, `zh`, `es`, `de`, `fr`, and `ja`.
- Treat observed Review View defects as baseline acceptance criteria for this change, not optional follow-up cleanup.

## Impact
- Affected specs: `i18n-coverage`
- Affected code: `src/components/review/`, `src/components/mobile/`, `src/components/layout/`, `src/components/common/`, `src/components/settings/`, `src/pages/`, `src/routes/`, `src/lib/i18n/locales/*.ts`, `src/lib/__tests__/i18n.test.ts`
