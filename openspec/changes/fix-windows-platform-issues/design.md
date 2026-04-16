## Context

Incrementum uses a Tauri + React architecture with platform-specific WebView engines:
- **macOS**: WebKit (WKWebView)
- **Windows**: WebView2 (Edge/Chromium)
- **Linux**: WebKitGTK

Two bugs affect the Windows build:

1. **Animated themes show nothing.** The `ThemeBackdrop` component renders a full-screen `<canvas>` at `z-index: 0` with `position: fixed`. Legacy animated themes inject `customCSS` that sets `background: transparent !important` on `.app-shell`, `.main-content`, and `.bg-cream` so the canvas animation shows through. On macOS this works; on Windows the canvas appears blank or the transparent backgrounds don't composite correctly.

2. **Anna's Archive button shows but is non-functional on Windows.** The button is gated by `isTauri()` which is `true` on all desktop platforms. The underlying search/download Rust commands fail on Windows (likely due to file path handling or network issues). The simplest fix is to hide it on Windows.

### Current Architecture

**Theme animation flow:**
1. Theme with `effects.backgroundAnimation` is selected
2. `ThemeContext.applyThemeToDOM()` sets `data-theme-animation` attribute on `<html>`
3. Legacy themes auto-generate `customCSS` (in `legacyIndex.ts` lines 190-210) that makes background panels transparent
4. `ThemeBackdrop` component reads the animation ID, looks it up in the `_ANIM` registry, and starts a Canvas 2D animation loop
5. Canvas is positioned behind all content via CSS (`.theme-backdrop` at `z-index: 0`, `position: fixed`)

**Platform detection:** Currently only `isTauri()` and `isPWA()` exist in `src/lib/tauri.ts`. Keyboard shortcut code uses inline `navigator.platform` checks for macOS detection but there's no shared utility.

## Goals / Non-Goals

**Goals:**
- Animated themes render correctly on Windows WebView2
- Anna's Archive button is hidden on platforms where it doesn't work (Windows, Linux)
- A reusable `isMac()` / `getPlatform()` utility is available for future platform-specific code

**Non-Goals:**
- Making Anna's Archive actually work on Windows (complex Rust-side networking/path issue, separate effort)
- Changing the animation engine (Canvas 2D is sufficient)
- Supporting new animated themes

## Decisions

### Decision 1: Platform detection via `navigator.userAgentData` or `navigator.platform`

**Choice:** Add a `getPlatform()` function to `src/lib/tauri.ts` that returns `'mac' | 'windows' | 'linux' | 'unknown'`.

Use `navigator.platform` as the primary check (already used in codebase for keyboard shortcuts). Fall back to `navigator.userAgent` parsing.

**Rationale:** `navigator.platform` is available in all WebView engines. The existing codebase already uses this pattern inline (in `useKeyboardShortcuts.ts`, `ShortcutTooltip.tsx`, `CommandPalette.tsx`). Centralizing it avoids duplication.

**Alternative considered:** Tauri's `@tauri-apps/plugin-os` plugin — adds a dependency for something achievable with a 5-line JS function.

### Decision 2: Anna's Archive visibility gating

**Choice:** Replace `isTauri()` with `isTauri() && isMac()` on both Anna's Archive button renderings in `DocumentsView.tsx`.

**Rationale:** The feature only works on macOS. The simplest, least-risky fix is to hide it on non-macOS. This avoids touching the Rust backend.

**Alternative considered:** Adding a graceful error message on Windows when the button is clicked — more work, doesn't add user value since the feature can't work on Windows anyway.

### Decision 3: Animated themes — investigation-first approach

**Choice:** The fix requires investigating the root cause on a Windows machine. Likely candidates:

1. **WebView2 transparency/layering**: On Windows WebView2, the `position: fixed; z-index: 0` canvas may not render behind content the same way as WebKit. The fix may require adjusting the stacking context (e.g., using a negative `z-index`, or ensuring the canvas element is the first child of `<body>`).

2. **Canvas compositing**: WebView2 may handle `globalCompositeOperation: "lighter"` (used in `applyBrightnessGain`) differently. The brightness pass redraws the canvas onto itself, which may produce a white flash on Windows.

3. **CSS `background: transparent` inheritance**: The auto-generated customCSS sets `background: transparent !important` on key containers. If WebView2 applies a default opaque background to `<html>` or `<body>`, the transparency chain breaks.

**Approach:** Add debug logging to `ThemeBackdrop` to confirm the component mounts and the animation function runs. Then test CSS and stacking fixes on Windows.

## Risks / Trade-offs

- **[Animated theme fix may be environment-specific]** → Mitigation: Test on actual Windows hardware. Add platform-agnostic CSS fallbacks. The fix should not regress macOS/Linux.
- **[Hiding Anna's Archive on all non-macOS]** → Mitigation: This is acceptable since the feature is non-functional on those platforms. When a Windows-compatible backend is ready, the `isMac()` check can be relaxed.
- **[navigator.platform is deprecated in some browsers]** → Mitigation: WebView2 still supports it. Add a userAgent fallback for future-proofing.
