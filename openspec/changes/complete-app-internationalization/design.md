## Context
The app uses a hand-rolled i18n system in `src/lib/i18n.ts` with inline dictionaries per locale. No external i18n library is used, and no JSON translation files exist. The current architecture is:

- `SupportedLocale` type: `"en" | "zh" | "es" | "de" | "fr" | "ja"`
- Translation dictionaries defined as `const` objects within `i18n.ts`
- `useI18n()` React hook reads from Zustand `settingsStore.general.language`
- `t(key, vars?)` standalone function for non-React contexts
- Fallback chain: current locale -> English -> raw key string
- Interpolation via `{variableName}` pattern

Two competing settings pages exist:
- `src/pages/SettingsPage.tsx` (route target) — language is a text input
- `src/components/settings/SettingsPage.tsx` (not currently routed) — language is a proper dropdown

## Goals / Non-Goals
- Goals:
  - All user-facing strings use `t()` / `useI18n()` — zero hardcoded English in UI
  - All 6 locales have complete translation coverage
  - Language selector is a clear, consistent dropdown showing native language names
  - Language changes apply immediately (no reload needed)
- Non-Goals:
  - Adding new languages beyond the existing 6
  - RTL (right-to-left) layout support
  - Externalizing translations to JSON files (keep inline dictionaries for now — the current approach is simple and works)
  - Pluralization rules beyond the existing simple interpolation
  - Date/number/currency locale formatting
  - Browser language auto-detection

## Decisions

### 1. Keep inline dictionaries, don't switch to JSON files
- **Rationale**: The current inline-dictionary approach is simple, type-safe, and easy to maintain. With ~800 keys total, the file size is manageable. Moving to JSON adds complexity (async loading, separate file management, build pipeline changes) without clear benefit at this scale.
- **Alternatives considered**: JSON translation files with lazy loading; i18next library

### 2. Split translation dictionaries into separate locale files
- **Rationale**: `i18n.ts` will grow from ~440 lines to ~5000+ lines with full coverage. Split into `src/lib/i18n/locales/en.ts`, `zh.ts`, `es.ts`, etc. to keep files manageable and allow translators to work on one file per language.
- **Structure**: `src/lib/i18n/index.ts` (re-exports `useI18n`, `t`, types) + `src/lib/i18n/locales/*.ts`

### 3. Single consistent language dropdown
- **Rationale**: Both settings pages should show the same dropdown with native language names (e.g., "English", "中文", "Español"). The pages/SettingsPage.tsx text input is confusing and error-prone.

### 4. Prioritized translation work
- Phase 1: Extract all hardcoded strings into keys with English values (functional equivalence)
- Phase 2: Add Chinese translations (largest non-English user base)
- Phase 3: Add Spanish, German, French, Japanese translations
- Missing translations fall back to English automatically (existing behavior)

## Risks / Trade-offs
- **Volume of changes**: ~40+ files need modification. Risk of merge conflicts with active work.
  - Mitigation: Tasks are ordered by file, grouped by area. Each task is independently committable.
- **Translation quality**: Non-English translations need native speaker review.
  - Mitigation: Use the existing fallback chain; incomplete translations show English rather than broken text.
- **Maintenance burden**: Every new UI string must be added to 6 dictionaries.
  - Mitigation: Missing keys fall back to English gracefully. Tests can flag missing keys per locale.

## Open Questions
- Should the language selector also appear somewhere accessible outside settings (e.g., in a user menu or toolbar)? Currently it's only in settings.
