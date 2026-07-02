### Added
- **Custom Sync Endpoint Configuration** — Users can now configure their own self-hosted sync server WebSocket URL in settings (e.g. for local, VPS, or Tailscale setups).

### Fixed & Improved
- **Real-Time Sync is now Opt-In** — Real-time Yjs CRDT synchronization is disabled by default to reduce network connections and database pool contention until explicitly enabled.
