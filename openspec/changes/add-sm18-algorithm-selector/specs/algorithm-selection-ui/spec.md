# algorithm-selection-ui Specification

## Purpose
Allow users to select between available spaced repetition algorithms in the Learning Settings UI, with the selection persisted and respected by the backend review dispatch.

## ADDED Requirements

### Requirement: Algorithm Selection Dropdown
The system SHALL present an algorithm selector in the Learning Settings that lists all available algorithms with name, version, and description.

#### Scenario: User views algorithm options
- **Given** the user opens Learning Settings
- **When** the algorithm selector is displayed
- **Then** the system SHALL show the following options:
  - FSRS-6 (Recommended) -- Modern free algorithm with stability/difficulty model
  - SM-2 -- Classic SuperMemo algorithm (ease factor, simple intervals)
  - SM-5 -- Improved SuperMemo with modifier factor
  - SM-8 -- SuperMemo with optimal intervals and lapse tracking
  - SM-15 -- Modern SuperMemo with stability/difficulty model
  - SM-18 -- Latest SuperMemo algorithm with SInc matrix
- **And** the currently selected algorithm SHALL be indicated

#### Scenario: User selects SM-18
- **Given** the user has FSRS-6 selected
- **When** the user selects SM-18 from the dropdown
- **Then** the system SHALL show a confirmation dialog warning that existing scheduling data will not be migrated
- **And** upon confirmation, the system SHALL persist the selection to the settings store
- **And** subsequent reviews SHALL use the SM-18 algorithm

### Requirement: Algorithm Selection Persistence
The system SHALL persist the algorithm selection across sessions and platforms.

#### Scenario: Algorithm selection persists after restart
- **Given** the user has selected SM-18
- **When** the application is restarted
- **Then** the algorithm SHALL remain SM-18
- **And** the settings UI SHALL reflect the saved selection

#### Scenario: Algorithm selection works in Tauri desktop and Web App
- **Given** the user selects SM-18 in the Tauri desktop app
- **When** the user accesses the Web App / PWA
- **Then** the Web App SHALL also reflect the SM-18 selection (if settings are synced)
- **And** the Web App review endpoint SHALL dispatch to SM-18

### Requirement: Algorithm-Specific Settings Visibility
The system SHALL show or hide algorithm-specific settings based on the selected algorithm.

#### Scenario: FSRS retention slider hidden for SM-18
- **Given** the user has selected SM-18
- **When** the Learning Settings are displayed
- **Then** the FSRS "Desired Retention" slider SHALL be hidden (SM-18 uses its own forgetting index)
- **And** the FSRS "Personal FSRS Optimizer" button SHALL be hidden
- **And** the FSRS scoped overrides section SHALL be hidden

#### Scenario: FSRS settings visible for FSRS selection
- **Given** the user has selected FSRS-6
- **When** the Learning Settings are displayed
- **Then** the FSRS "Desired Retention" slider SHALL be visible
- **And** the FSRS "Personal FSRS Optimizer" button SHALL be visible
- **And** the FSRS scoped overrides section SHALL be visible

### Requirement: Backend Algorithm Dispatch
The backend SHALL route review commands to the selected algorithm implementation.

#### Scenario: Review dispatched to SM-18
- **Given** the user has selected SM-18 as their algorithm
- **When** a review is submitted for a learning item
- **Then** the backend SHALL use the SM-18 algorithm to compute the next schedule
- **And** the result SHALL be persisted with `algorithm_type = "sm18"` and `algorithm_state` containing the SM-18 state JSON

#### Scenario: Review dispatched to SM-2
- **Given** the user has selected SM-2 as their algorithm
- **When** a review is submitted for a learning item
- **Then** the backend SHALL use the SM-2 algorithm to compute the next schedule
- **And** the result SHALL be persisted with `algorithm_type = "sm2"` and `algorithm_state` containing the SM-2 state JSON
