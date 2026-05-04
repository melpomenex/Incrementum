# Design: Cross-Platform Battery Optimization

## Architecture Overview

Battery optimization touches three layers: **Rust backend** (compile flags, idle scanner), **React frontend** (animations, polling, lazy loading, battery context), and **build configuration** (Vite, Tauri, Cargo). Changes are independent per-item but share a common pattern: **do less when idle/hidden/unneeded**.

## Technical Decisions

### D1. Framerate capping via timestamp gating, not separate throttling library

No new dependency. Each RAF loop checks `timestamp - lastFrame >= FRAME_INTERVAL` before executing the expensive work. The RAF callback still fires (kept alive by the browser), but the actual rendering work is skipped.

**Why:** Zero-dependency, minimal code change, easy to audit. A throttling library would add bundle size for something 5 lines of code solve.

**Implementation:**
```typescript
const FRAME_INTERVAL = 1000 / 30; // ~33ms
const lastTimeRef = useRef(0);

const loop = (timestamp: number) => {
  rafId = requestAnimationFrame(loop);
  const elapsed = timestamp - lastTimeRef.current;
  if (elapsed >= FRAME_INTERVAL) {
    lastTimeRef.current = timestamp - (elapsed % FRAME_INTERVAL);
    renderFrame(elapsed);
  }
};
```

### D2. Dual visibility gate: document.hidden + Tauri window focus

Both are needed. `document.hidden` catches tab-level hiding (multi-window, minimize on some platforms). `getCurrentWindow().onFocusChanged` catches app-level focus loss (user switches apps) which `document.hidden` doesn't reliably detect on all Tauri/WebView combos.

**Why:** Belt and suspenders. WebView2 (Windows), WKWebView (macOS), and WebKitGTK (Linux) each report visibility differently.

### D3. Battery awareness via Tauri command, not navigator.getBattery()

`navigator.getBattery()` is deprecated and removed from Firefox/Safari. Instead, add a Tauri Rust command using the `battery` crate that polls via system APIs. Expose through a React context.

**Why:** Cross-platform reliability. The `battery` crate (MIT) works on macOS (IOKit), Windows (Win32), and Linux (UPower/sysfs).

**Implementation:**
```
src-tauri/src/battery.rs     — Tauri command using `battery` crate
src/contexts/BatteryContext.tsx — React context + polling hook
```

Battery polling interval: 30 seconds (sufficient for battery events which change slowly).

### D4. Yjs idle disconnect with reconnect-on-update

Keep the existing `YjsSync` singleton. Add a 5-minute idle timer that calls `provider.disconnect()`. On next `doc.on('update')`, call `provider.connect()`. The WebsocketProvider handles reconnection internally, so disconnect/connect is safe.

**Why:** The existing architecture already supports `connect()/disconnect()` (used in cleanup at line 272). Adding idle logic is a thin layer on top.

### D5. Idle scanner refactor: tokio mpsc channel

Replace `tokio::time::interval` in `idle_scanner.rs` with a `tokio::sync::mpsc::channel`. When `import_media` (or similar) completes, it sends a signal on the channel. The scanner blocks on `rx.recv()` until signaled.

**Why:** Eliminates periodic DB queries when nothing has changed. The scanner still does a startup check (first scan on app launch).

**Migration path:**
1. Add `tx: mpsc::Sender<()>` as Tauri managed state
2. In `idle_scanner::run()`, replace `ticker.tick().await` with `rx.recv().await`
3. In import handlers, `state.tx.send(()).await` after successful import
4. Keep a startup check: send an initial signal after scanner registers

### D6. Vite manual chunks — remove inlineDynamicImports, add output.manualChunks

`inlineDynamicImports: true` is needed for Tauri's single-file output. To get lazy loading, we configure `output.manualChunks` which splits the single bundle into named chunks that Vite still bundles correctly for Tauri.

Actually, need to verify: Tauri v2 with `inlineDynamicImports` may prevent code splitting. If so, the trade-off is bundle size vs lazy loading. **Decision: keep `inlineDynamicImports` and rely on tree-shaking instead of code splitting.** Remove unused Three.js/PDF.js/etc. from the main bundle by ensuring they're behind dynamic `import()` calls that tree-shake in dev but inline in release.

**Revised approach:** Audit all imports of heavy libs. Ensure they use `import()` (dynamic) not static `import`. Vite's tree-shaking + Tauri's inlining handles the rest. This gives us smaller initial parse time even if the bytes are all in one file.

### D7. Font lazy loading via dynamic CSS import

Replace static `import '@fontsource/inter/400.css'` with a runtime loader:
```typescript
const loadedFonts = new Set<string>();
export async function loadFont(family: string, weight: string = '400'): Promise<void> {
  const key = `${family}-${weight}`;
  if (loadedFonts.has(key)) return;
  await import(`@fontsource/${family}/${weight}.css`);
  loadedFonts.add(key);
}
```

Call `loadFont()` when the user's font preference is loaded, and when they change it.

