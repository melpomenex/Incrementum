## 0. Pre-flight (security-priority, separate PR)

- [x] 0.1 Resolve the unresolved Git merge conflict in `yjs-sync/service.py` (lines 30-49) — keep the upstream variant, drop the stashed variant exposing proxy credentials
- [ ] 0.2 Rotate any proxy credentials that were exposed in the stashed version; update the running deployment at `sync.readsync.org`
- [x] 0.3 Audit `yjs-sync/.env.example` and `yjs-sync/docker-compose.yml` for any other leaked secrets; ensure all secrets flow through env vars
- [x] 0.4 Add a CI check (grep-based) that fails if `<<<<<<<`, `=======`, or `>>>>>>>` markers appear in any committed file

## 1. Encryption foundation

- [x] 1.1 Add crypto dependencies to `package.json`: `argon2-browser`, `@noble/hashes`, `@noble/ciphers` (as fallback for environments where `crypto.subtle` is unavailable)
  - Note: swapped `argon2-browser` (UMD-only, no ESM `exports` field — Vite cannot bundle it cleanly) for `hash-wasm` (modern ESM, well-maintained, smaller). `@noble/hashes` and `@noble/ciphers` kept as planned for WebCrypto fallback (Phase 8.2).
- [x] 1.2 Create `src/lib/sync/encryption.ts` with: `deriveRoomKey(roomSecret, roomId)` using Argon2id (memory cost ≥ 32 MB, iterations ≥ 3, parallelism ≥ 4); `deriveSubKeys(roomKey)` returning `{ stateKey, fileKey, manifestAuthKey }` via HKDF-SHA256
- [x] 1.3 Implement `encryptState(updateBytes, stateKey)` / `decryptState(ciphertext, stateKey)` using AES-GCM with a counter+deviceId nonce scheme
- [x] 1.4 Implement `encryptChunk(plaintext, fileKey)` returning `{ ciphertext, nonce }` and `decryptChunk(ciphertext, nonce, fileKey)` returning plaintext; verify SHA-256 of plaintext matches expected hash
- [x] 1.5 Implement `hmacManifest(entryBytes, manifestAuthKey)` for manifest-entry authentication
- [x] 1.6 Implement per-device secure storage of the cached `RoomKey`: `setCachedRoomKey(key)`, `getCachedRoomKey()` using Tauri's secure-storage plugin on desktop/mobile and encrypted IndexedDB on web
  - Note: there is no `tauri-plugin-os-keychain` on crates.io. Used the existing `keyring = "3"` crate (already a dependency, already wrapped for AI keys and OAuth tokens) via three new Tauri commands in `src-tauri/src/commands/secure_storage.rs`. It routes to macOS Keychain / Windows Credential Manager / Linux Secret Service / Android Keystore / iOS Keychain. Web/PWA path stores the room key AES-GCM-encrypted under a per-device secret in localStorage, inside a dedicated IndexedDB database (`incrementum-secure-storage`).
- [x] 1.7 Write unit tests for key derivation determinism (same secret+roomId → same key), chunk encrypt/decrypt round-trip, HMAC tamper detection, and nonce-uniqueness under repeated encryptions
- [x] 1.8 Add a y-websocket provider wrapper (`src/lib/sync/encryptedProvider.ts`) that intercepts outbound `updateV2` payloads (encrypt) and inbound bytes (decrypt) using the state sub-key
  - **Critical follow-up discovered (task 1.8a)**: the stock `y-websocket/bin/utils.js` relay silently drops unknown message-type bytes (no `default` case in `messageListener`). The wrapper introduces type `0x10` for encrypted sync frames, which the relay currently discards — so the wrapper is correct in unit tests (mock relay forwards opaquely) but does NOT replicate against `sync.readsync.org` until task 1.8a lands. Also: the relay is not a pure forwarder — it applies client updates to its own Yjs doc and re-emits, so simply forwarding unknown types would still bypass the relay's persistence. The full fix needs a custom relay variant that forwards unknown types opaquely AND skips the local-Yjs-doc step for them.
