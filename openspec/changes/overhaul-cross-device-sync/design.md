## Context

Today the repo ships **three** independent sync subsystems, each addressing a slice of the problem and none of them actually replicating the user's reading data:

1. **Yjs/WebSocket** (`src/lib/yjsSync.ts`, server at `wss://sync.readsync.org`). Syncs two `Y.Map`s: `localStorage` (key/value mirror) and `fileManifest` (file metadata only). Gated off on Tauri by `if (!isTauri() && isPWA())` in `main.tsx`, so it only runs in browser/PWA. Files move via two unbridged paths: `yjs-file-service` (server upload, used by `browser-backend.ts`) and `file-transfer.ts` (ad-hoc P2P streaming over the same WebSocket, requires both devices online, no resumption).
2. **JWT/Postgres REST cloud sync** (`server/src/routes/sync.ts`, `server/src/routes/files.ts`). Authenticated REST API with version cursors. Syncs documents, extracts, learning_items. Used by nobody on the client side in any integrated way.
3. **Rust `cloud_sync.rs`** (`src-tauri/src/cloud_sync.rs` + `commands/cloud/sync.rs`). A `CloudProvider` trait wired into the Tauri desktop SQLite store, completely separate from the other two.

On top of this, the UI (`SyncSettings.tsx`) advertises "End-to-end enabled" while the code does no encryption — only TLS plus room-ID-as-bearer. `yjs-sync/service.py` still carries an unresolved Git merge conflict with proxy credentials exposed.

The net effect is the user's reported experience: "I want to sync with my phone, my other devices" does not work. A fresh install on a new device sees none of the documents, extracts, or review history from the other devices, and any file the user expects to be there is unavailable unless both devices are online at the same moment.

This design collapses all three paths into one, makes the changes the user actually wants (full state + async files across all device profiles), and adds the missing encryption layer.

## Goals / Non-Goals

**Goals**
- A new device, on first launch, joined to the user's room, sees the full app state (documents, extracts, learning items, review history & schedule, audio positions, settings, file manifest) without any other device being online.
- Files (PDFs, EPUBs, audio, etc.) upload once to the existing file-service and remain available for any device to fetch whenever it next connects.
- Works identically on web/PWA, Tauri desktop, and Tauri mobile.
- Server never sees plaintext state or plaintext file content. Truthful encryption status in the UI.
- One mental model, one code path, one set of bugs. The Postgres sync server and Rust `cloud_sync.rs` stop being sync paths.

**Non-Goals**
- Real-time collaborative editing (two cursors in the same document). CRDTs enable this but it is not a product goal; we only need eventual consistency.
- Public/team sharing with per-user ACLs. Rooms remain "share the secret" — everyone with the room key has full access.
- Server-side search or analytics over synced content. The server is intentionally dumb: relay bytes, store encrypted blobs, that's it.
- Migrating the LLM/OAuth tokens stored in `localStorage`. Those are explicitly excluded from sync today for security reasons and remain excluded.
- Replacing the SQLite-on-desktop storage engine itself. SQLite stays; it becomes a *projection* of the Yjs doc rather than an independent source of truth.

## Decisions

### Decision 1 — Yjs is the single canonical state channel

**Choice.** All app state replicates through one shared `Y.Doc` over the existing `y-websocket` relay. The JWT/Postgres REST sync server and Rust `cloud_sync.rs` are retired for state replication.

**Why Yjs over the alternatives:**
- *vs. the Postgres REST server.* CRDTs give us conflict-free merges for free, which matters acutely for review state (a user reviewed a card on phone, then reviews it again on laptop before sync — last-writer-wins on a REST API would silently drop one of the reviews). The Postgres path also requires writing per-entity cursor logic that already exists inside Yjs.
- *vs. Rust `cloud_sync.rs`.* That path is Tauri-only by construction; it can never serve web/PWA. Keeping it means keeping two sync implementations forever.
- *vs. a hybrid (Yjs for presence, REST for canonical).* Two paths to debug, two consistency models to reconcile. The whole point is to converge.

