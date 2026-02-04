## 1. Infrastructure & Backend Setup
- [ ] 1.1 Add SQLite VSS extension dependency to Cargo.toml
- [ ] 1.2 Create database migration for transcript_chunks table
- [ ] 1.3 Create database migration for transcript_embeddings table
- [ ] 1.4 Create VSS virtual table for vector search
- [ ] 1.5 Define Rust types for EmbeddingProvider enum (OpenAI, Cohere, OpenRouter, Ollama)
- [ ] 1.6 Implement embedding generation function (OpenAI)
- [ ] 1.7 Implement embedding generation function (Cohere)
- [ ] 1.8 Implement embedding generation function (OpenRouter)
- [ ] 1.8a Implement OpenRouter model list fetching API
- [ ] 1.9 Implement embedding generation function (Ollama)
- [ ] 1.10 Add Tauri command for generate_embedding
- [ ] 1.11 Add Tauri command for vector_search
- [ ] 1.12 Add Tauri command for index_transcript
- [ ] 1.13 Add Tauri command for fetch_openrouter_models

## 2. Transcript Chunking
- [ ] 2.1 Create chunking utility (slide-window with overlap)
- [ ] 2.2 Add timestamp preservation in chunks
- [ ] 2.3 Add speaker label extraction from transcript segments
- [ ] 2.4 Implement chunk storage in transcript_chunks table
- [ ] 2.5 Add tests for chunking edge cases (small transcripts, overlap boundaries)

## 3. Embedding Generation & Storage
- [ ] 3.1 Implement batch embedding for efficiency
- [ ] 3.2 Store embeddings in transcript_embeddings table
- [ ] 3.3 Populate VSS virtual table with vectors
- [ ] 3.4 Add embedding provider configuration to settings
- [ ] 3.5 Implement fallback logic if primary provider fails
- [ ] 3.6 Add progress tracking for embedding jobs

## 4. Frontend API Layer
- [ ] 4.1 Create src/api/semantic-search.ts
- [ ] 4.2 Implement semanticTranscriptSearch frontend function
- [ ] 4.3 Implement generateInterestPlaylist frontend function
- [ ] 4.4 Implement indexDocumentTranscript frontend function
- [ ] 4.5 Add TypeScript types for SemanticSearchResult
- [ ] 4.6 Add TypeScript types for InterestPlaylist
- [ ] 4.7 Add error handling for API failures

## 5. Command Palette Integration
- [ ] 5.1 Add "Semantic Search" mode toggle to CommandCenter
- [ ] 5.2 Display semantic search results with relevance scores
- [ ] 5.3 Show transcript excerpts with timestamps in results
- [ ] 5.4 Add "Jump to timestamp" action on results
- [ ] 5.5 Add speaker filter dropdown when transcripts include speakers
- [ ] 5.6 Implement result re-ranking (cross-encoder option)
- [ ] 5.7 Add keyboard navigation for results
- [ ] 5.8 Show loading state during embedding generation

## 6. Transcript Panel Search
- [ ] 6.1 Add semantic search input to TranscriptPanel
- [ ] 6.2 Display semantic matches with highlighting
- [ ] 6.3 Sync video player to clicked result timestamp
- [ ] 6.4 Add "Find similar" context menu on transcript segments
- [ ] 6.5 Implement speaker filter UI in transcript search
- [ ] 6.6 Add result count indicator

## 7. Interest-Based Playlists
- [ ] 7.1 Design interest playlist data model
- [ ] 7.2 Create "Save to Playlist" action from search results
- [ ] 7.3 Implement playlist creation dialog
- [ ] 7.4 Add playlist management UI (list, rename, delete)
- [ ] 7.5 Store playlist queries for re-running
- [ ] 7.6 Add "Refresh Playlist" action to update results
- [ ] 7.7 Display playlists in sidebar/collections panel
- [ ] 7.8 Auto-update playlists on new video imports

## 8. Settings & Configuration
- [ ] 8.1 Add embedding provider selection dropdown to Settings
- [ ] 8.2 Add API key input fields (OpenAI, Cohere, OpenRouter)
- [ ] 8.3 Add OpenRouter model selection UI when OpenRouter is selected
- [ ] 8.4 Implement "Refresh Models" button for OpenRouter
- [ ] 8.5 Display OpenRouter model details (dimensions, pricing, provider)
- [ ] 8.6 Add Ollama URL and model configuration
- [ ] 8.7 Add re-ranking mode toggle (none/cross-encoder/llm)
- [ ] 8.8 Add chunk size configuration (advanced)
- [ ] 8.9 Add "Index All Videos" button with progress
- [ ] 8.10 Add storage usage indicator for embeddings
- [ ] 8.11 Add "Clear All Embeddings" button

## 9. Background Indexing
- [ ] 9.1 Implement queue system for transcript indexing
- [ ] 9.2 Add progress indicator for indexing jobs
- [ ] 9.3 Implement pause/resume for indexing
- [ ] 9.4 Auto-index newly imported YouTube videos
- [ ] 9.5 Show notification when indexing completes
- [ ] 9.6 Handle indexing errors with retry logic

## 10. Testing
- [ ] 10.1 Test embedding generation with each provider (OpenAI, Cohere, OpenRouter, Ollama)
- [ ] 10.2 Test vector search accuracy with sample queries
- [ ] 10.3 Test speaker filtering on multi-speaker videos
- [ ] 10.4 Test playlist creation and refresh
- [ ] 10.5 Test re-ranking quality improvement
- [ ] 10.6 Test indexing of large transcripts (>1 hour)
- [ ] 10.7 Test error handling (API failures, network issues)
- [ ] 10.8 Test performance with 100+ indexed videos
- [ ] 10.9 Test web/PWA environment (in-memory vectors)
- [ ] 10.10 Test OpenRouter model selection and switching
- [ ] 10.11 Test OpenRouter model list refresh functionality
- [ ] 10.12 Test OpenRouter fallback to alternative model if selected unavailable

## 11. Edge Cases & Error Handling
- [ ] 11.1 Handle videos without transcripts
- [ ] 11.2 Handle transcripts too short to chunk
- [ ] 11.3 Handle API rate limiting gracefully
- [ ] 11.4 Show helpful messages when no embedding provider configured
- [ ] 11.5 Handle malformed transcript data
- [ ] 11.6 Handle storage limits for embeddings
- [ ] 11.7 Handle concurrent search requests
