### Added
- **Scan-to-join sync on mobile** — scan a desktop's sync QR code on Android to join its sync room immediately, with no manual "Join" tap and no app reload. Joining now switches the running sync in-process via a new `rejoinRoom` path. Added Android camera permission and a WebView permission bridge so `getUserMedia` resolves correctly.
- **Mobile sync enabled at startup** — the Yjs sync provider now initializes on the Tauri (Android/iOS) profile at launch, not just on PWA. Previously mobile sync only started lazily if a file-sync hook mounted.

### Fixed & Improved
- **Removed the confusing legacy API-key sync setup** — deleted the duplicate `api/sync` + `sync.rs` path (the endpoint + API-key REST sync) so there is now exactly one sync system: the room-based Yjs connection broker. Sync settings no longer shows an API key field, endpoint field, or sync log/status tabs from the removed system.
- **In-process room switching** — `rejoinRoom` tears down and rebuilds the sync provider against a new room without a page reload, eliminating the old "reload to connect" step after joining a room or toggling encryption.
- **IndexedDB guard for mobile WebViews** — sync degrades gracefully to in-memory-only on WebViews without IndexedDB rather than failing to start.
- **Rewrote the Sync section of the user handbook** in all six supported languages (English, German, Spanish, French, Chinese, Japanese) to document the room-based sync system, replacing outdated references to cloud-provider sync and legacy sync options.
- **Deprecated the account-based REST sync server routes** (`/sync`, `/files`) with `Deprecation`/`Sunset` headers ahead of their planned removal.
