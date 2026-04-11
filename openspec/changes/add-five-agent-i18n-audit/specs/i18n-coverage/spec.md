## MODIFIED Requirements

### Requirement: Full Translation Coverage
All user-facing strings in the application SHALL use the i18n translation system (`useI18n()` or `t()`) rather than hardcoded text. No user-visible English text SHALL be hardcoded in component JSX, placeholders, tooltips, toast notifications, confirmation dialogs, onboarding screens, review inspectors, or status badges.

#### Scenario: Review surfaces render in the selected locale
- **WHEN** a user switches the app to Chinese or any other supported locale and opens Review-related surfaces
- **THEN** Review View, Review Queue, quick-review widgets, review inspectors, and review session controls display localized UI copy
- **AND** they do not leak hardcoded English text such as static workflow labels, tooltip fragments, or status descriptions

#### Scenario: Hardcoded translation leaks are tracked and remediated
- **WHEN** the team performs an internationalization audit
- **THEN** each discovered hardcoded user-facing string is recorded with its source file, affected surface, and remediation status
- **AND** the fix routes the string through the translation system or explicitly documents why it is not user-facing

### Requirement: Translation Completeness Verification
The project SHALL include verification that each supported locale has translations for all defined translation keys and that high-risk user flows are checked for untranslated UI copy.

#### Scenario: Missing key detected
- **WHEN** a new translation key is added to the English dictionary but not to another locale's dictionary
- **THEN** the test suite SHALL fail with a message indicating which locale is missing which key(s)

#### Scenario: Review smoke verification detects untranslated text
- **WHEN** a localization pass is completed for review-critical surfaces
- **THEN** a smoke-verification pass checks Review, Queue, Settings, navigation, and onboarding in `en`, `zh`, `es`, `de`, `fr`, and `ja`
- **AND** any remaining untranslated or English-only user-facing strings are logged before the change is considered complete
