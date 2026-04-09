# Capability: i18n-coverage

## MODIFIED Requirements

### Requirement: Settings components SHALL invoke translation function calls, not render them as literal text

All `t("key")` calls in Settings component JSX SHALL be wrapped in curly braces to invoke the translation function. Raw text like `>t("key")<` is a syntax error that renders the function call as a literal string to users.

#### Scenario: SyncSettings titles display translated labels

- **WHEN** a user navigates to Settings > Sync
- **THEN** all section titles, labels, and descriptions display the translated string (e.g., "Sync Settings") instead of the raw translation key literal (e.g., `t("syncSettings.title")`)

#### Scenario: Unused settings components have no raw t() text nodes

- **WHEN** any of the unused settings components (LearningSettings, LLMProviderSettings, OCRSettings, NotificationSettings, CloudStorageSettings) are activated
- **THEN** all translation calls render correctly as translated strings, not as literal `t("key")` text
