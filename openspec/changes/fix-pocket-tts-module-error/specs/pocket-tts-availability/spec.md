## ADDED Requirements

### Requirement: Module import verification in wrapper
The Linux sidecar wrapper SHALL verify that the `pocket_tts` Python module is importable before attempting synthesis. If the module cannot be imported, the wrapper SHALL exit with a non-zero code and print a clear error message to stderr including installation instructions.

#### Scenario: Module not installed
- **WHEN** the wrapper script runs and `python3 -c "import pocket_tts"` fails with `ModuleNotFoundError`
- **THEN** the wrapper exits with code 1 and prints an error message containing the text "pocket_tts is not installed" and the command "uv tool install pocket-tts"

#### Scenario: Module installed correctly
- **WHEN** the wrapper script runs and `python3 -c "import pocket_tts"` succeeds
- **THEN** the wrapper proceeds to synthesis normally

### Requirement: Enhanced PATH discovery
The Linux sidecar wrapper SHALL append common installation directories to PATH before locating Python or running the module. These directories SHALL include `$HOME/.local/bin` and `$HOME/.local/share/uv/tools/pocket-tts/bin`, but only if they exist on disk.

#### Scenario: User installed via uv tool
- **WHEN** pocket_tts is installed via `uv tool install pocket-tts` in `~/.local/bin`
- **THEN** the wrapper includes `$HOME/.local/bin` in PATH and finds the pocket_tts module

#### Scenario: Standard system install
- **WHEN** pocket_tts is installed in the system Python's site-packages
- **THEN** the wrapper works as before with no regressions

### Requirement: Rust availability check stderr inspection
The Rust `check_pocket_tts_available` function SHALL inspect stderr output from the sidecar for `ModuleNotFoundError` or `No module named` patterns. When detected, it SHALL report `available: false` with an error message indicating that pocket_tts is not installed.

#### Scenario: Sidecar exits non-zero with module error
- **WHEN** the sidecar `--help` check fails and stderr contains "ModuleNotFoundError" or "No module named 'pocket_tts'"
- **THEN** the status response includes `available: false` and `error` containing "pocket_tts is not installed"

#### Scenario: Sidecar exits non-zero for other reasons
- **WHEN** the sidecar `--help` check fails for a reason other than module-not-found (e.g., permission denied)
- **THEN** the status response includes `available: false` with the existing generic error message

### Requirement: Clear availability error in settings UI
When Pocket TTS is reported as unavailable due to a missing module, the settings UI SHALL display the error message from the availability check and include actionable installation instructions.

#### Scenario: Missing module shown in settings
- **WHEN** the user opens TTS settings and Pocket TTS is unavailable with a "not installed" error
- **THEN** the settings panel shows the error and displays the command "uv tool install pocket-tts"
