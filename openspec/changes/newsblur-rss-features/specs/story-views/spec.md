## ADDED Requirements

### Requirement: Feed view mode
The system SHALL provide a default "Feed" view mode that renders article content from the RSS feed data (title, description, summary) without fetching the original site.

#### Scenario: View article in Feed mode
- **WHEN** user selects an article while "Feed" view is active
- **THEN** the reader panel displays the article title, author, date, and RSS description/summary content

### Requirement: Original view mode
The system SHALL provide an "Original" view mode that renders the original source website inline within the reader panel.

#### Scenario: View article in Original mode
- **WHEN** user selects an article while "Original" view is active
- **THEN** the reader panel embeds the article's source URL in an iframe or equivalent webview
- **AND** the embedded page retains its original styling and layout

#### Scenario: Original view fallback for blocked sites
- **WHEN** the source site blocks iframe embedding via X-Frame-Options or CSP
- **THEN** the system displays a "Open in browser" button that opens the URL in the system default browser

### Requirement: Text view mode
The system SHALL provide a "Text" view mode that displays extracted full article text with clean formatting, stripped of site navigation, ads, and clutter.

#### Scenario: View article in Text mode
- **WHEN** user selects an article while "Text" view is active
- **THEN** the system fetches the full article HTML from the source URL
- **AND** extracts the main content using text extraction logic
- **AND** renders clean text with preserved paragraphs, headings, and basic formatting
- **AND** removes navigation, sidebars, footers, ads, and non-content elements

#### Scenario: Text view with cached content
- **WHEN** the article's full content was previously fetched and cached
- **THEN** the system displays the cached content without re-fetching
- **AND** shows the cache timestamp

### Requirement: Story view mode
The system SHALL provide a "Story" view mode that presents articles one at a time in a focused reading layout with minimal UI chrome.

#### Scenario: View article in Story mode
- **WHEN** user selects an article while "Story" view is active
- **THEN** the article is displayed in a single-column, centered layout optimized for reading
- **AND** navigation arrows or keyboard shortcuts allow moving to the next/previous article
- **AND** the story list sidebar is hidden or minimized

### Requirement: Per-feed view mode preference
The system SHALL allow users to set a default view mode per feed. When a feed is selected, articles from that feed open in the feed's preferred view mode.

#### Scenario: Set view mode for a feed
- **WHEN** user opens feed settings and selects "Default View: Text"
- **THEN** all articles from that feed open in Text view mode
- **AND** the preference persists across sessions

#### Scenario: Override per-feed view mode
- **WHEN** user manually switches view mode while reading an article
- **THEN** the current session uses the manually selected view mode
- **AND** the feed's default view mode remains unchanged for future sessions

### Requirement: View mode switcher
The system SHALL provide a view mode switcher in the reader panel toolbar allowing quick switching between Feed, Original, Text, and Story modes.

#### Scenario: Switch view mode
- **WHEN** user clicks the view mode switcher and selects a different mode
- **THEN** the current article re-renders in the selected view mode
- **AND** the selection is reflected in the toolbar

### Requirement: Temporary view mode activation via keyboard
The system SHALL support temporary view mode activation: holding a modifier key to temporarily switch view mode for the current article only.

#### Scenario: Temporarily open in Text view
- **WHEN** user presses Shift+Enter on an article
- **THEN** the article opens in Text view mode for this viewing only
- **AND** the next article returns to the default view mode
