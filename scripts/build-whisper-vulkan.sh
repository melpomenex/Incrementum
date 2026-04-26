#!/usr/bin/env bash
# Build whisper.cpp with Vulkan GPU acceleration for Linux x86_64.
#
# Prerequisites (Arch Linux):
#   sudo pacman -S vulkan-devel cmake gcc make
#
# Usage:
#   ./scripts/build-whisper-vulkan.sh
#
# This replaces src-tauri/bin/whisper-x86_64-unknown-linux-gnu with a
# Vulkan-enabled build and copies the required shared libraries.

set -euo pipefail

WHISPER_VERSION="v1.8.3"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BIN_DIR="$PROJECT_DIR/src-tauri/bin"
BUILD_DIR="$(mktemp -d)"

echo "=== Building whisper.cpp $WHISPER_VERSION with Vulkan support ==="

# Clone whisper.cpp
if [ ! -d "$BUILD_DIR/whisper.cpp" ]; then
    git clone --depth 1 --branch "$WHISPER_VERSION" https://github.com/ggerganov/whisper.cpp.git "$BUILD_DIR/whisper.cpp"
fi

cd "$BUILD_DIR/whisper.cpp"

# Build with Vulkan
cmake -B build \
    -DGGML_VULKAN=ON \
    -DCMAKE_BUILD_TYPE=Release \
    -DBUILD_SHARED_LIBS=ON
cmake --build build -j"$(nproc)"

# Copy the main binary
echo "=== Copying binary to $BIN_DIR ==="
cp build/bin/whisper-cli "$BIN_DIR/whisper-x86_64-unknown-linux-gnu"
chmod +x "$BIN_DIR/whisper-x86_64-unknown-linux-gnu"

# Copy shared libraries (Vulkan GPU backend + dependencies)
echo "=== Copying shared libraries ==="
for lib in libggml-vulkan.so libggml-cpu.so libggml-base.so libggml.so libwhisper.so; do
    # Find the versioned library (e.g. libggml-vulkan.so.0.9.5)
    src=$(find build/src -name "$lib.*" -not -name "*.dylib" -type f 2>/dev/null | head -1)
    if [ -z "$src" ]; then
        src=$(find build -name "$lib.*" -not -name "*.dylib" -type f 2>/dev/null | head -1)
    fi
    if [ -n "$src" ]; then
        # Copy the versioned file and create SONAME + unversioned symlinks
        # e.g. libggml-vulkan.so.0.9.5 → libggml-vulkan.so.0 (SONAME) → libggml-vulkan.so
        cp "$src" "$BIN_DIR/"
        base=$(basename "$src")
        cd "$BIN_DIR"
        # SONAME: strip .9.5 from .0.9.5, leaving .0
        soname=$(echo "$base" | sed 's/\.[0-9]*\.[0-9]*$//')
        ln -sf "$base" "$soname"
        # Unversioned: strip all version numbers
        unversioned=$(echo "$base" | sed 's/\.[0-9]*\.[0-9]*\.[0-9]*$//')
        ln -sf "$base" "$unversioned"
        cd "$BUILD_DIR/whisper.cpp"
        echo "  Copied $base → $soname, $unversioned"
    else
        echo "  WARNING: $lib not found in build output"
    fi
done

echo ""
echo "=== Build complete ==="
echo "Binary: $BIN_DIR/whisper-x86_64-unknown-linux-gnu"
echo ""
echo "Verify Vulkan is detected:"
echo "  $BIN_DIR/whisper-x86_64-unknown-linux-gnu --help 2>&1 | grep -i vulkan"
echo ""
echo "Shared libraries in $BIN_DIR:"
ls -la "$BIN_DIR"/libggml*.so* "$BIN_DIR"/libwhisper*.so* 2>/dev/null || echo "  No .so files found"

# Cleanup
rm -rf "$BUILD_DIR"
