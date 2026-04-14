## 1. Database Migrations & Backend Foundation

- [x] 1.1 Add SQLite migration for `rss_classifiers` table (id, feed_id, classifier_type, value, sentiment, scope, created_at, updated_at)
- [x] 1.2 Add SQLite migration for `rss_folders` table (id, name, parent_id, icon, sort_order, created_at) — replaces localStorage folders
- [x] 1.3 Add SQLite migration for `rss_tags` table (id, name, created_at) and `rss_article_tags` junction table (article_id, tag_id)
- [x] 1.4 Add SQLite migration for `rss_annotations` table (id, article_id, type, content, start_offset, end_offset, color, created_at, updated_at)
- [x] 1.5 Add SQLite migration for `rss_story_clusters` table (id, canonical_article_id, article_id, similarity_score, cluster_type, created_at)
- [x] 1.6 Add SQLite migration for `rss_discovered_sites` table (id, url, title, description, feed_url, similarity_source, discovered_at)
- [x] 1.7 Add `intelligence_score` and `intelligence_score_computed_at` columns to `rss_articles` table
- [x] 1.8 Add `view_mode` and `layout` columns to `rss_feeds` table (per-feed view mode and layout preferences)
- [x] 1.9 Add `parent_id`, `icon`, and `sort_order` columns to support folder migration
- [x] 1.10 Create FTS5 virtual table `rss_articles_fts` on (title, content, author) with content-sync triggers

## 2. Rust Backend — Classifier & Intelligence Commands

- [x] 2.1 Implement `add_rss_classifier` Tauri command + HTTP endpoint
- [x] 2.2 Implement `remove_rss_classifier` command
- [x] 2.3 Implement `get_rss_classifiers` command with filters (feed_id, folder_id, classifier_type, sentiment)
- [x] 2.4 Implement `update_rss_classifiers_batch` command for bulk save from Manage Training view
- [x] 2.5 Implement `compute_intelligence_score` function: evaluate all applicable classifiers against an article (feed, folder, global scopes)
- [x] 2.6 Add intelligence score caching: store computed score in `rss_articles.intelligence_score` with timestamp
- [x] 2.7 Add classifier invalidation trigger: when classifiers change, mark affected articles for score recompute
- [x] 2.8 Extend `get_rss_articles` to accept `intelligence_filter` parameter (focus/neutral/all, include_hidden)

## 3. Rust Backend — Reading State Commands

- [x] 3.1 Implement `mark_rss_article_unread` command (set is_read = false, record timestamp)
- [x] 3.2 Implement `mark_rss_articles_before_date_read` command (cutoff-based marking)
- [x] 3.3 Implement `mark_rss_articles_after_date_read` command
- [x] 3.4 Add `auto_mark_after_days` column to `rss_feeds` table
- [x] 3.5 Add `auto_mark_after_days` column to `rss_folders` table with inheritance logic
- [x] 3.6 Implement auto-mark-as-read logic in feed refresh cycle (check per-feed setting, apply to articles exceeding threshold)
- [x] 3.7 Implement `get_read_rss_articles` command for Read Stories view (paginated, sorted by read timestamp)

## 4. Rust Backend — Search & Clustering Commands

- [x] 4.1 Implement `search_rss_articles` command using FTS5: query, optional feed_id/folder_id scope, ranked results with snippet highlighting
- [x] 4.2 Implement trigram similarity function in Rust for title comparison
- [x] 4.3 Implement `compute_story_clusters` function: compare articles within ±2 day window, group duplicates (>0.85) and related (>0.6)
- [x] 4.4 Implement `get_rss_article_clusters` command with feed_id/folder_id filtering
- [x] 4.5 Implement cluster invalidation on feed refresh

## 5. Rust Backend — Tags, Annotations & Discovery Commands

- [x] 5.1 Implement `add_tag` and `remove_tag` commands
- [x] 5.2 Implement `get_article_tags` and `get_articles_by_tag` commands
- [x] 5.3 Implement `rename_tag` and `merge_tags` commands
- [x] 5.4 Implement `create_annotation` command (highlight and note types)
- [x] 5.5 Implement `get_article_annotations` command
- [x] 5.6 Implement `update_annotation` and `delete_annotation` commands
- [x] 5.7 Implement `discover_feeds_from_links` background task: extract domains from recent articles, attempt RSS auto-discovery
- [x] 5.8 Implement `get_discovered_sites` command (paginated, filter already-subscribed)
- [x] 5.9 Implement `refresh_discoveries` command

## 6. Rust Backend — Folder & Feed Management Commands

- [x] 6.1 Implement `create_rss_folder` command with parent_id support
- [x] 6.2 Implement `update_rss_folder` command (rename, move parent, set icon, update sort_order)
- [x] 6.3 Implement `delete_rss_folder` command (cascade or move feeds)
- [x] 6.4 Implement `get_rss_folders` command returning nested tree structure
- [x] 6.5 Implement `move_rss_feed_to_folder` command
- [x] 6.6 Implement `reorder_feeds` and `reorder_folders` commands (update sort_order for multiple items)
- [x] 6.7 Implement `toggle_feed_active` command (disable/enable without unsubscribing)
- [x] 6.8 Implement `get_feed_statistics` command (article count, frequency, last fetch, etc.)
- [x] 6.9 Implement folder migration: one-time script to move localStorage folders to SQLite `rss_folders` table

