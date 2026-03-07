# Tasks: Fix Linux YouTube Playback

## Phase 1: WebKit Environment Standardization
- [x] **Standardize WebKit env vars in main.rs**
  - Ensure `WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1` is set
  - Add `WEBKIT_DISABLE_HARDWARE_ACCELERATION=1` if missing
  - Remove conflicting settings

- [x] **Standardize WebKit env vars in lib.rs**
  - Ensure consistency with main.rs settings
  - Remove `WEBKIT_DISABLE_HARDWARE_ACCELERATION` (redundant with main.rs)

- [x] **Update AppRun script**
  - Change `WEBKIT_FORCE_SANDBOX=0` to `WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1`
  - Ensure consistent environment variable naming
  - Add GStreamer plugin path configuration

- [ ] **Validation**: Build AppImage and verify environment variables are set correctly by checking startup logs

## Phase 2: GStreamer Plugin Bundling
- [x] **Create GStreamer plugin bundling function**
  - Added `bundle_gstreamer_plugins()` function to locate system GStreamer plugins
  - Copies essential plugins (libav, video, audio codecs) to AppDir

- [x] **Update ci-build-appimage.sh**
  - Added GStreamer plugin bundling step
  - Ensures plugins are copied to lib/gstreamer-1.0 in AppDir

- [x] **Update AppRun to set GST paths**
  - Set GST_PLUGIN_SYSTEM_PATH_1_0 to bundled plugin directory
  - Set GST_PLUGIN_PATH to bundled plugin directory

- [ ] **Validation**: Verify bundled plugins exist in the built AppImage

## Phase 3: CSP Verification and Enhancement
- [x] **Audit current CSP configuration**
  - Reviewed `tauri.conf.json` CSP settings
  - Verified all YouTube domains are included

- [x] **Enhance CSP**
  - Added `*.ggpht.com` for YouTube images
  - Added wildcard patterns for all YouTube subdomains
  - Enhanced connect-src, script-src, img-src, frame-src

- [x] **Update capabilities/default.json**
  - Added more YouTube-related URLs to remote URLs list

- [ ] **Validation**: Open DevTools and verify no CSP errors when loading YouTube embed

## Phase 4: Testing and Validation
- [ ] **Test on Ubuntu (deb package)**
  - Install deb package
  - Open a YouTube video
  - Verify playback works

- [ ] **Test on Arch Linux (pkg package)**
  - Install Arch package
  - Open a YouTube video
  - Verify playback works

- [ ] **Test AppImage on clean system**
  - Run AppImage on a system without GStreamer plugins
  - Verify bundled plugins are used
  - Verify YouTube playback works

- [ ] **Document troubleshooting steps**
  - Add docs for users who still experience issues
  - Include commands to install GStreamer plugins manually
