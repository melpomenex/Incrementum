# Proposal: Fix Interface Font Family Not Applying

## Intent
The settings page offers 30+ font choices (Inter, Merriweather, Poppins, etc.) but changing the font has no visible effect on the interface. The root cause is two-fold: the CSS variable holding the chosen font is never consumed by the base UI, and the Google Font files are never loaded.

## Scope
In scope:
- Wire the `--font-family` CSS variable into the base UI (via Tailwind v4 `--font-sans`)
- Load Google Font files when a non-system font is selected
- Ensure font persists across theme changes and page reloads

Out of scope:
- EPUB/PDF/HTML document reader fonts (those have their own settings)
- Adding new fonts to the list
- Font subsetting or performance optimization

## Approach
1. In `index.css` `@theme` block, set `--font-sans: var(--font-family, ...)` so Tailwind's `font-sans` utility (and the default body text) uses the user's chosen font.
2. Add a `loadGoogleFont()` function that dynamically injects a `<link>` for the selected Google Font. Call it from `ThemeContext.tsx` and `SettingsPage.tsx` when the font changes.
3. For system fonts (system-ui, serif, sans-serif, monospace), skip the Google Fonts load — just set the CSS variable.
