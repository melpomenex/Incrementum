## ADDED Requirements

### Requirement: MCP server commands MUST be restricted to an allowlist
The `mcp_add_server` command SHALL only allow commands that appear on a predefined allowlist of known MCP server launchers (e.g., `npx`, `uvx`, `node`, `python`, `python3`). Commands not on the allowlist SHALL trigger a native confirmation dialog before proceeding.

#### Scenario: Allowlisted MCP server command
- **WHEN** `mcp_add_server` is called with `command = "npx"` and `args = ["-y", "@modelcontextprotocol/server-fetch"]`
- **THEN** the server SHALL be added and spawned without additional confirmation

#### Scenario: Non-allowlisted command with user confirmation
- **WHEN** `mcp_add_server` is called with `command = "/usr/local/bin/custom-server"`
- **THEN** a native dialog SHALL be shown asking the user to confirm the execution
- **AND** if the user confirms, the server SHALL be added

#### Scenario: Non-allowlisted command with user rejection
- **WHEN** `mcp_add_server` is called with `command = "/usr/local/bin/custom-server"`
- **AND** the user rejects the confirmation dialog
- **THEN** the command SHALL return an error and no process SHALL be spawned

### Requirement: MCP server environment variables MUST NOT be user-controlled
The `mcp_add_server` command SHALL NOT accept arbitrary `env` values from the frontend. Environment variables for MCP servers SHALL be restricted to a known safe set (e.g., `PATH`, `HOME`, `NODE_PATH`).

#### Scenario: Attempt to inject environment variable
- **WHEN** `mcp_add_server` is called with `env = { "LD_PRELOAD": "/ malicious.so" }`
- **THEN** the `LD_PRELOAD` variable SHALL be stripped before passing to the child process

### Requirement: MCP tool operations SHALL require confirmation for destructive actions
MCP tools that perform destructive operations (`delete_document`, `batch_delete_cards`) SHALL require a confirmation result from the MCP client before execution. The tool definition SHALL mark these as requiring confirmation.

#### Scenario: Destructive MCP tool without confirmation
- **WHEN** an MCP client calls `delete_document` without providing a `confirmed: true` parameter
- **THEN** the tool SHALL return an error requesting confirmation
