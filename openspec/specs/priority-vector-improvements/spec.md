## ADDED Requirements

### Requirement: Blend user-set priority rating into userIntent dimension
The `userIntent` component of the priority vector SHALL incorporate the backend's `priority_rating` field (user-set importance, 1-5 scale) alongside the existing tag count signal. The formula SHALL be `userIntent = 0.6 * ratingScore + 0.4 * tagScore`, where `ratingScore` maps the 1-5 rating to a 0-90 range and `tagScore` uses the existing tag-count formula. Items with no `priority_rating` SHALL default to a neutral `ratingScore` of 50.

#### Scenario: High-rated item without tags scores higher than unrated item with tags
- **WHEN** item A has `priority_rating: 5` and no tags, and item B has `priority_rating: null` and 3 tags
- **THEN** item A's `userIntent` score SHALL be higher than item B's `userIntent` score

#### Scenario: Both signals combine for maximum intent
- **WHEN** an item has `priority_rating: 5` and 5+ tags
- **THEN** the `userIntent` score SHALL be close to the maximum of 90

#### Scenario: Unrated items remain neutral
- **WHEN** an item has no `priority_rating` and no tags
- **THEN** the `userIntent` score SHALL be approximately neutral (not near the extremes of 0 or 90)
