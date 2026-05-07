# Spec: AI Chat Integration with Podcast Transcripts

## Goal
Allow users to chat with the AI assistant about a podcast episode's content after transcription.

## Flow
1. User clicks "Chat About This" on a transcribed episode
2. System creates a temporary document entry containing the transcript
3. Assistant panel opens with that document as context
4. User can ask questions, summarize, extract key points, etc.
5. Document is linked back to the podcast episode for traceability

## Implementation

### Document Creation
- When "Chat About This" is clicked, check if a document already exists for this episode's transcript
- If not, create a document:
  - `title`: Episode title + " (Transcript)"
  - `file_type`: "transcript"
  - `content`: full transcript text
  - `metadata.source_type`: "podcast"
  - `metadata.source_episode_id`: episode_id
  - `metadata.source_feed_id`: feed_id
  - `tags`: ["podcast", "transcript", feed_title]
- Store the document in SQLite via existing document commands
- Reuse the document on subsequent "Chat About This" clicks (look up by `metadata.source_episode_id`)

### Assistant Integration
- Open the Assistant panel (existing `AssistantPanel.tsx` component)
- Pass the transcript document as context
- Pre-fill a suggested prompt: "Summarize the key points of this podcast episode."

### Extract Generation (from transcript)
- After transcription completes, optionally generate extracts:
  - Key quotes / notable segments
  - Topic boundaries (use Whisper word timestamps + silence detection)
  - Summary extract (first 500 chars as overview)
- Each extract links back to the parent podcast episode
- Extracts flow into the FSRS review queue like any other extract

### Document QA
- The transcript document works with existing DocumentQATab
- Vector embeddings allow semantic search over transcript content
- "Find the part where they discuss X" type queries work naturally
