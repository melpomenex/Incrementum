### Added
- Signed Android release APK build pipeline (`setup-android-toolchain.sh` and `build-android-apk.sh`).
- Keystore and signing configuration for release builds.

### Fixed & Improved
- Fixed bottom navigation bar overlapping the left vertical sidebar on mobile/tablet devices by conditionally hiding desktop toolbars when the mobile shell is active.
- Reduced bottom navigation height on mobile and tablets from 72px to 56px to optimize vertical screen real estate.
- Centered EPUB reader text inside the viewport on mobile and tablet devices.
