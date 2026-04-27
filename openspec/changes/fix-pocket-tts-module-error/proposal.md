## Why

Pocket TTS synthesis fails with `ModuleNotFoundError: No module named 'pocket_tts'` when using the `--text-file` path on Linux. The Linux sidecar wrapper finds system Python but does not verify that the `pocket_tts` module is actually importable before attempting synthesis. The availability check (`--help`) can also report success in scenarios where the module is not properly installed, leading to confusing runtime failures.

## What Changes

- The Linux sidecar wrapper (`pocket-tts-x86_64-unknown-linux-gnu`) will verify that the `pocket_tts` Python module is importable before attempting synthesis, and will produce a clear, actionable error message if it is not.
- The wrapper will search additional common paths for `pocket_tts` installations (e.g., `~/.local/bin`, uv tool directories) so that user-installed copies are found even when the app inherits a minimal `PATH`.
- The Rust-side availability check (`check_pocket_tts_available`) will be hardened to detect module-not-found errors in stderr and report them as unavailable (rather than relying solely on exit code).
- The availability check will also attempt a `python -c "import pocket_tts"` verification step so that `ModuleNotFoundError` is caught at check time, not at synthesis time.

## Capabilities

### New Capabilities

- `pocket-tts-availability`: Covers module import verification, enhanced path discovery, and actionable error messaging for the Pocket TTS sidecar wrapper and Rust availability check.

### Modified Capabilities

## Impact

- `src-tauri/bin/pocket-tts-x86_64-unknown-linux-gnu` — wrapper script changes for module verification and path discovery
- `src-tauri/src/pocket_tts.rs` — availability check stderr inspection, import-based verification
- `src/components/settings/TTSSettings.tsx` — may need to surface clearer installation instructions in the status panel
- No breaking changes to the Tauri command interface or frontend API
