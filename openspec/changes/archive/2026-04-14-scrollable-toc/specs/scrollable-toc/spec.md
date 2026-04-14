## ADDED Requirements

### Requirement: TOC container has bounded viewport height
The TOC inner container SHALL have a maximum height equal to the viewport height minus the sticky offset and surrounding padding. When TOC entries exceed this height, the container SHALL display a vertical scrollbar.

#### Scenario: TOC fits within viewport
- **WHEN** the TOC has fewer entries than can fill the available height
- **THEN** no scrollbar appears and all entries are visible without scrolling

#### Scenario: TOC overflows viewport
- **WHEN** the TOC has enough entries to exceed the available height
- **THEN** a vertical scrollbar appears within the TOC container and the user can scroll to see all entries independently of the main document scroll
