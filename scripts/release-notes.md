### Added
- **Cross-device file sync** — PDFs, EPUBs, and audio files now transfer between devices over the same sync room as your reading state. Import a file on desktop, and it appears on your phone with a download button (or auto-downloads per your setting). Files flow through the existing sync relay using a new binary transfer protocol; received files are cached and survive app restarts.
- **File sync status indicators** — the document library and reader now show per-file sync state (available to download, downloading with progress, waiting for the source device to come online). Tap to download from another device.
- **Auto-download modes** — the Settings → Sync → "Auto-download files" dropdown (Always / WiFi only / Manual) now actually controls behavior. "Manual" waits for an explicit tap; the others pull files when a device with them is online.

### Fixed & Improved
- **State sync now runs on mobile + desktop** — the localStorage-to-Yjs bridge that moves your library, settings, collections, and highlights across devices was gated to PWA-only, so Tauri apps connected to the sync room but never exchanged any data. Now enabled on all profiles.
- **Scan-to-join button now renders on mobile** — the QR-vs-Scan detection used `display-mode: standalone`, which Tauri's WebView never reports, so native Android/iOS showed a useless QR image instead of the camera scan button. Replaced with native-platform detection.
- **File transfer protocol correctness** — rewired from JSON text frames (which the relay forwards as binary and the receiver silently dropped) to a binary frame format that actually reaches peers. Chunk payloads are raw bytes, ~33% smaller than the prior base64 encoding.
