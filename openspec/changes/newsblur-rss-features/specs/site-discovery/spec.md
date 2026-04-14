## ADDED Requirements

### Requirement: Discover related sites
The system SHALL provide a "Discover Sites" feature that suggests feeds related to the user's existing subscriptions, based on shared categories, tags, and outbound link analysis.

#### Scenario: Browse discovered sites
- **WHEN** user opens the Discover Sites panel
- **THEN** the system displays an infinite-scroll grid of suggested sites
- **AND** each site card shows the site title, description, and up to 5 recent article headlines
- **AND** a "Subscribe" button allows immediate subscription

#### Scenario: Discover by feed category
- **WHEN** user is viewing a feed with category "Technology"
- **THEN** the Discover panel prioritizes sites also categorized as "Technology"
- **AND** sorts by relevance to the user's existing Technology subscriptions

### Requirement: Outbound link RSS discovery
The system SHALL analyze outbound links in recent articles and attempt RSS auto-discovery on linked domains. Discovered feeds are cached and presented as discovery suggestions.

#### Scenario: Discover feeds from article links
- **WHEN** a background task scans recent articles for outbound links
- **THEN** for each unique domain, the system fetches the homepage and checks for RSS/Atom feed links
- **AND** discovered feeds are stored in the `rss_discovered_sites` table with the source article as the similarity origin

#### Scenario: Filter already-subscribed sites
- **WHEN** discovered sites are displayed
- **THEN** sites the user is already subscribed to are marked "Subscribed" with the subscribe button disabled or hidden

### Requirement: Subscribe from discovery
The system SHALL allow one-click subscription to any discovered site directly from the discovery panel.

#### Scenario: Subscribe to discovered site
- **WHEN** user clicks "Subscribe" on a discovered site card
- **THEN** the system adds the feed using the discovered RSS URL
- **AND** the button changes to "Subscribed"
- **AND** the feed appears in the sidebar under its category or the default folder

### Requirement: Discovery statistics
The system SHALL display statistics for discovered sites: estimated update frequency, article count, and subscriber overlap with the user's subscriptions.

#### Scenario: View site statistics
- **WHEN** user clicks on a discovered site card (not the subscribe button)
- **THEN** a statistics dialog shows the site's estimated publish frequency, number of available articles, and which of the user's subscriptions share categories with this site

### Requirement: Discovery refresh control
The system SHALL allow users to manually trigger discovery refresh and configure automatic refresh interval.

#### Scenario: Manual discovery refresh
- **WHEN** user clicks "Refresh Discoveries" in the Discover panel
- **THEN** the system re-scans recent articles for outbound links and attempts RSS discovery
- **AND** new discoveries are merged with existing ones (no duplicates)
