## 1. Platform Detection Utility

- [x] 1.1 Add `getPlatform()` and `isMac()` functions to `src/lib/tauri.ts` — use `navigator.platform` with `navigator.userAgent` fallback to return `'mac' | 'windows' | 'linux' | 'unknown'`
- [x] 1.2 Verify the new functions work in browser dev mode (should return `'unknown'` or the browser host OS)

## 2. Hide Anna's Archive on Non-macOS

- [x] 2.1 In `src/components/documents/DocumentsView.tsx`, update the desktop toolbar button (line ~754) to use `isTauri() && isMac()` instead of just `isTauri()`
- [x] 2.2 In the same file, update the `MobileImportMenu` Anna's Archive button (line ~1903) to use the same `isTauri() && isMac()` guard
- [x] 2.3 Verify the button is hidden on Windows/Linux and still visible on macOS (visual check or grep)

## 3. Fix Animated Themes on Windows

- [x] 3.1 Investigate root cause: add temporary `console.log` to `ThemeBackdrop.tsx` useEffect to confirm the component mounts, canvas is created, and animation function is invoked on Windows
- [x] 3.2 Test CSS stacking fix — try making `.theme-backdrop` use `z-index: -1` or ensuring the canvas renders behind the root stacking context. Compare Windows WebView2 vs macOS WebKit behavior
- [x] 3.3 If stacking is not the issue, investigate the auto-generated `customCSS` transparency rules (`background: transparent !important` on `.app-shell`, `.main-content`, `.bg-cream`) — ensure WebView2 respects the transparency chain from `<html>` through to the canvas
- [x] 3.4 If `applyBrightnessGain` (`globalCompositeOperation: "lighter"`) causes issues on WebView2, add a platform-specific bypass or use a simpler brightness approach
- [x] 3.5 Remove temporary debug logging added in 3.1
- [ ] 3.6 Verify animated themes work on Windows without regressing macOS or Linux

## 4. Verification

- [ ] 4.1 Test at least 3 different animated themes on Windows (e.g., rain, aurora, digitalrain)
- [ ] 4.2 Confirm Anna's Archive button is absent on Windows and present on macOS
- [ ] 4.3 Confirm no regressions to non-animated themes on any platform
