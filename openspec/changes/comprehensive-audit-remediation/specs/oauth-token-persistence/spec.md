## ADDED Requirements

### Requirement: LLM API keys are persisted in the OS keychain
LLM API keys for OpenAI, Anthropic, OpenRouter, and other providers SHALL be stored in the OS keychain using the `keyring` crate with service name `com.incrementum.app.ai` and username equal to the provider name. The keys SHALL NOT be stored in-memory in the `AIState` struct as plaintext.

#### Scenario: API key stored after set_api_key
- **WHEN** `set_api_key` is called with a provider name and API key
- **THEN** the key SHALL be stored in the OS keychain
- **AND** the in-memory `AIState` SHALL only contain a boolean indicating a key is configured

#### Scenario: API key loaded on startup
- **WHEN** the app starts
- **THEN** the system SHALL check the OS keychain for stored API keys
- **AND** the `AIState` SHALL reflect which providers have configured keys

#### Scenario: get_ai_config does not expose keys
- **WHEN** `get_ai_config` is called
- **THEN** the response SHALL include provider configuration and a `has_api_key` boolean for each provider
- **AND** the response SHALL NOT include the actual API key value

#### Scenario: Frontend displays masked key
- **WHEN** the settings UI displays an API key field for a configured provider
- **THEN** the UI SHALL show only the last 4 characters of the key (e.g., `****abcd`)
