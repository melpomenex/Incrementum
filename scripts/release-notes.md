### Added
- **Cross-device sync for YouTube, web, and arXiv content** — Videos, web articles, and papers imported on one device now appear in the library on every other device in the sync room. YouTube videos are playable directly on the receiving device (the watch URL travels with the doc), and Twitter/X video imports transfer their downloaded MP4 via the file-sync layer so they can be played offline on other devices.

### Fixed & Improved
- **Reading position now syncs across devices** — Resolved the core cross-device sync bug where books transferred but the reading position (page, scroll, EPUB CFI, video/audio timestamp) never reached other devices. Position changes now propagate live and asynchronously, with last-writer-wins conflict resolution.
- **Synced YouTube videos play correctly** — Fixed a regression where a YouTube video that synced to another device would fail to play (the watch URL was being blanked on the receiver by a partial republish). The receiver now preserves the content URL, and partial field updates no longer null out `filePath`/`category`.
- **No more duplicate documents on re-import** — Re-importing the same YouTube URL (or re-syncing) no longer creates a duplicate library entry on every device; imports now dedupe by video id.
- **YouTube metadata fetch** — Corrected the backend command name so YouTube imports use the full yt-dlp metadata path instead of silently falling back to the sparse oEmbed lookup.
- **Faster, quieter sync startup** — URL-backed documents (YouTube links, web articles) are no longer pointlessly hashed at sync initialization, eliminating a recurring `hash_document_file: Invalid path` error on every boot.
