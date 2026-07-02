#!/bin/bash
# Deploy transcript service using Docker (containerized)

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
echo "Deploying Transcript Service (Docker)"
echo "=========================================="
echo "Host: ${VPS_HOST}"
echo "Remote dir: ${REMOTE_DIR}"
echo ""

# Generate a random API key
API_KEY=$(openssl rand -hex 32)
echo "Generated API Key: ${API_KEY}"
echo ""

# Create remote directory
echo "[1/5] Creating remote directory..."
ssh ${VPS_USER}@${VPS_HOST} "mkdir -p ${REMOTE_DIR}"

# Copy all necessary files
echo "[2/5] Copying files..."
scp -r docker-compose.yml Caddyfile Dockerfile.transcript service.py server.js utils.js Dockerfile.files file-service ${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}/

# Create .env file
echo "[3/5] Creating .env file..."
ssh ${VPS_USER}@${VPS_HOST} << EOF
cat > ${REMOTE_DIR}/.env << ENVEOF
YJS_SYNC_HOSTNAME=${YJS_SYNC_HOSTNAME:-sync.readsync.org}
TRANSCRIPT_HOSTNAME=${TRANSCRIPT_HOSTNAME:-transcripts.readsync.org}
TRANSCRIPT_API_KEY=${API_KEY}
PROXY_HOST=${PROXY_HOST:-}
PROXY_PORT=${PROXY_PORT:-}
PROXY_USER=${PROXY_USER:-}
PROXY_PASS=${PROXY_PASS:-}
ENVEOF
EOF

# Stop old systemd service if it exists
echo "[4/5] Stopping old systemd service (if exists)..."
ssh ${VPS_USER}@${VPS_HOST} << 'REMOTE'
if systemctl is-active --quiet transcript-service; then
  echo "Stopping old systemd service..."
  sudo systemctl stop transcript-service
  sudo systemctl disable transcript-service
fi
REMOTE

# Deploy with Docker Compose
echo "[5/5] Deploying with Docker Compose..."
ssh ${VPS_USER}@${VPS_HOST} << 'REMOTE'
# Configure Docker to use IPv4 only (VPS doesn't have IPv6)
if ! grep -q "ipv6=false" /etc/docker/daemon.json 2>/dev/null; then
  echo "Configuring Docker for IPv4 only..."
  sudo mkdir -p /etc/docker
  echo '{"ipv6": false,"fixed-cidr-v6": ""}' | sudo tee /etc/docker/daemon.json
  sudo systemctl restart docker
  sleep 3
fi

cd ${REMOTE_DIR}
docker compose down
docker compose pull
docker compose build transcript-service
docker compose up -d
docker compose ps
docker compose logs --tail=20 transcript-service
REMOTE

echo ""
echo "=========================================="
echo "Deployment complete!"
echo "=========================================="
echo ""
echo "Services running:"
echo "  - Yjs Sync: https://sync.readsync.org"
echo "  - Transcript Service: https://transcripts.readsync.org"
echo ""
echo "API Key: ${API_KEY}"
echo ""
echo "Test the transcript service:"
echo "  curl -H \"X-API-Key: ${API_KEY}\" https://transcripts.readsync.org/health"
echo ""
echo "Test a transcript fetch:"
echo "  curl -H \"X-API-Key: ${API_KEY}\" https://transcripts.readsync.org/transcript/dQw4w9WgXcQ"
echo ""
echo "View logs:"
echo "  ssh ${VPS_USER}@${VPS_HOST} 'cd ${REMOTE_DIR} && docker compose logs -f transcript-service'"
echo ""
