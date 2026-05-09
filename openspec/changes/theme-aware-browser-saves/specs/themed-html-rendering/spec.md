## ADDED Requirements

### Requirement: HTML document viewer applies theme colors to saved content
When displaying saved HTML content in the DocumentViewer iframe, the system SHALL apply the user's active theme colors (background, foreground, primary, muted, border, card) to all rendered content, overriding any cosmetic inline styles from the original capture.

#### Scenario: Viewing a saved page in dark theme
- **WHEN** a user views a saved HTML document while using a dark theme
- **THEN** the document background matches the theme's `--color-background`
- **AND** the text color matches the theme's `--color-foreground`
- **AND** links use the theme's `--color-primary`

#### Scenario: Viewing a saved page in light theme
- **WHEN** a user views a saved HTML document while using a light theme
- **THEN** the document background matches the theme's `--color-background`
- **AND** the text color matches the theme's `--color-foreground`
- **AND** code blocks use the theme's `--color-muted` for backgrounds

#### Scenario: Switching themes while viewing a document
- **WHEN** a user changes the active theme while an HTML document is displayed
- **THEN** the document viewer re-applies the new theme colors immediately

### Requirement: Legacy saved content with inline cosmetic styles is overridden by theme
When rendering previously saved HTML content that contains cosmetic inline styles (color, background-color, font-family, etc.), the system SHALL override those inline styles with theme values using CSS specificity.

#### Scenario: Viewing a legacy saved page with inline colors
- **WHEN** a user views a previously saved document that has inline `style="color: red; background-color: white"`
- **THEN** the text color matches the current theme foreground, not red
- **AND** the background matches the current theme background, not white

### Requirement: Rich content renderer applies theme colors
The RichContentRenderer component SHALL apply the user's active theme colors when rendering extract HTML content in its sandboxed iframe, instead of using hardcoded light-theme colors.

#### Scenario: Viewing an extract in dark theme
- **WHEN** a user views an extract with HTML content while using a dark theme
- **THEN** the extract's iframe background matches the theme's `--color-background`
- **AND** the text color matches the theme's `--color-foreground`
- **AND** links use the theme's `--color-primary`
- **AND** code block backgrounds use the theme's `--color-muted`

#### Scenario: Viewing an extract in light theme
- **WHEN** a user views an extract with HTML content while using a light theme
- **THEN** the extract's iframe background matches the theme's `--color-background`
- **AND** all colors match the active light theme

### Requirement: Theme-aware rendering preserves images
Images in saved HTML content SHALL be rendered with responsive sizing and theme-matched borders, regardless of whether cosmetic styles are stripped.

#### Scenario: Images in a themed document
- **WHEN** a saved document contains `<img>` elements
- **THEN** images display at a maximum of 100% container width
- **AND** images have a border matching the theme's `--color-border`
- **AND** images maintain their aspect ratio

### Requirement: User font and spacing preferences are applied
The HTML viewer SHALL respect user-configured font size, line height, and font family settings from the viewer controls, overriding any inline font styles.

#### Scenario: User changes font size
- **WHEN** a user adjusts the font size control in the HTML viewer
- **THEN** all text in the saved document renders at the selected font size
- **AND** the font size override applies to all elements regardless of inline styles

### Requirement: Semantic HTML elements are styled with theme tokens
Headings, paragraphs, tables, blockquotes, code blocks, and links in saved content SHALL be styled using theme tokens for colors, borders, and backgrounds.

#### Scenario: Table in saved content
- **WHEN** a saved document contains a `<table>` element
- **THEN** table borders use the theme's `--color-border`
- **AND** header cells use the theme's `--color-muted` for background
- **AND** text color uses the theme's `--color-foreground`

#### Scenario: Blockquote in saved content
- **WHEN** a saved document contains a `<blockquote>` element
- **THEN** the left border uses the theme's `--color-primary`
- **AND** the text uses the theme's muted foreground color
