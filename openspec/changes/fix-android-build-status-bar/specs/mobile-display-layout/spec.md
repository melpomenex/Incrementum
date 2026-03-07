# mobile-display-layout

## MODIFIED Requirements

### Requirement: Android Status Bar Safe Area
The application SHALL respect Android system window insets, ensuring content does not draw under the status bar.

#### Scenario: App content respects status bar on Android
- Given the app is running on an Android phone or tablet
- When the app is displayed in portrait or landscape mode
- Then the top of the app content MUST be positioned below the system status bar
- And the CSS `env(safe-area-inset-top)` variable SHALL return the correct inset value
- And UI elements in the header region MUST be fully visible and tappable

#### Scenario: App content respects navigation bar on Android
- Given the app is running on an Android device with gesture navigation
- When the app displays bottom navigation or content near the screen edge
- Then the bottom of the app content SHALL be positioned above the navigation bar
- And the CSS `env(safe-area-inset-bottom)` variable MUST return the correct inset value

### Requirement: WebView Safe Area Insets
The Tauri WebView on Android MUST correctly report system insets to the CSS environment variables.

#### Scenario: CSS safe-area-inset-top returns correct value
- Given the app is running on Android with a status bar
- When JavaScript reads `getComputedStyle(document.documentElement).paddingTop` or uses `env(safe-area-inset-top)`
- Then the value MUST match the Android WindowInsets status bar height

## Related Capabilities
- `tauri-mobile-ci-build` - Build pipeline that produces the Android APK
