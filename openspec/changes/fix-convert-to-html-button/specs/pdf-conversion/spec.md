# PDF Conversion Capability

## MODIFIED Requirements

### Requirement: User-Initiated PDF to HTML Conversion
The system SHALL provide a PDF viewer toolbar action that converts the active PDF document into HTML only when the user chooses to run the conversion.

#### Scenario: User converts the active PDF
- **Given** a user is viewing a PDF document
- **When** the user clicks the `Convert to HTML` toolbar button
- **Then** the system SHALL convert the full PDF document to HTML
- **And** the conversion SHALL include all pages in source order
- **And** the viewer SHALL present the generated HTML after conversion succeeds

#### Scenario: User has not requested conversion
- **Given** a user is viewing a PDF document
- **When** the user does not click `Convert to HTML`
- **Then** the system SHALL keep rendering the original PDF view
- **And** the system SHALL NOT automatically convert the PDF to HTML

### Requirement: Formatting-Preserving HTML Output
The PDF-to-HTML conversion SHALL preserve the source PDF's readable structure as much as practical while producing selectable, searchable, extractable HTML.

#### Scenario: PDF contains an embedded text layer
- **Given** a PDF contains extractable text
- **When** the user converts the PDF to HTML
- **Then** the generated HTML SHALL preserve reading order, page boundaries, paragraphs, headings, lists, and inline emphasis where the source PDF exposes enough structure
- **And** the generated HTML SHALL keep text selectable and copyable
- **And** the generated HTML SHALL avoid flattening all content into a single plain text block

#### Scenario: PDF contains tables or embedded images
- **Given** a PDF page contains tables or embedded images that can be extracted
- **When** the user converts the PDF to HTML
- **Then** the generated HTML SHALL include table-like structure or image elements where practical
- **And** text flow around these elements SHALL remain readable

#### Scenario: PDF layout cannot be perfectly reconstructed
- **Given** a PDF uses layout information that cannot be fully recovered
- **When** the user converts the PDF to HTML
- **Then** the generated HTML SHALL prefer readable, extractable output over pixel-perfect reproduction
- **And** the conversion SHALL preserve page order and source page attribution

### Requirement: Image-Only PDF Fallback
The PDF-to-HTML conversion SHALL provide an OCR-backed fallback for PDFs whose text layer is missing or unusable when an OCR provider is available.

#### Scenario: PDF has no usable text layer
- **Given** a PDF has no usable embedded text
- **And** an OCR provider is available
- **When** the user converts the PDF to HTML
- **Then** the system SHALL run OCR for the PDF pages
- **And** the generated HTML SHALL include the recognized text in page order
- **And** the viewer SHALL present the OCR-derived HTML using the same PDF/HTML toggle as text-layer conversions

#### Scenario: OCR fallback is unavailable
- **Given** a PDF has no usable embedded text
- **And** no OCR provider is available
- **When** the user converts the PDF to HTML
- **Then** the system SHALL show a clear failure message explaining that conversion requires extractable text or an OCR provider
- **And** the original PDF view SHALL remain available

### Requirement: Conversion Feedback and Saved Output
The system SHALL provide clear UI feedback during and after PDF-to-HTML conversion, including saved-file status when conversion writes an HTML sidecar file.

#### Scenario: Conversion is running
- **Given** a user started PDF-to-HTML conversion
- **When** conversion is still in progress
- **Then** the toolbar action SHALL show a loading state
- **And** the toolbar action SHALL be disabled until the current conversion finishes

#### Scenario: Conversion succeeds
- **Given** PDF-to-HTML conversion completes successfully
- **When** the generated HTML is ready
- **Then** the system SHALL show success feedback
- **And** the viewer SHALL allow switching between the original PDF and generated HTML

#### Scenario: HTML is saved to disk
- **Given** PDF-to-HTML conversion is requested with file saving enabled
- **When** conversion succeeds
- **Then** the system SHALL save the generated HTML beside the source PDF unless an output path is provided
- **And** the system SHALL report whether the file was saved successfully

#### Scenario: Conversion fails
- **Given** PDF-to-HTML conversion fails
- **When** the failure is returned to the viewer
- **Then** the system SHALL show a specific error message
- **And** the original PDF view SHALL remain usable
