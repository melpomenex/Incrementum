#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

APPIMAGE_DIR="src-tauri/target/release/bundle/appimage"
APPDIR="$APPIMAGE_DIR/Incrementum.AppDir"
NOTEBOOKLM_RUNTIME_SRC="src-tauri/bin/notebooklm-runtime"
NOTEBOOKLM_RUNTIME_DST="$APPDIR/usr/bin/notebooklm-runtime"
WORK_DIR="/tmp/appimagetool-work"
APPIMAGETOOL_APPIMAGE="$WORK_DIR/appimagetool.AppImage"
APPIMAGETOOL_BIN="$WORK_DIR/squashfs-root/AppRun"
RUNTIME_FILE="$WORK_DIR/runtime-x86_64"

EXPECTED_APPIMAGE="$(node -e 'const c=require("./src-tauri/tauri.conf.json"); console.log(`src-tauri/target/release/bundle/appimage/${c.productName}_${c.version}_amd64.AppImage`)')"

echo "Building AppImage with tauri..."
build_rc=0
APPIMAGE_EXTRACT_AND_RUN=1 NO_STRIP=1 npm run tauri -- build --bundles appimage || build_rc=$?
if [[ $build_rc -ne 0 ]]; then
  echo "tauri appimage build exited with $build_rc; attempting fallback packaging from AppDir"
fi

if [[ ! -d "$APPDIR" ]]; then
  echo "Expected AppDir missing at $APPDIR"
  exit 1
fi

RUNTIME_TRIPLE="x86_64-unknown-linux-gnu"
RUNTIME_PY_SRC="$NOTEBOOKLM_RUNTIME_SRC/$RUNTIME_TRIPLE/python/bin/python3"
RUNTIME_MANIFEST_SRC="$NOTEBOOKLM_RUNTIME_SRC/$RUNTIME_TRIPLE/runtime-manifest.json"
RUNTIME_MODULE_SRC="$NOTEBOOKLM_RUNTIME_SRC/$RUNTIME_TRIPLE/site-packages/notebooklm"
RUNTIME_SIDECAR_SRC="src-tauri/bin/notebooklm-$RUNTIME_TRIPLE"

if [[ ! -x "$RUNTIME_PY_SRC" || ! -f "$RUNTIME_MANIFEST_SRC" || ! -d "$RUNTIME_MODULE_SRC" || ! -x "$RUNTIME_SIDECAR_SRC" ]]; then
  echo "NotebookLM runtime source incomplete; bootstrapping portable runtime for $RUNTIME_TRIPLE..."
  NOTEBOOKLM_BUNDLE_RUNTIME=1 TARGET_TRIPLE="$RUNTIME_TRIPLE" node scripts/download-sidecars.js
fi

if [[ ! -x "$RUNTIME_PY_SRC" || ! -f "$RUNTIME_MANIFEST_SRC" || ! -d "$RUNTIME_MODULE_SRC" || ! -x "$RUNTIME_SIDECAR_SRC" ]]; then
  echo "NotebookLM runtime source still incomplete after bootstrap."
  exit 1
fi

echo "Injecting notebooklm runtime into AppDir..."
mkdir -p "$NOTEBOOKLM_RUNTIME_DST"
rsync -a --delete "$NOTEBOOKLM_RUNTIME_SRC"/ "$NOTEBOOKLM_RUNTIME_DST"/

# Copy the notebooklm sidecar binary to AppDir
NOTEBOOKLM_SIDECAR_SRC="src-tauri/bin/notebooklm-$RUNTIME_TRIPLE"
NOTEBOOKLM_SIDECAR_DST="$APPDIR/usr/bin/notebooklm-$RUNTIME_TRIPLE"
if [[ -x "$NOTEBOOKLM_SIDECAR_SRC" ]]; then
  echo "Copying notebooklm sidecar to AppDir..."
  cp -f "$NOTEBOOKLM_SIDECAR_SRC" "$NOTEBOOKLM_SIDECAR_DST"
  chmod +x "$NOTEBOOKLM_SIDECAR_DST"
else
  echo "NotebookLM sidecar not found at $NOTEBOOKLM_SIDECAR_SRC"
  exit 1
fi

scripts/verify-notebooklm-runtime.sh "$APPDIR/usr/bin"

