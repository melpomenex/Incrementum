# Tasks: Fix Interface Font Family

## 1. Wire CSS variable into Tailwind
- [x] 1.1 Add `--font-sans: var(--font-family, ui-sans-serif, ...)` to `@theme` block in `src/index.css`
- [x] 1.2 Add `font-family: var(--font-family)` to base `html, body` rule in `src/index.css`
- [x] 1.3 Verify `windows-95` theme rule doesn't conflict (it already uses `var(--font-family)`)

## 2. Create Google Font loader
- [x] 2.1 Create `src/utils/fonts.ts` with `loadGoogleFont(family: string)` function
- [x] 2.2 Function should skip system fonts (system-ui, serif, sans-serif, monospace)
- [x] 2.3 Function should deduplicate (don't load same font twice)

## 3. Integrate font loader
- [x] 3.1 Import and call `loadGoogleFont()` in `ThemeContext.tsx` theme application effect
- [x] 3.2 Import and call `loadGoogleFont()` in `SettingsPage.tsx` font change effect

## 4. Verify
- [x] 4.1 TypeScript compiles (`npx tsc --noEmit`)
- [ ] 4.2 Test in browser: changing font in settings visibly changes interface
- [ ] 4.3 Test persistence: font survives page reload
- [ ] 4.4 Test theme switch: font persists when switching between themes
