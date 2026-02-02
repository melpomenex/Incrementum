#!/bin/bash
# Install Transcript Worker as macOS Service

set -e

USERNAME=$(whoami)
WORKER_DIR="/Users/$USERNAME/.transcript-worker"
API_KEY="REDACTED_API_KEY"

echo "=================================================="
echo "Installing Transcript Worker Service"
echo "=================================================="

# Kill any running worker
echo "Stopping any running workers..."
pkill -f worker.py 2>/dev/null || true

# Create working directory
echo "Creating worker directory..."
mkdir -p "$WORKER_DIR"

# Create .env file
echo "Creating .env file..."
cat > "$WORKER_DIR/.env" << EOF
VPS_URL=http://REDACTED_IP:8766
VPS_API_KEY=$API_KEY
WORKER_ID=mac-mini-1
POLL_INTERVAL=5
EOF

# Copy worker.py if it exists in current dir
if [ -f "./worker.py" ]; then
    cp ./worker.py "$WORKER_DIR/worker.py"
    echo "Copied worker.py to $WORKER_DIR"
else
    if [ ! -f "$WORKER_DIR/worker.py" ]; then
        echo "ERROR: worker.py not found!"
        echo "Please copy home-worker.py to $WORKER_DIR/worker.py first"
        exit 1
    fi
fi

# Create LaunchAgent plist
echo "Creating LaunchAgent..."
cat > ~/Library/LaunchAgents/com.transcript.worker.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.transcript.worker</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>$WORKER_DIR/worker.py</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$WORKER_DIR</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>VPS_URL</key>
        <string>http://REDACTED_IP:8766</string>
        <key>VPS_API_KEY</key>
        <string>$API_KEY</string>
        <key>WORKER_ID</key>
        <string>mac-mini-1</string>
        <key>POLL_INTERVAL</key>
        <string>5</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$WORKER_DIR/worker.log</string>
    <key>StandardErrorPath</key>
    <string>$WORKER_DIR/worker-error.log</string>
</dict>
</plist>
EOF

# Unload existing service if present
echo "Unloading old service (if exists)..."
launchctl unload ~/Library/LaunchAgents/com.transcript.worker.plist 2>/dev/null || true

# Load the service
echo "Loading service..."
launchctl load ~/Library/LaunchAgents/com.transcript.worker.plist

# Wait a moment for service to start
sleep 2

# Check status
echo ""
echo "=================================================="
echo "Installation complete!"
echo "=================================================="
echo ""
echo "Service status:"
launchctl list | grep transcript || echo "Service not showing in list (may still be starting)"
echo ""
echo "To view logs:"
echo "  tail -f $WORKER_DIR/worker.log"
echo ""
echo "To restart service:"
echo "  launchctl restart com.transcript.worker"
echo ""
echo "To stop service:"
echo "  launchctl stop com.transcript.worker"
echo ""

# Show recent logs
echo "Recent logs:"
tail -10 "$WORKER_DIR/worker.log" 2>/dev/null || echo "No logs yet (service starting up...)"
