//! MCP Commands for Tauri
use crate::mcp::*;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::Manager;

/// Only these bare command names may be used to spawn MCP servers.
const MCP_ALLOWED_COMMANDS: &[&str] = &["npx", "uvx", "node", "python", "python3"];

/// Characters that must never appear in MCP server arguments (shell metacharacters).
const DANGEROUS_ARG_CHARS: &[char] = &['|', '>', '<', '&', '$', '`', '\n', '\r', ';'];

pub(crate) fn validate_mcp_command(command: &str, args: &[String]) -> Result<(), String> {
    // Reject paths — only bare command names are allowed
    if command.contains('/') || command.contains('\\') || command.contains('.') {
        return Err(format!(
            "MCP command must be a bare name (no paths): {}",
            command
        ));
    }

    if !MCP_ALLOWED_COMMANDS.contains(&command) {
        return Err(format!(
            "Command '{}' is not allowed. Permitted commands: {:?}",
            command, MCP_ALLOWED_COMMANDS
        ));
    }

    for (i, arg) in args.iter().enumerate() {
        for &ch in DANGEROUS_ARG_CHARS {
            if arg.contains(ch) {
                return Err(format!(
                    "Argument {} contains forbidden character '{}'",
                    i, ch
                ));
            }
        }
    }

    Ok(())
}

// Global MCP client manager
lazy_static::lazy_static! {
    static ref MCP_MANAGER: Arc<MCPClientManager> = Arc::new(MCPClientManager::new());
}

/// Add and connect to an external MCP server
#[tauri::command]
pub async fn mcp_add_server(
    id: String,
    name: String,
    command: String,
    args: Vec<String>,
    env: HashMap<String, String>,
    transport: String,
    transport_url: Option<String>,
) -> Result<String, String> {
    // Validate command against allowlist before doing anything else
    validate_mcp_command(&command, &args)?;

    // Determine transport type
    let mcp_transport = match transport.as_str() {
        "stdio" => MCPTransport::Stdio,
        "sse" => {
            let url = transport_url.ok_or("transport_url is required for SSE transport")?;
            MCPTransport::Sse(url)
        }
        _ => return Err(format!("Unknown transport type: {}", transport)),
    };

    let config = MCPServerConnection {
        id: id.clone(),
        name,
        command,
        args,
        env,
        transport: mcp_transport,
    };

    MCP_MANAGER.add_server(config).await?;
    Ok(id)
}

/// Remove and disconnect an MCP server
#[tauri::command]
pub async fn mcp_remove_server(id: String) -> Result<(), String> {
    MCP_MANAGER.remove_server(&id).await
}

/// List all connected MCP servers
#[tauri::command]
pub async fn mcp_list_servers() -> Result<Vec<MCPServerInfo>, String> {
    Ok(MCP_MANAGER.list_servers().await)
}

/// Get tools from all connected MCP servers
#[tauri::command]
pub async fn mcp_list_tools() -> Result<Vec<ToolDefinitionResponse>, String> {
    let tools = MCP_MANAGER.get_all_tools().await;
    Ok(tools
        .into_iter()
        .map(|(server_id, tool)| ToolDefinitionResponse {
            name: tool.name,
            description: format!("{} (from {})", tool.description, server_id),
            input_schema: tool.input_schema,
        })
        .collect())
}

/// Get tools from a specific MCP server
#[tauri::command]
pub async fn mcp_get_server_tools(id: String) -> Result<Vec<ToolDefinitionResponse>, String> {
    let tools = MCP_MANAGER.get_server_tools(&id).await?;
    Ok(tools
        .into_iter()
        .map(|tool| ToolDefinitionResponse {
            name: tool.name,
            description: tool.description,
            input_schema: tool.input_schema,
        })
        .collect())
}

/// Get info about a specific MCP server
#[tauri::command]
pub async fn mcp_get_server_info(id: String) -> Result<Option<MCPServerInfo>, String> {
    MCP_MANAGER.get_server_info(&id).await
}

/// Call a tool on a specific MCP server
#[tauri::command]
pub async fn mcp_call_tool(
    server_id: String,
    tool_name: String,
    arguments: serde_json::Value,
) -> Result<ToolCallResultResponse, String> {
    let result = MCP_MANAGER.call_tool(&server_id, &tool_name, arguments).await?;

    Ok(ToolCallResultResponse {
        content: result
            .content
            .into_iter()
            .map(|c| ToolContentResponse {
                r#type: c.r#type,
                text: c.text,
            })
            .collect(),
        is_error: result.is_error,
    })
}

/// Update an MCP server configuration
#[tauri::command]
pub async fn mcp_update_server(
    id: String,
    _updates: ServerConfigUpdate,
) -> Result<(), String> {
    // Remove the existing server
    MCP_MANAGER.remove_server(&id).await?;

    // Re-add with updated configuration
    // Note: In a real implementation, you'd persist these changes to the database
    // For now, this is a no-op as the configuration isn't stored
    Ok(())
}

/// Get Incrementum's built-in MCP tools
#[tauri::command]
pub async fn mcp_get_incrementum_tools(app: tauri::AppHandle) -> Result<Vec<ToolDefinitionResponse>, String> {
    let state = app.state::<crate::AppState>();
    let pool = {
        let db_guard = state
            .db
            .lock()
            .map_err(|_| "Failed to lock app state".to_string())?;
        let db = db_guard
            .as_ref()
            .ok_or_else(|| "Database not initialized".to_string())?;
        db.pool().clone()
    };
    let repository = crate::database::Repository::new(pool);
    let registry = MCPToolRegistry::new(std::sync::Arc::new(repository));

    Ok(registry
        .get_tools()
        .into_iter()
        .map(|tool| ToolDefinitionResponse {
            name: tool.name,
            description: tool.description,
            input_schema: tool.input_schema,
        })
        .collect())
}

/// Call Incrementum's built-in MCP tool
#[tauri::command]
pub async fn mcp_call_incrementum_tool(
    tool_name: String,
    arguments: serde_json::Value,
    app: tauri::AppHandle,
) -> Result<ToolCallResultResponse, String> {
    // Get the repository from the app state
    let state = app.state::<crate::AppState>();
    let pool = {
        let db_guard = state
            .db
            .lock()
            .map_err(|_| "Failed to lock app state".to_string())?;
        let db = db_guard
            .as_ref()
            .ok_or_else(|| "Database not initialized".to_string())?;
        db.pool().clone()
    };
    let repository = crate::database::Repository::new(pool);

    // Create tool registry with repository
    let registry = MCPToolRegistry::new(std::sync::Arc::new(repository));
    let result = registry.execute_tool(&tool_name, arguments).await?;

    Ok(ToolCallResultResponse {
        content: result
            .content
            .into_iter()
            .map(|c| ToolContentResponse {
                r#type: c.r#type,
                text: c.text,
            })
            .collect(),
        is_error: result.is_error,
    })
}

// Response types for Tauri commands

#[derive(serde::Deserialize)]
pub struct ServerConfigUpdate {
    pub name: Option<String>,
    pub endpoint: Option<String>,
    pub transport: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDefinitionResponse {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolContentResponse {
    #[serde(rename = "type")]
    pub r#type: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallResultResponse {
    pub content: Vec<ToolContentResponse>,
    #[serde(rename = "isError")]
    pub is_error: Option<bool>,
}
