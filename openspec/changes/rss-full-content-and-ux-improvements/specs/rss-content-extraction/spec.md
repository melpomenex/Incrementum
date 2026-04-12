## ADDED Requirements

### Requirement: Extract readable article content from HTML

The system SHALL use the Mozilla Readability algorithm to extract readable article content from raw HTML, removing navigation, ads, and non-content elements.

#### Scenario: Extract content from fetched HTML

- **WHEN** full article HTML is fetched from a source URL
- **THEN** the system SHALL process it through the Readability algorithm
- **AND** extract the article title, byline, content body, and excerpt
- **AND** return structured clean HTML

#### Scenario: Preserve article structure

- **WHEN** content is extracted
- **THEN** the system SHALL preserve headings, paragraphs, lists, links, and images within the article body
- **AND** remove scripts, styles, navigation elements, ads, and sidebars
- **AND** ensure the output is safe HTML suitable for rendering

#### Scenario: Handle malformed HTML

- **WHEN** the source HTML is malformed or invalid
- **THEN** the system SHALL use lenient parsing to recover readable content
- **AND** extract as much meaningful content as possible
- **AND** not crash on parsing errors

### Requirement: Sanitize extracted content

The system SHALL sanitize extracted HTML content to prevent XSS attacks and ensure safe rendering.

#### Scenario: Remove dangerous elements

- **WHEN** content is extracted by Readability
- **THEN** the system SHALL pass it through an HTML sanitizer
- **AND** remove all script tags, event handlers, and potentially dangerous attributes
- **AND** allow only safe HTML elements: p, h1-h6, ul, ol, li, a, img, blockquote, em, strong, etc.

#### Scenario: Validate image sources

- **WHEN** extracted content contains images
- **THEN** the system SHALL validate image URLs are http/https protocols only
- **AND** remove images with data URLs or other schemes for security
- **AND** preserve alt text for accessibility

### Requirement: Generate article excerpt

The system SHALL generate a plain text excerpt from the extracted full content for preview purposes.

#### Scenario: Create excerpt from full content

- **WHEN** full content is successfully extracted
- **THEN** the system SHALL generate a plain text excerpt (default 200 characters)
- **AND** strip all HTML tags
- **AND** truncate at word boundaries
- **AND** append ellipsis if truncated

#### Scenario: Use excerpt in article list

- **WHEN** displaying articles in the article list view
- **AND** full content has been extracted
- **THEN** the system SHALL use the generated excerpt instead of the RSS summary
- **AND** display it in the article preview
