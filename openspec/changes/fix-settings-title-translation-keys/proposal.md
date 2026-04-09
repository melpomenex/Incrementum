# fix-settings-title-translation-keys

## Summary

Fix Settings menu titles that display raw `t("key")` translation function calls as literal text instead of invoking the translation function. The root cause is missing JSX curly braces — `>t("key")<` renders as the string literal `t("key")` instead of the translated label.

## Problem

Multiple settings components render translation keys as plain text instead of invoking the `t()` function. For example:

```tsx
// BROKEN — renders literal text "t("syncSettings.title")"
<h2>t("syncSettings.title")</h2>

// CORRECT — renders "Sync Settings" (or translated equivalent)
<h2>{t("syncSettings.title")}</h2>
```

This affects the **SyncSettings** component (active, user-facing) and five additional components (currently unused but would break if activated).

## Scope

**Active (user-facing, imported by `src/pages/SettingsPage.tsx`):**
- `src/components/settings/SyncSettings.tsx` — 22 instances

**Unused but affected (imported by unused `src/components/settings/SettingsPage.tsx`):**
- `src/components/settings/LearningSettings.tsx` — 9 instances
- `src/components/settings/LLMProviderSettings.tsx` — 8 instances
- `src/components/settings/OCRSettings.tsx` — 15 instances
- `src/components/settings/NotificationSettings.tsx` — 19 instances
- `src/components/settings/CloudStorageSettings.tsx` — 4 instances

## Approach

Wrap all raw `t("...")` text nodes in JSX curly braces: `>t("key")<` → `>{t("key")}<`. No logic changes, no new translations, no structural refactors — purely a syntax fix.

## Related

- Part of the `complete-app-internationalization` change (i18n-coverage spec)
- All required translation keys already exist in `src/lib/i18n/locales/en.ts` and other locale files
