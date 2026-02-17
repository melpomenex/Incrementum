## Why

The repository currently builds desktop targets in GitHub Actions but does not have an automated mobile build path for Tauri. Adding mobile CI now reduces release risk and catches Android/iOS build regressions before manual packaging.

## What Changes

- Add a GitHub Actions workflow (or extend existing CI workflow) to build Tauri mobile targets.
- Define required job matrix, setup, and secrets/credentials expectations for mobile target builds.
- Produce and upload mobile build artifacts for CI verification.
- Add clear failure boundaries so mobile build failures are actionable in pull requests.

## Capabilities

### New Capabilities
- `tauri-mobile-ci-build`: CI system can run reproducible Tauri mobile builds (Android and iOS where supported) and publish build artifacts.

### Modified Capabilities
- None.

## Impact

- Affected code: `.github/workflows/*`, mobile-related build scripts/config used by Tauri.
- Dependencies/systems: GitHub-hosted runners, Tauri mobile toolchain setup, Android SDK/JDK, Xcode/macOS runner requirements for iOS.
- Process: PR/build validation will include mobile build checks.
