# YouTube Transcript Service

This directory contains a distributed, self-hosted YouTube transcript service designed to reliably fetch transcripts while bypassing YouTube's bot-detection and rate-limiting policies on cloud/VPS servers.

---

## Architecture Overview

Datacenter and VPS IP addresses are heavily rate-limited or outright blocked by YouTube when fetching metadata or transcripts via `yt-dlp`. 

To solve this, the service uses a **VPS-to-Home Worker architecture**:

```
Client Request
      │
      ▼
┌──────────────┐
│  VPS Server  │◄─────────┐
│ (service.py) │          │
└──────┬───────┘          │ 3. Poll / Upload
       │                  │
       │ 1. Direct fetch  │
       │    (fails)       │
       ▼                  │
   [Queue Job] ── 2. Poll ┘
                          │
                  ┌───────┴──────┐
                  │ Home Worker  │ (Runs on residential IP, e.g. Mac mini)
                  │(home-worker) │
                  └──────────────┘
```

1. **VPS Service (`service.py`)**:
   - Exposes public APIs for clients to request transcripts.
   - Maintains a local filesystem cache of fetched transcripts.
   - Tries to fetch transcripts directly (optionally routing through a configured proxy).
   - If direct fetch fails (due to blocking/bot detection), it queues the request.
2. **Home Worker (`home-worker.py`)**:
   - Runs on a machine inside a residential network (e.g., a home server or desktop).
   - Periodically polls the VPS for pending translation jobs.
   - Fetches the transcript locally (residential IPs are rarely blocked by YouTube).
   - Uploads the successful transcript back to the VPS.

---

## API Endpoints (Flask App)

All endpoints (except `/health`) require authentication using the `X-API-Key` HTTP header (or an `api_key` query parameter) matching the `TRANSCRIPT_API_KEY` defined in your environment:

*   **`GET /health`**
    *   Health check. Returns `200 OK`. (Does not require authentication).
*   **`GET /transcript/<video_id>`**
    *   Retrieves the transcript for a YouTube video.
    *   If cached, returns immediately. If uncached, triggers a fetch/queue flow.
*   **`GET /worker/poll`**
    *   Called by the home worker to check for queued transcription jobs.
*   **`POST /worker/upload`**
    *   Called by the home worker to upload a successfully fetched transcript.
*   **`GET /cache/stats`**
    *   Returns statistics about the cache size, hits, and misses.
*   **`POST /cache/clear`**
    *   Purges all cached transcripts from the server.

---

## How to Set Up and Run

### 1. VPS Side (Docker)
The service is bundled with the default Docker Compose stack:
1. Run `./setup.sh` inside the `yjs-sync` folder to configure your transcript subdomain and generate a `TRANSCRIPT_API_KEY`.
2. Start the Docker containers:
   ```bash
   docker compose up -d
   ```
3. Caddy will automatically route requests on your transcript domain to the Flask app on port `8766`.

### 2. Home Worker Side (Residential Machine)
On your home machine (e.g., a local server or computer left running):

1. Create a script or set the following environment variables:
   - `VPS_URL`: The URL pointing to your VPS transcript service (e.g., `https://transcripts.yourdomain.com`).
   - `VPS_API_KEY`: The `TRANSCRIPT_API_KEY` generated during the VPS setup.
   - `POLL_INTERVAL`: Time in seconds between polling requests (default: `5`).
2. Run the worker script:
   ```bash
   python3 home-worker.py
   ```
   *(Note: Ensure python dependencies `requests` are installed on the local machine).*