## 7. HTTP API — Mirror New Commands

- [x] 7.1 Add HTTP endpoints for all classifier commands (POST/GET/DELETE /api/rss/classifiers/*)
- [x] 7.2 Add HTTP endpoints for reading state commands (mark unread, cutoff marking)
- [x] 7.3 Add HTTP endpoints for search (/api/rss/search)
- [x] 7.4 Add HTTP endpoints for clustering (/api/rss/clusters)
- [x] 7.5 Add HTTP endpoints for tags (/api/rss/tags/*)
- [x] 7.6 Add HTTP endpoints for annotations (/api/rss/annotations/*)
- [x] 7.7 Add HTTP endpoints for folder management (/api/rss/folders/*)
- [x] 7.8 Add HTTP endpoints for discovery (/api/rss/discover/*)

## 8. Frontend — Intelligence Training UI

- [x] 8.1 Create `src/stores/classifiersStore.ts` Zustand store for classifier state management
- [x] 8.2 Create `src/api/rss-classifiers.ts` with Auto functions for classifier CRUD
- [x] 8.3 Create `IntelligenceIndicator` component: three-color dot/badge on story items (green/neutral/red)
- [x] 8.4 Create `TrainingMenu` component: context menu on articles for like/dislike author, tag, title keyword
- [x] 8.5 Create `ManageTrainingView` component: consolidated view of all classifiers grouped by folder, with filter/search/inline-edit/bulk-save
- [x] 8.6 Create `SiteBySiteTraining` component: walkthrough mode stepping through feeds with trainable highlights
- [x] 8.7 Add focus-only filter toggle to RSSReader filter controls
- [x] 8.8 Add "Show/Hide disliked stories" toggle to filter controls
- [x] 8.9 Add classifier color highlighting on matched title keywords and tags in article list

## 9. Frontend — Multiple Story Views

- [x] 9.1 Create `StoryViewModeSwitcher` component: toolbar buttons/dropdown for Feed/Original/Text/Story modes
- [x] 9.2 Implement `OriginalView` component: iframe embed of source URL with CSP fallback to "Open in browser"
- [x] 9.3 Enhance `RSSFullContentView` as `TextView`: improve text extraction, add clean formatting, preserve headings/paragraphs
- [x] 9.4 Implement `StoryView` component: single-article focused reading with minimal chrome, next/prev navigation
- [x] 9.5 Update `RSSReader` to conditionally render the selected view mode in the reader panel
- [x] 9.6 Add Shift+Enter temporary Text view activation (keyboard shortcut)
- [x] 9.7 Add per-feed view mode preference to FeedSettingsDialog

## 10. Frontend — Keyboard Navigation System

- [x] 10.1 Create `src/stores/keyboardShortcutsStore.ts` with default bindings and user customization
- [x] 10.2 Create `KeyboardShortcutProvider` component: document-level keydown listener with action dispatch
- [x] 10.3 Create `KeyboardHelpOverlay` component: `?` modal showing all shortcuts organized by category
- [x] 10.4 Register RSSReader context actions: feed nav (j/k), article nav (n/p), mark read (m), star (s), open original (o), search (/), train (+/-), view mode toggle
- [x] 10.5 Create `KeyboardShortcutPreferences` component in settings: edit bindings, conflict detection, reset to defaults
- [x] 10.6 Persist custom shortcuts in rss_user_preferences table

## 11. Frontend — Advanced Reading State UI

- [x] 11.1 Add "Mark as unread" option to article context menu and keyboard shortcut
- [x] 11.2 Add "Mark older than..." and "Mark newer than..." options to feed/folder context menus with duration picker
- [x] 11.3 Add "Auto-mark as read after" setting to FeedSettingsDialog (dropdown: never, 1/3/7/14/30/90/365 days)
- [x] 11.4 Add folder-level auto-mark-as-read setting to folder context menu with inheritance indicator
- [x] 11.5 Implement `RiverOfNewsView` mode: merged chronological stream from all feeds in a folder
- [x] 11.6 Add "Read Stories" filter option to RSSReader view modes
- [x] 11.7 Create `ReadStoriesView` component: browse previously read articles with pagination

## 12. Frontend — Nested Folders & Feed Management UI

- [x] 12.1 Create `FolderTree` component: recursive sidebar rendering with expand/collapse, drag-and-drop
- [x] 12.2 Create `FolderContextMenu` component: new subfolder, rename, move, delete, set icon, auto-mark timing, statistics
- [x] 12.3 Implement drag-and-drop for feeds between folders and folders between parents (using existing DnD library or native HTML5 DnD)
- [x] 12.4 Create `IconPicker` component: emoji grid + image upload for folder/feed icons
- [x] 12.5 Implement favicon auto-detection on feed subscribe (fetch /favicon.ico and <link rel="icon">)
- [x] 12.6 Create `FeedStatisticsDialog` component: display article count, frequency, last fetch, subscribed date, unread count
- [x] 12.7 Add "Disable/Enable feed" option to feed context menu
- [x] 12.8 Create `DisabledFeedsView` component: list disabled feeds with enable action
- [x] 12.9 Migrate localStorage folders to SQLite on first launch after update

## 13. Frontend — Saved Story Tags UI

- [x] 13.1 Create `src/stores/tagsStore.ts` Zustand store for tag state management
- [x] 13.2 Create `src/api/rss-tags.ts` with Auto functions for tag CRUD
- [x] 13.3 Create `TagInput` component: autocomplete input with pill display for adding/removing tags
- [x] 13.4 Integrate `TagInput` into the star/save flow and article context menu
- [x] 13.5 Add tag sidebar to saved stories view: list of all tags with counts, click to filter
- [x] 13.6 Implement multi-tag filtering (AND logic) in saved stories view
- [x] 13.7 Create `TagManagementView` component: rename and merge tags
- [x] 13.8 Display tags as virtual feeds in the sidebar

## 14. Frontend — Full-Text Search UI

- [x] 14.1 Create `src/api/rss-search.ts` with Auto functions for search
- [x] 14.2 Enhance existing search input in RSSReader to use FTS5 backend search
- [x] 14.3 Create `SearchResults` component: ranked results with highlighted snippets, source feed, date
- [x] 14.4 Add search scope indicator (All Feeds / Current Feed / Current Folder / Saved Stories)
- [x] 14.5 Implement debounced search-as-you-type with cancel-on-new-query

## 15. Frontend — Story Annotations UI

- [x] 15.1 Create `src/stores/annotationsStore.ts` Zustand store
- [x] 15.2 Create `src/api/rss-annotations.ts` with Auto functions
- [x] 15.3 Implement text selection capture: detect selection, show "Highlight" action in context menu or floating toolbar
- [x] 15.4 Create `HighlightRenderer`: apply highlight colors to text ranges in the reader panel
- [x] 15.5 Create `AnnotationsPanel` component: sidebar panel listing all highlights (with color) and notes for current article
- [x] 15.6 Create `NoteEditor` component: inline text input for adding/editing/deleting notes on articles
- [x] 15.7 Create `ShareWithComment` component: share dialog with optional comment input
- [x] 15.8 Create `SharedStoriesView` component: view all shared stories with comments

## 16. Frontend — Article Layouts UI

- [x] 16.1 Implement `MagazineLayout` component: 2-column masonry grid with large cards, thumbnails, excerpts
- [x] 16.2 Implement `GridLayout` component: 3-4 column uniform grid with thumbnail cards
- [x] 16.3 Add column count slider (1-6) to RSSCustomizationPanel
- [x] 16.4 Add card height presets (compact/normal/tall) to RSSCustomizationPanel
- [x] 16.5 Add per-feed layout preference to FeedSettingsDialog
- [x] 16.6 Add thumbnail display options (show/hide, position, size) to customization panel
- [x] 16.7 Implement smooth CSS transition animations for layout switching
- [x] 16.8 Update RSSReader article list to render using the selected layout component

## 17. Frontend — Story Clustering UI

- [x] 17.1 Create `src/api/rss-clusters.ts` with Auto functions
- [x] 17.2 Create `ClusterPill` component: "Duplicate" or "Related" badge on clustered articles
- [x] 17.3 Implement duplicate cluster collapse/expand in the story list
- [x] 17.4 Create `RelatedStoriesPanel` component: slide-out panel showing related articles when clicking "Related" pill

## 18. Frontend — Site Discovery UI

- [x] 18.1 Create `src/api/rss-discovery.ts` with Auto functions
- [x] 18.2 Create `DiscoverSitesPanel` component: infinite-scroll grid of discovered sites with subscribe buttons
- [x] 18.3 Create `DiscoverSiteCard` component: site title, description, 5 recent headlines, subscribe/action buttons
- [x] 18.4 Create `SiteStatisticsDialog` component: frequency, article count, category overlap
- [x] 18.5 Add "Discover" entry point to the RSS sidebar or toolbar
- [x] 18.6 Add "Refresh Discoveries" button with progress indicator

## 19. Integration & Polish

- [x] 19.1 Wire all new API functions through the Auto pattern (Tauri IPC → HTTP → localStorage fallback)
- [x] 19.2 Update `src/lib/browser-backend.ts` to register all new HTTP endpoints
- [x] 19.3 Remove or replace the old `RssTab.tsx` placeholder with a redirect to RSSReader
- [x] 19.4 Update OPML import/export to include new metadata (folders hierarchy, feed icons, per-feed view/layout preferences)
- [x] 19.5 Performance test: verify FTS5 search returns within 500ms on 100K articles
- [x] 19.6 Performance test: verify intelligence score computation doesn't block article loading (>100 classifiers)
- [x] 19.7 Add loading skeletons and error states for all new components
- [x] 19.8 Verify all new features work in browser (Axum HTTP) mode, not just Tauri desktop mode
