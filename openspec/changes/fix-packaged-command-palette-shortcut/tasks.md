## 1. Diagnose packaged-build failure

- [ ] 1.1 Build or obtain the current CI AppImage that reproduces the Linux `Ctrl+K` failure.
- [ ] 1.2 Confirm `Ctrl+K` opens the palette in `npm run tauri dev` on the same Linux environment.
- [ ] 1.3 Run the AppImage with shortcut diagnostics enabled and identify whether failure occurs at native registration, native callback, frontend event receipt, or palette open handling.
- [ ] 1.4 Check Windows packaged build behavior for `Ctrl+K`.
- [ ] 1.5 Check macOS packaged build behavior for `Cmd+K`.

## 2. Fix the command palette shortcut delivery path

- [x] 2.1 Ensure native registration includes the platform primary modifier plus `K` for Linux, Windows, and macOS packaged builds.
- [x] 2.2 Ensure native menu accelerators or equivalent packaged-build fallbacks are present where global shortcuts are unreliable.
- [x] 2.3 Ensure native callbacks emit to the main webview with the same payload shape used by existing shortcut handling.
- [x] 2.4 Route the frontend event through `command-palette-open` and keep command palette state ownership centralized.
- [x] 2.5 Preserve editable-target safeguards so typing in inputs, textareas, selects, and contenteditable regions is not hijacked.

## 3. Add regression coverage

- [x] 3.1 Add or update unit tests for Linux/Windows `Ctrl+K`, macOS `Cmd+K`, alternate modifier rejection, and editable-target rejection.
- [x] 3.2 Add or update event dispatch tests proving the native/global shortcut event opens the palette through `command-palette-open`.
- [x] 3.3 Add a packaged-build smoke script or CI check where feasible for desktop artifacts.
- [x] 3.4 Document any manual verification that remains necessary when CI cannot inject real keystrokes into packaged GUI artifacts.

## 4. Verify release artifacts

- [ ] 4.1 Verify Linux CI-built AppImage: `Ctrl+K` opens the command palette from the app shell.
- [ ] 4.2 Verify Linux CI-built AppImage: `Ctrl+K` opens the command palette with a document viewer focused.
- [ ] 4.3 Verify Windows packaged artifact: `Ctrl+K` opens the command palette from the app shell and document viewer.
- [ ] 4.4 Verify macOS packaged artifact: `Cmd+K` opens the command palette from the app shell and document viewer.
- [ ] 4.5 Verify the shortcut does not open the command palette while typing in editable fields on Linux, Windows, and macOS.
