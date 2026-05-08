## 1. Backend Implementation

- [x] 1.1 Implement `import_podcast_episode_as_document` command in `src-tauri/src/commands/podcast.rs`
- [x] 1.2 Add check for existing documents by file path to prevent duplicate imports
- [x] 1.3 Register the new command in `src-tauri/src/lib.rs`

## 2. API Integration

- [x] 2.1 Add `importPodcastEpisodeAsDocument` to `src/api/podcast.ts`
- [x] 2.2 Verify API types match the backend implementation

## 3. UI Integration

- [x] 3.1 Add "Insert into Queue" option to `handleEpisodeContextMenu` in `src/components/media/PodcastManager.tsx`
- [x] 3.2 Implement the click handler to call the new API and show a success toast
- [x] 3.3 Add internationalization strings for the new menu item

## 4. Verification

- [x] 4.1 Verify that right-clicking a podcast episode shows the new menu item
- [x] 4.2 Verify that clicking the menu item creates a new document visible in the Documents page
- [x] 4.3 Verify that the new document appears in Scroll Mode and is playable
