# Design: Video Extracts and Chapter Support

## Context
Incrementum is a cross-platform incremental reading and spaced-repetition desktop app. Currently, extracts (notes/snippets for review) only work with text-based content (PDFs, EPUBs, web pages). Video content lacks first-class support for creating timestamp-linked extracts that integrate with the review queue.

The system already has:
- Extract model for text content with FSRS scheduling
- Video bookmarks (timestamp only, no scheduling)
- Video chapters (manual entry only)
- Transcript support for YouTube videos
- MCP server for Assistant tools
- AI integration for content processing

## Goals / Non-Goals

### Goals
1. Enable users to create timestamp-linked extracts from videos for spaced repetition
2. Auto-detect chapters from YouTube metadata to help users navigate long videos
3. Provide an Assistant tool for AI-powered snippet extraction
4. Integrate video extracts into the existing review queue
5. Support both manual and AI-assisted chapter creation

### Non-Goals
1. Actual video clip extraction/export (we only store timestamp references)
2. Video editing capabilities
3. Multi-segment extracts (single contiguous range only)
4. Cross-device sync of extracts
5. Automatic chapter detection on all videos (cost/proformance concern)

## Decisions

### Decision 1: Separate VideoExtract Entity
Create a new `VideoExtract` entity rather than extending the existing `Extract` model.

**Rationale:**
- Video extracts have unique fields (start_time, end_time, duration, thumbnail)
- Text extracts don't need timestamp concepts
- Cleaner separation of concerns
- Allows video-specific behaviors without complicating text extract logic

**Data Model:**
```rust
pub struct VideoExtract {
    pub id: String,
    pub document_id: String,
    pub start_time: f64,        // seconds
    pub end_time: f64,          // seconds
    pub title: String,
    pub transcript_text: String, // Auto-populated from transcript
    pub notes: Option<String>,
    pub tags: Vec<String>,
    pub thumbnail_url: Option<String>,
    pub memory_state: Option<MemoryState>,
    pub next_review_date: Option<DateTime<Utc>>,
    pub review_count: i32,
    // ... scheduling fields similar to Extract
}
```

### Decision 2: Chapter Detection Strategy
Multi-tier approach for chapter detection:

1. **Primary**: YouTube metadata chapters (free, reliable when available)
2. **Secondary**: Manual chapter entry by user
3. **Tertiary**: AI-powered detection from transcript (on-demand, uses LLM)

**Rationale:**
- YouTube provides chapters natively - use them first
- Manual entry gives user control
- AI is expensive/slow, so make it opt-in
- Fallback chain ensures some chapter support always available

**API Flow:**
```
get_video_chapters(document_id)
  1. Check database for existing chapters
  2. If empty AND video is YouTube:
     - Fetch metadata via yt-dlp
     - Parse chapter markers
     - Save to database
  3. Return chapters (empty if none found)
```

### Decision 3: Assistant Tool Design
New MCP tool: `extract_video_snippet`

**Parameters:**
- `document_id` (required): Video document
- `description` (optional): Natural language description of segment
- `start_time` (optional): Manual timestamp override
- `end_time` (optional): Manual timestamp override
- `add_to_queue` (default: true): Whether to schedule for review
- `title` (optional): Custom title

**Behavior:**
- If description provided but no timestamps:
  - Search transcript for matching content
  - Use AI to find best matching segment
  - Auto-populate start/end times
- If timestamps provided manually:
  - Skip transcript search
  - Use provided times directly
- Create VideoExtract record
- If `add_to_queue`: Schedule for FSRS review

### Decision 4: Queue Integration
Video extracts appear as queue items with type "video-extract".

**Queue Item Structure:**
```typescript
interface VideoExtractQueueItem {
  id: string;
  document_id: string;
  video_extract_id: string;
  item_type: "video-extract";
  title: string;
  start_time: number;
  end_time: number;
  transcript_preview: string;  // First 200 chars
  thumbnail_url?: string;
  next_review_date: string;
  // ... standard queue fields
}
```

**Click Behavior:**
- Opens video player at `start_time`
- Optionally highlights segment in transcript panel
- Allows rating to schedule next review

### Decision 5: Database Schema
New table: `video_extracts`

```sql
CREATE TABLE video_extracts (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    start_time REAL NOT NULL,
    end_time REAL NOT NULL,
    title TEXT NOT NULL,
    transcript_text TEXT,
    notes TEXT,
    tags TEXT,  -- JSON array
    thumbnail_url TEXT,
    memory_state TEXT,  -- JSON: {stability, difficulty}
    next_review_date TEXT,
    last_review_date TEXT,
    review_count INTEGER DEFAULT 0,
    reps INTEGER DEFAULT 0,
    date_created TEXT NOT NULL,
    date_modified TEXT NOT NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX idx_video_extracts_document ON video_extracts(document_id);
CREATE INDEX idx_video_extracts_next_review ON video_extracts(next_review_date);
```

## Risks / Trade-offs

### Risk 1: Transcript Availability
**Risk**: YouTube videos may not have transcripts, especially for non-English content.

**Mitigation**:
- Allow video extracts without transcript text
- UI shows "No transcript available" instead of preview
- Manual notes become more important when transcript missing

### Risk 2: AI Chapter Detection Cost
**Risk**: Running LLM on every video for chapters would be expensive.

**Mitigation**:
- Make AI detection opt-in (user clicks "Auto-detect chapters")
- Cache results in database
- Use smaller/faster models for segmentation task
- Clear UI indicator that AI detection costs tokens

### Risk 3: Queue Bloat
**Risk**: Users might create many small extracts, cluttering the queue.

**Mitigation**:
- Add UI filter to show/hide video extracts
- Show video extracts grouped by parent document
- Minimum segment duration (30 seconds) enforced in UI

### Trade-off: Segment Duration Limit
**Decision**: Maximum 10 minutes per extract, warn at 5 minutes.

**Rationale**:
- Longer segments defeat the purpose of "snippets"
- But sometimes a complete thought takes 5+ minutes
- Hard limit prevents abuse (entire video as one extract)
- Warning guides better behavior without blocking

## Migration Plan

### Database Migration
```rust
// 025_add_video_extracts
sql: CREATE TABLE video_extracts (...);
sql: CREATE INDEX idx_video_extracts_document ON video_extracts(document_id);
sql: CREATE INDEX idx_video_extracts_next_review ON video_extracts(next_review_date);
```

### Backwards Compatibility
- Existing video bookmarks remain unchanged
- Existing chapters table unchanged
- New extracts are additive only

### Rollback
- Drop video_extracts table
- No impact on existing data (new table only)

## Open Questions

1. **Should video extracts support cloze deletions like text extracts?**
   - **Recommendation**: No for now, transcript timestamps make cloze complex
   - Could add later if users request it

2. **Should the UI show a video timeline thumbnail picker?**
   - **Recommendation**: Nice to have, defer to V2
   - Use timestamp input + chapter selection for V1

3. **How to handle videos that are re-imported with different duration?**
   - **Recommendation**: Clamp extracts to new duration, warn user
   - Extract end_time beyond new duration gets truncated

4. **Should extracts be exportable (e.g., as Anki cards with video embed)?**
   - **Recommendation**: Out of scope for V1
   - Consider for future if requested
