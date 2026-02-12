## Context
The existing sync server at `wss://sync.readsync.org` is a pure relay - files are NOT stored on the server. When a device uploads a file, it must be streamed in real-time through WebSocket to any other connected devices. Devices that are offline when a file is shared will NOT receive it.

## Goals / Non-Goals

**Goals:**
- Stream files between online devices in real-time via WebSocket
- Enable users to access files when their devices are online simultaneously
- Handle chunked binary transfer through existing Yjs WebSocket connection
- Allow users to configure auto-download behavior

**Non-Goals:**
- Server-side file storage (server is pure relay - files deleted instantly)
- Offline file sync (devices must be online simultaneously)
- File versioning/history beyond basic conflict detection

## Decisions

### 1. File Streaming via Yjs Binary Updates
**Decision:** Encode files as Yjs binary updates and stream through the existing WebSocket connection.

**Rationale:**
- Leverages existing infrastructure (no new endpoints needed)
- Yjs handles binary synchronization automatically
- Works with existing y-websocket server

**Protocol:**
1. Device A announces file via Yjs manifest (metadata only)
2. Device B sees manifest entry and requests file via Yjs message
3. Device A chunks file into ~64KB binary pieces
4. Each chunk sent as Yjs custom message through WebSocket
5. Device B reassembles chunks and stores locally

**Schema:**
```typescript
interface FileManifestEntry {
  id: string;           // UUID of file
  room: string;         // Sync room ID
  filename: string;
  contentType: string;
  sizeBytes: number;
  contentHash: string;  // SHA-256 for integrity
  uploadedAt: string;   // ISO timestamp
  uploadedBy: string;   // Device ID
}

interface FileChunkMessage {
  type: 'file-chunk';
  fileId: string;
  chunkIndex: number;
  totalChunks: number;
  data: ArrayBuffer;    // Base64 encoded in JSON, or binary in ws
}

interface FileRequestMessage {
  type: 'file-request';
  fileId: string;
  requesterDeviceId: string;
}
```

### 2. Auto-Download Configuration
**Decision:** Users can configure auto-download behavior in settings.

**Options:**
- `always` - Automatically download all files announced by other devices
- `wifi-only` - Auto-download only on WiFi (mobile)
- `manual` - Never auto-download; user must manually request each file

### 3. Local File Cache
**Decision:** Store downloaded files in IndexedDB with key `file-cache:<id>`.

**Rationale:**
- Consistent with existing IndexedDB usage in app
- Works in both browser and Tauri environments
- Easy to clear cache if needed

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Large files slow to download | Show progress, allow cancel |
| Conflict when same file uploaded twice | Hash comparison, conflict UI |
| Server file TTL before all devices sync | Server keeps files for 30 days (configurable) |
| Storage limits on mobile | Show storage usage, allow selective deletion |

## Migration Plan
No migration needed - this is a new feature. Existing uploaded files will be added to manifest on next upload.

## Open Questions
- [ ] Should we add user-configurable auto-download setting for new files?
- [ ] What's the server-side file retention policy?
