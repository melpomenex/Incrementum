# Change: Add Cross-Device File Sync

## Why
Users with multiple devices (desktop, laptop, mobile) need their imported files (PDFs, EPUBs, etc.) to be available on all devices. The sync server is a pure relay (no file storage), so files must be streamed in real-time between devices that are online simultaneously.

## What Changes
- Add file manifest tracking in Yjs to broadcast file availability across devices
- Implement WebSocket binary streaming to transfer files between devices in real-time
- Add auto-download configuration (always/wifi-only/manual)
- Add file sync status UI showing which files are synced, available, or waiting for source
- Handle transfer interruption and resume when source device comes back online

## Impact
- Affected specs: file-sync (new capability)
- Affected code:
  - `src/lib/yjsSync.ts` - add file manifest shared type and binary protocol
  - `src/lib/file-transfer.ts` - new file for chunking, transfer coordination
  - `src/stores/settingsStore.ts` - add autoDownloadMode setting
  - `src/components/settings/SyncSettings.tsx` - add file sync status and config
  - `src/components/documents/DocumentsView.tsx` - add sync status indicators
- No server changes needed (pure relay architecture)
