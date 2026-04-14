## ADDED Requirements

### Requirement: Global keyboard shortcut registry
The system SHALL maintain a registry of keyboard shortcuts for all RSS reader actions. Shortcuts MUST be defined as key combinations mapping to action strings.

#### Scenario: Default shortcuts loaded
- **WHEN** the RSS reader initializes
- **THEN** the default keyboard shortcut mapping is loaded from built-in defaults
- **AND** user-customized overrides from preferences are applied on top

### Requirement: Feed navigation shortcuts
The system SHALL support keyboard shortcuts for navigating feeds: move to next/previous feed, expand/collapse folders, jump to feed by first letter.

#### Scenario: Navigate feeds
- **WHEN** user presses the "next feed" shortcut (default: `j` or `↓`)
- **THEN** the selection moves to the next feed in the sidebar
- **AND** the article list updates to show articles from the newly selected feed

#### Scenario: Jump to folder
- **WHEN** user presses `Shift+letter` matching a folder's first letter
- **THEN** the sidebar scrolls to and selects the matching folder

### Requirement: Article navigation shortcuts
The system SHALL support keyboard shortcuts for navigating articles: next/previous article, scroll within article, open article in new tab.

#### Scenario: Navigate articles
- **WHEN** user presses the "next article" shortcut (default: `n`)
- **THEN** the selection moves to the next article in the story list
- **AND** the article is marked as read

#### Scenario: Open article link
- **WHEN** user presses the "open original" shortcut (default: `o`)
- **THEN** the article's source URL opens in the system default browser

### Requirement: Action shortcuts
The system SHALL support keyboard shortcuts for article actions: mark read/unread, save/star, share, train like/dislike, toggle view mode.

#### Scenario: Mark article read
- **WHEN** user presses the "mark read" shortcut (default: `m`)
- **THEN** the current article is marked as read
- **AND** the next unread article is selected

#### Scenario: Star article
- **WHEN** user presses the "star" shortcut (default: `s`)
- **THEN** the current article is saved/starred
- **AND** a star indicator appears on the article

#### Scenario: Train article
- **WHEN** user presses the "train like" shortcut (default: `+`) or "train dislike" shortcut (default: `-`)
- **THEN** the current article's top classifier (author or first tag) is set to liked or disliked respectively

### Requirement: Search shortcut
The system SHALL support a keyboard shortcut to focus the search input.

#### Scenario: Focus search
- **WHEN** user presses the "search" shortcut (default: `/`)
- **THEN** the search input is focused and any existing text is selected
- **AND** typing begins a new search query

### Requirement: Keyboard shortcut help overlay
The system SHALL display a keyboard shortcut reference overlay when the user presses `?`.

#### Scenario: Display help overlay
- **WHEN** user presses `?`
- **THEN** a modal overlay displays all keyboard shortcuts organized by category (Navigation, Actions, View, Training)
- **AND** each shortcut shows the key combination and action description
- **AND** pressing `?` or `Escape` dismisses the overlay

### Requirement: Customizable keyboard shortcuts
The system SHALL allow users to customize keyboard shortcuts through a preferences panel.

#### Scenario: Customize a shortcut
- **WHEN** user opens Keyboard Shortcuts preferences and clicks "Edit" on a shortcut
- **THEN** the system enters a capture mode where the next key combination is recorded as the new binding
- **AND** the new binding is validated for conflicts with existing shortcuts
- **AND** conflicts are flagged with a warning and the user must resolve them before saving

#### Scenario: Reset shortcuts to defaults
- **WHEN** user clicks "Reset to defaults" in Keyboard Shortcuts preferences
- **THEN** all shortcuts are restored to their built-in default values
- **AND** user-customized overrides are deleted

### Requirement: Shortcut persistence
The system SHALL persist user-customized keyboard shortcuts in the preferences system.

#### Scenario: Shortcuts survive restart
- **WHEN** the application is restarted
- **THEN** user-customized keyboard shortcuts are loaded from preferences and applied
