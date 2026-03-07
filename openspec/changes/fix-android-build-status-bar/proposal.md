## Why

The Android build in GitHub Actions is currently failing. The workflow completes the Rust compilation successfully (taking ~18 minutes) but then fails during the Gradle `rustBuildArm64Release` task with an error starting the cargo process. Additionally, when the app runs on Android devices, the content extends under the system status bar, making the top portion of the app obscured and difficult to interact with.

## What Changes

### Android Build Fix
- Diagnose and fix the Gradle build failure that occurs after Rust compilation completes
- Ensure the cargo toolchain is properly accessible during the Gradle APK assembly phase
- Validate the build produces a working signed APK artifact

### Android Status Bar Safe Area
- Configure the Android activity to respect system window insets (status bar and navigation bar)
- Ensure the webview content respects `env(safe-area-inset-top)` CSS environment variable
- Apply proper padding/margins so the app content does not draw under the status bar

## Capabilities

### Modified Capabilities
- `tauri-mobile-ci-build`: CI system must produce working Android APK artifacts that pass all build phases
- `mobile-display-layout`: App content must respect system UI insets on Android, avoiding overlap with status bar

## Impact

- Affected code:
  - `.github/workflows/mobile-build.yml` - Build configuration and environment setup
  - `src-tauri/gen/android/app/src/main/AndroidManifest.xml` - Activity window flags
  - `src-tauri/gen/android/app/src/main/res/values/themes.xml` - Theme configuration for edge-to-edge
  - `src-tauri/gen/android/app/src/main/java/.../MainActivity.kt` - Window insets handling
  - `src/index.css`, `src/styles/mobile.css` - Safe area inset CSS variables
- Dependencies/systems: GitHub Actions, Android SDK/NDK, Tauri mobile toolchain
- Process: Android builds will be unblocked for releases and PR validation
