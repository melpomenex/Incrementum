## Tasks

### 1. Diagnose Android build failure
- [x] Review the Gradle `rustBuildArm64Release` task failure details
- [x] Identify why cargo is not accessible during the Gradle build phase
- [x] Check if environment variables are properly propagated to Gradle

### 2. Fix Android CI build workflow
- [x] Update `.github/workflows/mobile-build.yml` to ensure cargo is on PATH for Gradle
- [x] Verify NDK_HOME and related toolchain env vars are set before Gradle runs
- [x] Add version extraction and tag_name parameter for release uploads
- [ ] Test that the workflow produces a valid APK artifact (requires CI run)

### 3. Configure Android status bar safe area
- [x] Update Android theme to handle window insets properly
- [x] Modify MainActivity to set appropriate window flags or enable edge-to-edge with insets
- [x] Ensure `env(safe-area-inset-top)` CSS variable is properly populated by the WebView

### 4. Update CSS for Android safe area insets
- [x] Review and update `src/index.css` app-shell class to respect safe-area-inset-top (already configured)
- [x] Verify `src/styles/mobile.css` mobile-header uses proper inset handling (already configured)
- [ ] Test on Android device/emulator to confirm status bar no longer overlaps content (requires device)

### 5. Validate end-to-end
- [ ] Trigger a CI build and confirm Android APK is produced
- [ ] Install APK on Android device/emulator and verify status bar behavior

### 6. Ensure mobile artifacts appear in releases
- [x] Add version extraction step for Android release uploads
- [x] Add `tag_name` parameter to Android release upload step
- [x] Add version extraction step for iOS release uploads
- [x] Add `tag_name` parameter to iOS release upload step
