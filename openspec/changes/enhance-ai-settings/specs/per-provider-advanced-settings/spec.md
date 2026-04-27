## ADDED Requirements

### Requirement: Per-provider temperature configuration
Each LLM provider config SHALL support a configurable temperature value between 0.0 and 2.0 that controls the randomness of the model's output.
The default value SHALL be 0.7 for new providers. The temperature SHALL be passed to the `ChatCompletionRequest` when the provider is used.

#### Scenario: User sets temperature for a provider
- **WHEN** user sets temperature to 0.3 for an OpenAI provider
- **THEN** the provider config SHALL store temperature: 0.3
- **AND** subsequent chat requests using this provider SHALL include temperature: 0.3

### Requirement: Per-provider max tokens configuration
Each LLM provider config SHALL support a configurable max_tokens value.
The default SHALL be 4096 for new providers. The max_tokens SHALL be passed to the backend API when the provider is used.

#### Scenario: User sets max tokens for a provider
- **WHEN** user sets max_tokens to 2048 for an OpenAI provider
- **THEN** the provider config SHALL store max_tokens: 2048
- **AND** subsequent requests using this provider SHALL cap responses at 2048 tokens

### Requirement: Per-provider system prompt
Each LLM provider config SHALL support an optional system_prompt field.
If set, this SHALL be prepended as the system message in all chat requests using this provider.
If unset, no system prompt SHALL be sent (default behavior preserved).

#### Scenario: User sets system prompt for a provider
- **WHEN** user sets system_prompt to "You are a helpful tutor" for an Anthropic provider
- **THEN** the provider config SHALL store system_prompt: "You are a helpful tutor"
- **AND** chat requests using this provider SHALL include a system message with this text

#### Scenario: User clears system prompt
- **WHEN** user clears the system_prompt field for a provider
- **THEN** the provider SHALL NOT send any system message in requests

### Requirement: UI for per-provider advanced settings
The provider edit form (LLMProviderSettings) SHALL include fields for temperature (slider or number input, range 0.0–2.0, step 0.1), max_tokens (number input, min 1, max 128000), and system_prompt (textarea).
These fields SHALL appear below the model selector.

#### Scenario: Advanced settings fields visible in provider form
- **WHEN** user opens the add/edit provider form
- **THEN** SHALL see temperature slider, max_tokens input, and system_prompt textarea
- **AND** existing values SHALL be pre-filled if editing an existing provider

### Requirement: LLMProviderConfig interface extension
The `LLMProviderConfig` interface SHALL be extended with:
- `temperature: number` (default 0.7)
- `maxTokens: number` (default 4096)
- `systemPrompt?: string` (optional)

#### Scenario: New provider has default values
- **WHEN** a user adds a new provider via `addProvider`
- **THEN** the new provider SHALL have temperature: 0.7, maxTokens: 4096, and no systemPrompt
