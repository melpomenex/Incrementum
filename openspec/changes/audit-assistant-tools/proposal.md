## Why

The assistant uses a text-based tool call protocol (fenced JSON blocks) instead of native LLM function calling. This relies on the LLM correctly formatting tool calls as ````tool_calls` code blocks — when it doesn't, tool calls silently fail and the raw JSON is displayed as chat text. The core problem: the assistant outputs flashcard JSON to chat instead of executing `create_qa_card` / `batch_create_cards` tool calls, and lacks clear guidelines for when to respond vs. act.

## What Changes

- Audit all 21 registered MCP tools for correctness — verify each tool's handler works, its schema is accurate, and the frontend tool list is complete
- Fix the tool list mismatch: the frontend `mcp_get_incrementum_tools` command exposes only 17 tools (missing `get_queue_documents`, `extract_video_snippet`, `get_video_extracts`, `get_video_transcript`), and the hardcoded fallback only has 6
- Strengthen the system prompt in `buildToolInstruction()` to explicitly instruct the LLM to emit tool calls (not raw JSON) when the user asks to create/save items, and to respond conversationally when the user is just asking a question
- Add tool call confirmation feedback — after tool execution succeeds, the assistant should report what was created (e.g., "Created 5 flashcards and saved them to your library")
- Ensure the tool call parsing in `parseToolCalls()` handles edge cases where the LLM outputs JSON without the fence wrapper

## Capabilities

### New Capabilities
- `assistant-tool-reliability`: Ensures all registered tools are exposed to the assistant, tool calls are reliably parsed and executed, and the LLM receives clear instructions on when to use tools vs. respond conversationally

### Modified Capabilities
<!-- No existing specs are being modified at the requirements level -->

## Impact

- `src/components/assistant/AssistantPanel.tsx` — system prompt, tool parsing, tool list, execution feedback
- `src-tauri/src/mcp/tools.rs` — tool registration completeness
- `src-tauri/src/commands/mcp.rs` — `mcp_get_incrementum_tools` tool list
- `src/api/mcp.ts` — tool API types
- No database changes required
