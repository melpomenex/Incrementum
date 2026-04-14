## Why

Incrementum's RSS reader (RSSReader + RSSScrollMode) provides solid feed management and article reading, but lacks the advanced curation, social, and discovery features that make power-user RSS readers like NewsBlur indispensable. Adding NewsBlur-inspired intelligence training, multiple story views, story clustering, keyboard-first navigation, and richer reading state management will transform Incrementum from a basic feed reader into a sophisticated information management tool that adapts to each user's reading habits.

## What Changes

### Intelligence Training System ("Brains")
- Per-feed classifier training on authors, tags, title keywords, and feeds themselves
- Three-tier classification: focus (green), neutral, disliked (red) with "green always wins" priority
- Intelligence score per story computed from all active classifiers
- Focus-only and show/hide hidden story filters
- "Site by Site" training walkthrough: step through each feed viewing trainable suggestions
- Consolidated "Manage Training" view with filtering, inline editing, and bulk save

### Multiple Story Views
- **Feed view**: Plain RSS feed content (current default behavior)
- **Original view**: Render the original source site inline (iframe/embedded browser)
- **Text view**: Extracted full article text with clean formatting (upgrade to current full-content fetch)
- **Story view**: Individual blog posts from the original site, one at a time

### Story Clustering & Discovery
- Duplicate/near-duplicate detection: group stories with similar titles across feeds
- "Discover Sites": show related/similar sites based on current subscriptions with sample stories
- "Discover Stories": find related stories from same site, similar sites, or all subscriptions

### Advanced Reading State
- Mark stories as unread (not just read)
- Cutoff-based marking: mark stories older/newer than a timestamp as read
- Auto-mark-as-read with configurable per-feed and per-folder timing (1 day to 365 days, or never)
- "River of News" mode: read all feeds in a folder as one chronological stream
- Read Stories view: browse previously read articles

### Keyboard-First Navigation
- Comprehensive keyboard shortcut system (feed navigation, story scrolling, marking, saving, training, view switching, search)
- Press `?` to display shortcut reference overlay
- Customizable keyboard shortcuts via preferences

### Enhanced Feed Management
- Nested folders (folders within folders)
- Feed icons (favicon auto-detection + custom icon upload)
- Disable feeds without unsubscribing
- Per-feed view mode and layout preferences
- Feed statistics: publish frequency, story count, last fetch time
- Reorder feeds and folders with drag-and-drop

### Saved Stories with Tags
- Tag-based bookmarking system for saved/favorited stories
- Filter saved stories by tag, search query, and highlights
- Each tag view acts as a virtual feed

### Full-Text Search
- Search across all subscriptions, within a single feed, within a folder, or saved stories
- Search in title, content, and author fields

### Richer Article Actions
- Share story with optional comment (local note)
- Text highlight and annotation on saved stories
- Story notes (private notes attached to articles)
- Track Changes: see how a story evolved since first publication (diff view)

### Additional Layouts
- Magazine view: visual card-based layout with larger previews
- Grid view: thumbnail-heavy grid
- Per-feed configurable layout with column count and card height controls

## Capabilities

### New Capabilities
- `intelligence-training`: Per-feed classifier training system with author/tag/title/feed classifiers, focus/neutral/dislike tiers, intelligence scoring, and training management views
- `story-views`: Multiple story rendering modes (Feed, Original, Text, Story) selectable per-feed or globally
- `story-clustering`: Duplicate detection, story grouping by topic, and related story discovery across feeds
- `site-discovery`: Discover related/similar sites based on subscriptions with browse-and-subscribe UX
- `keyboard-navigation`: Comprehensive keyboard shortcut system with `?` help overlay and customizable bindings
- `advanced-reading-state`: Mark as unread, cutoff-based marking, auto-mark-as-read timing, River of News mode, read stories view
- `nested-folders`: Hierarchical folder organization with nested folders, drag-and-drop reordering, feed icons
- `saved-story-tags`: Tag-based bookmarking system for saved stories with tag filtering and virtual tag feeds
- `full-text-search`: Search across all feeds, single feed, folder, or saved stories with full-text matching
- `story-annotations`: Text highlighting, private notes, and share-with-comment on articles
- `article-layouts`: Magazine and grid view layouts with per-feed configurable column count and card sizing

### Modified Capabilities
<!-- No existing RSS-related specs to modify -->

## Impact

- **Frontend**: Major additions to `src/components/media/` (new components for each feature), `src/api/rss.ts` (new API functions), `src/stores/` (new stores for classifiers, annotations, tags), `src/components/tabs/RssTab.tsx` (may be fully replaced or removed)
- **Backend (Rust/Tauri)**: New SQLite tables for classifiers, tags, annotations, story clusters, keyboard shortcuts; new Tauri commands for training, clustering, search, discovery
- **Database**: New migrations for classifier tables, annotation tables, tag tables, reading state tracking (unread timestamps, auto-mark timers)
- **Dependencies**: May need a Rust full-text search crate (e.g., `tantivy` or SQLite FTS5), fuzzy matching for title clustering
- **Browser backend**: New HTTP API endpoints mirroring all new Tauri commands
