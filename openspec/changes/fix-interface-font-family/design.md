# Design: Fix Interface Font Family

## Root Cause Analysis

Two bugs prevent the interface font from changing:

### Bug 1: CSS variable not consumed by Tailwind v4
- `ThemeContext.tsx` sets `--font-family` on `document.documentElement`
- `SettingsPage.tsx` also sets `--font-family` and `--font-family-sans`
- But Tailwind v4's base layer uses `--font-sans` for the default `font-sans` utility
- The `@theme` block in `index.css` does NOT define `--font-sans`
- Result: Tailwind defaults to `ui-sans-serif, system-ui, -apple-system, ...` regardless of user choice
- Only the `windows-95` theme applies `font-family: var(--font-family)` (via a specific `:root[data-theme-id]` selector)

### Bug 2: Google Fonts never loaded
- Settings dropdown offers 30+ Google Fonts (Inter, Outfit, Merriweather, etc.)
- No `@import`, `<link>`, or `@font-face` anywhere in the project
- Browser can't render fonts it doesn't have → falls back to system-ui
- Users see no change because the fallback looks the same as the default

## Technical Approach

### Fix 1: Wire `--font-family` into Tailwind v4

In `src/index.css`, add to the `@theme` block:
```css
--font-sans: var(--font-family, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
--font-serif: var(--font-family-serif, ui-serif, Georgia, "Times New Roman", serif);
--font-mono: var(--font-family-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
```

This makes Tailwind's `font-sans` utility (used by default body text) reference `--font-family`, which `ThemeContext.tsx` already sets.

Also add to the base `html, body` rule:
```css
font-family: var(--font-family);
```

### Fix 2: Dynamic Google Font loading

Create a utility function `loadGoogleFont(family: string)`:
```typescript
const loadedFonts = new Set<string>();

export function loadGoogleFont(family: string): void {
  const SYSTEM_FONTS = new Set(["system-ui", "serif", "sans-serif", "monospace"]);
  if (SYSTEM_FONTS.has(family) || loadedFonts.has(family)) return;

  const encoded = family.replace(/ /g, "+");
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encoded}:wght@300;400;500;600;700&display=swap`;
  document.head.appendChild(link);
  loadedFonts.add(family);
}
```

Call from:
- `ThemeContext.tsx`: in the `useEffect` that applies theme (after `applyThemeToDOM`)
- `SettingsPage.tsx`: in the `useEffect` that calls `applyFontFamily`

### File Changes

| File | Change |
|------|--------|
| `src/index.css` | Add `--font-sans` mapping in `@theme`; add `font-family` to base `html, body` |
| `src/utils/fonts.ts` | New file — `loadGoogleFont()` utility |
| `src/contexts/ThemeContext.tsx` | Import + call `loadGoogleFont()` in theme effect |
| `src/components/settings/SettingsPage.tsx` | Import + call `loadGoogleFont()` in font effect |