# === Bundle GStreamer Plugins for YouTube/Video Playback ===
# WebKitGTK requires GStreamer plugins for H.264 and other codecs
bundle_gstreamer_plugins() {
  echo "Bundling GStreamer plugins for media codec support..."

  # Find system GStreamer plugins directory
  local GST_PLUGINS_DIR=""
  if command -v pkg-config &>/dev/null; then
    GST_PLUGINS_DIR="$(pkg-config --variable=pluginsdir gstreamer-1.0 2>/dev/null || true)"
  fi

  # Fallback locations
  if [[ -z "$GST_PLUGINS_DIR" || ! -d "$GST_PLUGINS_DIR" ]]; then
    for dir in "/usr/lib/gstreamer-1.0" "/usr/lib/x86_64-linux-gnu/gstreamer-1.0" "/usr/lib64/gstreamer-1.0"; do
      if [[ -d "$dir" ]]; then
        GST_PLUGINS_DIR="$dir"
        break
      fi
    done
  fi

  if [[ -z "$GST_PLUGINS_DIR" || ! -d "$GST_PLUGINS_DIR" ]]; then
    echo "Warning: Could not find GStreamer plugins directory. YouTube playback may not work."
    return 0
  fi

  echo "Found GStreamer plugins at: $GST_PLUGINS_DIR"

  # Create destination directory
  local GST_DEST="$APPDIR/usr/lib/gstreamer-1.0"
  mkdir -p "$GST_DEST"

  # Essential plugins for YouTube/video playback
  # - libgstcoreelements.so (required)
  # - libgstplayback.so (required)
  # - libgstlibav.so (H.264, AAC codecs - from gst-libav)
  # - libgstvideoconvertscale.so (video processing)
  # - libgstaudioconvert.so, libgstaudioresample.so (audio)
  # - libgstvorbis.so, libgstopus.so (audio codecs)
  # - libgstisomp4.so (MP4 container)
  # - libgsttypefindfunctions.so (media type detection)
  # - libgstgl.so (OpenGL rendering, required by WebKitGTK)
  local PLUGINS=(
    "libgstcoreelements.so"
    "libgstcoretracers.so"
    "libgstplayback.so"
    "libgstlibav.so"
    "libgstvideoconvertscale.so"
    "libgstaudioconvert.so"
    "libgstaudioresample.so"
    "libgstvorbis.so"
    "libgstopus.so"
    "libgstisomp4.so"
    "libgsttypefindfunctions.so"
    "libgstapp.so"
    "libgstautodetect.so"
    "libgstpulse.so"
    "libgstalsa.so"
    "libgstgl.so"
  )

  local copied=0
  for plugin in "${PLUGINS[@]}"; do
    if [[ -f "$GST_PLUGINS_DIR/$plugin" ]]; then
      cp -L "$GST_PLUGINS_DIR/$plugin" "$GST_DEST/" 2>/dev/null || true
      ((copied++)) || true
    fi
  done

  echo "Copied $copied GStreamer plugins to AppDir"

  # List what was copied
  if [[ -d "$GST_DEST" ]]; then
    echo "Bundled GStreamer plugins:"
    ls -la "$GST_DEST"/*.so 2>/dev/null || echo "  (none)"
  fi

  # Remove any GStreamer core libraries that tauri-bundler/linuxdeploy may have placed
  # in the AppDir. Bundled core libs (from Ubuntu's older GStreamer) conflict with
  # system WebKitGTK on distros like Arch that ship newer GStreamer versions.
  # Plugins are loaded via GST_PLUGIN_PATH set in main.rs; core libs come from the system.
  echo "Removing any bundled GStreamer core libraries..."
  rm -f "$APPDIR/usr/lib"/libgst*.so.* "$APPDIR/usr/lib"/libgstreamer*.so.*
}

bundle_gstreamer_plugins

# Fix absolute symlinks in the AppDir (Python stdlib, linuxdeploy artifacts, etc.)
# Absolute symlinks break on user machines since they point to CI runner paths.
fixed=0
broken=0
find "$APPDIR" -type l | while read -r link; do
  target="$(readlink "$link")"
  if [[ "$target" = /* ]]; then
    if [[ -e "$target" ]]; then
      rm "$link"
      cp -aL "$target" "$link"
    else
      rm "$link"
    fi
  fi
done
echo "Absolute symlinks in AppDir cleaned up"

mkdir -p "$WORK_DIR"
if [[ ! -x "$APPIMAGETOOL_BIN" ]]; then
  curl -fsSL -o "$APPIMAGETOOL_APPIMAGE" \
    "https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage"
  chmod +x "$APPIMAGETOOL_APPIMAGE"
  (
    cd "$WORK_DIR"
    APPIMAGE_EXTRACT_AND_RUN=1 "$APPIMAGETOOL_APPIMAGE" --appimage-extract >/dev/null
  )
fi

if [[ ! -f "$RUNTIME_FILE" ]]; then
  curl -fsSL -o "$RUNTIME_FILE" \
    "https://github.com/AppImage/type2-runtime/releases/download/continuous/runtime-x86_64"
  chmod +x "$RUNTIME_FILE"
fi

desktop_file="$(find "$APPDIR/usr/share/applications" -maxdepth 1 -type f -name '*.desktop' | head -n1 || true)"
if [[ -n "$desktop_file" ]]; then
  icon_name="$(awk -F= '/^Icon=/{print $2; exit}' "$desktop_file")"
  if [[ -n "$icon_name" && ! -f "$APPDIR/$icon_name.png" ]]; then
    if [[ -f "$APPDIR/Incrementum.png" ]]; then
      cp -f "$APPDIR/Incrementum.png" "$APPDIR/$icon_name.png"
    fi
  fi
fi

rm -f "$ROOT_DIR/Incrementum-x86_64.AppImage"
rm -f "$EXPECTED_APPIMAGE"
ARCH=x86_64 "$APPIMAGETOOL_BIN" --runtime-file "$RUNTIME_FILE" "$ROOT_DIR/$APPDIR"

if [[ ! -f "$ROOT_DIR/Incrementum-x86_64.AppImage" ]]; then
  echo "appimagetool packaging did not produce Incrementum-x86_64.AppImage"
  exit 1
fi

mv -f "$ROOT_DIR/Incrementum-x86_64.AppImage" "$EXPECTED_APPIMAGE"

if [[ ! -f "$EXPECTED_APPIMAGE" ]]; then
  echo "Expected AppImage missing: $EXPECTED_APPIMAGE"
  exit 1
fi

echo "Final AppImage:"
ls -lh "$EXPECTED_APPIMAGE"
