## ADDED Requirements

### Requirement: Single-item postpone uses algorithm-aware computation
The queue context menu "Postpone" action SHALL compute the new interval using the postpone engine instead of adding a fixed number of days. The context menu SHALL show the computed increase and allow the user to confirm or cancel.

#### Scenario: Context menu shows computed postpone result
- **WHEN** a user right-clicks a learning item in the queue and selects "Postpone"
- **THEN** a dialog SHALL show the computed new interval (e.g., "Postpone by 30 days? New interval: 60 days") with Confirm and Cancel buttons

#### Scenario: Postpone document from queue
- **WHEN** a user right-clicks a document in the queue and selects "Postpone"
- **THEN** the system SHALL use topic parameters to compute the increase and display the result

### Requirement: Postpone-all action postpones eligible items in batch
The queue toolbar SHALL include a "Postpone All" button that postpones all eligible items (both learning items and documents) in the current queue view. The system SHALL show a confirmation dialog with the count of items to be postponed before executing.

#### Scenario: Postpone-all with confirmation
- **WHEN** a user clicks "Postpone All" with 25 eligible items in the queue
- **THEN** a dialog SHALL show "Postpone 25 items?" with Confirm and Cancel buttons

#### Scenario: Postpone-all skips ineligible items
- **WHEN** a user clicks "Postpone All" with 40 items in the queue, 15 of which pass eligibility checks
- **THEN** the dialog SHALL show "Postpone 25 items?" (40 total minus 15 skipped) and upon confirmation, only the 25 eligible items SHALL have their intervals increased

#### Scenario: Postpone-all with empty queue
- **WHEN** a user clicks "Postpone All" with no items in the queue
- **THEN** the action SHALL be disabled or show a message "No items to postpone"

### Requirement: Auto-postpone prompt appears on session start
When auto-postpone is enabled and the user opens the queue with overdue items, the system SHALL display a prompt asking whether to postpone outstanding items. The prompt SHALL show the count of outstanding items.

#### Scenario: Auto-postpone prompt with overdue items
- **WHEN** autoPostponeEnabled is true, the user opens the queue, and 30 items are overdue
- **THEN** a prompt SHALL appear: "You have 30 overdue items. Would you like to postpone them?" with "Postpone" and "Review Now" buttons

#### Scenario: Auto-postpone skipped when no overdue items
- **WHEN** autoPostponeEnabled is true and no items are overdue
- **THEN** no prompt SHALL appear and the user enters the normal review flow

#### Scenario: User dismisses auto-postpone prompt
- **WHEN** the user clicks "Review Now" on the auto-postpone prompt
- **THEN** the prompt SHALL close and the user SHALL enter the normal review flow with all items

### Requirement: Postpone statistics are displayed after batch operations
After a postpone-all or auto-postpone operation completes, the system SHALL display a summary showing: total items postponed, total interval increase (sum of all increases in days), and items skipped (ineligible).

#### Scenario: Summary after postpone-all
- **WHEN** a postpone-all operation completes with 25 items postponed and 15 skipped
- **THEN** a summary SHALL show: "25 items postponed. Average increase: X days. 15 items skipped (already well-established)."

### Requirement: Postpone settings are configurable in the learning settings panel
The learning settings page SHALL include a "Postpone" section with controls for: auto-postpone toggle, simple mode toggle, randomization toggle, item/topic increase percentages, min/max increase limits, eligibility thresholds, and floor/cap values. All controls SHALL include labels and tooltips explaining what each parameter does.

#### Scenario: Settings panel displays all postpone parameters
- **WHEN** a user navigates to Settings > Learning > Postpone
- **THEN** all postpone parameters SHALL be displayed with their current values and the ability to modify them

#### Scenario: Settings are validated before saving
- **WHEN** a user sets itemMinIncrease greater than itemMaxIncrease
- **THEN** the system SHALL show a validation error and SHALL NOT save the invalid configuration
