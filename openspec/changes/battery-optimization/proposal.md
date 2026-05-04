# Proposal: Cross-Platform Battery Optimization

## Intent

Incrementum is a desktop Tauri app that users run for extended study sessions — often on laptops on battery power. Profiling reveals several high-drain patterns: full-speed canvas animations running unconditionally, a Rust backend compiled at minimal optimization, persistent polling/WebSocket connections, and heavy bundle bloat from eagerly loaded dependencies. This change systematically reduces power consumption across all platforms (macOS, Windows, Linux) without sacrificing functionality or visual quality.

## Scope

**In scope:**
- Animation framerate capping and visibility-aware pausing (ThemeBackdrop, KnowledgeSphere, AudioPlayer)
- Rust release profile optimization (opt-level, LTO, codegen-units)
- DevTools disabled in release builds
- Clipboard polling throttled when hidden
- Yjs WebSocket idle disconnect
- Backend idle scanner made event-driven
- Vite manual chunks for lazy loading (Three.js, PDF.js, epub.js, tesseract, recharts, yjs)
- 65 @fontsource packages lazy-loaded
- Linux hardware acceleration restored (conditional, not blanket)
- Production PerformanceObserver gated behind dev mode
- Battery awareness context for adaptive behavior

**Out of scope:**
- New user-facing settings UI for battery mode (future change)
- Replacing ThemeBackdrop plasma animation with WebGL shader (keep as future optimization)
- Clipboard event-based approach (Tauri API doesn't support it on all platforms)
- Yjs reconnection strategy beyond basic idle disconnect

## Approach

Three-tier strategy ranked by impact:

1. **Tier 1 — Critical** (biggest battery wins, lowest risk): Rust profile, DevTools off, animation capping, visibility pausing, clipboard polling gate
2. **Tier 2 — Significant** (medium effort, solid savings): Lazy-loaded Vite chunks, font lazy-loading, Yjs idle disconnect, KnowledgeSphere throttle, audio visualizer throttle, idle scanner refactor
3. **Tier 3 — Polish** (small wins, higher effort): Linux HW accel conditional enable, battery-aware context, PerformanceObserver gating

Each optimization is independently shippable. No single change depends on another completing first.
