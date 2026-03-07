## Design: Android Build and Status Bar Fix

### Problem Analysis

#### Build Failure
The Android CI build fails at the Gradle `rustBuildArm64Release` task with:
```
Execution failed for task ':app:rustBuildArm64Release'.
> A problem occurred starting process 'command '/home/runner/.cargo/bin/cargo''
```

The workflow successfully:
1. Sets up Java 17
2. Sets up Android SDK
3. Installs Rust toolchain with aarch64-linux-android target
4. Compiles the Rust code (~18 minutes)
5. Creates the .so symlink in jniLibs

But then fails when Gradle's `rustBuildArm64Release` task tries to invoke cargo. This task is part of Tauri's Android build integration that re-runs cargo during the Gradle build process.

**Root cause hypothesis**: The workflow runs `npm run tauri -- android build` which compiles Rust first via the Tauri CLI, but then Gradle has its own `rustBuildArm64Release` task that tries to run cargo again. The environment variables (CARGO, PATH) may not be properly propagated to the Gradle subprocess, or there's a timing/environment issue where cargo isn't found.

**Fix approach**: Ensure the Gradle build can find cargo by:
1. Verifying CARGO env var points to the correct binary
2. Ensuring the cargo bin directory is in PATH for the Gradle subprocess
3. Possibly adjusting the workflow to rely solely on Gradle for the build (removing the separate `tauri android build` call) or ensuring both use consistent environments

#### Status Bar Overlap
The app draws content under the Android status bar, obscuring top UI elements.

**Root cause**: Modern Android uses edge-to-edge by default, but the WebView may not properly report safe area insets, or the CSS isn't consuming them correctly.

**Fix approach**:
1. **Android native side**: In MainActivity, configure window insets handling to ensure WebView receives correct insets
2. **CSS side**: Ensure the app shell and mobile-header components properly use `env(safe-area-inset-top)`

### Technical Approach

#### Build Fix Options

**Option A: Ensure environment propagation**
Add explicit environment export before the Gradle phase:
```yaml
- name: Build Android APK
  env:
    CARGO: ${{ env.CARGO }}
    PATH: ${{ env.PATH }}
  run: npm run tauri -- android build --ci --target aarch64 --apk
```

**Option B: Use Gradle directly**
Skip the `tauri android build` command and use Gradle directly after Rust compilation:
```yaml
- name: Build Rust library
  run: cargo build --release --target aarch64-linux-android

- name: Build APK with Gradle
  run: cd src-tauri/gen/android && ./gradlew assembleRelease
```

**Option C: Fix Tauri's rustBuild task**
The issue may be that the Tauri Gradle plugin's `rustBuildArm64Release` task expects cargo to be available but the PATH isn't set. We may need to ensure the `CARGO_HOME/bin` is in PATH for the entire job.

#### Status Bar Fix

In `MainActivity.kt` (or the Tauri-generated equivalent), add window insets handling:

```kotlin
override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    // Enable proper window insets handling
    WindowCompat.setDecorFitsSystemWindows(window, false)

    // The WebView will now receive correct safe area insets
}
```

Update theme in `themes.xml`:
```xml
<style name="Theme.incrementum_tauri" parent="Theme.MaterialComponents.DayNight.NoActionBar">
    <item name="android:windowDrawsSystemBarBackgrounds">true</item>
    <item name="android:statusBarColor">@android:color/transparent</item>
</style>
```

The CSS already has `env(safe-area-inset-top)` support in `src/index.css` and `src/styles/mobile.css`, but we need to verify these work correctly with the WebView's inset reporting.

### Trade-offs

1. **Build fix complexity**: Option A is simplest but may not address root cause. Option B is more explicit but may miss Tauri-specific build steps. Option C addresses root cause but requires understanding Tauri's Gradle integration.

2. **Edge-to-edge vs system bars**: We could either:
   - Disable edge-to-edge (simpler, but less modern appearance)
   - Enable edge-to-edge with proper insets (modern, but requires correct WebView/CSS integration)

### Dependencies
- Tauri Android Gradle plugin behavior
- Android WindowInsets API
- WebView safe area inset support (Chrome/WebView 108+)