**Why:** Vite handles dynamic CSS imports. No runtime cost for fonts the user never uses.

### D8. Linux HW accel: conditional based on GPU detection

Replace blanket env vars with a GPU check:
```rust
#[cfg(target_os = "linux")]
fn configure_linux_gpu() {
    // Check for known-bad GPU drivers
    let renderer = std::process::Command::new("glxinfo")
        .args(&["-B"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok());

    let needs_workaround = renderer.as_ref()
        .map(|r| r.contains("llvmpipe") || r.contains("softpipe") || r.contains("swrast"))
        .unwrap_or(true); // default to workaround if we can't detect

    if needs_workaround {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
    }
}
```

**Why:** Software renderers (llvmpipe, softpipe, swrast) are the actual problem cases. Mesa/NVIDIA proprietary drivers work fine with HW accel enabled.

### D9. PerformanceObserver: gate behind `import.meta.env.DEV`

Simple conditional. No refactoring needed — just wrap the observer creation in `if (import.meta.env.DEV)`.

## File Changes

### Rust Backend
| File | Change |
|---|---|
| `src-tauri/Cargo.toml` | Update `profile.release`: opt-level=3, lto=true, codegen-units=1, strip=true, panic="abort" |
| `src-tauri/Cargo.toml` | Add `[profile.release.package."*"] opt-level=3` |
| `src-tauri/Cargo.toml` | Add `battery = "0.8"` dependency |
| `src-tauri/tauri.conf.json` | Set `devtools: false` (conditional via build script or keep false, open in debug only) |
| `src-tauri/src/main.rs` | Replace blanket Linux env vars with conditional GPU detection |
| `src-tauri/src/battery.rs` | NEW — Tauri command `get_battery_state()` |
| `src-tauri/src/transcription/idle_scanner.rs` | Replace `tokio::time::interval` with `mpsc::channel` |
| `src-tauri/src/lib.rs` | Register battery command, add battery state to managed state |

### React Frontend
| File | Change |
|---|---|
| `src/components/common/ThemeBackdrop.tsx` | Add 30fps cap, visibility/focus pause, battery-aware density reduction |
| `src/components/graph/KnowledgeSphere.tsx` | Add auto-rotate 5s timeout, force sim 15fps cap, battery pixel ratio, WebGL dispose cleanup |
| `src/components/media/AudioPlayer.tsx` | Add waveform visualizer 20fps cap |
| `src/components/common/ClipboardQuickAddWatcher.tsx` | Stop polling when `document.hidden`, restart on visible |
| `src/lib/yjsSync.ts` | Add 5-min idle disconnect timer, visibility disconnect/reconnect |
| `src/contexts/BatteryContext.tsx` | NEW — React context with battery state from Tauri command |
| `src/utils/fonts.ts` | NEW — `loadFont()` dynamic loader |
| `src/utils/performance.ts` | Gate all observer creation behind `import.meta.env.DEV` |
| Multiple files with static font imports | Replace with `loadFont()` calls |

### Build Configuration
| File | Change |
|---|---|
| `vite.config.ts` | Audit dynamic imports (no change needed if using `inlineDynamicImports`) |
| `package.json` | Verify @fontsource imports are dynamic |

## Risk Assessment

| Change | Risk | Mitigation |
|---|---|---|
| Rust opt-level=3 + LTO | Build time increase (2-3x), potential compiler crash | Incremental: test opt-level=2 first, then 3. Known LLVM issue documented in existing comment. |
| DevTools false in release | Can't debug production easily | Keep debug build workflow for debugging |
| Animation throttling | Perceived "less smooth" | 30fps is visually imperceptible for ambient effects. Can make configurable. |
| Yjs idle disconnect | Missed sync during idle window | 5 min is generous; reconnects immediately on update. Acceptable trade-off. |
| Linux GPU detection | `glxinfo` may not be installed | Default to workaround if detection fails (current behavior preserved) |
| Font lazy loading | FOUC (flash of unstyled text) on first load | Load configured fonts immediately on app start, just dynamically |
| Battery crate | Additional native dependency | Small crate (MIT), well-maintained, supports all 3 platforms |

## Expected Impact

| Optimization | Est. Battery Savings | Effort |
|---|---|---|
| Canvas animation capping + visibility pause | 30-50% | Medium |
| Rust opt-level=3 + LTO | 10-20% CPU reduction | Low |
| DevTools disabled in release | 5-10% | Trivial |
| Battery-aware animation density | 10-30% (when on battery) | Medium |
| Clipboard polling hidden pause | 5-15% | Low |
| Lazy-loaded heavy dependencies | 5-10% (memory → less GC) | Medium |
| Yjs idle disconnect | 3-5% | Low |
| Audio visualizer throttle | 3-5% during playback | Trivial |
| Linux HW accel conditional | 10-30% on Linux | Medium |
| Idle scanner event-driven | 2-5% | Medium |
| Font lazy loading | 2-5% (startup only) | Low |
| PerformanceObserver gating | 1-2% | Trivial |
