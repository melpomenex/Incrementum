## Why

Users often discover podcast episodes they want to process using Incremental Reading (IR) techniques. While the app has a dedicated Podcast section, there is no direct way to promote a specific episode into the main Incremental Reading queue (Scroll Mode / Optimal Queue) for prioritized consumption and FSRS-managed scheduling.

This change allows users to bridge the gap between media discovery and the IR system by allowing a "right-click to insert" workflow.

## What Changes

- **New Context Menu Item**: Add "Insert into Queue" to the podcast episode context menu.
- **Backend Promotion Logic**: Implement a command to convert/import a podcast episode as a first-class `Document` in the IR system.
- **FSRS Integration**: Episodes promoted to the queue will be managed by the FSRS document scheduler, allowing them to appear in Scroll Mode alongside PDFs, EPUBs, and RSS articles.
- **Metadata Persistence**: Ensure the title, audio URL, and cover image are correctly mapped to the new `Document` record.

## Capabilities

### New Capabilities
- `insert-podcast-to-queue`: Allows promoting a podcast episode into the incremental reading system as a document.

### Modified Capabilities
- None

## Impact

- **UI**: `PodcastManager.tsx` will have a new context menu option.
- **Backend**: `podcast.rs` or `document.rs` will have a new command `import_podcast_episode_as_document`.
- **Queue**: Promoted podcasts will appear in `get_queue` results.
