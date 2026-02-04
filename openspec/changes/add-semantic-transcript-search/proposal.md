# Change: Add semantic transcript search with embeddings

## Why
Users need to search through YouTube video transcripts to find specific content, but current keyword-only search is limited. Semantic search using embeddings enables finding relevant content even when exact keywords don't match. Users also want to create interest-based playlists from video content based on semantic themes.

## What Changes
- Add embeddings generation for transcript chunks using OpenAI/Cohere/OpenRouter APIs (or local models)
- Store embeddings in SQLite with vector extension (SQLite VSS or similar)
- Implement semantic search in command palette (Cmd/Ctrl+K) with transcript filtering
- Enable search across multiple videos with relevance-ranked results
- Allow users to create interest-based playlists from semantic search results
- Support speaker attribution filtering (when available in transcripts)
- Optional re-ranking for improved result quality
- OpenRouter integration with model selection (access to OpenAI, Cohere, Google, Mistral embeddings via single API)

## Impact
- Affected specs: transcript-search (new), semantic-embeddings (new), interest-playlists (new)
- Affected code:
  - `src/api/transcription.ts` - add embeddings generation
  - `src/api/semantic-search.ts` - new semantic search API
  - `src/components/search/CommandCenter.tsx` - add semantic search option
  - `src/components/media/TranscriptPanel.tsx` - add semantic search UI
  - Rust backend - add SQLite vector extension and embeddings storage
  - `src/stores/collectionStore.ts` - extend for interest-based playlists
