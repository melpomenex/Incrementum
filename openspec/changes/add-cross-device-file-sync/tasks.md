## 1. File Manifest Sync via Yjs
- [x] 1.1 Define Yjs Y.Map schema for file manifest (id, room, filename, contentType, sizeBytes, contentHash, uploadedAt, uploadedBy)
- [x] 1.2 Create FileManifest class to manage manifest state in Yjs document
- [x] 1.3 Track which devices have each file locally (device presence in manifest)
- [x] 1.4 Emit events when remote devices announce new files or change availability

## 2. WebSocket Binary Protocol
- [x] 2.1 Define custom message types for file transfer protocol (file-request, file-chunk, file-complete, file-error)
- [x] 2.2 Implement chunking logic to split files into 64KB chunks
- [x] 2.3 Implement chunk reassembly on receiving device
- [x] 2.4 Add retry logic for failed chunks (max 3 retries per chunk)
- [x] 2.5 Handle binary vs text message encoding in y-websocket

## 3. File Transfer Service
- [x] 3.1 Create FileTransferManager to coordinate send/receive operations
- [x] 3.2 Implement file request broadcasting to find online source devices
- [x] 3.3 Implement sender side: read file, chunk, send via WebSocket
- [x] 3.4 Implement receiver side: receive chunks, reassemble, store in IndexedDB
- [x] 3.5 Handle transfer interruption (source goes offline)
- [x] 3.6 Resume partial transfers when source comes back online

## 4. Auto-Download Configuration
- [x] 4.1 Add sync setting: autoDownloadMode ('always' | 'wifi-only' | 'manual')
- [x] 4.2 Implement auto-download trigger when new file announced (based on setting)
- [x] 4.3 Add network type detection for wifi-only mode
- [x] 4.4 Add settings UI for auto-download configuration

## 5. File Sync Status UI
- [x] 5.1 Add file sync status indicator to document list items (synced/available/waiting/downloading)
- [x] 5.2 Show download progress bar during active transfers
- [x] 5.3 Add "Download" button for files available from peers
- [x] 5.4 Show "Waiting for source device" when no peer has file
- [x] 5.5 Add "Sync Files" section in settings showing all files and their status

## 6. Testing
- [ ] 6.1 Unit tests for file chunking/reassembly
- [ ] 6.2 Unit tests for manifest sync
- [ ] 6.3 Integration tests for file transfer between two mock clients
- [ ] 6.4 Test offline/reconnect scenarios
- [ ] 6.5 Test large file transfers (>100MB)
