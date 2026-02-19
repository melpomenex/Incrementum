# media-aware-scheduling Specification

## ADDED Requirements

### Requirement: Duration-aware safety cap for long content
The system SHALL apply a coverage-aware interval cap for long videos/articles when positive ratings are given after limited study time.

#### Scenario: Long video with low coverage
- **GIVEN** a long video document and a positive rating (`Good` or `Easy`)
- **AND** observed study time is a small fraction of estimated content duration
- **WHEN** scheduling is computed
- **THEN** the next interval is capped to a shorter safe interval
- **AND** scheduling reason includes that a duration-aware cap was applied

#### Scenario: Long article with low coverage
- **GIVEN** a long article-like document and a positive rating (`Good` or `Easy`)
- **AND** observed study time is below a configured coverage threshold
- **WHEN** scheduling is computed
- **THEN** interval capping is applied using the same safety policy

#### Scenario: Adequate coverage
- **GIVEN** long content with adequate observed coverage
- **WHEN** scheduling is computed
- **THEN** no duration-aware cap is applied
- **AND** baseline scheduler result is preserved

#### Scenario: Non-positive ratings
- **WHEN** rating is `Again` or `Hard`
- **THEN** duration-aware capping does not override those baseline shorter-interval outcomes
