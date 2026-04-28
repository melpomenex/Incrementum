## ADDED Requirements

### Requirement: Inline styles stripped from imported HTML
The system SHALL remove all inline `style` attributes from HTML elements when processing browser-extension-imported content for display in the document viewer.

#### Scenario: Extension-imported article renders with app typography
- **WHEN** a document imported via the browser extension context menu is displayed in the HTML viewer
- **THEN** no element SHALL retain inline `style` attributes from the source site
- **AND** all text SHALL render using the app's configured font size, line height, and font family

#### Scenario: Intentional formatting preserved
- **WHEN** inline styles are stripped from imported HTML
- **THEN** HTML structure SHALL be preserved (bold, italic, links, lists, headings, code, tables, blockquotes, images)
- **AND** only the `style` attribute SHALL be removed — no elements or classes SHALL be stripped

### Requirement: Viewer CSS overrides typography on all elements
The `injectHtmlViewerStyles()` CSS SHALL apply `font-size`, `line-height`, and `font-family` with `!important` to all elements via the universal selector, ensuring app settings win over any residual inline styles.

#### Scenario: Residual inline styles do not affect typography
- **WHEN** an imported HTML element has a residual inline `font-size` or `line-height` (e.g., from partial processing)
- **THEN** the injected CSS `!important` declaration SHALL override it

### Requirement: Heading hierarchy in imported articles
The injected CSS SHALL define distinct font sizes for `h1` through `h6` headings, scaled relative to the user's configured base font size.

#### Scenario: Article headings display with proper hierarchy
- **WHEN** an imported article contains `h1`–`h6` elements
- **THEN** each heading level SHALL display at a distinct, larger font size than body text
- **AND** `h1` SHALL be the largest and `h6` the smallest

### Requirement: Element spacing normalization
The injected CSS SHALL normalize margins and padding on common block elements (p, h1–h6, ul, ol, li, blockquote, pre, table, figure) to prevent source-site layout from affecting readability.

#### Scenario: Source-site margins do not cause layout issues
- **WHEN** an imported article contains elements with unusual margin/padding from the source site
- **THEN** the injected CSS SHALL override those with reasonable defaults
