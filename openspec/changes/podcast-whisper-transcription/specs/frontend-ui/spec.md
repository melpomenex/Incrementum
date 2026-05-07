# Spec: Frontend UI — Transcription in Podcast Manager

## Episode Card Changes

### Before transcription
- Add a "Transcribe" button (FileAudio icon) next to existing Play button
- Button opens a small dropdown/popover: "Transcribe with Whisper"
- Shows model selector (from installed Whisper models) and language hint input
- Clicking "Start Transcription" kicks off the process

### During transcription (status = 'downloading' | 'transcribing')
- Replace transcribe button with a progress indicator:
  - Thin progress bar under the episode title
  - Status text: "Downloading audio..." or "Transcribing... 45%"
  - Cancel button (X) to abort
- Listen to Tauri events: `podcast://transcription-progress`
- Disable Play button while transcribing

### After transcription (status = 'done')
- Replace transcribe button with "View Transcript" button (FileText icon)
- Clicking opens a transcript panel (slide-in from right or modal)
- Show "Chat About This" button (MessageSquare icon) that opens Assistant with transcript as context

### On error (status = 'error')
- Show "Transcription Failed" text with error message tooltip
- "Retry" button to re-attempt

## Transcript Viewer Panel

Slide-in panel (right side, ~400px wide):
- Full transcript text with timestamps
- Speaker diarization markers (if available from Whisper)
- Search/filter text
- Copy full transcript button
- "Chat About This" button at top

## Feed Settings — Auto-Transcribe

In feed context menu (or feed settings panel):
- Toggle "Auto-transcribe new episodes"
- Language selector
- When a new episode is fetched via refresh, check if auto-transcribe is on
  - If yes, automatically start transcription for unplayed episodes without a transcript

## Feed-level language default
- Store per-feed language preference for Whisper
- Used as default when user clicks "Transcribe" on any episode in that feed

## Progress Event Handling

```ts
// In PodcastManager.tsx or a custom hook
const unlisten = await listen<{ episodeId: string; status: string; progress: number; message?: string }>(
  'podcast://transcription-progress',
  (event) => {
    // Update episode's transcript_status and progress in state
  }
);

const unlistenComplete = await listen<{ episodeId: string; segmentCount: number }>(
  'podcast://transcription-complete',
  (event) => {
    // Reload episode, show "View Transcript" button
  }
);
```
