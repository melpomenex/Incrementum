## Context

The Pocket TTS feature uses a shell script sidecar (`pocket-tts-x86_64-unknown-linux-gnu`) that locates a Python interpreter and runs `pocket_tts` as a Python module. There are two code paths in the wrapper:

1. **Direct path** (`exec "$PYTHON" -m pocket_tts "$@"`) — used when `--text-file` is not passed
2. **Wrapper path** — creates a temp `.py` script that does `from pocket_tts.__main__ import cli_app; cli_app()` when `--text-file` is passed

The Rust code in `pocket_tts.rs` always passes `--text-file` (to avoid `ARG_MAX` limits), so synthesis always goes through the wrapper path. The availability check uses `--help` which goes through the direct path.

The `pocket-tts-runtime/` directory is empty — no bundled Python/pocket-tts exists. The wrapper falls back to system Python, which may not have `pocket_tts` installed. The Rust availability check only looks at the exit code of `--help` and does not inspect stderr for `ModuleNotFoundError`.

Current environment setup: Rust does `env_clear()` then sets `HOME`, `USER`, `PATH` from the current process. If the app is launched from a desktop entry or AppImage, `PATH` may not include `~/.local/bin` where `uv tool install` places binaries.

## Goals / Non-Goals

**Goals:**
- Detect `pocket_tts` unavailability early (at status-check time, not synthesis time)
- Surface actionable installation instructions in the wrapper and settings UI
- Expand PATH discovery to cover common installation locations (`~/.local/bin`, uv tool dirs)
- Maintain the existing sidecar contract (no changes to Tauri command signatures)

**Non-Goals:**
- Auto-installing `pocket_tts` from within the app
- Bundling a Python runtime with pocket_tts pre-installed
- Changing the macOS or Windows wrapper scripts (they have different discovery mechanisms and are not affected by this specific error)

## Decisions

### 1. Wrapper-level module verification

**Decision**: Add a `verify_module()` function to the Linux wrapper that runs `"$PYTHON" -c "import pocket_tts"` before proceeding with synthesis.

**Rationale**: The current wrapper only checks that a Python interpreter exists (`find_python`), not that the module is importable. Adding an import check catches the failure before creating temp files and wrapper scripts.

**Alternative considered**: Run `python3 -m pocket_tts --help` as the verification — rejected because it's slower (loads the full CLI) and may have side effects (model download prompts).

### 2. Enhanced PATH construction

**Decision**: After locating the system Python, prepend common user-local directories to PATH: `$HOME/.local/bin`, `$HOME/.local/share/uv/tools/pocket-tts/bin`, and any directory containing the resolved Python binary.

**Rationale**: When the app is launched from a desktop entry, `PATH` may be minimal. Users who install via `uv tool install pocket-tts` get the binary in `~/.local/bin/`. The uv virtualenv bin directory is needed for `python3 -m pocket_tts` to find the module.

**Alternative considered**: Use `$PYTHON -c "import pocket_tts; print(pocket_tts.__file__)"` to discover the installation — too fragile, depends on the package exposing `__file__`.

### 3. Rust-side stderr inspection

**Decision**: In `check_pocket_tts_available`, inspect stderr for `ModuleNotFoundError` or `No module named` patterns and report `available: false` with a descriptive error message.

**Rationale**: Currently the availability check only checks exit code. If the sidecar wrapper exits non-zero with a clear module-not-found error, the Rust code should parse that and present it as "not installed" rather than a generic "sidecar not found".

### 4. Single-platform scope

**Decision**: Only modify the Linux wrapper. macOS and Windows wrappers use different discovery mechanisms (searching standard Homebrew/program-files paths) and are not affected by this specific AppImage/PATH issue.

**Rationale**: The error traceback shows `/tmp/pocket-tts-wrapper-*.py` which is specific to the Linux wrapper's `--text-file` handling. The macOS wrappers don't have this temp-wrapper pattern.

## Risks / Trade-offs

- **[Slow availability check]** → The import verification adds ~200ms to the status check. Mitigated by only running it when the initial `--help` check succeeds.
- **[PATH expansion may find wrong Python]** → Adding too many directories could cause conflicts. Mitigated by only adding directories that actually exist on disk.
- **[uv tool directory layout may change]** → Hardcoding `~/.local/share/uv/tools/pocket-tts/bin` is fragile. Mitigated by treating it as a fallback after `~/.local/bin` and system Python.
