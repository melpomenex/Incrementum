## ADDED Requirements

### Requirement: Language Selector
The settings page SHALL provide a language selector that allows users to choose from all supported interface languages. The selector MUST display each language in its native name (e.g., "English", "中文", "Español", "Deutsch", "Français", "日本語").

#### Scenario: User selects a new language
- **WHEN** a user opens Settings and selects a different language from the dropdown
- **THEN** the entire interface updates immediately to display text in the selected language
- **AND** the selection persists across app restarts

#### Scenario: Language fallback for missing translations
- **WHEN** a user selects a language that does not have a translation for a particular key
- **THEN** the English translation for that key is displayed
- **AND** no broken or missing text is shown

#### Scenario: Language selector is consistent
- **WHEN** a user views the language setting on any settings page variant
- **THEN** the language selector is presented as a dropdown with native language names
- **AND** not as a free-text input
