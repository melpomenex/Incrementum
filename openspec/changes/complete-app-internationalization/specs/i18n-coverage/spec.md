## ADDED Requirements

### Requirement: Full Translation Coverage
All user-facing strings in the application SHALL use the i18n translation system (`useI18n()` or `t()`) rather than hardcoded text. No user-visible English text SHALL be hardcoded in component JSX, placeholders, tooltips, toast messages, alert/confirm dialogs, or onboarding screens.

#### Scenario: All UI text is translatable
- **WHEN** a user switches to any supported language
- **THEN** all navigation labels, page titles, button text, form labels, placeholders, tooltips, toast notifications, confirmation dialogs, onboarding copy, and empty-state messages display in the selected language (with English fallback for any missing keys)

#### Scenario: Settings components are translated
- **WHEN** a user views any settings section
- **THEN** section titles, descriptions, option labels, button text, placeholder text, and validation messages display in the selected language

#### Scenario: Onboarding flow is translated
- **WHEN** a new user completes the onboarding flow with a non-English language selected
- **THEN** all welcome text, option descriptions, tutorial steps, and call-to-action buttons display in the selected language

### Requirement: Translation Completeness Verification
The project SHALL include tests that verify each supported locale has translations for all defined translation keys, preventing accidental coverage gaps.

#### Scenario: Missing key detected
- **WHEN** a new translation key is added to the English dictionary but not to another locale's dictionary
- **THEN** the test suite SHALL fail with a message indicating which locale is missing which key(s)
