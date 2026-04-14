## ADDED Requirements

### Requirement: Magazine view layout
The system SHALL provide a "Magazine" layout mode that displays articles in a 2-column masonry-style grid with large thumbnail images and prominent titles.

#### Scenario: Enable magazine layout
- **WHEN** user selects "Magazine" from the layout options in the customization panel
- **THEN** articles are displayed in a 2-column layout with large card heights
- **AND** each card shows: thumbnail image (top), title (large font), excerpt (2-3 lines), source feed name, publish date
- **AND** cards have varying heights based on content length (masonry effect)

### Requirement: Grid view layout
The system SHALL provide a "Grid" layout mode that displays articles in a uniform multi-column grid with thumbnail images.

#### Scenario: Enable grid layout
- **WHEN** user selects "Grid" from the layout options
- **THEN** articles are displayed in a 3-4 column uniform grid
- **AND** each card shows: thumbnail image, title (1-2 lines), source feed, publish date
- **AND** all cards have equal height

### Requirement: Configurable column count
The system SHALL allow users to configure the number of columns for magazine and grid layouts.

#### Scenario: Change column count
- **WHEN** user adjusts the column count slider (range: 1-6)
- **THEN** the article grid updates to the selected number of columns
- **AND** the layout remains responsive (cards reflow)

### Requirement: Configurable card height
The system SHALL allow users to configure the card height for grid and magazine layouts.

#### Scenario: Compact cards
- **WHEN** user selects "Compact" card height
- **THEN** cards show only thumbnail, title (1 line), and source feed
- **AND** more articles are visible in the viewport

#### Scenario: Tall cards
- **WHEN** user selects "Tall" card height
- **THEN** cards show thumbnail, title, full excerpt, author, date, and source feed
- **AND** fewer articles fit in the viewport but more information is visible per card

### Requirement: Per-feed layout preference
The system SHALL allow users to set a default layout per feed. When a feed is selected, its articles display in the feed's preferred layout.

#### Scenario: Set layout for a feed
- **WHEN** user opens feed settings and selects "Default Layout: Magazine"
- **THEN** articles from that feed always display in magazine layout when the feed is selected
- **AND** the preference persists across sessions

#### Scenario: Global layout override
- **WHEN** no per-feed layout is set
- **THEN** the global layout preference is used
- **AND** changing the global layout affects all feeds without per-feed overrides

### Requirement: Thumbnail display options
The system SHALL allow users to configure thumbnail display: show/hide, position (left/top), and size.

#### Scenario: Hide thumbnails
- **WHEN** user disables "Show thumbnails" in the display settings
- **THEN** all layout modes hide article thumbnails and show a placeholder icon or no image

#### Scenario: Thumbnail position
- **WHEN** user selects "Left" thumbnail position
- **THEN** in list and compact modes, thumbnails appear to the left of the article title
- **AND** in grid and magazine modes, thumbnails appear at the top of the card regardless (position setting applies only to list-like layouts)

### Requirement: Layout transitions
The system SHALL animate layout transitions smoothly when switching between layout modes.

#### Scenario: Switch layout with animation
- **WHEN** user switches from list to magazine layout
- **THEN** articles transition smoothly to the new layout using CSS transitions
- **AND** no flickering or layout jump occurs
