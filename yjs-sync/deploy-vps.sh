#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load environment variables from .env if it exists
if [ -f "${SCRIPT_DIR}/.env" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "$line" ]] && continue
    export "$line"
  done < "${SCRIPT_DIR}/.env"
else
  echo "Missing ${SCRIPT_DIR}/.env file"
  echo "Copy .env.example -> .env and configure it before running deployment."
  exit 1
fi

# Configuration
VPS_HOST="${VPS_HOST:-}"
VPS_USER="${VPS_USER:-}"
REMOTE_DIR="${REMOTE_DIR:-/home/${VPS_USER}/yjs-sync}"

if [ -z "${VPS_HOST}" ] || [ -z "${VPS_USER}" ]; then
  echo "Error: VPS_HOST and VPS_USER must be set in your .env file."
  exit 1
fi

echo "=========================================="
echo "Deploying Yjs Sync Service (Native Host)"
echo "=========================================="
echo "Host: ${VPS_HOST}"
echo "Remote dir: ${REMOTE_DIR}"
echo ""

# Copy the server files, system Caddyfile, and file-service files
echo "[1/3] Copying files to remote host..."
scp -r server.js utils.js Caddyfile Caddyfile.system package.json yjs-file-service.service file-service ${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}/

# Run npm install on remote
echo "[2/3] Running remote npm install..."
ssh ${VPS_USER}@${VPS_HOST} << EOF
# Load NVM and run npm install
export NVM_DIR="\$HOME/.nvm"
[ -s "\$NVM_DIR/nvm.sh" ] && \. "\$NVM_DIR/nvm.sh"

echo "Installing relay dependencies..."
cd ${REMOTE_DIR}
npm install --omit=dev

echo "Installing file-service dependencies..."
cd ${REMOTE_DIR}/file-service
npm install --omit=dev
EOF

# Restart the relay service
echo "[3/3] Restarting native systemd service (requires sudo)..."
ssh -tt ${VPS_USER}@${VPS_HOST} "sudo systemctl restart yjs-sync"

echo ""
echo "=========================================="
echo "Deployment of Yjs Sync Service complete!"
echo "To finish file-service and Caddy configuration, run this one-liner on your server:"
echo "  sudo cp ${REMOTE_DIR}/yjs-file-service.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable --now yjs-file-service && sudo cp ${REMOTE_DIR}/Caddyfile.system /etc/caddy/Caddyfile && sudo systemctl restart caddy"
echo "=========================================="
