## ADDED Requirements

### Requirement: Full-text search across all feeds
The system SHALL provide full-text search across all subscribed feeds, searching article titles, content, and author names.

#### Scenario: Search all feeds
- **WHEN** user enters a search query in the search input with no feed or folder selected
- **THEN** the system searches all articles across all feeds using FTS5
- **AND** results are ranked by relevance (BM25)
- **AND** each result shows the article title, source feed, publish date, and a content snippet with the query highlighted

### Requirement: Search within a single feed
The system SHALL support searching within a specific feed when a feed is selected.

#### Scenario: Search within a feed
- **WHEN** user has a feed selected and enters a search query
- **THEN** results are limited to articles from the selected feed only
- **AND** results are ranked by relevance within that feed

### Requirement: Search within a folder
The system SHALL support searching within a folder when a folder is selected.

#### Scenario: Search within a folder
- **WHEN** user has a folder selected and enters a search query
- **THEN** results include articles from all feeds within that folder
- **AND** each result shows its source feed name

### Requirement: Search saved stories
The system SHALL support searching within saved/starred articles.

#### Scenario: Search saved stories
- **WHEN** user is in the saved stories view and enters a search query
- **THEN** only saved articles matching the query are displayed

### Requirement: Search result highlighting
The system SHALL highlight matching terms in search results with configurable snippet length.

#### Scenario: Highlighted snippet
- **WHEN** a search result is displayed
- **THEN** the matched terms in the title and content snippet are wrapped in a highlight element
- **AND** the snippet shows approximately 100 characters of context around each match

### Requirement: Search performance
The system SHALL return search results within 500ms for personal-scale datasets (up to 100,000 articles).

#### Scenario: Fast search response
- **WHEN** user submits a search query
- **THEN** results begin rendering within 500ms
- **AND** the FTS5 index is used (not a table scan)

### Requirement: FTS5 index synchronization
The system SHALL keep the FTS5 full-text index synchronized with the `rss_articles` table. All inserts, updates, and deletes on articles MUST be reflected in the index.

#### Scenario: Index updated on article insert
- **WHEN** a new article is inserted into `rss_articles`
- **THEN** the corresponding row is inserted into `rss_articles_fts`

#### Scenario: Index updated on article delete
- **WHEN** an article is deleted from `rss_articles`
- **THEN** the corresponding row is deleted from `rss_articles_fts`
