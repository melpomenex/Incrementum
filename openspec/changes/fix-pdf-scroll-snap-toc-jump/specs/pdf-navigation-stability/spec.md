## ADDED Requirements

### Requirement: User Scroll Position Stability
The system MUST treat direct user scroll input as authoritative and SHALL NOT override the viewport position with background restoration updates while user scroll ownership is active.

#### Scenario: Programmatic restoration suppressed after manual scroll
- **WHEN** a user scrolls within an open PDF document
- **THEN** the system preserves the resulting viewport position and suppresses non-essential programmatic repositioning that would move to a different location

#### Scenario: Render updates do not force snap-back
- **WHEN** additional pages render or virtualized content mounts/unmounts after the user has scrolled
- **THEN** the viewport remains anchored to the user's current reading position without snapping to a prior cached position

### Requirement: Deterministic TOC Navigation
The system MUST execute table-of-contents navigation as a single active action and SHALL resolve to the selected heading destination without oscillating between unrelated pages.

#### Scenario: TOC click lands on selected heading
- **WHEN** a user clicks a heading in the table of contents
- **THEN** the viewer navigates to the corresponding destination page/offset and keeps that destination as the active target until navigation completes

#### Scenario: Late events from prior navigations are ignored
- **WHEN** multiple TOC navigations are initiated in sequence and delayed render or scroll events arrive from an older navigation
- **THEN** only events associated with the most recent active navigation are allowed to update viewport position

### Requirement: Stable Post-Navigation Scrolling
After TOC navigation completes, the system MUST allow normal scrolling without page hopping caused by deferred destination corrections.

#### Scenario: Scroll after TOC jump remains continuous
- **WHEN** the user starts scrolling after landing on a TOC destination
- **THEN** the viewer scrolls continuously from the landed position and does not jump to unrelated pages due to stale correction logic

#### Scenario: Destination settle criteria before completion
- **WHEN** the viewer is navigating to a TOC destination while destination page content is still rendering
- **THEN** the navigation is marked complete only after the destination is within configured settle thresholds, preventing visible load-then-unload oscillation
