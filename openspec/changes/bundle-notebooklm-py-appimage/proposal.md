## Why

NotebookLM integration currently works only inside a development venv and fails in the packaged AppImage because required Python runtime pieces are not bundled or resolved correctly at runtime. This blocks end users from using NotebookLM features in production builds.

## What Changes

- Bundle `notebooklm-py` and its required Python environment artifacts into the distributable app runtime.
- Ensure the packaged app can locate and launch the bundled NotebookLM runtime without relying on an external venv.
- Add startup/runtime checks and failure reporting so NotebookLM integration fails with actionable diagnostics when dependencies are missing.
- Update packaging/build workflow so AppImage outputs consistently include NotebookLM runtime assets.

## Capabilities

### New Capabilities
- `notebooklm-runtime-bundling`: Package and run NotebookLM Python integration dependencies from within distributed app artifacts (including AppImage) without requiring a developer venv.

### Modified Capabilities
- None.

## Impact

- Affected code paths in Tauri-side runtime process launching and environment setup for Python integrations.
- Build/packaging scripts and bundle configuration for Linux AppImage outputs.
- Runtime dependency footprint increases due to bundled Python packages/interpreter assets.
- Release validation must include NotebookLM integration checks against packaged artifacts, not only local venv execution.
