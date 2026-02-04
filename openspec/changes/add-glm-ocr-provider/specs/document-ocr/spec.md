## ADDED Requirements
### Requirement: GLM-OCR Local Provider
The system SHALL offer a GLM-OCR local provider that sends images to a vLLM OpenAI-compatible endpoint and returns extracted content as Markdown.

#### Scenario: GLM-OCR selected with valid configuration
- **WHEN** the user selects the GLM-OCR provider and supplies a vLLM endpoint and model
- **THEN** OCR requests are sent to the configured endpoint using the selected model
- **AND THEN** the image is provided as a base64 data URL input
- **AND THEN** the response text is treated as Markdown output

#### Scenario: GLM-OCR selected without configuration
- **WHEN** the user selects GLM-OCR without providing a reachable endpoint or model
- **THEN** OCR requests fail with a configuration error surfaced in the UI

### Requirement: GLM-OCR Provider UX Label
The system SHALL present GLM-OCR as GPU-recommended in the OCR provider selection UI.

#### Scenario: User views OCR provider list
- **WHEN** the OCR provider list is shown
- **THEN** the GLM-OCR option indicates GPU-recommended performance

### Requirement: OCR Markdown Rendering
The system SHALL render OCR Markdown output to HTML using the existing Markdown rendering pipeline and apply the current theme styling.

#### Scenario: Markdown output is produced by GLM-OCR
- **WHEN** GLM-OCR returns Markdown text for a document
- **THEN** the system converts it to HTML using the existing Markdown renderer
- **AND THEN** the HTML is displayed with the current theme styling
