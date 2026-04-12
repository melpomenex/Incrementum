## ADDED Requirements

### Requirement: Calendar grid displays monthly workload
The system SHALL render a month-grid calendar (7 columns: Sun–Sat) where each day cell displays the number of due reviews for that date. Past days SHALL show the actual count of reviews completed; future days SHALL show the projected count of items due.

#### Scenario: Viewing current month
- **WHEN** the user navigates to the Workload Calendar
- **THEN** the current month is displayed with each day cell showing the review count
- **AND** today's cell is visually highlighted

#### Scenario: Past day with reviews
- **WHEN** a past day has completed reviews
- **THEN** the cell shows the actual review count
- **AND** the cell background color reflects the workload intensity level

#### Scenario: Future day with due items
- **WHEN** a future day has items due
- **THEN** the cell shows the projected due count
- **AND** the cell uses a distinct visual style (e.g., outlined border) to indicate it is a projection

#### Scenario: Day with no activity
- **WHEN** a day has zero reviews (past) or zero items due (future)
- **THEN** the cell displays "0" or is empty
- **AND** the cell has no intensity color (neutral background)

### Requirement: Color-coded workload intensity
The system SHALL apply a 5-level color scale to day cells based on the review count: none (0), light (1–10), moderate (11–25), heavy (26–50), overload (51+). Colors SHALL use the existing theme palette (green shades for low, amber for moderate, red for heavy).

#### Scenario: Light workload day
- **WHEN** a day has between 1 and 10 reviews
- **THEN** the cell background uses the light intensity color

#### Scenario: Heavy workload day
- **WHEN** a day has between 26 and 50 reviews
- **THEN** the cell background uses the heavy intensity color

#### Scenario: Overload workload day
- **WHEN** a day has 51 or more reviews
- **THEN** the cell background uses the overload intensity color (red)

### Requirement: Month navigation
The system SHALL provide previous/next month navigation buttons and a "Today" button that returns to the current month.

#### Scenario: Navigate to next month
- **WHEN** the user clicks the "Next" button
- **THEN** the calendar displays the following month

#### Scenario: Navigate to previous month
- **WHEN** the user clicks the "Previous" button
- **THEN** the calendar displays the previous month

#### Scenario: Jump to today
- **WHEN** the user clicks the "Today" button
- **THEN** the calendar displays the current month with today highlighted

### Requirement: Month summary statistics
The system SHALL display summary statistics for the visible month: total due reviews, daily average, and peak day (date with highest count).

#### Scenario: Month with activity
- **WHEN** viewing a month with review activity
- **THEN** the summary shows the total review count, daily average (rounded to 1 decimal), and the date of the peak day

#### Scenario: Empty month
- **WHEN** viewing a month with no activity (e.g., future month with no items scheduled)
- **THEN** the summary shows zeros for total and average, and "—" for peak day

### Requirement: Day drill-down popover
The system SHALL allow clicking any day cell to open a popover listing the individual items due (future) or reviewed (past) on that date. Each item SHALL show the question/content preview and its parent document title.

#### Scenario: Click a future day
- **WHEN** the user clicks a future day with due items
- **THEN** a popover opens listing all items due on that date
- **AND** each item shows the question text and parent document title

#### Scenario: Click a past day
- **WHEN** the user clicks a past day with reviews
- **THEN** a popover opens listing all items reviewed on that date with their result (correct/incorrect)

#### Scenario: Click empty day
- **WHEN** the user clicks a day with no items
- **THEN** a popover opens showing "No items scheduled" or "No reviews completed"

### Requirement: Workload trend chart
The system SHALL display a compact area chart below the calendar showing the 30-day due forecast with actual review counts overlaid.

#### Scenario: Viewing trend chart
- **WHEN** the calendar is visible
- **THEN** a trend chart below the calendar shows two lines: projected due items (future) and actual reviews (past)
- **AND** the chart covers 30 days centered on the visible month
