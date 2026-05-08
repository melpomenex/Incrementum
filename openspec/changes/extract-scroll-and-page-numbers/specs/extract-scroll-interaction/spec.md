## ADDED Requirements

### Requirement: Extract content scroll containment in scroll mode
When viewing an extract item in scroll mode, mouse wheel events inside the extract content area SHALL scroll the extract content and SHALL NOT advance to the next or previous queue item. The queue SHALL only advance when the extract content area cannot scroll further in the wheel direction.

#### Scenario: Scrolling down within a long extract
- **WHEN** an extract item is displayed in scroll mode with content that overflows the container
- **AND** the user scrolls down with the mouse wheel while the content area can still scroll down
- **THEN** the extract content area scrolls down
- **AND** the queue does NOT advance to the next item

#### Scenario: Scrolling to bottom of extract advances queue
- **WHEN** an extract item is displayed in scroll mode
- **AND** the extract content area is scrolled to the bottom
- **AND** the user scrolls down with the mouse wheel
- **THEN** the queue advances to the next item

#### Scenario: Scrolling up within an extract
- **WHEN** an extract item is displayed in scroll mode with content that is scrolled past the top
- **AND** the user scrolls up with the mouse wheel while the content area can still scroll up
- **THEN** the extract content area scrolls up
- **AND** the queue does NOT advance to the previous item

#### Scenario: Short extract content (no overflow)
- **WHEN** an extract item is displayed in scroll mode with content that does not overflow the container
- **AND** the user scrolls down with the mouse wheel
- **THEN** the queue advances to the next item (no content to scroll through)

#### Scenario: Keyboard navigation unchanged
- **WHEN** an extract item is displayed in scroll mode
- **AND** the user presses ArrowDown or PageDown
- **THEN** the queue advances to the next item (keyboard shortcuts remain unchanged)
