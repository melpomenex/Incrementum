# Home Transcript Worker - Setup Guide

## Architecture Overview

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Vercel/   │  HTTPS  │     VPS     │ Tailscale│  Mac Mini   │
│   Client    │───────►│  (relay)    │◄────────►│  (worker)   │
│             │◄───────│             │  Tunnel  │             │
└─────────────┘  JSON   └─────────────┘         └─────────────┘
                              │
                        transcripts.readsync.org
                              │
                         (Public Endpoint)
                              │
                        Your home IP is NEVER exposed
```

## How It Works

1. **Vercel/Client** requests transcript from VPS (`transcripts.readsync.org`)
2. **VPS** checks cache, if miss:
   - If workers available → queues request, returns `202 Processing`
   - If no workers → fetches directly with proxy
3. **Mac Mini Worker** polls VPS for pending jobs, fetches via yt-dlp, uploads result
4. **Client retries** and gets cached result

## Setup Instructions

### Part 1: VPS Setup (one time)

SSH into your VPS:

```bash
ssh root@100.103.106.125
cd /root/yjs-sync
```

Copy these files to the VPS:
- `service.py` (updated with worker support)
- `docker-compose.yml`
- `Dockerfile.transcript`
- `Caddyfile`

Then run:

```bash
# Rebuild and restart
docker-compose down
docker-compose up -d --build
docker-compose logs -f transcript-service
```

### Part 2: Mac Mini Setup

#### Step 1: Install Dependencies

```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install yt-dlp
brew install yt-dlp

# Install Python dependencies
pip3 install requests
```

#### Step 2: Install Tailscale

```bash
# Install Tailscale
brew install --cask tailscale

# Start Tailscale
sudo tailscale up
```

Verify Tailscale is connected:
```bash
tailscale status
# You should see the VPS (100.103.106.125) in the peer list
```

#### Step 3: Copy Files

Copy `home-worker.py` to your Mac mini:

```bash
# From your local machine
scp home-worker.py your-mac-mini-user@your-mac-mini-ip:~/
```

Or create `~/worker.py` manually with the content from `home-worker.py`.

#### Step 4: Configure Environment

Create `~/.transcript-worker/.env`:

```bash
mkdir -p ~/.transcript-worker
cat > ~/.transcript-worker/.env << 'EOF'
# VPS Configuration (Tailscale IP - stays private)
VPS_URL=http://100.103.106.125:8766
VPS_API_KEY=change-me-in-production

# Worker Configuration
WORKER_ID=mac-mini-1
POLL_INTERVAL=5
EOF
```

**IMPORTANT:** Get the actual API key from your VPS:
```bash
ssh root@100.103.106.125 "cat /root/yjs-sync/.env | grep TRANSCRIPT_API_KEY"
```

Update `VPS_API_KEY` in the `.env` file with the actual value.

#### Step 5: Run the Worker

**Test run:**
```bash
python3 ~/worker.py
```

You should see:
```
[mac-mini-1] Home Transcript Worker Starting
[mac-mini-1] VPS URL: http://100.103.106.125:8766
[mac-mini-1] Poll interval: 5s
==================================================
[mac-mini-1] No work, sleeping...
```

**Run as a service (auto-start on boot):**

Create `~/Library/LaunchAgents/com.transcript.worker.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.transcript.worker</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>/Users/YOUR_USERNAME/worker.py</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/YOUR_USERNAME/.transcript-worker</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/Users/YOUR_USERNAME/.transcript-worker/worker.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/YOUR_USERNAME/.transcript-worker/worker-error.log</string>
</dict>
</plist>
```

Replace `YOUR_USERNAME` with your actual username.

Then load the service:
```bash
launchctl load ~/Library/LaunchAgents/com.transcript.worker.plist
```

Check logs:
```bash
tail -f ~/.transcript-worker/worker.log
```

## Vercel Configuration

Update your Vercel environment variables:

```bash
VPS_TRANSCRIPT_URL=https://transcripts.readsync.org
VPS_TRANSCRIPT_API_KEY=your-actual-api-key
```

## Testing

1. **Check VPS health:**
```bash
curl https://transcripts.readsync.org/health
```

Response should show workers available:
```json
{
  "status": "healthy",
  "workers_available": 1,
  "pending_queue_size": 0
}
```

2. **Request a transcript:**
```bash
curl -H "X-API-Key: your-api-key" \
  "https://transcripts.readsync.org/transcript/wnCZUd0yiIE"
```

First request returns `202 Processing`:
```json
{
  "success": false,
  "code": "PROCESSING",
  "retry_after": 5
}
```

Wait 5-10 seconds and retry, you should get the transcript:
```json
{
  "success": true,
  "title": "...",
  "segment_count": 420
}
```

## Security Benefits

✅ **Home IP never exposed** - Only Tailscale IPs are used
✅ **No open ports** - Worker initiates connection to VPS
✅ **Encrypted tunnel** - All traffic via Tailscale VPN
✅ **VPS as relay** - Clients only see VPS domain
✅ **Private API** - Worker communication requires API key

## Troubleshooting

**Worker can't reach VPS:**
- Verify Tailscale is running: `tailscale status`
- Check VPS is in Tailscale network
- Test connection: `curl http://100.103.106.125:8766/health`

**No workers showing on VPS:**
- Check worker is running: `tail -f ~/.transcript-worker/worker.log`
- Verify API key matches between VPS and worker
- Check VPS logs: `docker logs transcript-service`

**Transcripts stuck in "Processing":**
- Worker might have crashed, check logs
- yt-dlp might need update: `brew upgrade yt-dlp`
- VPS falls back to direct fetch if worker unavailable
