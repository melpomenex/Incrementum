## ADDED Requirements

### Requirement: Complete tool exposure
The system SHALL expose all tools registered in `MCPToolRegistry` to the assistant frontend. The `mcp_get_incrementum_tools` Tauri command SHALL return every tool from the registry, matching `register_default_tools()` exactly.

#### Scenario: All registry tools are available to the assistant
- **WHEN** the frontend calls `mcp_get_incrementum_tools`
- **THEN** the returned list SHALL include all 21 tools from `MCPToolRegistry::register_default_tools()`

#### Scenario: Frontend has no hardcoded tool fallback
- **WHEN** the assistant panel mounts
- **THEN** tools are fetched from the backend via `getIncrementumMCPTools()`
- **AND** no hardcoded tool list is used as a fallback

### Requirement: Explicit respond-vs-act system prompt
The system prompt SHALL contain explicit instructions distinguishing when the LLM MUST emit tool calls versus when it MUST respond conversationally.

#### Scenario: User requests flashcard creation
- **WHEN** the user message contains intent to create flashcards (e.g., "create flashcards", "make cards", "generate qa cards", "create a set of flashcards")
- **THEN** the LLM SHALL emit a `tool_calls` fenced block with `create_qa_card` or `batch_create_cards` tool calls
- **AND** SHALL NOT output raw flashcard JSON as plain text

#### Scenario: User asks a question
- **WHEN** the user message is a question about document content (e.g., "what does this mean?", "explain this concept")
- **THEN** the LLM SHALL respond conversationally without any tool calls

#### Scenario: User asks for both explanation and flashcards
- **WHEN** the user message requests both an explanation and flashcard creation
- **THEN** the LLM SHALL provide a conversational explanation AND emit tool calls to create the flashcards

### Requirement: Tool execution confirmation
After tool calls are executed, the system SHALL display a confirmation message to the user indicating what was created.

#### Scenario: Flashcard creation succeeds
- **WHEN** `create_qa_card` or `batch_create_cards` tool calls execute successfully
- **THEN** the assistant SHALL display a message like "Created N flashcard(s) and saved them to your library"

#### Scenario: Extract creation succeeds
- **WHEN** `create_extract` tool call executes successfully
- **THEN** the assistant SHALL display a message like "Extract saved to the document"

#### Scenario: Tool call fails
- **WHEN** a tool call execution fails
- **THEN** the assistant SHALL display the error message to the user

### Requirement: Resilient tool call parsing
The `parseToolCalls()` function SHALL handle common LLM formatting variations beyond the exact ````tool_calls` fence format.

#### Scenario: Tool call JSON without fence wrapper
- **WHEN** the LLM outputs valid tool call JSON containing recognized tool names but without the ````tool_calls` fence
- **THEN** the parser SHALL still detect and execute the tool calls

#### Scenario: Tool call JSON with array wrapper only
- **WHEN** the LLM outputs `[{"name": "create_qa_card", "arguments": {...}}]` as plain text
- **THEN** the parser SHALL detect and execute the tool call

#### Scenario: Non-tool JSON is left untouched
- **WHEN** the LLM outputs JSON that does not contain recognized tool names
- **THEN** the parser SHALL NOT attempt to execute it as a tool call
- **AND** the JSON SHALL be displayed as regular text

### Requirement: Tool list consistency
The tool definitions returned by `mcp_get_incrementum_tools` SHALL match the `MCPToolRegistry` definitions exactly, derived from the same source rather than maintained separately.

#### Scenario: Tool added to registry appears in frontend
- **WHEN** a new tool is registered in `MCPToolRegistry::register_default_tools()`
- **THEN** it SHALL automatically appear in the frontend tool list without any additional code changes