- [x] 1.8a **Upgrade the relay to support opaque-forwarding of unknown message types.** Fork `y-websocket/bin/utils.js` into `yjs-sync/utils.js` with: (1) a `default` case in `messageListener` that broadcasts the raw frame to all other connections in the room without parsing or applying to the local Yjs doc; (2) update `yjs-sync/docker-compose.yml` to run a custom `yjs-sync/server.js` that requires the forked utils. Add a CI/integration test that round-trips a 0x10 frame end-to-end through a real relay instance. **Deployment required** at `sync.readsync.org` — coordinate with task 0.2's credential-rotation deploy.
  - Done: forked `yjs-sync/utils.js` + `yjs-sync/server.js` (CommonJS — added `yjs-sync/package.json` override so the project's `"type": "module"` doesn't trip them up locally; the Docker container has its own package.json). Inlined `callback.js` since y-websocket's `exports` field blocks deep imports. Integration test at `yjs-sync/test/opaque-forwarding.cjs` — 2/2 pass: (1) 0x10 frame round-trips verbatim between two clients; (2) server's Yjs doc is unchanged after an unknown-type frame (confirming the bytes are forwarded, not applied).
  - **Deployment step still required** at `sync.readsync.org`: pull the new `yjs-sync/server.js` + `yjs-sync/utils.js`, restart the `yjs-sync` container. Until this deploys, encrypted state only replicates in test environments.
- [ ] 1.8b **(Follow-up, not blocking v1 launch)** Add server-side persistence of encrypted frames so async state sync works (device A uploads at 9am, device B downloads at noon when A is offline). The 1.8a fork forwards frames live only — if all clients in a room disconnect, the server has no state. Options: (a) per-room append-only log of recent encrypted frames, capped at N MB or M days, replayed on new connection; (b) periodic encrypted-snapshot upload from one designated client, stored server-side, downloaded by new clients before live sync. Punt to a follow-up PR; current 1.8a + 1.8 already covers the "both devices online simultaneously" use case which is the most common pattern.
- [x] 1.9 Add settings UI: passphrase-entry field on room creation, "join with passphrase" flow alongside existing QR scan, "reset room key" action, truthful encryption-status label (`Encrypted` / `TLS only — room secret` / `Not syncing`) replacing the existing "End-to-end enabled" string in `SyncSettings.tsx`
  - Done. New orchestration module `src/lib/sync/roomCrypto.ts` (generate secret, derive+cache key+secret, enable/disable/reset). Extended `secureStorage.ts` with parallel secret-storage API. Wired `yjsSync.ts` to construct `EncryptedWebsocketProvider` when a cached key is present (falls back to plain `WebsocketProvider` in "TLS only" mode). `SyncSettings.tsx` gains an "End-to-end encryption" subsection with Enable/Disable/Reset, show/copy secret, and the QR encodes the new `incrementum-sync:v1:` format when encryption is on (emits bare roomId for back-compat). Join handler parses both formats. Truthful status label replaces the dishonest "End-to-end enabled" string in two places.
- [x] 1.10 Add QR-code payload format: `incrementum-sync:v1:<roomId>:<base64url roomSecret-or-passphrase>`; update `SyncQrScanner.tsx` to parse and validate the version field
- [ ] 1.11 Manual test: create room with passphrase on device A, scan QR on device B, confirm both derive the same room key and the relay sees only ciphertext

## 2. Full-state CRDT schema

