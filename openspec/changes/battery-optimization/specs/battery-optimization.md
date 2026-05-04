## ADDED Requirements

### Requirement: Animation Framerate Capping
System SHALL cap all requestAnimationFrame loops to 30fps maximum for ambient/visual effects (ThemeBackdrop, AudioPlayer waveform). KnowledgeSphere force simulation SHALL run at 15fps maximum.

#### Scenario: ThemeBackdrop at 60fps should throttle to 30fps
- GIVEN the app is running and ThemeBackdrop is visible
- WHEN the animation loop fires via requestAnimationFrame
- THEN frames SHALL be throttled to ~33ms intervals (30fps cap)

#### Scenario: Audio visualizer at 60fps should throttle to 20fps
- GIVEN the user is playing audio and the waveform is visible
- WHEN the visualizer redraws via requestAnimationFrame
- THEN redraws SHALL be throttled to ~50ms intervals (20fps cap)

### Requirement: Animation Visibility-Aware Pausing
System SHALL pause all canvas/WebGL animations when the app window loses focus or the document becomes hidden. Animations SHALL resume automatically when focus/visibility returns.

#### Scenario: Window loses focus pauses animations
- GIVEN ThemeBackdrop is animating
- WHEN the user switches to another application (Tauri focus change)
- THEN the animation loop SHALL be stopped immediately
- WHEN the user returns to Incrementum
- THEN the animation loop SHALL resume

#### Scenario: Document hidden pauses animations
- GIVEN KnowledgeSphere is rendering
- WHEN the document enters hidden state (visibilitychange)
- THEN the animation loop AND force simulation SHALL be stopped

### Requirement: KnowledgeSphere Auto-Rotate Timeout
System SHALL stop KnowledgeSphere auto-rotation after 5 seconds of no user interaction. Auto-rotation SHALL resume on any user interaction (drag, zoom, click).

#### Scenario: Auto-rotate stops after idle
- GIVEN the user is viewing the Knowledge Sphere and auto-rotate is active
- WHEN no interaction occurs for 5 seconds
- THEN auto-rotation SHALL stop

### Requirement: Rust Release Profile Optimization
System SHALL be compiled with opt-level=3, LTO enabled, codegen-units=1, strip=true, and panic="abort" in release builds. All dependency crates SHALL also use opt-level=3.

#### Scenario: Release binary uses full optimization
- GIVEN a release build is triggered (`cargo build --release`)
- WHEN the Rust code compiles
- THEN Cargo.toml profile.release SHALL specify opt-level=3, lto=true, codegen-units=1, strip=true

### Requirement: DevTools Disabled in Release
System SHALL NOT enable WebView devtools in release builds. DevTools SHALL only be available in debug/dev builds.

#### Scenario: Release build has no devtools
- GIVEN the app is running in release mode
- WHEN the user attempts to open devtools
- THEN the devtools window SHALL NOT open

### Requirement: Clipboard Polling Hidden Pause
System SHALL stop clipboard polling when the document is hidden and resume when visible.

#### Scenario: Clipboard polling stops when hidden
- GIVEN ClipboardQuickAddWatcher is polling at 1400ms intervals
- WHEN the document becomes hidden
- THEN the polling interval SHALL be cleared
- WHEN the document becomes visible again
- THEN the polling interval SHALL be re-established

### Requirement: Yjs WebSocket Idle Disconnect
System SHALL disconnect the Yjs WebSocket after 5 minutes of no document updates. The connection SHALL re-establish on the next document update. System SHALL also disconnect when the document is hidden and reconnect when visible.

#### Scenario: Idle Yjs disconnect
- GIVEN the Yjs sync WebSocket is connected
- WHEN no document updates occur for 5 minutes
- THEN the WebSocket SHALL disconnect

#### Scenario: Hidden document disconnects Yjs
- GIVEN the Yjs sync WebSocket is connected
- WHEN the document becomes hidden
- THEN the WebSocket SHALL disconnect
- WHEN the document becomes visible again
- THEN the WebSocket SHALL reconnect

### Requirement: Backend Idle Scanner Event-Driven
System SHALL replace the polling interval in idle_scanner.rs with an event-driven approach using tokio channels. The scanner SHALL wake only when new media is imported, not on a fixed timer.

#### Scenario: Scanner waits for import signal
- GIVEN the idle scanner is running
- WHEN no media import signal is received
- THEN the scanner SHALL NOT query the database
- WHEN a new media file is imported
- THEN the scanner SHALL wake and check for untranscribed media

### Requirement: Vite Manual Chunks for Lazy Loading
System SHALL configure Vite to split heavy dependencies into separate chunks: three, pdfjs-dist, epubjs, recharts, yjs/y-websocket/y-indexeddb, and tesseract.js. These chunks SHALL only be loaded when the corresponding feature is accessed.

#### Scenario: Three.js loads only for Knowledge Sphere
- GIVEN the user has not visited the Knowledge Sphere
- WHEN the app starts
- THEN the Three.js chunk SHALL NOT be loaded
- WHEN the user navigates to the Knowledge Sphere
- THEN the Three.js chunk SHALL be loaded on demand

#### Scenario: PDF.js loads only for PDF viewing
- GIVEN the user opens a non-PDF document
- WHEN the document renders
- THEN the PDF.js chunk SHALL NOT be loaded

### Requirement: Font Packages Lazy Loading
System SHALL NOT eagerly import all 65 @fontsource packages at startup. Fonts SHALL be loaded on demand based on user reading settings or on first use.

#### Scenario: Only configured fonts loaded at startup
- GIVEN the user has configured "Inter" and "Merriweather" as their reading fonts
- WHEN the app starts
- THEN only those 2 font packages SHALL be loaded
- WHEN the user changes their font setting to "Lora"
- THEN the Lora font package SHALL be loaded dynamically

### Requirement: Linux Hardware Acceleration Conditional
System SHALL NOT blanket-disable WebKit hardware acceleration and compositing on Linux. Disabling SHALL only occur for specific GPU/driver combinations that are known to have issues.

#### Scenario: Healthy GPU keeps acceleration
- GIVEN the app runs on Linux with a supported GPU driver (e.g., Mesa, NVIDIA proprietary)
- WHEN the app starts
- THEN hardware acceleration SHALL remain enabled
- THEN compositing SHALL remain enabled

### Requirement: Production PerformanceObserver Gating
System SHALL NOT run PerformanceObserver or longtask monitoring in production builds. Performance monitoring SHALL only be active in development mode.

#### Scenario: No observer overhead in release
- GIVEN the app is running in production mode
- WHEN PerformanceObserver setup code executes
- THEN it SHALL be skipped entirely (no observer created, no events watched)

### Requirement: Battery Awareness Context
System SHALL provide a React context that exposes battery state (on battery, charging, percentage). Components SHALL be able to subscribe and adapt behavior (e.g., lower animation density on battery).

#### Scenario: ThemeBackdrop reduces density on battery
- GIVEN the battery context reports the device is on battery power
- WHEN ThemeBackdrop renders
- THEN particle/effect density SHALL be reduced (e.g., halved)

#### Scenario: KnowledgeSphere reduces quality on battery
- GIVEN the battery context reports the device is on battery
- WHEN KnowledgeSphere initializes its renderer
- THEN pixel ratio SHALL be capped at 1 (instead of devicePixelRatio)
