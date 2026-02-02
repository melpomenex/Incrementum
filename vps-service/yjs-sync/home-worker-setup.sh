#!/bin/bash
# Setup script for Home Transcript Worker on Mac mini

set -e

echo "=================================================="
echo "Home Transcript Worker Setup for macOS"
echo "=================================================="

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is required. Install with: brew install python3"
    exit 1
fi

# Check if yt-dlp is installed
if ! command -v yt-dlp &> /dev/null; then
    echo "Installing yt-dlp..."
    if command -v brew &> /dev/null; then
        brew install yt-dlp
    else
        echo "ERROR: Homebrew not found. Please install Homebrew first:"
        echo "  /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        exit 1
    fi
else
    echo "✓ yt-dlp is installed"
fi

# Install Python dependencies
echo "Installing Python dependencies..."
pip3 install requests 2>/dev/null || python3 -m pip install --user requests

# Create config directory
CONFIG_DIR="$HOME/.transcript-worker"
mkdir -p "$CONFIG_DIR"

# Create .env file
ENV_FILE="$CONFIG_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "Creating configuration file..."
    cat > "$ENV_FILE" << 'EOF'
# VPS Configuration (use Tailscale IP)
VPS_URL=http://REDACTED_IP:8766
VPS_API_KEY=change-me-in-production

# Worker Configuration
WORKER_ID=mac-mini-1
POLL_INTERVAL=5
EOF
    echo ""
    echo "⚠️  Please edit $ENV_FILE and update VPS_API_KEY"
    echo "   Get the API key from your VPS at: /root/yjs-sync/.env"
    echo ""
fi

# Copy worker script
SCRIPT_DIR="$CONFIG_DIR"
cp home-worker.py "$SCRIPT_DIR/worker.py" 2>/dev/null || {
    echo "Please copy home-worker.py to $SCRIPT_DIR/worker.py"
    echo ""
}

# Create LaunchAgent plist
PLIST_PATH="$HOME/Library/LaunchAgents/com.transcript.worker.plist"
cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.transcript.worker</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>$SCRIPT_DIR/worker.py</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$CONFIG_DIR</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>VPS_URL</key>
        <string>$(grep VPS_URL "$ENV_FILE" | cut -d'=' -f2)</string>
        <key>VPS_API_KEY</key>
        <string>$(grep VPS_API_KEY "$ENV_FILE" | cut -d'=' -f2)</string>
        <key>WORKER_ID</key>
        <string>$(grep WORKER_ID "$ENV_FILE" | cut -d'=' -f2)</string>
        <key>POLL_INTERVAL</key>
        <string>$(grep POLL_INTERVAL "$ENV_FILE" | cut -d'=' -f2)</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$CONFIG_DIR/worker.log</string>
    <key>StandardErrorPath</key>
    <string>$CONFIG_DIR/worker-error.log</string>
</dict>
</plist>
EOF

echo ""
echo "=================================================="
echo "Setup complete!"
echo "=================================================="
echo ""
echo "Next steps:"
echo "1. Edit $ENV_FILE and set your VPS_API_KEY"
echo "2. Make sure Tailscale is running: sudo tailscale up"
echo "3. Copy home-worker.py to $SCRIPT_DIR/worker.py"
echo ""
echo "To start the worker:"
echo "  python3 $SCRIPT_DIR/worker.py"
echo ""
echo "To run as a service (auto-start on boot):"
echo "  launchctl load "$PLIST_PATH""
echo ""
echo "To view logs:"
echo "  tail -f $CONFIG_DIR/worker.log"
echo ""
