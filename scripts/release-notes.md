### Fixed & Improved
- **Full settings-menu localization (incl. the keyboard shortcuts menu)** — The keyboard shortcuts settings menu and its Vim Reading section rendered in English for every non-English locale because the keys were missing or wired to hardcoded strings. Added the missing keys (the Extract Text shortcut, the Vim Reading category, and the Vim Reading section labels), wired the hardcoded strings in the settings component to i18n, and translated the full shortcuts menu plus ~540 other previously-missing UI strings across zh/es/de/fr/ja — the settings dialog no longer falls back to English. Also translated the new system-TTS voice picker added in v1.57.3, and fixed a `calendar.november` typo in French that had left November rendering in English.

### Tooling
- Added a local **cut-release** skill (`.agents/skills/`) documenting this repo's release workflow, and gitignore rules for browser-extension build artifacts so they no longer leak into release commits.
