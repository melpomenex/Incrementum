# Capability: OCR HTML Full PDF

## ADDED Requirements

### Requirement: Full-Document OCR Conversion
The system MUST OCR all pages in a PDF and generate a combined HTML view when the user triggers OCR conversion.
#### Scenario: User converts a PDF via OCR → HTML
- **Given** a PDF document is open in the Document Viewer
- **And** an OCR provider is configured
- **When** the user clicks `OCR → HTML`
- **Then** the system OCRs every page in the PDF in page order
- **And** renders a single combined HTML view of the full document

### Requirement: Page Boundary Toggle
The combined HTML output MUST support a default continuous layout with an optional page-break toggle.
#### Scenario: Multi-page OCR output without page breaks
- **Given** the PDF has multiple pages
- **When** OCR completes
- **Then** the combined HTML output is rendered as continuous content with no visible page breaks
#### Scenario: User enables page-break view
- **Given** the PDF has multiple pages
- **And** OCR output is displayed
- **When** the user enables the page-break toggle in document settings
- **Then** the combined HTML output displays clear page boundary separators or headings

### Requirement: Provider Fallback for PDFs
When a selected OCR provider cannot process PDFs directly, the system MUST OCR extracted page images instead.
#### Scenario: Provider does not handle PDFs directly
- **Given** the selected OCR provider does not accept PDFs as direct input
- **When** OCR is requested for a PDF
- **Then** the system extracts page images and OCRs each page image in order
- **And** reports a clear error if no page images can be extracted

### Requirement: Preserve Tables and Images When Available
The system MUST preserve tables and images in the OCR HTML output when the selected provider returns them.
#### Scenario: Provider returns structured output
- **Given** the selected OCR provider returns structured output with tables or images
- **When** OCR completes
- **Then** the HTML output includes those tables or images in the rendered view
