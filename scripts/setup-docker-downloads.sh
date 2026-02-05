#!/bin/bash
# Setup Docker to use /mnt/downloads for image storage
# This requires root access and will restart Docker

set -e

DOCKER_DATA_ROOT="/mnt/downloads/docker"
mkdir -p "$DOCKER_DATA_ROOT"

echo "This script will:"
echo "1. Stop Docker"
echo "2. Configure Docker to use $DOCKER_DATA_ROOT"
echo "3. Restart Docker"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted"
    exit 1
fi

# Create Docker config directory if it doesn't exist
sudo mkdir -p /etc/docker

# Backup existing config
if [ -f /etc/docker/daemon.json ]; then
    sudo cp /etc/docker/daemon.json /etc/docker/daemon.json.backup.$(date +%s)
    echo "Backed up existing daemon.json"
fi

# Write new config
echo "Configuring Docker..."
sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
  "data-root": "$DOCKER_DATA_ROOT",
  "storage-driver": "overlay2"
}
EOF

# Stop Docker
echo "Stopping Docker..."
sudo systemctl stop docker

# Optional: Move existing data (uncomment if you want to keep existing images)
# echo "Moving existing Docker data..."
# sudo rsync -aP /var/lib/docker/ "$DOCKER_DATA_ROOT/"

# Start Docker
echo "Starting Docker..."
sudo systemctl start docker

# Verify
echo ""
echo "Verifying new Docker root dir:"
docker info 2>/dev/null | grep "Docker Root Dir" || echo "Docker may not be starting properly"

echo ""
echo "Done! Docker images will now be stored in $DOCKER_DATA_ROOT"
