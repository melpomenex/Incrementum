## ADDED Requirements
### Requirement: Retention-Aware Activity Heatmap
The system SHALL extend activity heatmaps to include retention-rate overlays for each day.

#### Scenario: User views retention by day
- **WHEN** a user opens the study heatmap
- **THEN** each day displays activity intensity and associated retention-rate indicator

### Requirement: Forgetting Curve Visualization
The system SHALL provide predicted forgetting-curve visualization at both individual-card and aggregate scopes.

#### Scenario: User inspects a specific card curve
- **WHEN** a user opens card-level retention analytics
- **THEN** the system displays the predicted decay curve and next-scheduled review point

### Requirement: Cognitive Energy Correlation Tracking
The system SHALL allow users to record pre-session energy level and SHALL correlate energy trends with retention outcomes.

#### Scenario: User logs energy before session
- **WHEN** a user records energy level and completes reviews
- **THEN** analytics surfaces include energy-to-performance correlation over time

### Requirement: Reading Speed and ETA Forecasting
The system SHALL track reading speed by document type and display estimated completion time for queued documents.

#### Scenario: User checks queue ETA
- **WHEN** a user views reading queue analytics
- **THEN** the system shows per-document and total ETA estimates derived from observed reading speeds
