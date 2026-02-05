#!/bin/bash
# Cross-compile Windows binaries from Linux using Zig cross-compilation
# All caches and artifacts stored on /mnt/downloads to save main drive space

set -e

# Get project root (parent of scripts directory)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Configuration - all on downloads drive
DOWNLOADS_BASE="/mnt/downloads/cargo-zig"
CARGO_HOME="$DOWNLOADS_BASE/cargo-home"
RUSTUP_HOME="$DOWNLOADS_BASE/rustup-home"
CARGO_TARGET_DIR="$DOWNLOADS_BASE/target"

# Create directories
echo "Setting up directories on /mnt/downloads..."
mkdir -p "$CARGO_HOME" "$RUSTUP_HOME" "$CARGO_TARGET_DIR"

echo "Project root: $PROJECT_ROOT"
echo "Cargo cache: $CARGO_HOME"
echo "Build output: $CARGO_TARGET_DIR"

# Build type: debug (faster, less memory) or release (optimized, more memory)
BUILD_TYPE="${1:-debug}"
echo "Building Windows x64 binary ($BUILD_TYPE mode)..."

# Copy final binary to project directory for easy access
FINAL_OUTPUT_DIR="$PROJECT_ROOT/src-tauri/target-windows"
mkdir -p "$FINAL_OUTPUT_DIR"

# Use zigcc Docker image which has Zig pre-installed
# Low memory settings + increased stack size
docker run --rm \
    --volume "$PROJECT_ROOT":/project \
    --volume "$CARGO_HOME":/cargo-home \
    --volume "$RUSTUP_HOME":/rustup-home \
    --volume "$CARGO_TARGET_DIR":/cargo-target \
    --workdir /project/src-tauri \
    --env CARGO_HOME=/cargo-home \
    --env RUSTUP_HOME=/rustup-home \
    --env CARGO_TARGET_DIR=/cargo-target \
    --env CARGO_BUILD_JOBS=1 \
    --env RUST_MIN_STACK=16777216 \
    ghcr.io/messense/cargo-zigbuild:latest \
    bash -c "
        # Install MinGW tools (needed for windows-rs)
        apt-get update -qq && apt-get install -y -qq mingw-w64

        # Add Windows target
        rustup target add x86_64-pc-windows-gnu

        # Build using cargo-zigbuild with low memory settings
        export CARGO_BUILD_JOBS=1
        export RUST_MIN_STACK=16777216

        if [ \"$BUILD_TYPE\" = \"release\" ]; then
            cargo zigbuild --target x86_64-pc-windows-gnu --release -j 1
        else
            cargo zigbuild --target x86_64-pc-windows-gnu -j 1
        fi
    "

# Copy the final binary to the project directory for easy access
echo ""
echo "Copying binary to project directory..."
find "$CARGO_TARGET_DIR" -name "incrementum.exe" -type f -exec cp {} "$FINAL_OUTPUT_DIR/" \; 2>/dev/null || echo "Note: incrementum.exe not found (build may have failed)"

echo ""
echo "Done!"
echo "Build cache stored in: $DOWNLOADS_BASE"
echo "Binary copied to: $FINAL_OUTPUT_DIR/"
echo ""
echo "To clear cache later: rm -rf $DOWNLOADS_BASE"
echo ""
echo "Usage: ./cross-build.sh [debug|release]"
echo "  debug  - Faster build, larger binary (default)"
echo "  release - Optimized build, slower compilation"
