## ADDED Requirements

### Requirement: Summary cache stores content and metadata

The system SHALL cache generated summaries with their content, timestamp, and generation parameters.

#### Scenario: Cache summary after generation

- **WHEN** a summary is successfully generated
- **THEN** the system SHALL store in cache: content, timestamp, length parameter, and focus parameter
- **AND** the cache key SHALL be based on article ID and content hash

#### Scenario: Cache retrieval on panel open

- **WHEN** the user opens the summary panel for an article
- **AND** a valid cached summary exists
- **THEN** the system SHALL display the cached summary immediately without API call
- **AND** the panel SHALL indicate the cached status (timestamp shown in footer)

#### Scenario: Cache structure

- **GIVEN** a cache entry
- **THEN** it SHALL contain: `content` (string), `timestamp` (ISO8601), `length` (enum), `focus` (enum), `contentHash` (string)

### Requirement: Summary cache respects TTL

The system SHALL invalidate cached summaries after 7 days.

#### Scenario: Cache entry older than 7 days

- **WHEN** a cached summary is retrieved
- **AND** the timestamp is older than 7 days
- **THEN** the cache entry SHALL be considered invalid
- **AND** the system SHALL trigger a new generation

#### Scenario: Cache entry within 7 days

- **WHEN** a cached summary is retrieved
- **AND** the timestamp is within 7 days
- **THEN** the cache entry SHALL be considered valid
- **AND** the cached summary SHALL be displayed

### Requirement: Summary cache persists across sessions

The system SHALL persist the summary cache to localStorage for cross-session availability.

#### Scenario: Cache persists after browser close

- **GIVEN** a user has generated summaries in a session
- **WHEN** the browser is closed and reopened
- **THEN** the cached summaries SHALL still be available from localStorage

#### Scenario: Cache loads on app start

- **WHEN** the application initializes
- **THEN** the system SHALL load cached summaries from localStorage into memory
- **AND** expired entries SHALL be purged during loading

#### Scenario: Cache size limits

- **WHEN** the cache exceeds 100 entries
- **THEN** the oldest entries (by timestamp) SHALL be evicted
- **AND** a maximum of 100 entries SHALL be maintained

### Requirement: Cache invalidation on content change

The system SHALL invalidate cache entries if article content changes.

#### Scenario: Content hash mismatch

- **GIVEN** a cached summary with content hash
- **WHEN** the current article content hash differs from the cached hash
- **THEN** the cache entry SHALL be invalidated
- **AND** a new summary SHALL be generated

#### Scenario: Content hash generation

- **WHEN** caching a summary
- **THEN** the system SHALL compute a hash of the article content
- **AND** the hash SHALL be stored with the cache entry

### Requirement: Manual cache refresh

The system SHALL provide a refresh button to regenerate and update the cached summary.

#### Scenario: User clicks refresh

- **GIVEN** a cached summary is displayed
- **WHEN** the user clicks the refresh button
- **THEN** the system SHALL generate a new summary with current parameters
- **AND** the cache SHALL be updated with the new content and timestamp

#### Scenario: Refresh with loading state

- **WHEN** the user clicks refresh
- **THEN** the existing summary SHALL remain visible with a loading overlay
- **AND** the new summary SHALL replace the old one when generation completes
