# Change: Complete App Internationalization

## Why
The app has a custom i18n system supporting 6 locales (en, zh, es, de, fr, ja), but only English and Chinese have full translation coverage (~115 keys). The remaining 4 languages cover only nav and review keys (~28 keys each). Additionally, an estimated 700-800+ hardcoded English strings exist across pages, settings components, onboarding, toasts, alerts, confirms, placeholders, and tooltips. Users selecting a non-English/Chinese language see a partially translated interface.

## What Changes
- Add missing translation keys for all 6 languages to achieve full coverage
- Extract all hardcoded user-facing strings into the i18n translation system
- Unify the language selector to a consistent dropdown across all settings pages
- Ensure language change applies immediately across the entire app without page reload
- Add i18n coverage tests to prevent regression

## Impact
- Affected specs: none (new capability)
- Affected code: `src/lib/i18n.ts`, `src/pages/SettingsPage.tsx`, `src/components/settings/SettingsPage.tsx`, `src/App.tsx`, `src/components/onboarding/`, `src/components/common/EmptyState.tsx`, `src/components/Toolbar.tsx`, `src/components/settings/*.tsx`, `src/pages/*.tsx`, `src/routes/*.tsx`, and ~40+ additional component files containing hardcoded strings
