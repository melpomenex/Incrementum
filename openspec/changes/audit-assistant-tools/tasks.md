## 1. Backend Tool List Consolidation

- [x] 1.1 Refactor `mcp_get_incrementum_tools` in `src-tauri/src/commands/mcp.rs` to derive the tool list from `MCPToolRegistry::register_default_tools()` instead of maintaining a separate hardcoded list
- [x] 1.2 Add a `list_tools()` method to `MCPToolRegistry` that returns all registered `ToolDefinition` structs
- [x] 1.3 Verify all 21 tools (including `get_queue_documents`, `extract_video_snippet`, `get_video_extracts`, `get_video_transcript`) are returned

## 2. Frontend Tool Loading

- [x] 2.1 Remove the hardcoded `getAvailableTools()` fallback in `AssistantPanel.tsx` (lines 851-883)
- [x] 2.2 Ensure `useEffect` on mount fetches tools from backend via `getIncrementumMCPTools()` and shows a loading state if not yet loaded
- [x] 2.3 Pass the fetched tool list (not fallback) to `buildToolInstruction()`

## 3. System Prompt Rewrite

- [x] 3.1 Rewrite `buildToolInstruction()` in `AssistantPanel.tsx` (lines 970-1016) with explicit respond-vs-act rules
- [x] 3.2 Include the full list of available tools with brief descriptions in the prompt
- [x] 3.3 Add examples of correct tool call format and incorrect raw JSON output

## 4. Tool Call Parsing Hardening

- [x] 4.1 Enhance `parseToolCalls()` in `AssistantPanel.tsx` (lines 885-921) to also match unfenced tool call JSON containing recognized tool names
- [x] 4.2 Add a set of known tool names from the current tool list for validation during fallback parsing
- [x] 4.3 Ensure non-tool JSON (without recognized tool names) is left untouched and displayed as regular text

## 5. Tool Execution Confirmation

- [x] 5.1 After `executeToolCalls()` completes in `AssistantPanel.tsx`, generate a confirmation message summarizing what was created (type and count)
- [x] 5.2 Add the confirmation as a follow-up assistant message in the conversation
- [x] 5.3 Handle error cases: display the error message when a tool call fails