- [ ] 2.1 Define TypeScript types for each shared-map value shape in `src/lib/sync/schemas.ts`: `Document`, `Extract`, `LearningItem`, `Review`, `AudioPosition`, `Setting`, plus updated `FileManifestEntry` (with chunk list, plaintext hash, HMAC, status)
- [ ] 2.2 Define the deterministic `Review.id` generator: `sha1(cardId + "|" + reviewedAtMs + "|" + deviceId)`; document the idempotency contract
- [ ] 2.3 Add tombstone convention: each entity type carries optional `_deleted: boolean`, `deletedAt: number`; write a `writeTombstone(yMap, key)` helper and a `gcTombstones(yMap, olderThanMs)` helper
- [ ] 2.4 Extend the singleton Yjs doc in `src/lib/yjsSync.ts` to declare all new shared maps: `documents`, `extracts`, `learningItems`, `reviews`, `audioPositions`, `settings` (in addition to the existing `localStorage`, `fileManifest`, `devicePresence`)
- [ ] 2.5 Add empty-body debug-log cleanup: remove the `if (isSyncDebugEnabled()) {}` no-op blocks at `yjsSync.ts` lines 187, 223, 234, 250; replace with real logging gated on the debug flag

## 3. Local-DB-as-projection adapters

- [ ] 3.1 Define the `YjsAdapter<T>` interface in `src/lib/sync/adapter.ts` (collection name, yMap reference, applyRemoteToLocal, writeLocal, deleteLocal)
- [ ] 3.2 Implement `src/lib/sync/stateAdapters.ts` with one adapter per entity type, each subscribing to its `Y.Map`'s `observeDeep` events and writing through to the IndexedDB store (web/PWA) and SQLite (Tauri via an invoke bridge)
- [ ] 3.3 Reroute all UI writes (document create/update/delete, extract create/update, learning-item state transitions, review completion, audio position save, settings change) to go through `adapter.writeLocal()` first; remove direct IndexedDB / SQLite writes from feature code
- [ ] 3.4 Add an SQLite-side projection on Tauri: a Rust command `apply_yjs_delta` that takes a serialized delta and writes to SQLite, called from the frontend adapter via `invoke`
- [ ] 3.5 Replace the brute-force corruption reset (`yjsSync.ts` lines 99-143 + `main.tsx` lines 75-87) with a targeted reset: clear only the `y-indexeddb` persistence database for the affected doc, preserve local data, re-bootstrap from local data on next connection
- [ ] 3.6 Rate-limit the corruption reset to once per session (already partly done via `sessionStorage`; verify and tighten)
- [ ] 3.7 Add adapter-level invariant tests: every UI write surfaces as a Yjs change AND as a local-DB write; every remote Yjs change surfaces as a local-DB write

## 4. Review-history merge correctness

- [ ] 4.1 Audit every place FSRS / SM-18 / SM-20 scheduling reads review history; ensure they read from the merged `reviews` map (via the adapter), not from a local-only table
- [ ] 4.2 Add an invariant test: re-running each scheduling algorithm over the merged review log produces the same card state as the merged projection field; cover the multi-device-out-of-order scenario
- [ ] 4.3 Add a test for the same-review-twice case (reconnect after pushing) — assert exactly one entry, schedule unaffected by replay
- [ ] 4.4 Add a test for the same-card-reviewed-on-two-devices case — assert both reviews present, schedule reflects chronological order

## 5. File-service canonicalization

