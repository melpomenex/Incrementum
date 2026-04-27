## 1. Wrapper Script Hardening

- [x] 1.1 Add `enhance_path()` function to `src-tauri/bin/pocket-tts-x86_64-unknown-linux-gnu` that prepends `$HOME/.local/bin` and `$HOME/.local/share/uv/tools/pocket-tts/bin` to PATH (if directories exist)
- [x] 1.2 Add `verify_module()` function that runs `"$PYTHON" -c "import pocket_tts"` and exits with a clear error message + installation instructions if it fails
- [x] 1.3 Call `enhance_path()` before `find_python()` and call `verify_module()` after locating Python, before the `--text-file` / synthesis logic

## 2. Rust Availability Check

- [x] 2.1 In `check_pocket_tts_available` (src-tauri/src/pocket_tts.rs), capture stderr lines during the `--help` sidecar check
- [x] 2.2 After the sidecar terminates, inspect captured stderr for `ModuleNotFoundError` or `No module named 'pocket_tts'` patterns
- [x] 2.3 When the pattern is detected, set error message to indicate pocket_tts is not installed (with installation command)

## 3. Settings UI

- [x] 3.1 In `TTSSettings.tsx`, check if the availability error contains "not installed" and display the `uv tool install pocket-tts` command prominently in the status panel
