## ADDED Requirements

### Requirement: Popover background color is opaque in light mode
The system SHALL define `--color-popover` as an opaque white (`#ffffff`) and `--color-popover-foreground` as a dark color (`#020817`) in the `@theme` block of `src/index.css`.

#### Scenario: Priority dropdown renders with solid white background
- **WHEN** a user opens the "Set Priority" dropdown in a document viewer in light mode
- **THEN** the dropdown panel SHALL have a solid white background with no document content visible behind it

#### Scenario: GeneratedCards popover renders with solid white background
- **WHEN** a user opens a popover that uses `bg-popover` in light mode
- **THEN** the popover panel SHALL have a solid white background with no content visible behind it

### Requirement: Popover background color adapts to dark mode
The system SHALL define dark-mode overrides for `--color-popover` and `--color-popover-foreground` using the existing `.dark` selector pattern in `src/index.css`.

#### Scenario: Priority dropdown renders with solid dark background in dark mode
- **WHEN** a user opens the "Set Priority" dropdown in a document viewer in dark mode
- **THEN** the dropdown panel SHALL have a solid dark opaque background (no transparency) with light foreground text
