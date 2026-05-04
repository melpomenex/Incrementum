## ADDED Requirements

### Requirement: Schedule Timeline
System SHALL display a horizontally scrollable date strip showing the next 14 days with visual indicators of daily workload intensity. Each date cell SHALL show the day label, date number, and item count. Dates SHALL be color-coded by workload level (green → amber → red). Tapping/clicking a date SHALL filter the item list to show items due on that date.

#### Scenario: User views upcoming schedule
- GIVEN the user navigates to the Schedule view
- WHEN the view loads
- THEN a timeline strip shows the next 14 days starting from today
- AND each day shows its due item count
- AND today is visually highlighted

#### Scenario: User selects a specific day
- GIVEN the timeline is displayed with items due across multiple days
- WHEN the user taps on a future date showing "47 items"
- THEN the item list filters to show only items due on that date
- AND the date cell shows a selected state

### Requirement: Schedule Item List
System SHALL display a list of queue items grouped by due date with section headers. Each item row SHALL show: document title (truncated to 2 lines), item type badge (Document/Extract/Learning Item), due date, days-until-due text, stability bar (0–100%), difficulty indicator (1–10), estimated review time, and lapse count when > 0. Items SHALL be sorted chronologically within each date group, then by priority within the same date.

#### Scenario: User reads item scheduling details
- GIVEN the schedule item list is displayed
- WHEN the user views a learning item due in 3 days
- THEN the row shows the item title, "Learning Item" badge, "In 3d", stability bar, difficulty, and "est. 2 min"

### Requirement: Spread Overloaded Days
System SHALL allow users to redistribute items from overloaded days across a configurable future horizon. When triggered, System SHALL display a Spread modal with: source date(s), target horizon selector (7/14/30/60/90 days), daily limit input, and a before/after bar chart showing the workload distribution. System SHALL use the existing postpone engine to compute the redistribution and preview the result before the user confirms.

#### Scenario: User spreads 2955 items across 30 days
- GIVEN the user has 2955 items due on May 5
- WHEN the user selects May 5 and triggers "Spread"
- AND the user selects a 30-day horizon and confirms
- THEN the 2955 items are redistributed across May 5 – June 3 using the postpone engine
- AND the timeline and item list update to show the new distribution
- AND a toast confirms "2,955 items spread across 30 days (~99/day)"

#### Scenario: User previews spread before committing
- GIVEN the user has opened the Spread modal
- WHEN the user adjusts the horizon from 14 to 30 days
- THEN the preview chart updates in real-time to show the projected daily distribution
- AND the modal shows estimated daily average

### Requirement: Quick Reschedule Actions
System SHALL provide quick-action buttons on each item row: Postpone +1 day, Postpone +3 days, Postpone +7 days. These actions SHALL immediately reschedule the item and update the list. On mobile, these actions SHALL be accessible via a swipe gesture or a long-press context menu.

#### Scenario: User postpones a single item
- GIVEN the item list shows an item due today
- WHEN the user taps the "+3d" quick action
- THEN the item's due date moves to 3 days from now
- AND the item moves to the appropriate date group in the list
- AND a brief toast confirms "Postponed 3 days"

### Requirement: Schedule Summary Stats
System SHALL display summary statistics at the top of the Schedule view: total items in schedule, items due today, items overdue, estimated daily average for the next 7 days, and the most overloaded day in the next 14 days. These stats SHALL update when items are spread or rescheduled.

#### Scenario: User sees schedule summary
- GIVEN the user opens the Schedule view
- WHEN the summary section loads
- THEN it shows "2,955 scheduled", "342 due today", "89 overdue", "~98/day avg (7d)", and "Peak: May 5 (2,955)"

### Requirement: Mobile PWA Compatibility
System SHALL render the Schedule view responsively on mobile devices. The timeline strip SHALL be horizontally scrollable with snap-to-day behavior. Item cards SHALL be full-width touch targets (min 48px height). The Spread modal SHALL use a bottom-sheet pattern on mobile. Item details SHALL expand inline on tap rather than using hover popovers.

#### Scenario: Mobile user spreads items
- GIVEN a mobile user views the Schedule on their phone
- WHEN they select an overloaded day and tap "Spread"
- THEN a bottom-sheet modal slides up with the spread controls
- AND the preview chart fits the screen width
- AND confirming closes the sheet with a success toast

## MODIFIED Requirements

### Requirement: Queue Tab Navigation (MODIFIED)
Queue Tab SHALL include a third sub-view toggle: "Queue" | "Schedule" | "Review" (previously "Queue" | "Review"). Selecting "Schedule" SHALL render the new ScheduleView component. On mobile, the toggle SHALL appear as a bottom tab bar or top segmented control.

(previous: Queue Tab had two sub-views — Queue and Review)
