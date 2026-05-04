# Tasks: Cross-Platform Battery Optimization

## 1. Rust Release Profile (Tier 1 — Critical)
- [x] 1.1 Update `src-tauri/Cargo.toml` profile.release: opt-level=3, lto=true, codegen-units=1, strip=true, panic="abort"
- [x] 1.2 Add `[profile.release.package."*"]` with opt-level=3
- [x] 1.3 Test release build compiles successfully (watch for LLVM crashes noted in existing comment)
- [ ] 1.4 Benchmark startup and runtime CPU vs current opt-level=1 build

## 2. DevTools Disabled in Release (Tier 1 — Critical)
- [x] 2.1 Set `devtools: false` in `src-tauri/tauri.conf.json`
- [ ] 2.2 Verify devtools still open in debug/dev mode (`tauri dev`)
- [ ] 2.3 Confirm release build does not show devtools

## 3. withGlobalTauri Cleanup (Tier 1 — Critical)
- [x] 3.1 Set `withGlobalTauri: false` in `src-tauri/tauri.conf.json`
- [x] 3.2 Audit codebase for `window.__TAURI__` usage, replace with ES module imports from `@tauri-apps/api/*`
- [ ] 3.3 Test all Tauri API calls work correctly with module imports

## 4. Animation Framerate Capping (Tier 1 — Critical)
- [x] 4.1 Create `useThrottledRAF` hook in `src/hooks/useThrottledRAF.ts` (timestamp-gated RAF loop with configurable fps)
- [x] 4.2 Apply 30fps cap to `ThemeBackdrop.tsx` (32 requestAnimationFrame call sites)
- [x] 4.3 Apply 20fps cap to `AudioPlayer.tsx` waveform visualizer
- [ ] 4.4 Verify animations still look smooth at capped framerates

## 5. Visibility-Aware Animation Pausing (Tier 1 — Critical)
- [x] 5.1 Add `visibilitychange` listener to `ThemeBackdrop.tsx` — pause/resume RAF loop
- [x] 5.2 Add Tauri `getCurrentWindow().onFocusChanged` listener to `ThemeBackdrop.tsx` — pause/resume
- [x] 5.3 Add `visibilitychange` + focus listener to `KnowledgeSphere.tsx` — pause RAF + force sim
- [x] 5.4 Add `visibilitychange` + focus listener to `AudioPlayer.tsx` waveform visualizer
- [ ] 5.5 Test: switch apps → animations stop, return → animations resume

## 6. KnowledgeSphere Optimizations (Tier 2 — Significant)
- [x] 6.1 Add auto-rotate 5-second idle timeout (stop after no interaction, resume on interaction)
- [x] 6.2 Cap force simulation tick rate to 15fps
- [x] 6.3 Set pixel ratio to 1 when on battery (or when devicePixelRatio > 2)
- [ ] 6.4 Add proper WebGL disposal on unmount (renderer, geometries, materials)
- [ ] 6.5 Test: Knowledge Sphere renders correctly, auto-rotate stops after 5s idle

## 7. Clipboard Polling Hidden Pause (Tier 1 — Critical)
- [x] 7.1 Update `ClipboardQuickAddWatcher.tsx` to clear interval on `document.hidden`
- [x] 7.2 Re-establish interval on `visibilitychange` to visible
- [ ] 7.3 Test: background app → no clipboard checks, foreground → checks resume

## 8. Yjs WebSocket Idle Disconnect (Tier 2 — Significant)
- [x] 8.1 Add 5-minute idle timer to `yjsSync.ts` that calls `provider.disconnect()`
- [x] 8.2 Reset timer on every `doc.on('update')` event
- [x] 8.3 Reconnect on next update after idle disconnect
- [x] 8.4 Add `visibilitychange` handler: disconnect when hidden, reconnect when visible
- [ ] 8.5 Test: idle 5 min → WebSocket closes, type in doc → reconnects

## 9. Backend Idle Scanner Event-Driven (Tier 2 — Significant)
- [x] 9.1 Add `tokio::sync::mpsc::channel` to idle_scanner state
- [x] 9.2 Replace `tokio::time::interval` ticker with `rx.recv().await`
- [x] 9.3 Send signal on channel from media import handlers
- [x] 9.4 Send initial signal after scanner startup for boot-time scan
- [ ] 9.5 Test: import media → scanner wakes, no import → no DB queries

## 10. Battery Awareness Context (Tier 3 — Polish)
- [x] 10.1 Add `battery = "0.7"` crate to `src-tauri/Cargo.toml` (corrected from 0.8)
- [x] 10.2 Create `src-tauri/src/battery.rs` — Tauri command using `battery` crate
- [x] 10.3 Register `get_battery_state` command in `src-tauri/src/lib.rs`
- [x] 10.4 Create `src/contexts/BatteryContext.tsx` — React context with 30s polling
- [x] 10.5 Integrate BatteryContext in `ThemeBackdrop.tsx` (density reduction on battery)
- [x] 10.6 Integrate BatteryContext in `KnowledgeSphere.tsx` (pixel ratio capping)
- [ ] 10.7 Test on macOS, Windows, Linux — verify battery state reported correctly

## 11. Font Lazy Loading (Tier 2 — Significant)
- [x] 11.1 Create `src/utils/fonts.ts` — `loadFont(family, weight)` dynamic import function with dedup cache
- [x] 11.2 Audit all static `@fontsource/*` imports across the codebase (none found — already using dynamic Google Fonts)
- [x] 11.3 Replace static imports with `loadFont()` calls (triggered by user font settings)
- [x] 11.4 Ensure configured reading fonts load immediately on app start
- [ ] 11.5 Test: font changes apply correctly, no FOUC on configured fonts

## 12. Linux Hardware Acceleration Conditional (Tier 3 — Polish)
- [x] 12.1 Create GPU detection function in `src-tauri/src/main.rs` (checks for software renderers)
- [x] 12.2 Replace blanket env var sets with conditional: only disable for llvmpipe/softpipe/swrast
- [x] 12.3 Default to workaround if GPU detection fails (preserves current behavior as fallback)
- [ ] 12.4 Test on Linux with Mesa driver — verify HW accel stays enabled
- [ ] 12.5 Test on Linux with software renderer — verify fallback to current behavior

## 13. Production PerformanceObserver Gating (Tier 3 — Polish)
- [x] 13.1 Wrap PerformanceObserver creation in `src/utils/performance.ts` with `if (import.meta.env.DEV)`
- [x] 13.2 Verify no observers are created in production build
- [x] 13.3 Verify observers still work in dev mode

## 14. Vite Bundle Audit (Tier 2 — Significant)
- [x] 14.1 Audit all imports of three, pdfjs-dist, epubjs, recharts, yjs, tesseract.js — ensure they use dynamic `import()`
- [x] 14.2 Verify tree-shaking removes unused heavy libs from initial bundle
- [ ] 14.3 Measure initial bundle size before and after
