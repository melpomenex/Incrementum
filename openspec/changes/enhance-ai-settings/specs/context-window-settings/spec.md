## ADDED Requirements

### Requirement: Max tokens per request configuration
The system SHALL allow the user to configure the maximum tokens per request.
This is a global fallback value; per-provider max_tokens in `LLMProviderConfig` overrides the global value.
Range: 256–128000. Default: 4096.

#### Scenario: User sets global max tokens
- **WHEN** user sets "Max tokens per request" to 8192
- **THEN** providers without a per-provider max_tokens set SHALL use 8192

#### Scenario: Per-provider max_tokens overrides global
- **WHEN** a provider has max_tokens set to 2048
- **AND** global max tokens is 4096
- **THEN** the provider SHALL use 2048

### Requirement: Context from related cards toggle
The system SHALL provide a toggle to include content from semantically related cards as context in AI requests.
When enabled, the system SHALL fetch related card content up to the configured context window limit.
Default: disabled.

#### Scenario: Enable related card context
- **WHEN** user enables "Include context from related cards"
- **THEN** AI requests SHALL include content from semantically related cards as additional context

#### Scenario: Disable related card context
- **WHEN** user disables "Include context from related cards"
- **THEN** AI requests SHALL NOT include related card content

### Requirement: Document snippet length configuration
When using document context in AI requests, the system SHALL allow configuration of the snippet length.
This controls how many characters of the source document are included per context snippet.
Range: 200–10000. Default: 2000.

#### Scenario: User sets document snippet length
- **WHEN** user sets "Document snippet length" to 5000
- **THEN** context snippets from documents SHALL be at most 5000 characters each

### Requirement: Context window settings UI
The settings page SHALL include a "Context Window" sub-section with: max-tokens-per-request number input (256–128000), include-related-cards toggle, and document-snippet-length number input (200–10000).

#### Scenario: Context window section renders
- **WHEN** user navigates to AI Settings
- **THEN** SHALL see a "Context Window" sub-section with all three controls