**Trade-off accepted:** Yjs's merge semantics on lists (`Y.Array`) are non-deterministic across offline edits in pathological cases. We mitigate by modeling review history as a `Y.Map<reviewId, Review>` rather than a `Y.Array<Review>` — map keys make idempotency trivial (dedup on review ID).

### Decision 2 — Local DB becomes a projection of the Yjs doc

**Choice.** IndexedDB (web) and SQLite (Tauri) stop being authoritative. They are repopulated from the Yjs doc via per-entity adapters that subscribe to `observeDeep` events and write through to the local store. Writes from the UI go *into the Yjs doc first*, then propagate back to local storage through the adapter.

**Why.** If both stores are writable, you have two sources of truth and a reconciliation problem on every reconnect. Making Yjs the single writer eliminates an entire class of bugs (cursor drift, deleted-then-edited, etc.).

**Adapter shape** (one per entity — `documents`, `extracts`, `learning_items`, `reviews`, `audio_positions`, `localStorage`, `fileManifest`):

```ts
interface YjsAdapter<T> {
  collection: string;                    // IndexedDB store / SQLite table name
  yMap: Y.Map<T>;
  applyRemoteToLocal(key: string, value: T | null): Promise<void>;
  writeLocal(doc: T): void;              // mutates Y.Map; adapter handles local propagation
  deleteLocal(key: string): void;
}
```

**Tombstones.** Deletes write `{ _deleted: true, deletedAt: number }` rather than removing the key, with a periodic GC of tombstones older than 30 days. Required because Yjs `Y.Map.delete` does not propagate as a delete event to peers that join after the delete — they need to learn the entity is gone, not just absent.

### Decision 3 — Full-state CRDT schema

The shared `Y.Doc` carries these top-level shared types:

| Shared type | Entity | Shape (values) |
|---|---|---|
| `Y.Map<string, Document>` | `documents` | id, title, type, created/updated, source URI, tags, metadata |
| `Y.Map<string, Extract>` | `extracts` | id, documentId, content, position, scheduling refs |
| `Y.Map<string, LearningItem>` | `learningItems` | id, extractId, deckId, FSRS/SM state, last review, due |
| `Y.Map<string, Review>` | `reviews` | id (deterministic: `${cardId}-${reviewEpochMs}`), cardId, rating, reviewedAt, device; dedup on id |
| `Y.Map<string, AudioPosition>` | `audioPositions` | documentId → playback position, updated timestamp |
| `Y.Map<string, LocalStorageEntry>` | `localStorage` | existing key/value/updatedAt shape (preserved) |
| `Y.Map<string, FileManifestEntry>` | `fileManifest` | existing shape, plus new fields (see Decision 5) |
| `Y.Map<string, DevicePresence>` | `devicePresence` | existing shape (preserved) |
| `Y.Map<string, Setting>` | `settings` | typed app settings beyond localStorage |

**Review-history idempotency.** `Review.id` is `sha1(cardId + "|" + reviewedAtMs + "|" + deviceId)`. The same review event arriving twice (a device replays its update after reconnect) collapses to one entry. This is the only correct way to merge multi-device review streams without double-counting.

**FSRS/SM card-state merges.** Card-state fields (`difficulty`, `stability`, `due`, `reps`) resolve by last-writer-wins on a monotonic `updatedAt`. The `reviews` map is the source of truth for *what happened*; the card-state fields are a denormalized projection. If two devices disagree on the projection, the merge takes the one whose latest `Review` is newer — equivalent to recomputing from the review log.

### Decision 4 — File-service is the canonical file store; P2P streaming is removed

**Choice.** `sync.readsync.org/files` becomes the single durable home for file blobs. The P2P streaming protocol in `file-transfer.ts` is deleted. Files are uploaded once (encrypted, see Decision 5), listed in the manifest, and downloaded by any device that joins the room.

**Why this beats the current P2P design:**
- "Sync with my phone" fundamentally requires async. A user imports a PDF on their laptop in the morning, expects it on their phone at lunch — the phone and laptop are never online at the same moment. P2P-only makes this impossible.
- The file-service already exists and already stores files; we are promoting it from "browser-only fallback" to "the path", not building new infrastructure.
- Removes ~500 lines of `file-transfer.ts` chunking/retry/resume logic and its associated IndexedDB cache.

