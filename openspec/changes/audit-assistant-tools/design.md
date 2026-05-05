## Context

The assistant panel uses a text-based tool call protocol: the LLM emits ````tool_calls` fenced JSON blocks, which are parsed and routed to the MCP tool registry. This approach was chosen over native function calling APIs to support multiple LLM providers (OpenAI, Anthropic, Ollama, OpenRouter) uniformly. However, the protocol is fragile — if the LLM doesn't format tool calls exactly right, they silently fail and the user sees raw JSON in the chat.

Current state:
- 21 tools registered in `MCPToolRegistry` (`tools.rs`)
- Only 17 exposed via `mcp_get_incrementum_tools` (`mcp.rs`) — missing 4 video/queue tools
- Only 6 in the frontend hardcoded fallback (`AssistantPanel.tsx`)
- System prompt tells the LLM about tools but doesn't clearly distinguish "respond" vs "act" intent
- No feedback loop: after tool execution, the user sees "Running tool calls..." but not what was created

## Goals / Non-Goals

**Goals:**
- All 21 MCP tools are discoverable and callable from the assistant
- The LLM reliably emits tool calls when the user asks to create/save items (not raw JSON to chat)
- The LLM reliably responds conversationally when the user asks questions
- After tool execution, the user gets clear confirmation of what was created
- Tool call parsing handles common LLM formatting mistakes

**Non-Goals:**
- Switching to native function calling APIs (out of scope — would require per-provider adapters)
- Adding new MCP tools or changing tool schemas
- Changing the database schema
- Modifying the MCP tool handler implementations in Rust

## Decisions

### 1. Consolidate tool list from backend, eliminate hardcoded fallback

**Decision**: The `mcp_get_incrementum_tools` Tauri command SHALL return all tools from the `MCPToolRegistry`. The frontend SHALL fetch tools on mount and remove the hardcoded fallback list entirely.

**Rationale**: The fallback list is always stale. The registry is the source of truth. If the backend hasn't loaded yet, show a loading state instead of an incomplete tool set.

### 2. Strengthen system prompt with explicit respond-vs-act rules

**Decision**: Rewrite `buildToolInstruction()` to include explicit rules:
- When the user says "create flashcards", "make cards", "save this", "add a card" → MUST emit a tool call
- When the user asks a question, wants an explanation, or is just chatting → respond conversationally
- NEVER output raw JSON for items that could be created via tools

**Rationale**: The current prompt is too soft ("Create flashcards when asked"). LLMs need explicit, imperative instructions to reliably choose between tool calls and text responses.

### 3. Add tool execution confirmation message

**Decision**: After `executeToolCalls()` completes, inject a follow-up assistant message summarizing what was created (e.g., "Created 5 Q&A flashcards from the document"). Include item count and type.

**Rationale**: Currently the user sees "Running tool calls..." with no confirmation. This makes it unclear whether anything was actually saved.

### 4. Harden tool call parsing for common LLM mistakes

**Decision**: Enhance `parseToolCalls()` to also match:
- Unfenced JSON arrays starting with `[{"name":` or `[{"tool_calls":`
- JSON objects with `tool_calls` key that aren't wrapped in a code fence
- Single tool call objects without the array wrapper

**Rationale**: LLMs sometimes emit valid tool call JSON without the exact fence format. Catching these patterns prevents silent failures.

## Risks / Trade-offs

- **Broader JSON matching may false-positive on non-tool JSON** → Mitigate by requiring the JSON to contain recognized tool names from the current tool list
- **Stronger system prompt uses more tokens** → Acceptable tradeoff for reliability; keep prompt under 500 tokens
- **Removing the fallback means tools are unavailable until backend loads** → The assistant already requires backend for LLM calls, so this is an acceptable dependency
