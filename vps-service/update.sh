#!/bin/bash
# Quick update script for transcript service

VPS_HOST="REDACTED_IP"
VPS_USER="REDACTED_USER"
REMOTE_DIR="/home/${VPS_USER}/transcript-service"

echo "Updating transcript service on VPS..."

# Copy updated service.py
scp service.py ${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}/

# Restart the service
ssh ${VPS_USER}@${VPS_HOST} << 'REMOTE'
sudo systemctl restart transcript-service
sleep 2
sudo systemctl status transcript-service --no-pager
REMOTE

echo ""
echo "Service updated!"
echo "Test with:"
echo "  curl -H \"X-API-Key: your-api-key\" https://REDACTED_HOST/transcript/dQw4w9WgXcQ"
