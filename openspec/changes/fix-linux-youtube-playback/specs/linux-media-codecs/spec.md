# linux-media-codecs Specification Delta

## Purpose
Ensure YouTube videos play correctly in Linux builds (AppImage, deb, Arch packages) by properly configuring WebKitGTK and bundling required GStreamer plugins.
## ADDED Requirements

### Requirement: GStreamer Plugin Bundling for AppImage
The system SHALL bundle required GStreamer plugins with the Linux AppImage build to enable H.264/MP4 codec support in WebKitGTK.

#### Scenario: AppImage includes GStreamer plugins
- **GIVEN** the user downloads the Incrementum AppImage
- **WHEN** the user runs the AppImage on a Linux system
- **THEN** the application SHALL include bundled GStreamer plugins for media codecs
- **AND** the plugins SHALL be discoverable by WebKitGTK at runtime
- **AND** H.264/MP4 video playback SHALL work in YouTube embeds

#### Scenario: GStreamer plugins bundled with correct paths
- **GIVEN** the AppImage is being built
- **WHEN** the build script runs
- **THEN** the script SHALL locate system GStreamer plugins
- **AND** copy them to the AppDir's lib/gstreamer-1.0 directory
- **AND** set GST_PLUGIN_SYSTEM_PATH_1_0 to the bundled plugin path

### Requirement: WebKit Environment Variable Standardization
The system SHALL use consistent WebKit environment variables across all entry points to ensure reliable YouTube playback.

#### Scenario: Consistent sandbox settings
- **GIVEN** the application is starting on Linux
- **WHEN** the WebKitGTK webview initializes
- **THEN** the environment variable WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS SHALL be set to "1"
- **AND** this setting SHALL be applied in main.rs, lib.rs, and AppRun
- **AND** the setting SHALL be applied before any webview creation

#### Scenario: Hardware acceleration disabled consistently
- **GIVEN** the application is starting on Linux
- **WHEN** the WebKitGTK webview initializes
- **THEN** WEBKIT_DISABLE_HARDWARE_ACCELERATION SHALL be set to "1"
- **AND** WEBKIT_DISABLE_DMABUF_RENDERER SHALL be set to "1"
- **AND** these settings SHALL be consistent across main.rs, lib.rs, and AppRun

### Requirement: CSP Configuration for YouTube
The Content Security Policy SHALL allow all necessary YouTube domains for iframe embedding and media playback.

#### Scenario: YouTube iframe loads correctly
- **GIVEN** a user opens a YouTube document in Incrementum
- **WHEN** the YouTube iframe loads
- **THEN** the CSP SHALL allow frame-src from youtube.com and youtube-nocookie.com
- **AND** the CSP SHALL allow media-src from googlevideo.com and youtube.com
- **AND** the CSP SHALL allow connect-src to youtube.com domains
- **AND** the CSP SHALL allow img-src from ytimg.com and related CDN domains
