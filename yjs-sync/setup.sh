#!/bin/bash
set -euo pipefail

# ANSI color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Helper functions
prompt_input() {
  local prompt_text="$1"
  local default_val="$2"
  local user_val

  if [ -n "$default_val" ]; then
    echo -n -e "${GREEN}?${NC} ${prompt_text} (${YELLOW}default: ${default_val}${NC}): " >&2
    read user_val
    echo "${user_val:-$default_val}"
  else
    echo -n -e "${GREEN}?${NC} ${prompt_text}: " >&2
    read user_val
    while [ -z "$user_val" ]; do
      echo -e "${RED}Error: This field is required.${NC}" >&2
      echo -n -e "${GREEN}?${NC} ${prompt_text}: " >&2
      read user_val
    done
    echo "$user_val"
  fi
}

prompt_confirm() {
  local prompt_text="$1"
  local default_val="$2" # y or n
  local user_val

  if [ "$default_val" = "y" ]; then
    echo -n -e "${GREEN}?${NC} ${prompt_text} (Y/n): " >&2
    read user_val
    user_val=$(echo "${user_val:-y}" | tr '[:upper:]' '[:lower:]')
  else
    echo -n -e "${GREEN}?${NC} ${prompt_text} (y/N): " >&2
    read user_val
    user_val=$(echo "${user_val:-n}" | tr '[:upper:]' '[:lower:]')
  fi

  if [ "$user_val" = "y" ] || [ "$user_val" = "yes" ]; then
    return 0
  else
    return 1
  fi
}

