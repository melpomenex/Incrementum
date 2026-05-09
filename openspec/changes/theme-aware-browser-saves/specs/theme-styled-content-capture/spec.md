## ADDED Requirements

### Requirement: Browser extension captures structural styles only
When capturing page HTML via the browser extension content script, the system SHALL inline only structural CSS properties and SHALL NOT inline cosmetic CSS properties.

Structural properties include: `display`, `flex-direction`, `flex-wrap`, `justify-content`, `align-items`, `grid-template-columns`, `grid-template-rows`, `margin-top`, `margin-right`, `margin-bottom`, `margin-left`, `padding-top`, `padding-right`, `padding-bottom`, `padding-left`, `width`, `max-width`, `min-width`, `border-collapse`, `list-style-type`, `white-space`, `overflow-x`.

Cosmetic properties that SHALL NOT be inlined: `color`, `background-color`, `font-family`, `font-size`, `font-weight`, `font-style`, `line-height`, `text-align`, `text-decoration`, `text-transform`, `letter-spacing`.

#### Scenario: Saving a page via right-click context menu
- **WHEN** user right-clicks on a web page and selects "Save to Incrementum"
- **THEN** the captured HTML content contains inline `style` attributes with only structural CSS properties
- **AND** the captured HTML does NOT contain inline `color`, `background-color`, `font-family`, `font-size`, or `font-weight` properties

#### Scenario: Saving a link via right-click context menu
- **WHEN** user right-clicks on a hyperlink and selects "Save Link to Incrementum"
- **THEN** the captured HTML content contains inline `style` attributes with only structural CSS properties
- **AND** the captured HTML does NOT contain cosmetic CSS properties

### Requirement: Images are preserved in captured content
The content capture SHALL preserve all `<img>` elements with their absolute `src` URLs intact. Images SHALL be captured regardless of whether cosmetic styles are stripped.

#### Scenario: Page with embedded images
- **WHEN** a page containing `<img>` elements is captured
- **THEN** all `<img>` elements are present in the captured HTML
- **AND** each image's `src` attribute contains an absolute URL

#### Scenario: Image layout is preserved
- **WHEN** an image has explicit width/height CSS properties
- **THEN** the image's `width` and `max-width` structural properties are preserved in the inline styles

### Requirement: DOM structure is preserved in captured content
The content capture SHALL preserve the full semantic DOM structure including headings, paragraphs, lists, tables, links, blockquotes, and code blocks.

#### Scenario: Article with semantic HTML
- **WHEN** a page with headings (h1-h6), paragraphs, lists, tables, and blockquotes is captured
- **THEN** all semantic HTML elements are present in the captured output
- **AND** element hierarchy (parent-child relationships) is preserved

### Requirement: Captured content is sanitized for security
The content capture SHALL remove all potentially dangerous elements and attributes from captured HTML, including `<script>` tags, `on*` event handler attributes, `javascript:` URLs, and `<iframe>` elements.

#### Scenario: Page with inline scripts
- **WHEN** a page containing `<script>` tags and `onclick` attributes is captured
- **THEN** the captured HTML does not contain any `<script>` elements
- **AND** the captured HTML does not contain any `on*` event handler attributes

### Requirement: Content capture preserves anchor hrefs
The content capture SHALL preserve `<a>` element `href` attributes as absolute URLs.

#### Scenario: Links in captured content
- **WHEN** a page with anchor links is captured
- **THEN** all `<a>` elements retain their `href` attributes as absolute URLs
