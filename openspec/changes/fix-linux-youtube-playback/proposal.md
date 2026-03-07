# Change: Fix YouTube Videos Not Playing on Linux Builds

## Metadata
- **Change ID:** fix-linux-youtube-playback
- **Author:** Claude
- **Status:** Proposed
- **Created:** 2026-03-05

## Summary
Ensure YouTube videos play correctly in Linux AppImage, deb, and Arch package builds by bundling required GStreamer plugins and standardizing WebKit environment configuration.

## Problem Statement
YouTube videos fail to play in Linux builds (AppImage, deb, Arch packages). Users see either:
1. A black video area with no playback
2. "Your browser can't play this video" error message
3. Error codes 5 or 150 from YouTube iframe API
4. The thumbnail/play button shows but clicking does either nothing or shows an error

The root cause is a combination of:
- **WebKitGTK codec limitations**: WebKitGTK on Linux lacks built-in H.264/MP4 codecs that YouTube requires. These codecs come from GStreamer plugins.
- **Inconsistent WebKit environment variables**: Different parts of the codebase set conflicting environment variables for WebKit configuration.
- **Missing GStreamer plugins in AppImage**: While deb packages specify GStreamer dependencies, AppImage builds don't bundle these plugins.
- **Sandbox configuration mismatch**: `lib.rs` uses `WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS` while `AppRun` uses `WEBKIT_FORCE_SANDBOX=0`.
- **CSP restrictions**: Content Security Policy may block required iframe communication.

## Proposed Solution
### 1. Bundle GStreamer Plugins with AppImage
Include essential GStreamer plugins for H.264/MP4 codec support inside the AppImage:
- `gst-libav`
- `gst-plugins-base`
- `gst-plugins-good` (for matroskabluka, opus, etc.)
- `gst-plugins-bad` (for additional codecs)

Update the AppImage build script to locate and bundle system GStreamer plugins.

### 2. Standardize WebKit Environment Variables
Unify environment variable settings across all entry points:
- Remove duplicate/conflicting settings in `lib.rs`, `main.rs`, and `AppRun`
- Ensure `WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1` is set everywhere
- Keep GStreamer plugin paths intact (already done in AppRun)

### 3. Enhance CSP Configuration
Verify CSP headers in `tauri.conf.json` allow all necessary YouTube domains for iframe embeds:
- `*.youtube.com`
- `*.googlevideo.com`
- `*.ytimg.com`
- `*.youtube-nocookie.com`
- `*.ggpht.com`
- `*.gstatic.com`
- `*.googleusercontent.com`

### 4. Add User-Friendly Error Handling
When codec detection fails, provide:
- Clear error message explaining the issue
- Link to documentation on installing GStreamer plugins
- Option to open video in external browser as fallback

## Scope
- `src-tauri/AppRun` - WebKit and GStreamer environment setup
- `scripts/ci-build-appimage.sh` - Bundle GStreamer plugins
- `src-tauri/tauri.conf.json` - CSP configuration
- `src-tauri/src/lib.rs` - WebKit environment variables
- `src-tauri/src/main.rs` - WebKit environment variables
- `src/components/viewer/YouTubeViewer.tsx` - Error messaging (optional enhancement)

## Risks
- **AppImage size increase**: Bundling GStreamer plugins will increase AppImage size by ~20-50MB
- **Compatibility**: Different Linux distributions have different GStreamer versions; may need version-specific handling
- **Security**: Setting `WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1` reduces security but is required for YouTube iframe functionality
