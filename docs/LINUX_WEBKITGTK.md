# Linux (WebKitGTK) Known Limitations

The Linux AppImage uses WebKitGTK as its web engine. While WebKitGTK works well for most app functionality, it has some known limitations compared to the macOS (WKWebView) and Windows (WebView2/Chromium) builds.

## YouTube Playback Performance

YouTube videos are embedded via an iframe using `react-youtube`. On macOS and Windows, the native webview engines handle cross-origin iframe compositing efficiently. WebKitGTK struggles with this — when a YouTube video is playing, the **entire app UI may become sluggish**.

This is a WebKitGTK limitation, not an app bug. There is no fix within the app code.

### Mitigations

- **Use the web version** on browsers that use Chromium/Blink (Chrome, Firefox, Edge) for the best YouTube experience
- **Try X11 instead of Wayland** — WebKitGTK compositing is sometimes smoother on X11
- **Environment variables** (may or may not help depending on your system):
  - `WEBKIT_HARDWARE_ACCELERATION_POLICY=always` — force GPU compositing
  - `WEBKIT_DISABLE_COMPOSITING_MODE=1` — force software rendering (can go either way)

## Missing Media Codecs

Some WebKitGTK builds (especially minimal/distro-specific ones) lack H.264/MP4 codecs. The app detects this at startup and shows a warning if inline video playback is likely unsupported.

### Fix

Install GStreamer plugins with H.264 support:

```bash
# Arch / Omarchy
sudo pacman -S gst-plugins-good gst-plugins-bad gst-plugins-ugly gst-libav

# Ubuntu / Debian
sudo apt install gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly gstreamer1.0-libav

# Fedora
sudo dnf install gstreamer1-plugins-good gstreamer1-plugins-bad-free gstreamer1-plugins-ugly-free gstreamer1-libav
```

## YouTube Embed Host Fallback

YouTube's privacy-enhanced embed domain (`youtube-nocookie.com`) is blocked by WebKitGTK's CORS policy for internal requests made by the embed. The app detects Linux and automatically falls back to `youtube.com` for embeds. If you see "Your browser can't play this video" errors, this fallback may not have triggered — check the console for `[YouTubeViewer]` warnings.
