## MODIFIED Requirements

### Requirement: Command palette opens without UI freeze
System SHALL open the command palette modal within 100ms regardless of collection size (up to 10,000 items).
- GIVEN a collection with 3000+ documents and learning items
- WHEN the user opens the command palette (Ctrl+K / Cmd+K)
- THEN the palette modal SHALL render immediately without blocking the main thread
- AND no data fetching SHALL occur before the search input is visible and focused

### Requirement: Extracts loaded lazily for search
System SHALL NOT load all extracts eagerly when the command palette opens.
- GIVEN the command palette is opened
- WHEN the user has not yet typed a query
- THEN extracts SHALL NOT be fetched from the database
- GIVEN the user types a meaningful search query
- WHEN search executes
- THEN extracts MAY be loaded (once, cached) for content matching

### Requirement: Document content extraction deferred
System SHALL NOT trigger document text extraction when the command palette opens.
- GIVEN the command palette is opened
- THEN no `extractDocumentText` calls SHALL be initiated
- GIVEN a search query targets document content
- WHEN a document's content is needed for matching
- THEN content MAY be fetched lazily for that document (with caching)

### Requirement: Search remains responsive during execution
System SHALL keep the UI responsive during search execution on large collections.
- GIVEN a collection with 3000+ items and a search query is executing
- WHEN the search scans documents and extracts
- THEN the search SHALL yield to the main thread periodically
- AND results SHALL update incrementally as they become available