load_env_val() {
  local var_name="$1"
  local default_val="$2"
  local env_path="${SCRIPT_DIR}/.env"
  if [ -f "$env_path" ]; then
    local val
    val=$(grep -E "^${var_name}=" "$env_path" | head -n 1 | cut -d'=' -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
    if [ -n "$val" ]; then
      echo "$val"
      return
    fi
  fi
  echo "$default_val"
}

# Clear terminal screen for clean wizard startup
clear

echo -e "${BLUE}${BOLD}=================================================="
echo -e "      Yjs Sync & Services Setup Wizard            "
echo -e "==================================================${NC}"
echo ""
echo -e "This wizard will help you configure your domains, API keys, proxy,"
echo -e "and remote deployment settings."
echo ""

# Generate a fallback API key in case one isn't in .env
DEFAULT_API_KEY=""
if command -v openssl >/dev/null 2>&1; then
  DEFAULT_API_KEY=$(openssl rand -hex 32)
else
  DEFAULT_API_KEY=$(head -c 32 /dev/urandom | tr -dc 'a-f0-9' || echo "change-me-in-production-12345")
fi

# Step 1: Domain Configuration
echo -e "${BLUE}${BOLD}--- Step 1: Domain Configuration ---${NC}"
echo -e "These domains will be used by Caddy to auto-provision SSL certificates."
echo ""
YJS_SYNC_HOSTNAME=$(prompt_input "Sync Server WebSocket Domain" "$(load_env_val YJS_SYNC_HOSTNAME "sync.readsync.org")")
TRANSCRIPT_HOSTNAME=$(prompt_input "YouTube Transcript Service Domain" "$(load_env_val TRANSCRIPT_HOSTNAME "transcripts.readsync.org")")
echo ""

# Step 2: Security & Authentication
echo -e "${BLUE}${BOLD}--- Step 2: Security & Authentication ---${NC}"
echo -e "Secure your transcript endpoints with an API key."
echo ""
EXISTING_KEY=$(load_env_val TRANSCRIPT_API_KEY "")
if [ -z "$EXISTING_KEY" ]; then
  EXISTING_KEY="$DEFAULT_API_KEY"
fi
TRANSCRIPT_API_KEY=$(prompt_input "Transcript Service API Key" "$EXISTING_KEY")
echo ""

# Step 3: Proxy Settings
echo -e "${BLUE}${BOLD}--- Step 3: Proxy Settings (Optional) ---${NC}"
echo -e "If running YouTube transcripts service, you may want to route fetches through"
echo -e "a proxy to avoid rate-limiting by YouTube."
echo ""
HAS_PROXY_CONFIGURED=false
if [ -n "$(load_env_val PROXY_HOST "")" ]; then
  HAS_PROXY_CONFIGURED=true
fi

WANT_PROXY=false
if [ "$HAS_PROXY_CONFIGURED" = true ]; then
  if prompt_confirm "Keep or update existing proxy configuration?" "y"; then
    WANT_PROXY=true
  fi
else
  if prompt_confirm "Do you want to configure a proxy for YouTube transcripts?" "n"; then
    WANT_PROXY=true
  fi
fi

if [ "$WANT_PROXY" = true ]; then
  PROXY_HOST=$(prompt_input "Proxy Host" "$(load_env_val PROXY_HOST "")")
  PROXY_PORT=$(prompt_input "Proxy Port" "$(load_env_val PROXY_PORT "10001")")
  PROXY_USER=$(prompt_input "Proxy Username" "$(load_env_val PROXY_USER "")")
  PROXY_PASS=$(prompt_input "Proxy Password" "$(load_env_val PROXY_PASS "")")
else
  PROXY_HOST=""
  PROXY_PORT=""
  PROXY_USER=""
  PROXY_PASS=""
fi
echo ""

# Step 4: VPS Deployment Details
echo -e "${BLUE}${BOLD}--- Step 4: VPS Deployment Details (Optional) ---${NC}"
echo -e "Configure your SSH credentials to enable one-command deployment to your VPS."
echo ""
HAS_VPS_CONFIGURED=false
if [ -n "$(load_env_val VPS_HOST "")" ]; then
  HAS_VPS_CONFIGURED=true
fi

WANT_VPS=false
if [ "$HAS_VPS_CONFIGURED" = true ]; then
  if prompt_confirm "Keep or update existing VPS deployment settings?" "y"; then
    WANT_VPS=true
  fi
else
  if prompt_confirm "Do you want to configure VPS deployment settings?" "n"; then
    WANT_VPS=true
  fi
fi

if [ "$WANT_VPS" = true ]; then
  VPS_HOST=$(prompt_input "VPS IP / Hostname" "$(load_env_val VPS_HOST "")")
  VPS_USER=$(prompt_input "VPS SSH User" "$(load_env_val VPS_USER "ubuntu")")
  REMOTE_DIR=$(prompt_input "VPS Destination Directory" "$(load_env_val REMOTE_DIR "/home/${VPS_USER}/yjs-sync")")
else
  VPS_HOST=""
  VPS_USER=""
  REMOTE_DIR=""
fi
echo ""

# Save configurations
echo -e "${BLUE}Saving configurations to .env...${NC}"

cat > "${SCRIPT_DIR}/.env" << ENVEOF
# Domain configuration
YJS_SYNC_HOSTNAME=${YJS_SYNC_HOSTNAME}
TRANSCRIPT_HOSTNAME=${TRANSCRIPT_HOSTNAME}

# Transcript service configuration
TRANSCRIPT_API_KEY=${TRANSCRIPT_API_KEY}

# Proxy configuration
PROXY_HOST=${PROXY_HOST}
PROXY_PORT=${PROXY_PORT}
PROXY_USER=${PROXY_USER}
PROXY_PASS=${PROXY_PASS}

# VPS Deployment Configuration
VPS_HOST=${VPS_HOST}
VPS_USER=${VPS_USER}
REMOTE_DIR=${REMOTE_DIR}
ENVEOF

echo -e "${GREEN}${BOLD}✓ Configuration saved successfully to .env!${NC}\n"

# Execution step
if prompt_confirm "Do you want to pull and start the local Docker containers now?" "n"; then
  echo -e "\n${BLUE}Checking Docker installation...${NC}"
  if ! command -v docker >/dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not installed. Please install Docker + Docker Compose first.${NC}"
    exit 1
  fi
  
  echo -e "${BLUE}Pulling images and building services...${NC}"
  cd "${SCRIPT_DIR}"
  sudo docker compose pull
  sudo docker compose up -d --build
  
  echo -e "\n${GREEN}${BOLD}✓ Services started successfully!${NC}"
  echo -e "Local WebSocket:   ws://localhost:1234"
  echo -e "Local File Service: http://localhost:8787"
  echo -e "Web Proxy (Caddy): https://${YJS_SYNC_HOSTNAME} (requires public DNS setup)"
else
  echo -e "\n${YELLOW}Configuration saved. You can start the server locally later by running:${NC}"
  echo -e "  cd yjs-sync && docker compose up -d"
fi

if [ -n "${VPS_HOST}" ]; then
  echo -e "\n${BLUE}${BOLD}VPS Deployment is ready:${NC}"
  echo -e "To deploy these services remote to your VPS (${VPS_USER}@${VPS_HOST}), run:"
  echo -e "  cd yjs-sync && ./deploy.sh"
fi

echo ""
echo -e "${GREEN}${BOLD}Setup completed successfully!${NC}"
