## 1. Runtime Packaging Definition

- [x] 1.1 Audit current NotebookLM runtime assets under `src-tauri/bin/notebooklm-runtime/<triple>/` and define the minimum required runtime layout (python executable, notebooklm site-packages, optional playwright assets).
- [x] 1.2 Update Linux/AppImage packaging configuration to explicitly include required NotebookLM runtime directories and CLI binaries.
- [x] 1.3 Add/refresh runtime manifest metadata used to validate packaged runtime completeness.

## 2. Backend Runtime Resolution and Environment

- [x] 2.1 Update NotebookLM runtime resolution logic in `src-tauri/src/notebooklm.rs` to prioritize bundled runtime in packaged AppImage context.
- [x] 2.2 Consolidate NotebookLM command environment construction so health checks and command execution share identical runtime env setup.
- [x] 2.3 Ensure runtime environment includes required python/module/playwright path variables for bundled execution.
- [x] 2.4 Preserve controlled fallback behavior (managed bootstrap/system CLI) only when bundled runtime is unavailable or explicitly invalid.

## 3. Runtime Validation and Diagnostics

- [x] 3.1 Implement runtime integrity validation against manifest/layout before first NotebookLM command execution.
- [x] 3.2 Return actionable integration errors that identify missing runtime components and remediation guidance.
- [x] 3.3 Add structured logging around runtime selection path (bundled vs managed vs system) for packaged troubleshooting.

## 4. Verification and Release Readiness

- [x] 4.1 Add or update automated smoke checks that run NotebookLM health and one command path against packaged Linux artifacts.
- [x] 4.2 Build a Linux AppImage and verify NotebookLM works without activating any external venv.
- [x] 4.3 Document release validation steps and known trade-offs (artifact size growth, runtime refresh cadence).
