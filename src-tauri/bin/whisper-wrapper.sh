#!/bin/bash
# Wrapper script for whisper that sets LD_LIBRARY_PATH
# This ensures libwhisper.so.1 can be found in the same directory

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export LD_LIBRARY_PATH="$SCRIPT_DIR:$LD_LIBRARY_PATH"

# Determine which whisper binary to run based on architecture
ARCH=$(uname -m)
if [ "$ARCH" = "x86_64" ]; then
    WHISPER_BIN="$SCRIPT_DIR/whisper-x86_64-unknown-linux-gnu"
elif [ "$ARCH" = "aarch64" ]; then
    WHISPER_BIN="$SCRIPT_DIR/whisper-aarch64-apple-darwin"
else
    # Fallback - try to find any whisper binary
    WHISPER_BIN=$(find "$SCRIPT_DIR" -name 'whisper-*' -type f | head -1)
fi

if [ ! -f "$WHISPER_BIN" ]; then
    echo "Error: Whisper binary not found" >&2
    exit 1
fi

exec "$WHISPER_BIN" "$@"
