## MODIFIED Requirements

### Requirement: Anna's Archive Book Search
The system SHALL provide integrated search functionality for Anna's Archive, allowing users to discover books from a database of 60+ million titles without leaving the application.

#### Scenario: User searches for books by title or author
- **GIVEN** the user is on the Documents page or uses the Command Center
- **WHEN** the user enters a search query (title, author, ISBN, or keywords)
- **THEN** the application SHALL query active Anna's Archive mirrors (e.g., annas-archive.org) via direct scraping
- **AND** results SHALL include title, author, year, language, MD5 hash, and available formats
- **AND** results SHALL include cover images when available
- **AND** the search SHALL complete within 10 seconds (allowing for potential mirror rotation)

#### Scenario: Search fallback to mirror domains
- **GIVEN** the primary Anna's Archive domain is unavailable or blocked by anti-bot measures
- **WHEN** a search request fails
- **THEN** the application SHALL attempt fallback mirror domains (e.g., .li, .se, .rs) in sequence
- **AND** the application SHALL maintain a list of known mirror URLs
- **AND** the user SHALL be notified if all mirrors are unavailable or require manual verification (Cloudflare)

### Requirement: Anna's Archive Book Download
The system SHALL allow users to download books directly from Anna's Archive search results and import them into their document library.

#### Scenario: User downloads a book from search results
- **GIVEN** the user has searched for books and found a desired title
- **WHEN** the user clicks the download button for a specific format
- **THEN** the application SHALL attempt to fetch a direct download link or an external mirror link (LibGen, Z-Library)
- **AND** a progress indicator SHALL show download status
- **AND** the downloaded file SHALL be automatically imported into the document library
- **AND** the document metadata (title, author, MD5) SHALL be pre-populated from Anna's Archive data
