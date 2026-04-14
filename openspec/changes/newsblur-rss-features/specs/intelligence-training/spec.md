## ADDED Requirements

### Requirement: Author classifier training
The system SHALL allow users to train intelligence classifiers on article authors. Users MUST be able to mark an author as liked (focus), disliked (hidden), or neutral for any feed. Classifiers MUST be stored per-feed with optional folder and global scope.

#### Scenario: Like an author
- **WHEN** user selects an article and clicks "Like Author" from the training menu
- **THEN** the system creates a classifier with type "author", the author's name as value, and sentiment "like" for the current feed
- **AND** all future articles by that author in this feed receive a positive intelligence score

#### Scenario: Dislike an author
- **WHEN** user selects an article and clicks "Dislike Author" from the training menu
- **THEN** the system creates a classifier with type "author", the author's name as value, and sentiment "dislike" for the current feed
- **AND** articles by that author appear with a red indicator and are filtered in focus-only view

#### Scenario: Toggle author classifier sentiment
- **WHEN** user clicks on an existing author classifier pill in the Manage Training view
- **THEN** the classifier cycles through like → dislike → neutral → like

### Requirement: Tag classifier training
The system SHALL allow users to train classifiers on article tags/categories. Users MUST be able to mark tags as liked, disliked, or neutral per feed.

#### Scenario: Like a tag
- **WHEN** user right-clicks a category tag on an article and selects "Like this tag"
- **THEN** the system creates a classifier with type "tag", the tag text as value, and sentiment "like"
- **AND** future articles with this category receive a positive intelligence score

#### Scenario: Dislike a tag
- **WHEN** user right-clicks a category tag on an article and selects "Dislike this tag"
- **THEN** the system creates a classifier with type "tag", the tag text as value, and sentiment "dislike"

### Requirement: Title keyword classifier training
The system SHALL allow users to train classifiers on words found in article titles. Users select text in a title and classify it.

#### Scenario: Train on title text
- **WHEN** user selects text within an article title and clicks "Train" from the context menu, then selects "Like" or "Dislike"
- **THEN** the system creates a classifier with type "title", the selected text as value, and the chosen sentiment
- **AND** matched title text in articles is highlighted with the classifier color (green for liked, red for disliked)

### Requirement: Feed-level classifier training
The system SHALL allow users to like or dislike an entire feed. Liking a feed boosts all its stories; disliking hides all stories from that feed.

#### Scenario: Like a feed
- **WHEN** user right-clicks a feed in the sidebar and selects "Like this feed"
- **THEN** all articles from this feed receive a positive intelligence score boost

#### Scenario: Dislike a feed
- **WHEN** user right-clicks a feed in the sidebar and selects "Dislike this feed"
- **THEN** all articles from this feed are classified as disliked and hidden in focus view

### Requirement: Three-color intelligence indicator
The system SHALL display a three-color indicator on each story: green (liked/focus), neutral (unrated), or red (hidden/disliked) based on the computed intelligence score.

#### Scenario: Green always wins rule
- **WHEN** an article matches both a liked classifier and a disliked classifier
- **THEN** the article displays as green (focus) — liked classifiers always take priority

#### Scenario: Neutral article
- **WHEN** an article matches no classifiers of any type
- **THEN** the article displays with no color indicator (neutral)

### Requirement: Intelligence score computation
The system SHALL compute an intelligence score for each article based on all active classifiers matching the article's author, title, tags, and feed. The score MUST be cached in the database and recomputed when classifiers change.

#### Scenario: Score computation
- **WHEN** an article is fetched or a classifier is modified
- **THEN** the system evaluates all applicable classifiers (feed scope, folder scope, global scope) against the article
- **AND** the intelligence score equals (count of matching liked classifiers) - (count of matching disliked classifiers)
- **AND** the score is stored in the article's `intelligence_score` column

### Requirement: Focus-only filter
The system SHALL provide a "Focus" view filter that shows only stories classified as green (focus).

#### Scenario: Enable focus view
- **WHEN** user selects the "Focus" view mode from the filter controls
- **THEN** only articles with a positive intelligence score are displayed in the story list

### Requirement: Show/hide hidden stories
The system SHALL provide a toggle to show or hide stories classified as disliked (red).

#### Scenario: Hide disliked stories
- **WHEN** user enables "Hide disliked" filter (default)
- **THEN** stories with a negative intelligence score are excluded from the story list

#### Scenario: Show disliked stories
- **WHEN** user disables "Hide disliked" filter
- **THEN** all stories are displayed including those with negative intelligence scores, with red indicators

### Requirement: Manage Training view
The system SHALL provide a consolidated "Manage Training" view showing all classifiers across all feeds organized by folder. Users MUST be able to filter, search, inline-edit, and bulk-save classifiers.

#### Scenario: View all classifiers
- **WHEN** user opens the Manage Training view
- **THEN** all classifiers are displayed grouped by folder, with each classifier shown as a colored pill (green/red/gray)

#### Scenario: Filter classifiers by type
- **WHEN** user selects a classifier type filter (Author/Title/Tag/Feed)
- **THEN** only classifiers of that type are displayed

#### Scenario: Bulk save classifier changes
- **WHEN** user modifies multiple classifier sentiments via inline editing and clicks "Save Changes"
- **THEN** all modified classifiers are saved in a single database transaction

### Requirement: Site by Site training walkthrough
The system SHALL provide a "Site by Site" mode that walks through each feed showing articles with trainable elements highlighted.

#### Scenario: Walk through feeds
- **WHEN** user enters Site by Site mode
- **THEN** the system displays articles from the first feed with author names, title keywords, and tags highlighted as clickable training targets
- **AND** user can navigate to the next feed when done training on the current one
