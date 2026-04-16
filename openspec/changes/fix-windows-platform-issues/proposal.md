## Why

Two distinct bugs affect the Windows build of Incrementum:

1. **Animated themes render nothing on Windows** — all ~30 legacy themes that use canvas-based background animations (rain, aurora, digitalrain, etc.) show a blank/still background on Windows. The same themes work correctly on macOS and Linux. The animation system is pure Canvas 2D with no WebGL, so the root cause is likely a CSS stacking, transparency, or WebView2 rendering difference on Windows.

2. **Anna's Archive button appears on Windows but is non-functional** — the button is gated only by `isTauri()`, which returns `true` on both macOS and Windows. The underlying search/download functionality depends on network calls and file operations that fail on Windows, making the button misleading.

Both issues need fixing before the Windows build is usable.

## What Changes

- Investigate and fix the animated theme canvas rendering on Windows WebView2
- Add a platform detection utility (`isMac()`) to `src/lib/tauri.ts` so UI code can conditionally hide features
- Hide the Anna's Archive button (both desktop toolbar and mobile menu instances) on non-macOS platforms using the new platform check
- Ensure the fix does not regress animated themes on macOS or Linux

## Capabilities

### New Capabilities
- `platform-detection`: Frontend utility to detect the current OS (macOS, Windows, Linux) for conditional UI rendering

### Modified Capabilities
<!-- No existing specs are modified — these are bug fixes, not requirement changes -->

## Impact

- **Frontend**: `src/lib/tauri.ts` (new `isMac()` / `getPlatform()` helper), `src/components/documents/DocumentsView.tsx` (Anna's Archive visibility), `src/components/common/ThemeBackdrop.tsx` or CSS (animated theme fix)
- **CSS**: Possibly `src/index.css` or auto-generated custom CSS in `src/themes/legacyIndex.ts` if the fix is CSS-level
- **No Rust/backend changes expected** — the Anna's Archive Rust backend remains intact; only the UI is hidden
- **No breaking changes** — purely additive fix and UI gating
