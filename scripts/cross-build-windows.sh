#!/bin/bash
# Cross-compile Windows binaries from Linux using Docker
# All caches and artifacts stored on /mnt/downloads to save main drive space

set -e

# Get project root (parent of scripts directory)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Configuration - all on downloads drive
DOWNLOADS_BASE="/mnt/downloads/cargo-xwin"
CARGO_HOME="$DOWNLOADS_BASE/cargo-home"
RUSTUP_HOME="$DOWNLOADS_BASE/rustup-home"
CARGO_TARGET_DIR="$DOWNLOADS_BASE/target-xwin"
XWIN_CACHE_DIR="$DOWNLOADS_BASE/xwin-cache"

# Create directories
echo "Setting up directories on /mnt/downloads..."
mkdir -p "$CARGO_HOME" "$RUSTUP_HOME" "$CARGO_TARGET_DIR" "$XWIN_CACHE_DIR"

echo "Project root: $PROJECT_ROOT"
echo "Cargo cache: $CARGO_HOME"
echo "Build output: $CARGO_TARGET_DIR"

echo "Building Windows x64 binary using cargo-xwin Docker..."

# Copy final binary to project directory for easy access
FINAL_OUTPUT_DIR="$PROJECT_ROOT/src-tauri/target-windows-msvc"
mkdir -p "$FINAL_OUTPUT_DIR"

# Use messense/cargo-xwin image which has cargo-xwin pre-installed
docker run --rm \
    --volume "$PROJECT_ROOT":/project \
    --volume "$CARGO_HOME":/cargo-home \
    --volume "$RUSTUP_HOME":/rustup-home \
    --volume "$CARGO_TARGET_DIR":/cargo-target \
    --volume "$XWIN_CACHE_DIR":/xwin-cache \
    --workdir /project/src-tauri \
    --env CARGO_HOME=/cargo-home \
    --env RUSTUP_HOME=/rustup-home \
    --env CARGO_TARGET_DIR=/cargo-target \
    --env XWIN_CACHE_DIR=/xwin-cache \
    messense/cargo-xwin:latest \
    bash -c "
        # Add Windows target
        rustup target add x86_64-pc-windows-msvc

        # Build for Windows
        cargo xwin build --target x86_64-pc-windows-msvc --release
    "

# Copy the final binary to the project directory for easy access
echo ""
echo "Copying binary to project directory..."
find "$CARGO_TARGET_DIR" -name "incrementum.exe" -type f -exec cp {} "$FINAL_OUTPUT_DIR/" \; 2>/dev/null || echo "Note: incrementum.exe not found (build may have failed or produced a different output)"

echo ""
echo "Done!"
echo "Build cache stored in: $DOWNLOADS_BASE"
echo "Binary copied to: $FINAL_OUTPUT_DIR/"
echo ""
echo "To clear cache later: rm -rf $DOWNLOADS_BASE"
