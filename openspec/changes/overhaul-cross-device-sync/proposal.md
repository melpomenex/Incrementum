## Why

The current "yjs-sync" does not actually sync a user's devices. It replicates `localStorage` key-values and file *metadata*, but never the documents, extracts, learning items, review state, or the files themselves across time. It is disabled entirely on Tauri (desktop and mobile), requires both devices to be online simultaneously for any file transfer, ships three competing sync systems (Yjs/WebSocket, JWT/Postgres REST, Rust `cloud_sync.rs`), and claims "End-to-end enabled" in the UI while transferring everything in plaintext. Users who install on a phone and a laptop reasonably expect a Dropbox-like experience — open the app on a new device, see everything — and today they do not get it.

## What Changes

### State sync — what actually replicates
- **BREAKING**: Add full app-state replication over Yjs CRDTs: documents, extracts, learning items, review history & schedule, audio playback positions, source/config blobs, and the existing `localStorage` + file manifest maps. The IndexedDB/SQLite app database becomes a *local projection* of the shared Yjs document, not an independent source of truth.
- Introduce typed `Y.Map`/`Y.Array` schemas per entity with bidirectional adapters so existing React stores read from the same Yjs doc on every platform.
- Enable Yjs sync on **Tauri desktop and Tauri mobile**, not only web/PWA. The `!isTauri() && isPWA()` gate is removed.
- Deprecate the JWT/Postgres REST sync server (`server/src/routes/sync.ts`) and Rust `cloud_sync.rs` provider trait as state-replication paths. Yjs becomes the single canonical state channel; the Postgres server is decommissioned for sync (auth/identity use cases, if any, are tracked separately).

### File sync — async, server-backed
- **BREAKING**: Replace the relay-only P2P streaming protocol (`file-transfer.ts` requiring simultaneous presence) with the already-deployed file-service (`sync.readsync.org/files`) as the canonical durable store. Files upload once; any device downloads later whenever it comes online.
- Unify the two split file systems: the `yjs-file-service` upload path and the `file-transfer` P2P path are merged into one file pipeline driven by the Yjs file manifest. The manifest entry becomes the single source of truth for "this file exists in the room"; the file-service stores the bytes.
- Add content-defined chunking, per-chunk integrity (SHA-256), resumable uploads/downloads, and a configurable per-room storage quota with eviction policy.
- Preserve the existing auto-download modes (`always` / `wifi-only` / `manual`) but drive them off the manifest, not off peer presence.

### End-to-end encryption — real, not cosmetic
- Derive a room key from a user-held secret (passphrase or QR-scanned 256-bit key) using Argon2id. The room key never leaves the originating device in plaintext; joining devices receive it via QR or typed passphrase.
- Encrypt file blobs client-side before upload (AES-GCM, random nonce per chunk). The file-service stores ciphertext only.
- Encrypt sensitive Yjs update payloads via a custom provider wrapper (`y-encryption`-style) so the relay sees opaque bytes; the existing relay code needs no change.
- Fix the dishonest UI: replace "End-to-end enabled" with truthful status (`Encrypted` / `TLS only — room secret`) reflecting actual mode.

### Consolidation & cleanup
- Remove the unresolved Git merge conflict in `yjs-sync/service.py` and any leaked proxy credentials.
- Replace the brute-force "delete IndexedDB on any decode error" recovery with targeted Yjs-doc reset keyed to the specific corruption signature.
- Consolidate duplicate file-cache IndexedDBs (`incrementum-file-cache` and the per-file cache baked into `file-transfer.ts`) into one.
- Drop the empty `if (isSyncDebugEnabled()) {}` no-op logging blocks.

## Capabilities

### New Capabilities
- `cross-device-sync`: End-to-end replication of app state across all device profiles (web/PWA, Tauri desktop, Tauri mobile). Covers Yjs document schema for full app state, room identity, device presence, and the real end-to-end encryption model that protects both state and file blobs. Supersedes the never-archived `localStorage`-only behavior.
- `file-sync`: Async, server-backed file replication with E2EE blobs. Replaces the in-flight `add-cross-device-file-sync` design (pure relay, both-devices-online) with durable server storage, manifest-driven awareness, resumable transfers, and per-room quota.

### Modified Capabilities
- (none — `file-sync` was never promoted into `openspec/specs/`, so it is treated as new rather than modified.)

## Impact

**Affected code (frontend)**
- `src/lib/yjsSync.ts` — extend singleton to host full-state Yjs doc; remove debug no-ops; replace corruption-reset hack.
- `src/lib/localStorageSync.ts` — becomes one of several Yjs adapters rather than the whole sync surface.
- `src/lib/file-manifest.ts`, `src/lib/file-transfer.ts`, `src/lib/yjs-file-service.ts`, `src/lib/useFileSync.ts` — merged into a single file pipeline; P2P streaming path removed.
- `src/lib/database.ts` — IndexedDB stores become projections of the Yjs doc; new adapters (`yjsToIndexedDB`, `indexedDBToYjs`).
- New: `src/lib/sync/encryption.ts` (room key derivation + AES-GCM helpers), `src/lib/sync/stateAdapters.ts` (per-entity CRDT bindings).
- `src/components/settings/SyncSettings.tsx` — truthful encryption status, passphrase/QR-key UI, quota display.
- `src/main.tsx` — remove `isTauri()` gate on `initLocalStorageSync()`; rework the `unhandledrejection` corruption handler.

**Affected code (Rust / Tauri)**
- `src-tauri/src/cloud_sync.rs`, `src-tauri/src/commands/cloud/sync.rs` — deprecated and ultimately removed; SQLite becomes a projection of the Yjs doc on desktop.
- `src-tauri/tauri.android.conf.json`, `src-tauri/tauri.ios.conf.json` — confirm `wss://sync.readsync.org` CSP and required capabilities for mobile.

**Affected code (server)**
- `yjs-sync/file-service/` — extended: per-room quota, encrypted-blob passthrough (no plaintext handling), manifest-aware listing endpoint, optional retention policy.
- `yjs-sync/service.py` — resolve merge conflict; remove leaked credentials; rotate any exposed secrets.
- `server/src/routes/sync.ts`, `server/src/routes/files.ts` — deprecated for sync use; removed in a follow-up once Yjs migration is verified.

**Dependencies**
- Add: `y-encryption` (or equivalent crypto wrapper around the provider), `argon2-browser` (key derivation), `@noble/ciphers` or similar audited AES-GCM.
- Remove (after migration): Rust-side cloud-provider crates that exist solely for `cloud_sync.rs`.

**Migration**
- One-time: existing IndexedDB/SQLite data is bootstrapped into a fresh Yjs doc on first launch of the new client. Users joining an existing room with local-only data trigger a deterministic merge (last-writer-wins by `updatedAt` per entity).
- Users with no room key set are prompted to create or join one; existing room IDs without a passphrase continue to work in "TLS only" mode with a clear UI warning until they migrate.

**Risks**
- CRDT merge semantics on review history (SM-18/SM-20/FSRS state) are subtle; needs a per-algorithm merge strategy to avoid double-counting reviews.
- E2EE key recovery: lost passphrase = lost data; need a recovery-code flow or escrow decision before launch.
- Mobile bandwidth/battery: full-state replication on first sync could be heavy; requires delta-only transport and chunked file fetch.
