## ADDED Requirements

### Requirement: Duplicate story detection
The system SHALL detect near-duplicate articles across different feeds based on title similarity. Articles with highly similar titles published within a time window MUST be grouped as duplicates.

#### Scenario: Duplicate cluster display
- **WHEN** two or more articles have titles with >0.85 trigram similarity and were published within ±2 days of each other
- **THEN** the system groups them as a duplicate cluster
- **AND** displays a "Duplicate" pill on each article in the cluster
- **AND** shows the cluster size count on the primary (earliest-published) article

#### Scenario: Collapse duplicate cluster
- **WHEN** user clicks "Collapse duplicates" or the duplicate pill
- **THEN** only the primary article is displayed in the story list
- **AND** a collapsed cluster indicator shows the count of hidden duplicates
- **AND** clicking the indicator expands all articles in the cluster

### Requirement: Related story detection
The system SHALL detect topically related articles across feeds based on title similarity at a lower threshold than duplicate detection.

#### Scenario: Related story display
- **WHEN** articles have titles with >0.6 trigram similarity but below the duplicate threshold, and were published within ±3 days
- **THEN** the system groups them as related stories
- **AND** displays a "Related" pill on each article in the related group

#### Scenario: View related stories
- **WHEN** user clicks the "Related" pill on an article
- **THEN** the system shows a panel listing all related articles with their source feed and publish date

### Requirement: Cluster computation timing
The system SHALL compute clusters at query time when articles are loaded, not as a background job. Clustering MUST operate only on the currently visible set of articles (respecting pagination and filters).

#### Scenario: Cluster on article load
- **WHEN** user loads a feed or folder view
- **THEN** the system computes clusters among the loaded articles (first page or visible batch)
- **AND** cluster pills are displayed without visible delay

### Requirement: Cluster persistence
The system SHALL persist computed clusters in a SQLite table to avoid recomputation on repeated views. Clusters MUST be invalidated when new articles are fetched for the involved feeds.

#### Scenario: Cache cluster results
- **WHEN** clusters are computed for a set of articles
- **THEN** the cluster relationships are stored in the `rss_story_clusters` table
- **AND** subsequent views of the same articles use cached cluster data

#### Scenario: Invalidate clusters on feed refresh
- **WHEN** new articles are fetched for a feed
- **THEN** all clusters involving articles from that feed are deleted
- **AND** clusters are recomputed on next view
