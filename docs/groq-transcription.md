# Groq Transcription Integration

## Overview

This implementation adds Groq as a cloud-based transcription provider alongside the existing local Whisper transcription. Groq provides ultra-fast transcription using their LPU (Language Processing Unit) infrastructure with a generous free tier.

**Key Feature: Automatic File Chunking** - Files larger than 25MB are automatically split into smaller chunks, transcribed individually, and combined back together with seamless timestamp alignment. This means there are effectively no file size limits for transcription!

## Free Tier Limits

| Metric | Limit |
|--------|-------|
| Requests per Minute | 20 |
| Requests per Day | 2,000 |
| Audio per Day | ~8 hours (28,800 seconds) |
| Max File Size | 25 MB |

## Pricing (if exceeding free tier)

| Model | Cost per Hour |
|-------|--------------|
| whisper-large-v3-turbo | $0.04 |
| whisper-large-v3 | $0.111 |

## Files Added

### `/src/api/groqTranscription.ts`
Core API module for Groq transcription:
- `transcribeWithGroq()` - Main transcription function
- `isGroqConfigured()` - Check if API key is valid
- `validateGroqApiKey()` - Validate API key format
- `getUsageStats()` - Get current usage statistics
- `getRateLimitStatus()` - Check if approaching limits
- `convertGroqToInternalFormat()` - Convert Groq response to internal format
- `GroqTranscriptionError` - Custom error class

## Files Modified

### `/src/types/settings.ts`
Added new interfaces:
- `GroqTranscriptionSettings` - Configuration for Groq
- Updated `AudioTranscriptionSettings` to include `provider` and `groq` fields

### `/src/config/defaultSettings.ts`
Added default Groq configuration with:
- Default provider: 'local' (for backwards compatibility)
- Default model: 'whisper-large-v3-turbo'
- Empty API key
- Usage tracking initialized

### `/src/stores/settingsStore.ts`
Updated store interface and default settings to match the new types.

### `/src/components/settings/AudioTranscriptionSettings.tsx`
Major UI overhaul:
- Added provider selection tabs (Local Whisper / Groq Cloud)
- Groq-specific settings panel with:
  - API key input with validation
  - Model selection (Turbo vs Large V3)
  - Usage statistics dashboard
  - Rate limit warnings
  - Free tier information

### `/src/lib/videoTranscriptionQueue.ts`
Updated to support both providers:
- `processWithGroq()` - Handle Groq transcription
- `processWithLocalWhisper()` - Handle local transcription
- Automatic provider selection based on settings
- New status codes: 'needs-api-key', 'file-too-large'

### `/src/api/audiobooks.ts`
Updated transcript generation:
- `generateTranscriptWithGroq()` - For audiobooks
- `generateTranscriptWithLocalWhisper()` - For local processing
- `getTranscriptionProvider()` - Get current provider
- `isTranscriptionAvailable()` - Check availability

### `/src/components/import/AudiobookImportDialog.tsx`
Enhanced error handling:
- Groq API key missing error
- Rate limit error
- File too large error
- Action buttons to navigate to settings

### `/src/components/viewer/LocalVideoPlayer.tsx`
Updated status display:
- Show 'needs-api-key' status
- Show 'file-too-large' status
- Instructions for switching providers

## Usage

### For Users

#### Desktop App (Tauri)

1. **Get a Groq API Key**
   - Visit https://console.groq.com/keys
   - Create a free account
   - Generate an API key (starts with `gsk_`)

2. **Configure in Settings**
   - Go to Settings → Audio Transcription
   - Choose between "Local Whisper" (offline) or "Groq Cloud" (fast)
   - If using Groq, paste your API key and select a model
   - Save

3. **Import and Transcribe**
   - Import videos or audiobooks as usual
   - Transcription will automatically use your selected provider
   - **Large files are automatically split into chunks** (no 25MB limit!)
   - Track usage in the settings panel

#### Web App / PWA

1. **Get a Groq API Key** (same as above)

2. **Configure in Settings**
   - Go to Settings → Audio Transcription
   - Only Groq Cloud is available in the web app (no local Whisper)
   - Paste your API key
   - Save

3. **Import and Transcribe**
   - Import videos or audiobooks as usual
   - Files are transcribed using Groq's cloud API
   - **All your data remains private** - API keys and transcripts are stored locally
   - Note: Very large files may require the desktop app for chunking

### For Developers

```typescript
// Check if Groq is configured
import { isGroqConfigured, transcribeWithGroq } from './api/groqTranscription';

if (isGroqConfigured()) {
  const result = await transcribeWithGroq({
    file: audioFile,
    language: 'en',
    responseFormat: 'verbose_json',
    timestampGranularities: ['segment', 'word'],
  });
  
  // result.text - Full transcript text
  // result.segments - Array of segments with timestamps
  // result.duration - Audio duration in seconds
}
```

## Usage Tracking

The implementation includes client-side usage tracking:
- Tracks audio seconds processed
- Tracks number of requests made
- Resets daily (based on local date)
- Shows remaining quota in UI
- Warns when approaching limits

## Error Handling

The implementation handles various error cases:
- Missing API key
- Invalid API key format
- Rate limit exceeded
- File too large (>25MB for free tier)
- Network errors
- API errors

Each error type has a specific error code and user-friendly message.

## Backwards Compatibility

The implementation maintains full backwards compatibility:
- Default provider is 'local' (existing behavior)
- Existing Whisper models continue to work
- No changes required to existing installations
- Users can switch between providers at any time

## Security

- API keys are stored locally in the browser
- Keys are never sent to any server except Groq
- Input is masked by default
- Validation prevents obviously invalid keys

## File Chunking

The implementation includes automatic file chunking to handle Groq's 25MB limit:

### How It Works

1. **Detection**: Files larger than 20MB are automatically detected
2. **Splitting**: ffmpeg splits the audio into ~8 minute chunks
3. **Optimization**: Each chunk is re-encoded at 16kHz mono with 32kbps bitrate
4. **Transcription**: Each chunk is sent to Groq sequentially
5. **Combining**: Results are combined with adjusted timestamps
6. **Cleanup**: Temporary chunk files are deleted after processing

### Technical Details

- Chunks are processed sequentially to respect rate limits (20 RPM)
- 1-second delay between chunk requests
- Each chunk targets ~15-20MB (safely under 25MB)
- Timestamp adjustment ensures seamless transcript continuity
- Progress reporting shows overall completion percentage

## Future Enhancements

Potential improvements:
- Parallel chunk processing (respecting rate limits)
- Retry logic with exponential backoff for failed chunks
- Batch processing multiple files
- Cost estimation before transcription
- Export usage reports
- Support for Groq's "url" parameter (for podcasts hosted online)
