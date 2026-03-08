## MODIFIED Requirements

### Requirement: User Scroll Position Stability
The system MUST treat direct user scroll input as authoritative and SHALL NOT override the viewport position with background restoration updates while user scroll ownership is active. The system MUST also disable browser-native scroll restoration (`history.scrollRestoration`) to prevent interference with application-controlled positioning.

#### Scenario: Programmatic restoration suppressed after manual scroll
- **WHEN** a user scrolls within an open PDF document
- **THEN** the system preserves the resulting viewport position and suppresses non-essential programmatic repositioning that would move to a different location

#### Scenario: Render updates do not force snap-back
- **WHEN** additional pages render or virtualized content mounts/unmounts after the user has scrolled
- **THEN** the viewport remains anchored to the user's current reading position without snapping to a prior cached position

#### Scenario: Browser scroll restoration disabled during PDF viewing
- **WHEN** the PDF viewer component mounts
- **THEN** the system sets `history.scrollRestoration = 'manual'` to prevent browser-native scroll position interference
- **AND** the previous value is restored when the viewer unmounts

#### Scenario: No bounce on document load or refresh
- **WHEN** a user loads a PDF document or refreshes the page
- **THEN** the viewport does not "bounce" between browser-attempted position and application-controlled position
- **AND** the application restores the saved reading position only after the target page has rendered with non-zero height
