# Implementation Tasks

## Task 1: Database Migration
Create the video_extracts table.

**Steps:**
1. Add migration `025_add_video_extracts` to `src-tauri/src/database/migrations.rs`
2. Create video_extracts table with all required fields
3. Create indexes on document_id and next_review_date
4. Test migration on fresh database
5. Test migration on existing database

**Validation:**
- Migration applies successfully
- Table structure matches design
- Indexes are created correctly

**Dependencies:** None

---

## Task 2: VideoExtract Model
Create the VideoExtract struct and basic operations.

**Steps:**
1. Create `src-tauri/src/models/video_extract.rs`
2. Define VideoExtract struct with all fields
3. Implement VideoExtract::new() constructor
4. Add helper methods (duration, is_valid, etc.)
5. Export from models mod.rs

**Validation:**
- Model compiles without errors
- Constructor creates valid instances
- Duration calculation works correctly

**Dependencies:** Task 1

---

## Task 3: Repository Layer - Video Extracts
Add CRUD operations for video extracts.

**Steps:**
1. Add `create_video_extract()` to `src-tauri/src/database/repository.rs`
2. Add `get_video_extract()` by ID
3. Add `get_video_extracts_by_document()` for listing
4. Add `update_video_extract()` for editing
5. Add `delete_video_extract()` for removal
6. Add `get_due_video_extracts()` for queue
7. Add video extract scheduling methods (similar to extracts)

**Validation:**
- Can create, read, update, delete extracts
- Due extracts query returns correct results
- Scheduling methods integrate with FSRS

**Dependencies:** Task 1, Task 2

---

## Task 4: Tauri Commands - Video Extracts
Expose video extract operations to frontend.

**Steps:**
1. Add commands to `src-tauri/src/commands/video.rs` (or new file)
2. `create_video_extract(document_id, start_time, end_time, title, notes, tags)`
3. `get_video_extracts(document_id)`
4. `update_video_extract(extract_id, ...)`
5. `delete_video_extract(extract_id)`
6. `rate_video_extract(extract_id, rating)` for FSRS
7. Register commands in main.rs

**Validation:**
- Commands are callable from frontend
- Error handling works correctly
- Input validation (timestamps non-negative, end > start)

**Dependencies:** Task 3

---

## Task 5: YouTube Chapter Detection
Implement auto-detection of chapters from YouTube metadata.

**Steps:**
1. Extend `src-tauri/src/youtube.rs` with chapter parsing
2. Parse chapters from yt-dlp JSON output (chapters field)
3. Add `set_youtube_chapters()` command
4. Modify `get_video_chapters()` to auto-fetch from YouTube if empty
5. Handle various chapter formats (time-based, manual)

**Validation:**
- Chapters are detected from YouTube videos
- Manual chapters aren't overwritten
- Missing chapters on non-YouTube videos handled gracefully

**Dependencies:** None (uses existing youtube.rs)

---

## Task 6: AI Chapter Detection (Optional)
Add LLM-powered chapter detection from transcripts.

**Steps:**
1. Create `src-tauri/src/ai/chapter_detector.rs`
2. Implement transcript segmentation using LLM
3. Add prompt for detecting topic shifts
4. Add `auto_detect_chapters(document_id)` command
5. Cache results in chapters table

**Validation:**
- LLM returns valid chapter boundaries
- Chapters are saved to database
- Error handling for missing transcripts

**Dependencies:** Existing AI integration

---

## Task 7: MCP Tool - extract_video_snippet
Add Assistant tool for extracting video snippets.

**Steps:**
1. Register `extract_video_snippet` tool in `src-tauri/src/mcp/tools.rs`
2. Implement tool execution handler
3. Add transcript search logic (find text matching description)
4. Integrate with AI for semantic matching if description provided
5. Create VideoExtract record
6. Optionally add to queue based on parameter

**Validation:**
- Tool is discoverable via MCP tools/list
- Creates valid video extracts
- Transcript search finds relevant segments
- Queue integration works

**Dependencies:** Task 3, Task 4

---

## Task 8: Frontend API Layer
Create TypeScript functions for video extracts.

**Steps:**
1. Create `src/api/videoExtracts.ts`
2. Add `createVideoExtract()` function
3. Add `getVideoExtracts()` function
4. Add `updateVideoExtract()` function
5. Add `deleteVideoExtract()` function
6. Add `rateVideoExtract()` function
7. Add `autoDetectChapters()` function
8. Add proper TypeScript types

**Validation:**
- Functions compile without errors
- Proper error handling
- Types match backend structures

