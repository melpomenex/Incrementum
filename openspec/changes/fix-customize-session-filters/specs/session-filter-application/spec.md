## ADDED Requirements

### Requirement: Tag filter restricts visible queue items
The system SHALL filter the visible queue items to only include items whose tags match at least one of the selected tags when the user selects tags in the Customize Session modal.

#### Scenario: Single tag selected
- **WHEN** user selects tag "physics" in the Customize Session modal
- **THEN** only items tagged "physics" SHALL appear in the queue list

#### Scenario: Multiple tags selected (OR logic)
- **WHEN** user selects tags "physics" and "math" in the Customize Session modal
- **THEN** items tagged "physics" OR "math" SHALL appear in the queue list

#### Scenario: No tags selected
- **WHEN** user has no tags selected in the Customize Session modal
- **THEN** all items SHALL appear regardless of their tags (tag filter is not applied)

### Requirement: Category filter restricts visible queue items
The system SHALL filter the visible queue items to only include items whose category matches at least one of the selected categories when the user selects categories in the Customize Session modal.

#### Scenario: Single category selected
- **WHEN** user selects category "Chapter 1" in the Customize Session modal
- **THEN** only items with category "Chapter 1" SHALL appear in the queue list

#### Scenario: Multiple categories selected (OR logic)
- **WHEN** user selects categories "Chapter 1" and "Chapter 2"
- **THEN** items with category "Chapter 1" OR "Chapter 2" SHALL appear in the queue list

#### Scenario: No categories selected
- **WHEN** user has no categories selected
- **THEN** all items SHALL appear regardless of category (category filter is not applied)

### Requirement: Priority range filter restricts visible queue items
The system SHALL filter the visible queue items to only include items whose computed priority score falls within the selected min/max range.

#### Scenario: Narrow priority range
- **WHEN** user sets priority range to min=70, max=100
- **THEN** only items with priority score >= 70 and <= 100 SHALL appear in the queue list

#### Scenario: Default priority range (0-100)
- **WHEN** user has default priority range (0-100)
- **THEN** all items SHALL appear regardless of priority score

### Requirement: Exclude suspended filter removes suspended items
The system SHALL exclude items with status "suspended" from the visible queue when the exclude suspended toggle is enabled.

#### Scenario: Exclude suspended enabled
- **WHEN** user enables "Exclude Suspended" toggle
- **THEN** items with status "suspended" SHALL NOT appear in the queue list

#### Scenario: Exclude suspended disabled
- **WHEN** user disables "Exclude Suspended" toggle
- **THEN** suspended items SHALL appear in the queue list

### Requirement: Item type filter restricts visible queue items
The system SHALL filter the visible queue items by item type (documents, extracts, learning items) based on the checkboxes in the Customize Session modal.

#### Scenario: Only documents enabled
- **WHEN** user enables only the "Documents" checkbox and disables extracts and learning items
- **THEN** only items with itemType "document" SHALL appear in the queue list

#### Scenario: Only learning items enabled
- **WHEN** user enables only the "Learning Items" checkbox
- **THEN** only items with itemType "learning-item" SHALL appear in the queue list

#### Scenario: All item types enabled
- **WHEN** user enables all three item type checkboxes
- **THEN** items of all types SHALL appear in the queue list

### Requirement: Multiple filters compose with AND logic
The system SHALL apply all active session customization filters together using AND logic — an item must pass every active filter to appear in the queue.

#### Scenario: Tag AND category filter
- **WHEN** user selects tag "physics" and category "Chapter 1"
- **THEN** only items that are tagged "physics" AND have category "Chapter 1" SHALL appear

#### Scenario: Tag AND priority range filter
- **WHEN** user selects tag "physics" and sets priority range to 50-100
- **THEN** only items tagged "physics" AND having priority score 50-100 SHALL appear

#### Scenario: All filters combined
- **WHEN** user selects tag "physics", category "Chapter 1", priority range 50-100, enables exclude suspended, and enables only learning items
- **THEN** only items that pass all five filters simultaneously SHALL appear

### Requirement: Session customization filters compose with queue-mode and search filters
The session customization filters SHALL apply after queue-mode (review/reading), file-type, and search filters. An item must pass all layers to appear in the queue list.

#### Scenario: Review mode with tag filter
- **WHEN** queue mode is "review" (learning items only) and user selects tag "physics"
- **THEN** only learning items tagged "physics" SHALL appear

#### Scenario: Search query with tag filter
- **WHEN** user has a search query "quantum" and selects tag "physics"
- **THEN** only items matching the search query "quantum" AND tagged "physics" SHALL appear
