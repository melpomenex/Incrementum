# tauri-mobile-ci-build

## MODIFIED Requirements

### Requirement: Android APK Build Pipeline
The CI system SHALL successfully compile the Tauri application for Android targets and produce a signed APK artifact.

#### Scenario: Android build completes on GitHub Actions
- Given the mobile-build.yml workflow is triggered on push or PR
- When the android-build job runs
- Then the Rust compilation for aarch64-linux-android completes successfully
- And the Gradle build assembles a release APK
- And the APK is signed and uploaded as a workflow artifact

#### Scenario: Build environment has correct toolchain configuration
- Given the workflow sets up Rust, Java, and Android SDK
- When the Gradle build task `rustBuildArm64Release` executes
- Then the cargo binary MUST be accessible on PATH
- And NDK_HOME SHALL point to the correct NDK installation
- And the C toolchain linker and archiver paths MUST be properly configured

## Related Capabilities
- `mobile-display-layout` - Runtime display configuration on Android
