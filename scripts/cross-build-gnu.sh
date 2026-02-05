#!/bin/bash
# Cross-compile Windows binaries from Linux using MinGW (GNU toolchain) via Docker
# All caches and artifacts stored on /mnt/downloads to save main drive space

set -e

# Get project root (parent of scripts directory)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Configuration - all on downloads drive
DOWNLOADS_BASE="/mnt/downloads/cargo-gnu"
CARGO_HOME="$DOWNLOADS_BASE/cargo-home"
RUSTUP_HOME="$DOWNLOADS_BASE/rustup-home"
CARGO_TARGET_DIR="$DOWNLOADS_BASE/target"

# Create directories
echo "Setting up directories on /mnt/downloads..."
mkdir -p "$CARGO_HOME" "$RUSTUP_HOME" "$CARGO_TARGET_DIR"

echo "Project root: $PROJECT_ROOT"
echo "Cargo cache: $CARGO_HOME"
echo "Build output: $CARGO_TARGET_DIR"

echo "Building Windows x64 binary using MinGW (GNU toolchain)..."

# Copy final binary to project directory for easy access
FINAL_OUTPUT_DIR="$PROJECT_ROOT/src-tauri/target-windows-gnu"
mkdir -p "$FINAL_OUTPUT_DIR"

# Use the latest Rust Docker image with MinGW
docker run --rm \
    --volume "$PROJECT_ROOT":/project \
    --volume "$CARGO_HOME":/cargo-home \
    --volume "$RUSTUP_HOME":/rustup-home \
    --volume "$CARGO_TARGET_DIR":/cargo-target \
    --workdir /project/src-tauri \
    --env CARGO_HOME=/cargo-home \
    --env RUSTUP_HOME=/rustup-home \
    --env CARGO_TARGET_DIR=/cargo-target \
    rust:latest \
    bash -c "
        # Install MinGW
        apt-get update -qq && apt-get install -y -qq mingw-w64

        # Install Rust target
        rustup target add x86_64-pc-windows-gnu

        # Build for Windows
        cargo build --target x86_64-pc-windows-gnu --release
    "

# Copy the final binary to the project directory for easy access
echo ""
echo "Copying binary to project directory..."
cp -f "$CARGO_TARGET_DIR/x86_64-pc-windows-gnu/release/incrementum.exe" "$FINAL_OUTPUT_DIR/" 2>/dev/null || echo "Note: incrementum.exe not found (build may have failed)"

echo ""
echo "Done!"
echo "Build cache stored in: $DOWNLOADS_BASE"
echo "Binary copied to: $FINAL_OUTPUT_DIR/"
echo ""
echo "To clear cache later: rm -rf $DOWNLOADS_BASE"