- [ ] 5.1 Implement content-defined chunking in `src/lib/sync/chunking.ts` (rolling-hash boundary, target average 64 KB, min 16 KB, max 256 KB); produce `Array<{ index, plaintextHash, plaintext }>`
- [ ] 5.2 Implement `src/lib/sync/filePipeline.ts` unifying the previous `yjs-file-service.ts` + `file-transfer.ts` + `useFileSync.ts` into one path; remove the P2P streaming protocol entirely
- [ ] 5.3 Add upload path: chunk → encrypt each chunk under `fileKey` with random 96-bit nonce → `POST /files/:room/:fileId/chunks/:chunkHash` (chunkHash is the *plaintext* SHA-256; ciphertext + nonce in body)
- [ ] 5.4 Add download path: query manifest for chunk list → `GET /files/:room/:fileId/chunks/:chunkHash` → decrypt → verify plaintext hash → persist to local cache → assemble on first read
- [ ] 5.5 Add resumability: persist per-`(fileId, chunkHash)` upload/download state in IndexedDB; on reconnect, query file-service `HEAD /files/:room/:fileId/chunks/:chunkHash` for which chunks exist, transfer only the missing set
- [ ] 5.6 Consolidate the duplicate file caches into one `incrementum-file-cache` IndexedDB keyed by `(fileId, chunkHash)`; reference-count against manifest entries; free chunks when no manifest entry references them
- [ ] 5.7 Update `FileManifestEntry` schema and `file-manifest.ts`: add `chunks: string[]` (ordered plaintext hashes), `plaintextSha256`, `hmac`, `status: 'available' | 'bytes-evicted' | 'unrecoverable'`, `lastFetchedAt` per device
- [ ] 5.8 Update `useFileSync.ts` hooks (`useFileSyncStatus`, `useAllFileSyncStatus`, `useFileDownloader`, `useFileUploader`) to drive off the unified pipeline; remove peer-presence-based logic
- [ ] 5.9 Update `browser-backend.ts` `import_document` and `read_document_file` to use the unified pipeline; drop the `yjs-file://` URL scheme in favor of manifest-keyed access (keep a read-compatibility shim for legacy URLs)
- [ ] 5.10 Update `FileSyncStatusIndicator.tsx`: states `synced`, `available`, `uploading` (with progress), `downloading` (with progress), `unrecoverable`; derive purely from manifest + local cache
- [ ] 5.11 Honor auto-download modes (`always` / `wifi-only` / `manual`) off manifest updates; for `wifi-only`, query `navigator.connection.effectiveType` / Tauri mobile network API; surface "waiting for WiFi" status

## 6. File-service server-side changes

- [ ] 6.1 Add `POST /files/:room/:fileId/chunks/:chunkHash` endpoint to `yjs-sync/file-service/index.js`: accept ciphertext + nonce, store at `/data/files/<room>/<fileId>/<chunkHash>.bin` with nonce sidecar
- [ ] 6.2 Add `GET /files/:room/:fileId/chunks/:chunkHash` and `HEAD` (HEAD returns 200/404 only) endpoints
- [ ] 6.3 Add `GET /files/:room/:fileId/manifest` returning the list of chunk hashes the server has for that file (for resumability diff)
- [ ] 6.4 Add per-room quota tracking: `GET /rooms/:room/usage` returns `{ usedBytes, quotaBytes }`; reject uploads that would exceed quota with `413 Quota Exceeded`
- [ ] 6.5 Add server-side eviction job: when quota pressure, pick LRU chunks where `manifest.devicesWithLocalCopy >= 2`; delete the chunk, leave manifest entry, mark `bytes-evicted` (requires reading manifest from y-websocket relay state — coordinate via shared volume or HTTP from the relay)
- [ ] 6.6 Keep the existing no-auth access model (room ID is the bearer) — encryption now provides the actual confidentiality boundary; document this clearly in `yjs-sync/file-service/README.md`
- [ ] 6.7 Load-test the chunk endpoints with a representative file (PDF ~5MB, audio ~50MB); record p95 latency and throughput

## 7. Migration (local data → Yjs)

- [ ] 7.1 Add a migration runner in `src/lib/sync/migrate.ts` gated by a `localStorage` flag (`incrementum_yjs_migration_v1_done`); idempotent — skip if flag set
- [ ] 7.2 Implement web/PWA migration: read each IndexedDB store → write into corresponding `Y.Map` (or tombstone for deletes inferred from manifest)
- [ ] 7.3 Implement Tauri-desktop migration: read SQLite via existing Rust models → serialize → frontend writes into `Y.Map`
- [ ] 7.4 Implement conflict merge on first-join-when-room-has-data: per-entity `updatedAt` last-writer-wins; reviews merged by deterministic ID; surface non-blocking toast with counts
- [ ] 7.5 Add a migration progress UI (one-time modal on first launch): "Migrating your data to sync…" with entity counter; allow deferring if device is not on WiFi + charging
- [ ] 7.6 Test migration on: a fresh device with no data joining an existing room; an existing desktop user creating their first room; two devices with overlapping data both joining the same new room

