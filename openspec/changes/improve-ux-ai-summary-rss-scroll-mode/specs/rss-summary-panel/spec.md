## ADDED Requirements

### Requirement: Summary Panel uses theme-aware styling

The Summary Panel SHALL use CSS variables that match the application's design system for colors, typography, and spacing.

#### Scenario: Panel renders in light mode

- **WHEN** the user opens the summary panel in light mode
- **THEN** the panel SHALL use `bg-background`, `text-foreground`, and `border-border` CSS variables
- **AND** the panel SHALL not use amber-on-black terminal colors

#### Scenario: Panel renders in dark mode

- **WHEN** the user opens the summary panel in dark mode
- **THEN** the panel SHALL adapt to dark theme colors automatically via CSS variables
- **AND** the panel SHALL maintain proper contrast ratios for accessibility

### Requirement: Summary Panel has smooth animations

The Summary Panel SHALL slide in from the configured side (left or right) with a smooth 300ms ease-out animation.

#### Scenario: Opening the panel

- **WHEN** the user clicks the summarize button or presses `S`
- **THEN** the panel SHALL animate from off-screen to visible position over 300ms
- **AND** the animation SHALL use `ease-out` timing function

#### Scenario: Closing the panel

- **WHEN** the user clicks close, presses `H`, or toggles summary off
- **THEN** the panel SHALL animate to off-screen over 200ms
- **AND** the animation SHALL use `ease-in` timing function

#### Scenario: Resizing the panel

- **WHEN** the user drags the resize handle
- **THEN** the panel width SHALL update in real-time without animation
- **AND** the content SHALL reflow smoothly

### Requirement: Summary Panel is resizable and repositionable

The Summary Panel SHALL support user-configurable width (240px - 600px) and position (left or right side).

#### Scenario: User resizes panel

- **WHEN** the user drags the resize handle on the panel edge
- **THEN** the panel width SHALL update between 240px minimum and 600px maximum
- **AND** the width SHALL persist in localStorage

#### Scenario: User toggles position

- **WHEN** the user clicks the position toggle button
- **THEN** the panel SHALL switch from left to right or right to left
- **AND** the position SHALL persist in localStorage

#### Scenario: Mobile responsive behavior

- **WHEN** the viewport width is less than 768px
- **THEN** the panel SHALL display as a bottom sheet (80vh height) instead of side panel
- **AND** the panel SHALL be dismissible by swiping down

### Requirement: Summary Panel displays inline badge when collapsed

The Summary Panel SHALL show an inline "AI Summary Available" badge when a summary exists but the panel is closed.

#### Scenario: Summary exists for current article

- **WHEN** a cached summary exists for the current article
- **AND** the summary panel is closed
- **THEN** an inline badge SHALL appear near the article header
- **AND** the badge SHALL display a sparkle icon with "Summary" text

#### Scenario: User clicks inline badge

- **WHEN** the user clicks the inline badge
- **THEN** the summary panel SHALL open and display the cached summary

### Requirement: Summary Panel supports modern and terminal display modes

The Summary Panel SHALL support both a modern theme-aware mode and the legacy terminal mode.

#### Scenario: Modern mode display

- **WHEN** the user has `rssSummary.mode` set to "modern" (default)
- **THEN** the panel SHALL render with the modern design system

#### Scenario: Terminal mode display

- **WHEN** the user has `rssSummary.mode` set to "terminal"
- **THEN** the panel SHALL render with the amber-on-black retro terminal aesthetic

#### Scenario: Mode toggle

- **WHEN** the summary panel is open
- **THEN** a toggle SHALL be available to switch between modern and terminal modes