**Chunking & integrity.** Files split into content-defined chunks (CDC, ~64KB average, boundaries on a rolling hash) rather than fixed 64KB offsets, so two devices that independently import the same file produce identical chunk boundaries and dedup server-side. Each chunk: SHA-256, random 96-bit AES-GCM nonce, encrypted, uploaded as `POST /files/:room/:fileId/chunks/:chunkHash`. Manifest entry stores the chunk list and the cleartext SHA-256 of the original file.

**Resumable uploads/downloads.** Client tracks per-file upload/download state in IndexedDB keyed by `(fileId, chunkHash)`. On reconnect after a partial transfer, the client queries the file-service for which chunk hashes it already has, and only sends/fetches the diff.

**Quota & retention.** Per-room quota (default 2GB, configurable later). On quota hit, the manifest's `least-recently-fetched` entries are eligible for server-side eviction *only if at least N devices have a local copy* — the manifest tracks this. The file is removed from the server but remains in the manifest; clients can re-upload from a local copy if all server chunks are gone.

### Decision 5 — Real end-to-end encryption

**Choice.** A room key, derived once when the room is created, encrypts both state and file blobs. The server sees ciphertext only.

**Key hierarchy:**
```
RoomSecret (user-held: passphrase OR 256-bit random)
   │
   ▼ Argon2id (memory=64MB, iters=3, p=4)
RoomKey (256 bits, never leaves the originating device in plaintext)
   │
   ├──► StateEncryptionKey  = HKDF(RoomKey, "state-v1",  info=roomId)
   ├──► FileEncryptionKey   = HKDF(RoomKey, "files-v1", info=roomId)
   └──► ManifestAuthKey     = HKDF(RoomKey, "auth-v1",   info=roomId)
```

- **RoomSecret** is what users actually share (QR code or passphrase). It can be rotated; rotation re-encrypts the file manifest and triggers a re-key broadcast over the existing Yjs doc.
- **State encryption.** A custom y-websocket provider wrapper intercepts `updateV2` payloads before they hit the wire, encrypts with `StateEncryptionKey` (AES-GCM, nonce = `counter || deviceId-prefix`), and decrypts inbound. **The stock y-websocket relay does NOT forward opaque bytes** — it parses, applies to its own Yjs doc, and re-emits; and it silently drops unknown message-type bytes. See Open Questions for the relay-upgrade task this requires. Local persistence (`y-indexeddb`) stores plaintext (the device already has the key).
- **File encryption.** Each chunk's plaintext is AES-GCM-encrypted under `FileEncryptionKey` with a random 96-bit nonce. The nonce is stored alongside the ciphertext.
- **Manifest authentication.** Manifest entries carry an HMAC-MAC under `ManifestAuthKey` so a tampering relay (or another client that somehow has the roomId but not the key) cannot inject bogus file entries that decrypt to garbage.

**Crypto choices.**
- Argon2id via `argon2-browser` (WASM) — well-standardized KDF, resistant to GPU cracking.
- AES-GCM via WebCrypto (`crypto.subtle`) — no native dependency, audited, available in WebView2/WKWebView/WebKitGTK and on mobile.
- HKDF-SHA256 via WebCrypto.
- `@noble/hashes` as fallback if WebCrypto is unavailable in some context (e.g. WASM workers).

**Key recovery / loss.** This is the hard part and the biggest UX risk. Three options were considered:
- *(a) No recovery.* Lose the passphrase, lose the data. Honest but brutal.
- *(b) Server-side escrow* with a user-chosen recovery passphrase. Adds complexity and a soft E2EE boundary.
- *(c) Per-device local key cache* — device remembers the key in secure storage after first join, so re-launching the same device does not need the passphrase; only *new* device joins need it.

**Choice for v1: (c) + (a).** Devices cache the room key in OS secure storage (macOS Keychain / Windows DPAPI / Android Keystore / browser: encrypted in IndexedDB keyed by a per-device secret). New joins require the passphrase or QR. Lose all your devices *and* the passphrase = lose the data. A recovery-code flow is an explicit Open Question (see below) and may land in a follow-up.

