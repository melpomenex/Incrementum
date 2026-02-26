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
APPIMAGETOOL_BIN="$WORK_DIR/squashfs-root/usr/bin/appimagetool"
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

if [[ ! -d "$NOTEBOOKLM_RUNTIME_SRC" ]]; then
  echo "NotebookLM runtime source missing: $NOTEBOOKLM_RUNTIME_SRC"
  exit 1
fi

echo "Injecting notebooklm runtime into AppDir..."
mkdir -p "$NOTEBOOKLM_RUNTIME_DST"
rsync -a --delete "$NOTEBOOKLM_RUNTIME_SRC"/ "$NOTEBOOKLM_RUNTIME_DST"/

if [[ -x "$APPDIR/usr/bin/notebooklm" ]]; then
  "$APPDIR/usr/bin/notebooklm" --version >/dev/null
fi

mkdir -p "$WORK_DIR"
if [[ ! -x "$APPIMAGETOOL_BIN" ]]; then
  curl -fsSL -o "$APPIMAGETOOL_APPIMAGE" \
    "https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage"
  chmod +x "$APPIMAGETOOL_APPIMAGE"
  "$APPIMAGETOOL_APPIMAGE" --appimage-extract >/dev/null
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
"$APPIMAGETOOL_BIN" --runtime-file "$RUNTIME_FILE" "$ROOT_DIR/$APPDIR"

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
