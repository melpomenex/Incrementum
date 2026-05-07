## ADDED Requirements

### Requirement: Composite relevance score computation
The system SHALL compute a composite relevance score in the range [0.0, 1.0] for every queue item (document, RSS article, extract) based on four weighted signals: classifier match (0.4), tag affinity (0.25), rating history (0.2), and semantic similarity (0.15).

#### Scenario: Relevance score for item with all signals available
- **WHEN** a queue item has RSS classifier matches, shares tags with recently-rated items, belongs to a source with rating history, and has a computed embedding
- **THEN** the system SHALL compute a composite relevance score using the weighted formula: `score = 0.4 * classifier + 0.25 * tag_affinity + 0.2 * rating_history + 0.15 * semantic_similarity`
- **AND** the result SHALL be clamped to [0.0, 1.0]

#### Scenario: Relevance score for item with partial signals
- **WHEN** a queue item is missing one or more signals (e.g., no embedding computed, no classifier matches)
- **THEN** the system SHALL redistribute the missing signal's weight proportionally among the available signals
- **AND** compute the composite score from only the available signals

#### Scenario: Relevance score for brand new item with no signals
- **WHEN** a queue item has no classifier matches, no tag overlap with rated items, no source rating history, and no embedding
- **THEN** the system SHALL assign a neutral relevance score of 0.5

### Requirement: Classifier match signal
The system SHALL compute a classifier match signal by evaluating the item's metadata (author, tags, title keywords) against existing RSS classifiers with like/dislike sentiment.

#### Scenario: Item matches liked classifiers
- **WHEN** an item's author or tags match one or more classifiers with "like" sentiment
- **THEN** the classifier match signal SHALL be positive (proportional to the number of matches)
- **AND** the signal value SHALL be in [0.0, 1.0]

#### Scenario: Item matches disliked classifiers
- **WHEN** an item's author or tags match one or more classifiers with "dislike" sentiment
- **THEN** the classifier match signal SHALL be negative (proportional to the number of matches)
- **AND** the signal value SHALL be in [-1.0, 0.0]

#### Scenario: Item matches both liked and disliked classifiers
- **WHEN** an item matches both "like" and "dislike" classifiers
- **THEN** the classifier match signal SHALL be the net sum (likes minus dislikes), normalized to [-1.0, 1.0]

### Requirement: Tag affinity signal
The system SHALL compute a tag affinity signal based on the frequency of the item's tags in recently positively-rated content.

#### Scenario: Item tags frequently appear in positive ratings
- **WHEN** the item's tags appear in more than 50% of the last 100 Easy/Good-rated items
- **THEN** the tag affinity signal SHALL be high (approaching 1.0)

#### Scenario: Item tags rarely appear in positive ratings
- **WHEN** the item's tags appear in less than 10% of the last 100 Easy/Good-rated items
- **THEN** the tag affinity signal SHALL be low (approaching 0.0)

#### Scenario: No rating history exists
- **WHEN** the user has fewer than 10 total ratings
- **THEN** the tag affinity signal SHALL be excluded and its weight redistributed

### Requirement: Rating history signal
The system SHALL compute a rating history signal based on the user's past ratings of items from the same source, author, or feed.

#### Scenario: Source has consistently positive ratings
- **WHEN** the item shares a source/author/feed with items that were rated Good or Easy
- **THEN** the rating history signal SHALL be positive (approaching 1.0)

#### Scenario: Source has consistently negative ratings
- **WHEN** the item shares a source/author/feed with items that were rated Again or Hard
- **THEN** the rating history signal SHALL be negative (approaching 0.0)

#### Scenario: No prior ratings from this source
- **WHEN** no items from the same source/author/feed have been rated
- **THEN** the rating history signal SHALL be excluded and its weight redistributed

### Requirement: Semantic similarity signal
The system SHALL compute a semantic similarity signal using cosine similarity between the item's embedding and the centroid of embeddings for recently favorited and high-rated items.

#### Scenario: Item is semantically similar to favorited content
- **WHEN** the item's embedding has high cosine similarity (>0.7) to the centroid of recently favorited item embeddings
- **THEN** the semantic similarity signal SHALL be high (approaching 1.0)

#### Scenario: Item has no embedding
- **WHEN** the item does not have a computed embedding in the vector store
- **THEN** the semantic similarity signal SHALL be excluded and its weight redistributed

### Requirement: Relevance score persistence
The system SHALL persist the computed relevance score and its computation timestamp for each item.

#### Scenario: Score is computed and persisted
- **WHEN** a relevance score is computed for an item
- **THEN** the system SHALL store `relevance_score` (f64) and `relevance_computed_at` (DateTime) on the item's database record

#### Scenario: Stale score detection
- **WHEN** an item's `relevance_computed_at` is older than 7 days
- **THEN** the system SHALL flag the item for recomputation during the next queue assembly

### Requirement: Incremental relevance updates on feedback
The system SHALL incrementally update relevance scores when users provide feedback, without recomputing all items.

#### Scenario: User upvotes an RSS article
- **WHEN** the user creates a "like" classifier via upvote on an RSS article
- **THEN** the system SHALL recompute the relevance score for that article immediately
- **AND** the system SHALL schedule lazy recomputation for items sharing the same author or tags

#### Scenario: User rates a document
- **WHEN** the user rates a document (Again/Hard/Good/Easy)
- **THEN** the system SHALL recompute the relevance score for that document
- **AND** the system SHALL schedule lazy recomputation for items sharing the same tags or source

#### Scenario: User favorites an item
- **WHEN** the user favorites an RSS article or document
- **THEN** the system SHALL recompute relevance for the favorited item
- **AND** the system SHALL schedule lazy recomputation for semantically similar items
