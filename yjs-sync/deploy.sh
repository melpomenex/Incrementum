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
echo "Deploying Yjs Sync Server"
echo "=========================================="
echo "Host: ${VPS_HOST}"
echo "Remote dir: ${REMOTE_DIR}"
echo ""

# Create remote directory
ssh ${VPS_USER}@${VPS_HOST} "mkdir -p ${REMOTE_DIR}"

# Copy the whole folder (compose build contexts require Dockerfiles and service code).
scp -r \
  "${SCRIPT_DIR}" \
  ${VPS_USER}@${VPS_HOST}:"$(dirname "${REMOTE_DIR}")"/

# Start or update services
ssh ${VPS_USER}@${VPS_HOST} << EOF
cd ${REMOTE_DIR}
sudo docker compose pull
# Ensure the latest config is applied
sudo docker compose up -d --build
sudo docker compose ps
EOF

echo ""
echo "=========================================="
echo "Deployment complete!"
echo "=========================================="
