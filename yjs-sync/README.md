# Self-Hosted Yjs Sync Server & Services

This directory contains the necessary components and scripts to run your own self-hosted sync server for the application.

## Core Components

1. **Yjs WebSocket Relay (`yjs-sync`)**
   - A custom fork of the standard `y-websocket` relay (`server.js` + `utils.js`).
   - **Important**: Standard `y-websocket` servers will silently drop unknown frame types. This fork implements **opaque forwarding** of message type `0x10` bytes, which are used by the client for client-side AES-GCM encrypted state synchronization. You **must** run this fork rather than a vanilla upstream relay.
2. **File Service (`file-service`)**
   - A Node.js API to upload and stream binary assets (like PDFs, EPUBs) across client devices (since the WebSocket relay itself is not persistent for files).
3. **Transcript Service (`transcript-service`)**
   - An optional Python/Flask service for fetching and caching YouTube transcripts. See [TRANSCRIPT_SERVICE.md](file:///home/kubuntu/Code/incrementum-tauri/yjs-sync/TRANSCRIPT_SERVICE.md) for architecture, endpoint details, and setup instructions.
4. **Caddy Reverse Proxy (`caddy`)**
   - Routes traffic and automatically handles SSL certificates (via Let's Encrypt) using the `Caddyfile`.

---

## Prerequisites

- **Docker** and **Docker Compose** installed on the host.
- A registered domain name pointing to your server's IP address (needed for Caddy SSL generation).

---

## Quick Start (Docker Compose)

### 1. Configure the Environment
Copy the example environment file and configure the domains/keys:
```bash
cp .env.example .env
```
Open `.env` and configure:
- `YJS_SYNC_HOSTNAME`: The domain or subdomain for your sync server (e.g., `sync.yourdomain.com`).
- `TRANSCRIPT_HOSTNAME`: The domain or subdomain for your transcript service (e.g., `transcripts.yourdomain.com`).
- `TRANSCRIPT_API_KEY`: A secure random API key used to authenticate transcript requests.
- `VPS_HOST`: The IP address of your remote VPS (for deployment).
- `VPS_USER`: The SSH username of your remote VPS (for deployment).
- `REMOTE_DIR`: (Optional) The folder on the remote VPS where files are deployed (defaults to `/home/<user>/yjs-sync`).

### 2. Start the Services
Run the setup script to pull and launch the containers:
```bash
./setup.sh <sync-domain> <transcripts-domain>
# Example: ./setup.sh sync.yourdomain.com transcripts.yourdomain.com
```
This starts Caddy, the Yjs relay, the file service, and the transcript service in the background.

---

## Customizing for Local Networks / Non-HTTPS
If you want to test locally on a private network or without a public domain name:
1. Update `docker-compose.yml` to expose ports directly if you do not want to use Caddy:
   - Expose the WebSocket relay (`yjs-sync` on port `1234`).
   - Expose the file service (`file-service` on port `8787`).
2. Alternatively, modify the `Caddyfile` to use local/self-signed certificates (e.g., using `tls internal` or by binding to `http://localhost:port`).

---

## Deployment to VPS

The folder contains deployment helper scripts:
- **`deploy-docker.sh`**: Copies files and launches the Docker Compose stack on a remote host.
- **`deploy-vps.sh`**: Installs dependencies and runs the services natively via `systemd` (using the systemd service file `yjs-file-service.service` and `Caddyfile.system`) instead of containerized.
- **`deploy.sh`**: Core deployment script running the compose stack remotely.

These scripts load `VPS_HOST`, `VPS_USER`, and `REMOTE_DIR` from your local `.env` file before executing connection commands.