**Dependencies:** Task 4, Task 5

---

## Task 9: Video Extract Creation UI
Add UI for creating video extracts.

**Steps:**
1. Create `src/components/video/VideoExtractCreator.tsx`
2. Add timestamp range picker (start/end)
3. Add title and notes inputs
4. Show transcript preview for selected range
5. Add tag input
6. Add "Create Extract" button
7. Integrate into video player (YouTubeViewer, LocalVideoPlayer)

**Validation:**
- UI renders correctly
- Timestamp inputs validate correctly
- Transcript preview updates when range changes
- Extract creation works end-to-end

**Dependencies:** Task 8

---

## Task 10: Video Extract List View
Add UI for viewing video extracts.

**Steps:**
1. Create `src/components/video/VideoExtractList.tsx`
2. Display extracts with title, timestamp, preview
3. Add edit/delete actions
4. Add click to play video at timestamp
5. Add rating buttons for review
6. Integrate into document view

**Validation:**
- List displays all extracts for document
- Edit/delete actions work
- Clicking opens video at correct position
- Rating updates schedule correctly

**Dependencies:** Task 8

---

## Task 11: Queue Integration for Video Extracts
Add video extracts to the review queue.

**Steps:**
1. Extend `src-tauri/src/models/queue.rs` to support video-extract type
2. Update `get_queue_items` repository method
3. Update `QueuePage.tsx` to display video extracts
4. Add video extract item component
5. Handle click to open video player
6. Add rating controls for FSRS

**Validation:**
- Video extracts appear in queue
- Clicking opens video at correct timestamp
- Rating buttons work
- Scheduling updates correctly

**Dependencies:** Task 3, Task 10

---

## Task 12: Chapter UI Display and Management
Add UI for viewing and managing chapters.

**Steps:**
1. Update `VideoFeatures.tsx` chapters view
2. Show auto-detected chapters from YouTube
3. Add "Auto-detect from AI" button (optional)
4. Add manual chapter creation dialog
5. Allow editing chapter titles and times
6. Add delete chapter action

**Validation:**
- YouTube chapters display automatically
- Manual chapters can be added/edited
- AI detection button triggers tool
- Chapter changes persist to database

**Dependencies:** Task 5, Task 6, Task 8

---

## Task 13: Document List - Extract Count Indicator
Show video extract count in document list.

**Steps:**
1. Update document list query to include extract count
2. Add extract count badge to document items
3. Differentiate between text and video extracts
4. Update `DocumentsView.tsx`

**Validation:**
- Extract count displays correctly
- Badge only shows when extracts exist
- Count updates after creating extracts

**Dependencies:** Task 3

---

## Task 14: Testing and Bug Fixes
End-to-end testing and fixes.

**Steps:**
1. Manual testing: Create extract, verify it appears in queue
2. Test YouTube chapter auto-detection
3. Test AI chapter detection (if available)
4. Test Assistant tool via MCP
5. Test FSRS scheduling for video extracts
6. Test edge cases (missing transcript, invalid timestamps)
7. Fix any discovered bugs

**Validation:**
- All scenarios from spec work correctly
- No database errors
- Smooth user experience
- Assistant tool works via MCP

**Dependencies:** All previous tasks

---

## Optional: Enhancement Tasks

### Task 15: Thumbnail Generation
Generate thumbnails for video extracts.

**Dependencies:** Video frame capture capability

### Task 16: Export to Anki
Export video extracts as Anki cards with video embed.

**Dependencies:** Anki integration

### Task 17: Batch Extract Creation
Create multiple extracts from chapters at once.

**Dependencies:** Chapter detection

## Parallel Work Opportunities

The following tasks can be done in parallel:
- **Tasks 1, 2, 3** (Backend data layer) - sequential
- **Task 4** (Commands) - parallel with Task 8
- **Task 5** (YouTube chapters) - independent
- **Task 6** (AI chapters) - independent
- **Task 8** (Frontend API) - can be done in parallel with Tasks 1-4 using mocked responses
- **Tasks 9, 10, 11, 12** (Frontend UI) - can be done in parallel after Task 8

## Critical Path

The minimum path to a working feature:
1. Task 1 → Task 2 → Task 3 → Task 4 → Task 8 (Backend + API)
2. Task 9 + Task 10 (UI creation + listing) - parallel after Task 8
3. Task 11 (Queue integration) - after Task 10

MVP could skip:
- Task 6 (AI chapters) - do later
- Task 12 (Chapter management UI) - use existing
- Task 13 (List indicator) - nice to have
