# Packaged Command Palette Shortcut Verification

Use this checklist when validating desktop release artifacts. Dev mode is not
enough for this regression because packaged WebViews can handle accelerators
differently.

## Linux AppImage

1. Download or build the CI AppImage.
2. Run it from a terminal with diagnostics visible:

   ```bash
   RUST_LOG=incrementum_tauri=debug ./Incrementum-*-x86_64.AppImage
   ```

3. Press `Ctrl+K` from the app shell. The command palette must open.
4. Open a document viewer and press `Ctrl+K`. The command palette must open.
5. Focus an input, textarea, select, or contenteditable field and press
   `Ctrl+K`. The command palette must not open.

Expected diagnostic path when the native fallback fires:

- Rust logs either `global-shortcut fired: KeyK` or
  `menu accelerator shortcut emitted: KeyK`.
- The frontend logs `[global-shortcut] received: KeyK`.
- The command palette opens through the shared `command-palette-open` event.

## Windows

Repeat the same checks with the packaged Windows artifact using `Ctrl+K`.

## macOS

Repeat the same checks with the packaged macOS artifact using `Cmd+K`.
