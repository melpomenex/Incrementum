## ADDED Requirements

### Requirement: Platform detection utility
The system SHALL provide a `getPlatform()` function in `src/lib/tauri.ts` that returns the current OS as `'mac' | 'windows' | 'linux' | 'unknown'`. The system SHALL also provide an `isMac()` convenience function that returns `true` when the platform is macOS.

#### Scenario: Detect macOS
- **WHEN** the app runs on macOS (Tauri with WebKit)
- **THEN** `getPlatform()` returns `'mac'` and `isMac()` returns `true`

#### Scenario: Detect Windows
- **WHEN** the app runs on Windows (Tauri with WebView2)
- **THEN** `getPlatform()` returns `'windows'` and `isMac()` returns `false`

#### Scenario: Detect Linux
- **WHEN** the app runs on Linux (Tauri with WebKitGTK)
- **THEN** `getPlatform()` returns `'linux'` and `isMac()` returns `false`

#### Scenario: Fallback for unknown environments
- **WHEN** the app runs in a browser or unknown environment
- **THEN** `getPlatform()` returns `'unknown'` and `isMac()` returns `false`

### Requirement: Anna's Archive button hidden on non-macOS
The Anna's Archive button in both the desktop toolbar and mobile import menu SHALL only be visible when running on macOS. On Windows and Linux, the button SHALL NOT be rendered.

#### Scenario: Button visible on macOS
- **WHEN** the app runs on macOS Tauri
- **THEN** the Anna's Archive button is visible in the desktop toolbar and mobile import menu

#### Scenario: Button hidden on Windows
- **WHEN** the app runs on Windows Tauri
- **THEN** the Anna's Archive button is NOT rendered in either the desktop toolbar or mobile import menu

#### Scenario: Button hidden on Linux
- **WHEN** the app runs on Linux Tauri
- **THEN** the Anna's Archive button is NOT rendered in either the desktop toolbar or mobile import menu

### Requirement: Animated themes render on Windows
Animated themes SHALL display their canvas-based background animations on Windows WebView2 identically to how they render on macOS WebKit.

#### Scenario: Animated theme displays animation on Windows
- **WHEN** a user selects a legacy animated theme (e.g., "Forest" with rain animation) on Windows
- **THEN** the canvas animation renders visibly behind the semi-transparent UI panels

#### Scenario: Animated theme unchanged on macOS
- **WHEN** the fix is deployed and a user selects an animated theme on macOS
- **THEN** the animation renders identically to the current behavior (no regression)

#### Scenario: Animated theme unchanged on Linux
- **WHEN** the fix is deployed and a user selects an animated theme on Linux
- **THEN** the animation renders identically to the current behavior (no regression)
