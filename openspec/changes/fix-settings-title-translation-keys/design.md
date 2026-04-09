# Design

## Root Cause

In JSX, text between tags is treated as a literal string. To execute a JavaScript expression (like a function call), it must be wrapped in `{}`. Every affected instance follows the same pattern:

```tsx
// Before (broken)
<span>t("some.translation.key")</span>

// After (fixed)
<span>{t("some.translation.key")}</span>
```

## Fix Strategy

A simple find-and-replace per file using the regex `>t\("([^"]+)"\)<` → `>{t("$1")}<`. This is mechanical, zero-risk, and requires no changes to:

- Translation files (all keys already exist)
- Component logic or state
- Props or event handlers
- Styling or layout

## Why Not Fix the Unused Components?

The five unused components (`LearningSettings`, `LLMProviderSettings`, `OCRSettings`, `NotificationSettings`, `CloudStorageSettings`) are only imported by `src/components/settings/SettingsPage.tsx`, which is never imported by the active app. However, fixing them now prevents future breakage when these components are activated and keeps the codebase consistent.

## Verification

After fixing, a simple grep for the pattern `>t("` across the settings directory should return zero results, confirming all instances are resolved.
