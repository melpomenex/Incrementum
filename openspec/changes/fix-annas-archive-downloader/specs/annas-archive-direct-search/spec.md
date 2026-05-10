## ADDED Requirements

### Requirement: Direct Anna's Archive Search
The system SHALL provide a search interface that queries Anna's Archive mirrors directly to retrieve book metadata from its comprehensive database of 60M+ titles.

#### Scenario: Successful search with results
- **WHEN** a user enters a search query in the Anna's Archive search panel
- **THEN** the system SHALL query an active Anna's Archive mirror (e.g., annas-archive.org)
- **AND** the system SHALL parse the HTML response to extract book titles, authors, formats, and MD5 hashes
- **AND** the system SHALL display the results to the user with their respective metadata

#### Scenario: No results found
- **WHEN** a search query returns no matches on Anna's Archive
- **THEN** the system SHALL display a "No results found" message to the user

#### Scenario: Mirror unreachable
- **WHEN** the primary Anna's Archive mirror is unreachable or blocked
- **THEN** the system SHALL attempt to query fallback mirrors in sequence
- **AND** if all mirrors fail, the system SHALL display an error message suggesting the user check their connection or use a VPN
