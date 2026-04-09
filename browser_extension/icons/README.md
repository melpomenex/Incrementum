# Browser Extension Icons

This directory should contain the following icon files for the Incrementum Browser Sync extension:

- `icon16.png` - 16x16 pixels (toolbar icon)
- `icon32.png` - 32x32 pixels (Windows taskbar)
- `icon48.png` - 48x48 pixels (extension management page)
- `icon128.png` - 128x128 pixels (Chrome Web Store)

## Source Of Truth

These files are generated from the canonical app icon at `src-tauri/icons/icon.png` via `scripts/generate-icons.mjs`.

## Regenerating

Run:

```bash
node scripts/generate-icons.mjs
```

This refreshes:

- PWA icons in `public/icons/`
- `public/apple-touch-icon.png`
- Browser extension icons in this directory