### Decision 6 — Truthful UI status

The current "End-to-end enabled" string is replaced with one of three states derived from actual configuration:

| UI status | Condition |
|---|---|
| `Encrypted` | RoomKey present, encryption wrapper active, file-service accepting only ciphertext |
| `TLS only — room secret` | Room exists but no RoomSecret set (legacy mode, never encrypted). Shown with a warning |
| `Not syncing` | No room configured |

`SyncSettings.tsx` gains a "Reset room key" action that triggers the re-key flow (re-encrypt file manifest, broadcast new `RoomKey`).

### Decision 7 — Migration

Migration runs once per device on first launch of the new client:

1. Read the existing local data (IndexedDB on web/PWA, SQLite on Tauri desktop; no data exists yet on Tauri mobile since sync was off).
2. Construct or load the Yjs doc. If no room exists, prompt the user to create or join.
3. For each entity collection, write entries into the corresponding `Y.Map`. Tombstone any local rows that the Yjs doc says are deleted (if joining an existing room).
4. For files: walk the existing manifest, ensure each file the device has locally is uploaded (encrypted) to the file-service; reconcile manifest chunk hashes.
5. Mark migration complete in `localStorage`; subsequent launches skip.

**Conflict on first join (device has local data *and* room has data).** Last-writer-wins by `updatedAt` per entity. Reviews merge by deterministic ID. UI surfaces a non-blocking toast: "Synced N items, merged M conflicts."

**Rollback.** Because local DB is preserved through migration (not deleted), rollback is "uninstall new client, install old client" — old client reads local DB unchanged. Once the new client has been running for 30 days (tombstone GC window), rollback requires a manual export/import.

### Decision 8 — Mobile bandwidth & battery

- **Delta-only state transport.** y-websocket already sends update diffs, not full state. The local persistence layer (`y-indexeddb`) means reconnects after a short offline period replay only the missing update set. First-sync of a fresh device *does* pull full state — UI must show progress.
- **Background sync.** On Tauri mobile, sync runs while the app is foregrounded only. No background WebSocket (battery). The auto-download `wifi-only` mode is honored via the existing `NetworkInformation` API on web/PWA and a Tauri mobile equivalent.
- **Chunked file fetch.** File downloads stream chunk-by-chunk, persist each encrypted chunk to IndexedDB before decrypting, and only assemble + decrypt on first read. A failed download resumes from the last persisted chunk.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Review-history CRDT merge subtly wrong → silent over/under-counting of reviews → broken SRS schedule | Deterministic `Review.id` dedups replayed events. Add a `ReviewLog` invariant test: re-running FSRS/SM over the merged review set must yield the same card state as the merged projection. |
| Argon2id in WebView is slow on low-end mobile (200-500ms) | Run KDF once at unlock, cache `RoomKey` in OS secure storage, never re-derive in-session. Show a one-time progress indicator on first join. |
| Lost passphrase = lost data | v1 ships with per-device key cache only. Document the threat model in settings. Recovery flow deferred (Open Question). |
| Yjs `Y.Map` size grows unbounded as tombstones accumulate | Tombstone GC after 30 days. Per-collection compaction endpoint that snapshots current state and starts a fresh doc (long-term, not v1). |
| File-service disk fills up | Per-room quota. LRU eviction of chunks already present on N devices. Quota-exceeded surfaces in UI before upload starts. |
| Existing relay can't handle full-state traffic | Relay is unchanged architecturally; it forwards bytes. Capacity concern is real but separate — monitor p99 message size, add relay instances behind Caddy if needed. |
| Tauri mobile WebView quirks (crypto.subtle availability, IndexedDB limits) | Validate on iOS WKWebView and Android WebView2 in implementation; fall back to `@noble/*` polyfills if needed |
| Migration writes a large Yjs doc on first run → slow first launch, possible OOM on low-end phone | Stream entities into the doc in batches; show progress; allow deferring migration until device is on WiFi + charging |
| Removing `cloud_sync.rs` breaks any users actually relying on it | Discovery: search issue tracker / telemetry first. If usage exists, ship a "Yjs recommended" toggle before removal, full removal in a follow-up release |
| `service.py` merge conflict with leaked credentials is already public | Rotate any exposed secrets immediately; treat the fix as security-priority, land before the rest of the change |