## 8. Tauri enablement (desktop + mobile)

- [ ] 8.1 Remove the `!isTauri() && isPWA()` gate in `main.tsx` around `initLocalStorageSync()`; Yjs sync initializes on all device profiles
- [ ] 8.2 Verify `crypto.subtle` availability in WKWebView (iOS) and Android WebView2; where missing, fall back to `@noble/ciphers` and `@noble/hashes`
- [ ] 8.3 Wire up secure-storage plugin on Tauri mobile (`tauri-plugin-stronghold` or platform keychain) for `RoomKey` caching
- [ ] 8.4 Add CSP/connectivity allowlist entries for `wss://sync.readsync.org` and `https://sync.readsync.org` in `tauri.android.conf.json` and `tauri.ios.conf.json`
- [ ] 8.5 Confirm `y-indexeddb` works in mobile WebViews; if not, add an SQLite-backed persistence adapter for the Yjs doc on Tauri
- [ ] 8.6 Manual test on Android build: create room, sync state, sync a file, kill app, reopen, verify state and file persist

## 9. Cleanup & deprecation

- [ ] 9.1 Delete `src/lib/file-transfer.ts` and all its consumers once the unified pipeline is shipped and verified
- [ ] 9.2 Add a deprecation notice in the Postgres sync server (`server/src/routes/sync.ts`) responses: `Deprecation: true` header + `Sunset` date; log a warning when called
- [ ] 9.3 Add a UI deprecation banner for any user whose build is configured to use the JWT REST sync server (detected via settings); prompt to migrate to Yjs room-based sync
- [ ] 9.4 Audit `cloud_sync.rs` usage: search issue tracker, telemetry, and the Tauri settings UI for evidence of users actually using it; document findings in the change's open questions
- [ ] 9.5 After deprecation window (one full release cycle): remove `server/src/routes/sync.ts`, `server/src/routes/files.ts`, `src-tauri/src/cloud_sync.rs`, `src-tauri/src/commands/cloud/sync.rs`, and associated Cargo dependencies

## 10. Testing & verification

- [ ] 10.1 Unit: `src/lib/sync/encryption.ts` (key derivation determinism, AES-GCM round-trip, HMAC tamper detection, nonce uniqueness)
- [ ] 10.2 Unit: `src/lib/sync/chunking.ts` (same input produces same chunks across runs and across devices; boundary constraints respected)
- [ ] 10.3 Unit: review-history deterministic IDs (same event → same ID; different device → different ID)
- [ ] 10.4 Integration: two-clients-in-one-process harness simulating offline edits on both, then reconnect — assert merge converges and no data lost
- [ ] 10.5 Integration: large file (>100MB) upload/download with mid-transfer disconnect — assert resumption completes without re-uploading already-present chunks
- [ ] 10.6 Integration: corrupted IndexedDB doc on launch — assert targeted reset preserves local data and re-bootstraps successfully
- [ ] 10.7 End-to-end manual test matrix: web/PWA ↔ Tauri desktop ↔ Tauri mobile (Android); full state sync, file sync, offline edits, key rotation, quota pressure, lost-passphrase recovery flow
- [ ] 10.8 Performance: first-sync of a 1000-document room completes in under 30 seconds on a mid-range phone; record metrics for the design doc's Open Questions

## 11. Documentation

- [ ] 11.1 Update `openspec/project.md` "External Dependencies" section: note that `sync.readsync.org` is now an encrypted-state + encrypted-file relay, no plaintext path
- [ ] 11.2 Write a short threat-model doc (`docs/sync-security.md`): what the relay can and cannot see, what the room secret protects, lost-passphrase implications, recommendation to use the per-device key cache
- [ ] 11.3 Update `SyncSettings.tsx` help text and any in-app onboarding to set expectations: "Sync your devices", passphrase guidance, key-recovery warning
- [ ] 11.4 Add a `CHANGELOG` entry for the overhaul; supersede the previous `add-cross-device-file-sync` change in the changelog narrative
