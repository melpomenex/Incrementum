## ADDED Requirements

### Requirement: Display article progress indicator

The system SHALL display a visual progress indicator showing the user's position within the scroll mode reading session.

#### Scenario: Show floating progress bar

- **WHEN** the user enters scroll mode
- **THEN** the system SHALL display a floating progress bar at the top of the screen
- **AND** show the current position as a percentage or fraction
- **AND** update it in real-time as the user scrolls

#### Scenario: Article counter display

- **WHEN** the user is viewing an article in scroll mode
- **THEN** the system SHALL display an article counter (e.g., "3 of 24")
- **AND** update it when the user navigates to a different article

#### Scenario: Quick seek via progress bar

- **WHEN** the user clicks or drags the progress bar
- **THEN** the system SHALL jump to the corresponding position in the article list
- **AND** animate the transition smoothly

### Requirement: Enhanced navigation gestures

The system SHALL support intuitive touch and mouse gestures for navigating between articles in scroll mode.

#### Scenario: Swipe to next article

- **WHEN** the user swipes up on a touch device
- **THEN** the system SHALL navigate to the next article
- **AND** animate the transition with a slide effect
- **AND** provide haptic feedback if available

#### Scenario: Swipe to previous article

- **WHEN** the user swipes down on a touch device
- **THEN** the system SHALL navigate to the previous article
- **AND** animate the transition with a slide effect

#### Scenario: Mouse wheel navigation

- **WHEN** the user scrolls with the mouse wheel beyond article boundaries
- **THEN** the system SHALL navigate to the next/previous article
- **AND** require a threshold to prevent accidental navigation

#### Scenario: Keyboard navigation

- **WHEN** the user presses arrow keys or spacebar
- **THEN** the system SHALL navigate between articles
- **AND** scroll within long articles before navigating to next

### Requirement: Quick navigation actions

The system SHALL provide quick navigation actions for efficient reading in scroll mode.

#### Scenario: Jump to specific article index

- **WHEN** the user activates the jump-to-index feature
- **THEN** the system SHALL display an input for article number
- **AND** navigate directly to that article when confirmed

#### Scenario: Mark all as read action

- **WHEN** the user activates the mark-all-read action
- **THEN** the system SHALL mark all articles in the current view as read
- **AND** show a confirmation toast with undo option
- **AND** update the unread counts in the feed list

#### Scenario: Quick favorite action

- **WHEN** the user clicks the favorite action while in scroll mode
- **THEN** the system SHALL toggle the favorite status of the current article
- **AND** show visual feedback (animated star)
- **AND** display a toast confirmation

### Requirement: Article context overlay

The system SHALL provide contextual information about the current article without leaving scroll mode.

#### Scenario: Show article metadata overlay

- **WHEN** the user activates the info action or pauses on an article
- **THEN** the system SHALL display an overlay with article metadata
- **AND** include: feed name, publication date, author, word count, reading time
- **AND** allow clicking to open the original source URL

#### Scenario: Full content indicator

- **WHEN** an article has full content available
- **THEN** the system SHALL display an indicator in the scroll view
- **AND** provide a quick action to expand and read the full content
- **AND** allow collapsing back to summary view
