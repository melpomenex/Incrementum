## Why

The current "Anna's Archive" integration is limited to searching Library Genesis (LibGen.li) and does not utilize the full Anna's Archive database (60M+ books). Additionally, the current implementation is unreliable, lacks support for many formats and mirrors, and is currently disabled on non-macOS platforms due to perceived compatibility issues that can be resolved with a more robust implementation.

## What Changes

- **Backend Overhaul**: Replace the LibGen-only search with a direct Anna's Archive search implementation that queries active mirrors (annas-archive.org/li/se).
- **Enhanced Scraper**: Implement a more robust HTML scraper for Anna's Archive search results and book detail pages to extract MD5, metadata, and all available download mirrors.
- **Improved Download Flow**: Support downloading via Anna's Archive "Slow Download" mirrors and fallback to LibGen/Z-Library mirrors when direct links are unavailable.
- **Better Metadata**: Extract and display cover images, descriptions, and ISBNs more reliably.
- **Cross-Platform Fixes**: Restore and verify functionality on Windows and Linux by addressing path and networking issues.

## Capabilities

### New Capabilities
- `annas-archive-direct-search`: Query Anna's Archive mirrors directly to access its full 60M+ book database.
- `annas-archive-mirror-handling`: Support for multiple download mirrors (LibGen, Z-Library, etc.) sourced from Anna's Archive.

### Modified Capabilities
- `book-import`: Enhance the existing book import flow with enriched metadata and more reliable download sources.

## Impact

- **Backend**: `src-tauri/src/commands/anna_archive.rs` will be largely rewritten.
- **Frontend API**: `src/api/anna-archive.ts` will be updated to handle enriched search results and mirror options.
- **Frontend UI**: `src/components/import/AnnaArchiveSearch.tsx` and `src/api/anna-archive.ts` will be updated to display more metadata and handle the new search/download flow.
- **Platform**: Visibility gating in `src/components/documents/DocumentsView.tsx` will be relaxed once functionality is verified on other platforms.
