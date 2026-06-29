### Fixed & Improved
- **Cross-device file sync** — Fixed a bug where `fileId` was not persisted in the database, preventing peers from downloading document file contents (EPUBs/PDFs).
- **Self-download loop** — Fixed sync hook to correctly identify local/imported files on the owner device as synced instead of offering a download button.
- **Fallback download button** — Rendered the download control on the viewer fallback screen to enable downloading missing files from peers.
- **TypeScript & Test fixes** — Corrected local store mock path in Yjs replication tests and resolved Document interface shadowing type error in `EPUBViewer.tsx`.
