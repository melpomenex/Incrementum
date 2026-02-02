# Proposal: Video Extracts and Chapter Support

## Change ID
`add-video-extracts`

## Summary
Add the ability to create timestamp-linked extracts (snippets) from videos, supporting YouTube-style chapter detection, and provide an Assistant tool to extract snippets that integrate with the incremental review queue.

## Problem Statement
Incrementum currently supports text-based extracts from PDFs and documents, but lacks equivalent functionality for video content. Users cannot:

1. **Extract meaningful segments** from videos for later review (like YouTube "Chapters" but for learning)
2. **Link extracts to specific timestamps** - no way to say "this extract refers to 5:30-7:15 of the video"
3. **Auto-detect chapters** from video metadata or transcripts to break long videos into digestible segments
4. **Use the Assistant to extract snippets** - AI can identify key moments and queue them for review

### Current State
- Extracts exist but are text-only (`src-tauri/src/models/extract.rs`)
- Video bookmarks exist (`src-tauri/src/commands/video.rs`) but lack queue integration
- Chapters table exists but is manual-entry only
- Transcript segments exist but aren't leveraged for chapter detection
- MCP tools support document/extract creation but no video snippet extraction

### Impact
- Video content is second-class in the incremental reading system
- Users must manually note timestamps of important video segments
- Cannot leverage AI to identify and extract key video moments
- Long videos (lectures, tutorials) are harder to digest incrementally

## Proposed Solution

### 1. Video Extracts (New Entity)
Create a new `VideoExtract` model that extends the bookmark concept with:
- Timestamp range (start_time, end_time) for the segment
- Transcript text auto-populated from transcript segments
- User notes and highlights
- FSRS scheduling for spaced repetition review
- Queue integration

### 2. Chapter Detection and Management
- Auto-detect chapters from YouTube video metadata (available via yt-dlp)
- Allow manual chapter creation/override
- Optional AI-powered chapter detection from transcripts (LLM analyzes topic shifts)
- Display chapters in video player for navigation

### 3. Assistant MCP Tool
Add `extract_video_snippet` tool that:
- Takes a document_id and optional description
- Uses transcript + optional AI analysis to find relevant segment
- Creates a VideoExtract with scheduling
- Adds to review queue

### 4. Queue Integration
Video extracts appear in the queue alongside documents and text extracts:
- Shows timestamp range and preview text
- Clicking opens video player at that timestamp
- Can be rated for FSRS scheduling

## Scope

### In Scope
- New `VideoExtract` database table and model
- Database migration for video_extracts table
- Backend API for CRUD operations on video extracts
- Chapter auto-detection from YouTube metadata
- Manual chapter creation UI
- MCP tool `extract_video_snippet` for Assistant
- Queue integration for video extracts
- Frontend UI for creating/viewing video extracts
- Optional AI chapter detection (uses existing AI integration)

### Out of Scope
- Video clip actual extraction/export (we only store references)
- Video editing capabilities
- Multi-segment extracts (single contiguous segment only)
- Syncing extracts across devices

## Success Criteria
1. User can select a time range in a video and create an extract
2. Extract appears in queue with transcript preview
3. Clicking queue item opens video at the correct timestamp
4. Assistant can extract a snippet by describing content
5. Chapters auto-populate from YouTube metadata when available
6. Chapters can be manually created/edited
7. Extracts follow FSRS scheduling like other content

## Alternatives Considered

### Alternative 1: Extend Existing Extract Model
**Rejected**: Adding timestamp fields to the generic Extract model would complicate the model for text-only extracts. A separate VideoExtract entity keeps concerns separate and allows video-specific fields (duration, end_time, thumbnail).

### Alternative 2: Use Bookmarks with Notes
**Rejected**: Existing bookmarks don't have scheduling or queue integration. Video extracts need to be first-class citizens in the review system with FSRS scheduling.

### Alternative 3: Queue Only (No Entity)
**Rejected**: Without persistent storage, extracts would only exist in the queue. Users need to be able to view, edit, and manage their video extracts outside the queue context.

## Dependencies
- Existing: YouTube transcript fetch (`src-tauri/src/youtube.rs`)
- Existing: Video chapters table (manual entry only)
- Existing: MCP tool infrastructure (`src-tauri/src/mcp/`)
- Existing: FSRS scheduling algorithms
- Existing: AI integration for optional chapter detection

## Related Changes
- Builds on `add-video-progress-tracking` for timestamp handling
- Complements `incremental-reading-extracts` spec for video content
- Extends MCP tool registry for Assistant capabilities

## Open Questions
1. **Segment duration limits**: Should there be a maximum duration for a video extract (e.g., 5 minutes)? **Decision: 10 minute max, warn beyond 5 min**
2. **Chapter granularity**: For AI chapter detection, target chapter length? **Decision: 5-10 minutes ideal, configurable**
3. **Transcript fallback**: What if transcript is unavailable? **Decision: Allow extract creation with timestamp only, no text preview**
4. **AI chapter detection**: Should this run automatically or on-demand? **Decision: On-demand via UI button or Assistant tool to save API costs**