## Migration Plan

1. **Pre-flight (separate, security-priority PR).** Rotate leaked proxy credentials in `yjs-sync/service.py`; resolve the merge conflict; treat as security fix on `main`.
2. **Phase 1 — Encryption foundation.** Land crypto helpers, key derivation, Yjs encryption wrapper, and UI status changes. No state-schema changes yet. Users opt into a room key; existing rooms keep working in "TLS only" mode with a truthful label.
3. **Phase 2 — State schema.** Add the new `Y.Map` collections for documents/extracts/learning items/reviews/audio positions. Ship the adapters that project Yjs → IndexedDB/SQLite. The old localStorage-only sync keeps running in parallel. New data writes go to Yjs first.
4. **Phase 3 — File-service canonicalization.** Migrate file uploads/downloads to the new encrypted, chunked, resumable path. Remove `file-transfer.ts` P2P code. UI file status driven off manifest alone.
5. **Phase 4 — Tauri enablement.** Remove the `!isTauri()` gate; turn Yjs sync on for desktop and mobile. Run the migration on Tauri SQLite → Yjs.
6. **Phase 5 — Deprecation.** Mark JWT/Postgres sync server and Rust `cloud_sync.rs` deprecated. One release later, remove. Watch telemetry / issue tracker for anyone still depending on either path.

Each phase is independently shippable. Phases can pause for user feedback before proceeding.

## Open Questions

- [ ] **CRITICAL — Relay forwarding (discovered during 1.8 implementation).** The design assumed "the existing relay needs no change — it forwards opaque bytes." This is **wrong**. Verified against `node_modules/y-websocket/bin/utils.js`: the stock relay's `messageListener` (lines 162-188) has no `default` case, and the relay is not a pure forwarder — it applies client updates to its own Yjs doc and re-emits via `updateHandler` (line 79). Three options for resolution:
  - (a) **Fork the relay** to forward unknown message types opaquely and skip the local-Yjs-doc step for them. Small code change (~10 lines in `messageListener`), but requires deploying a custom server at `sync.readsync.org`. Captured as task 1.8a.
  - (b) **Switch to doc-level encryption** (encrypt the Yjs update payload INSIDE the standard `messageSync` envelope, using a Y.Doc that holds opaque bytes). Works with the stock relay but the server's Yjs doc operations (state-vector computation, GC) operate on ciphertext and either fail or produce useless metadata. Yjs's CRDT semantics may also break if the encrypted bytes don't decode as valid Yjs structures.
  - (c) **Use a separate transport** for encrypted state (raw WebSocket broadcast, not y-websocket). Cleanest separation but duplicates Yjs's awareness/sync/reconnect logic.
  - Recommendation: (a). It's the smallest change and preserves the wire-level encryption design as specified. The encryptedProvider.ts work is reusable as-is.
- [ ] **Recovery code.** Should v1 ship a server-side escrow of an encrypted room-key blob, unlockable by a user-chosen recovery passphrase? Trade-off is a soft E2EE boundary vs. user pain on lost passphrase. Default: defer to follow-up.
- [ ] **Guest read-only joins.** Should a room owner be able to issue a *read-only* room key (e.g. to share a library with a friend without giving them write access)? Adds ACL complexity to the manifest HMAC scheme. Default: no, v1 is full-access only.
- [ ] **Quota default.** 2GB per room is a guess. What's the right number given the typical library size (PDFs + EPUBs + audio)? Need to look at existing user libraries.
- [ ] **`cloud_sync.rs` actual usage.** Need to grep telemetry / issue tracker before Phase 5 removal. If real users depend on it, the deprecation window needs to be longer or the path kept as a fallback.
- [ ] **Browser storage eviction.** Browsers will evict IndexedDB under storage pressure. For stateless devices (a fresh PWA install on someone else's computer), should we offer "remember this device for N days"?
- [ ] **Yjs document compaction.** Long-running rooms accumulate CRDT history. When and how do we snapshot? Defer to v2 unless it bites in testing.
