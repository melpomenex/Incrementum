# Yjs Sync Server (Public, TLS)

This deploys a Yjs websocket sync server behind Caddy with automatic TLS.
It is designed for public access (e.g. `wss://sync.readsync.org`).

It also includes a simple HTTP file service for syncing small PDFs/EPUBs/etc:
- Upload: `POST https://sync.readsync.org/files/:room` (multipart field: `file`, 100MB limit)
- List: `GET https://sync.readsync.org/files/:room`
- Download: `GET https://sync.readsync.org/files/:room/:id`
- Delete: `DELETE https://sync.readsync.org/files/:room/:id`

## Prereqs (VPS)
- Docker + Docker Compose
- A DNS A record pointing `sync.readsync.org` -> VPS IP
- Ports 80 and 443 open on the VPS firewall

## Plug-and-play (server-side)
1) SCP the whole folder to the VPS:
```bash
scp -r vps-service/yjs-sync REDACTED_USER@REDACTED_IP:/home/REDACTED_USER/
```

2) On the VPS, run:
```bash
cd /home/REDACTED_USER/yjs-sync
./setup.sh sync.readsync.org transcripts.readsync.org
```

This creates `.env`, pulls images, and starts the stack.

## Deploy from this repo
If you prefer to deploy without copying the folder manually:

```bash
cp .env.example .env
# edit .env and set YJS_SYNC_HOSTNAME=sync.readsync.org
./deploy.sh
```

## Notes
- Yjs persistence is stored in a Docker volume (`yjs_data`).
- Uploaded files are stored in a Docker volume (`yjs_files`).
- Caddy manages TLS certs automatically.
- The websocket endpoint is the same as the HTTP endpoint:
  `wss://sync.readsync.org`

## Health check
```
curl https://sync.readsync.org/health
```

## Update
Re-run `./deploy.sh` after changes.
