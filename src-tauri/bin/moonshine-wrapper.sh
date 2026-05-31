#!/bin/bash
# Wrapper script for moonshine that sets LD_LIBRARY_PATH
# This ensures libonnxruntime.so can be found in the same directory

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export LD_LIBRARY_PATH="$SCRIPT_DIR:$LD_LIBRARY_PATH"

# Determine which moonshine binary to run based on architecture
ARCH=$(uname -m)
if [ "$ARCH" = "x86_64" ]; then
    MOONSHINE_BIN="$SCRIPT_DIR/moonshine-x86_64-unknown-linux-gnu"
elif [ "$ARCH" = "aarch64" ]; then
    MOONSHINE_BIN="$SCRIPT_DIR/moonshine-aarch64-unknown-linux-gnu"
else
    # Fallback - try to find any moonshine binary
    MOONSHINE_BIN=$(find "$SCRIPT_DIR" -name 'moonshine-*' -type f | head -1)
fi

if [ ! -f "$MOONSHINE_BIN" ]; then
    echo "Error: Moonshine binary not found" >&2
    exit 1
fi

exec "$MOONSHINE_BIN" "$@"
