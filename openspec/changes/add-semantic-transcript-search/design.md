# Design: Semantic Transcript Search with Embeddings

## Context

The application currently supports YouTube video import and transcript fetching. Users can view transcripts synchronized with video playback, but search is limited to keyword matching. This design adds semantic search capabilities using vector embeddings.

**Constraints:**
- Must work in Tauri desktop environment (Rust backend + SQLite)
- Should optionally support web/PWA environment
- Need to balance API costs (OpenAI/Cohere) vs local embedding options
- Must handle potentially large transcript datasets

**Stakeholders:**
- Users who want to find specific content in videos
- Researchers who need to search across many video transcripts
- Learners who want to create themed playlists from video content

## Goals / Non-Goals

**Goals:**
- Fast semantic search across video transcripts
- Re-ranking for improved result quality
- Interest-based playlist creation from search results
- Speaker filtering when transcript data includes it
- Cost-effective embedding generation

**Non-Goals:**
- Real-time transcription (already handled separately)
- Video recommendation algorithms
- Social sharing of playlists
- Multi-language support (initially English only)

## Decisions

### 1. Embedding Provider

**Decision:** Support multiple embedding providers with a priority order

**Options considered:**
- OpenAI text-embedding-3-small/medium - High quality, API costs
- Cohere embed-v3 - Good quality, competitive pricing
- OpenRouter - Aggregates multiple providers (OpenAI, Anthropic, Cohere, Google, Mistral, etc.) with unified API
- Local Ollama models - No API cost, slower, requires user setup
- Sentence-transformers - Python-only, not suitable for Tauri

**Chosen approach:**
```rust
pub enum EmbeddingProvider {
    OpenAI { key: String, model: Option<String> }, // model: text-embedding-3-small, text-embedding-3-large
    Cohere { key: String, model: Option<String> }, // model: embed-english-v3.0, embed-multilingual-v3.0
    OpenRouter { key: String, model: String },     // model: user selects from available embedding models
    Ollama { url: String, model: String },
}
```

**OpenRouter Models List:**
When OpenRouter is configured, the system will fetch available embedding models from OpenRouter's API and allow users to select from:
- `openai/text-embedding-3-small` - 1536 dimensions, fast, cost-effective
- `openai/text-embedding-3-large` - 3072 dimensions, highest quality
- `cohere/embed-english-v3.0` - 1024 dimensions, excellent for English
- `cohere/embed-multilingual-v3.0` - 1024 dimensions, supports 100+ languages
- `google/text-embedding-004` - 768 dimensions, good quality
- `mistral/mistral-embed` - 1024 dimensions, balanced option
- And more as OpenRouter adds providers

**Rationale:** OpenRouter provides access to multiple embedding providers through a single API key, giving users flexibility to choose models based on their specific needs (cost, quality, multilingual support). Default to OpenAI for best quality, fall back to Ollama for privacy-conscious users.

### 2. Vector Storage

**Decision:** Use SQLite with vss extension for Tauri, in-memory vectors for web

**Options considered:**
- Dedicated vector database (Qdrant, Weaviate) - Overkill for single-user desktop app
- PostgreSQL with pgvector - Additional infrastructure
- SQLite with vss extension - Lightweight, no extra services
- In-memory only - Lost on restart, no persistence

**Chosen approach:**
- Tauri: SQLite with `sqlite-vss` extension
- Web: In-memory vectors with localStorage persistence

**Rationale:** Keeps the desktop app self-contained while providing persistence.

### 3. Chunking Strategy

**Decision:** Slide-window chunking with overlap

**Configuration:**
```typescript
interface ChunkConfig {
  chunkSize: 500; // tokens
  overlap: 50; // tokens
  minChunkSize: 100; // tokens
}
```

**Rationale:** Preserves context while allowing granular search results. Overlap ensures relevant content isn't split at boundaries.

### 4. Re-ranking

**Decision:** Optional two-stage retrieval (vector search + LLM re-rank)

**Options:**
- Vector search only - Fast, good enough for most cases
- Cross-encoder re-ranking - Better quality, additional API call
- LLM re-ranking - Best quality, most expensive

**Chosen approach:** Configurable re-ranking
```typescript
type RerankMode = 'none' | 'cross-encoder' | 'llm';
```

**Rationale:** Users can choose based on quality needs and cost tolerance.

### 5. Speaker Attribution

**Decision:** Parse speaker info from transcript when available

**Implementation:** Extend transcript segment type:
```typescript
interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
  speaker?: string; // NEW
}
```

**Rationale:** Many YouTube transcripts include speaker labels. Preserving this enables filtering.

## Data Model

### New Tables (Tauri/SQLite)

```sql
-- Transcript chunks for embedding
CREATE TABLE transcript_chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    start_time REAL,
    end_time REAL,
    speaker TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Embeddings stored separately for vss
CREATE TABLE transcript_embeddings (
    chunk_id TEXT PRIMARY KEY,
    embedding BLOB NOT NULL, -- Vector data
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (chunk_id) REFERENCES transcript_chunks(id) ON DELETE CASCADE
);

-- Virtual table for vector search (vss)
CREATE VIRTUAL TABLE transcript_vectors USING vss0(
    embedding(768), -- Dimension depends on model
    chunk_id TEXT PRIMARY KEY
);
```

### New Types (TypeScript)

```typescript
interface TranscriptChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  text: string;
  startTime?: number;
  endTime?: number;
  speaker?: string;
  embedding?: number[];
}

interface SemanticSearchResult {
  chunk: TranscriptChunk;
  score: number;
  document: {
    id: string;
    title: string;
    filePath: string; // YouTube URL or video ID
    thumbnail?: string;
  };
  highlights: {
    text: string;
    offset: number;
  }[];
}

interface InterestPlaylist {
  id: string;
  name: string;
  query: string; // Semantic search query
  results: {
    documentId: string;
    chunkId: string;
    relevance: number;
  }[];
  createdAt: string;
}
```

## Architecture

### Component Flow

```
User opens Cmd+K
    ↓
CommandCenter detects semantic search mode
    ↓
User types query: "machine learning fundamentals"
    ↓
Frontend: generateQueryEmbedding(query)
    ↓
Backend: vectorSimilaritySearch(embedding)
    ↓
Results re-ranked (if enabled)
    ↓
Return: SemanticSearchResult[]
    ↓
UI: Display with transcript excerpts, timestamps
    ↓
User: "Save to playlist"
    ↓
Create InterestPlaylist with query + results
```

### API Design

**Frontend API (`src/api/semantic-search.ts`):**
```typescript
export async function semanticTranscriptSearch(options: {
  query: string;
  documentIds?: string[];
  speaker?: string;
  limit?: number;
  rerank?: 'none' | 'cross-encoder' | 'llm';
}): Promise<SemanticSearchResult[]>

export async function generateInterestPlaylist(options: {
  name: string;
  query: string;
  maxResults?: number;
}): Promise<InterestPlaylist>

export async function indexDocumentTranscript(documentId: string): Promise<void>
```

**Backend Commands (Rust):**
```rust
#[tauri::command]
async fn generate_embedding(text: String, provider: EmbeddingProvider) -> Result<Vec<f32>, String>

#[tauri::command]
async fn vector_search(
    query_embedding: Vec<f32>,
    document_ids: Option<Vec<String>>,
    limit: usize,
) -> Result<Vec<TranscriptSearchResult>, String>

#[tauri::command]
async fn index_transcript(
    document_id: String,
    chunks: Vec<TranscriptChunk>,
) -> Result<(), String>
```

## Migration Plan

### Phase 1: Infrastructure
1. Add SQLite VSS extension to Rust backend
2. Create migration for new tables
3. Implement embedding generation

### Phase 2: Indexing
1. Background job to index existing YouTube videos
2. Automatic indexing on new video import
3. Progress indicator for large batch jobs

### Phase 3: Search UI
1. Add semantic search toggle to command palette
2. Implement transcript panel semantic search
3. Add speaker filter dropdown

### Phase 4: Playlists
1. Interest playlist creation from search
2. Playlist management UI
3. Auto-update playlists based on semantic query

### Rollback
- Drop `transcript_chunks`, `transcript_embeddings`, `transcript_vectors` tables
- Remove semantic search UI elements
- Fallback to existing keyword search

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| API costs for embeddings | Recurring cost | Support local models, batch embedding, user-provided keys |
| Storage size for vectors | Large database | Configurable embedding dimensions, compression |
| Search latency | UX degradation | Lazy indexing, result caching, pagination |
| YouTube API rate limits | Indexing failures | Exponential backoff, queue system, retry logic |
| Privacy concerns | User data sent to APIs | Local model option, clear privacy policy |

### Trade-offs

**Embedding dimension:** 768 (standard) vs 1536 (better quality, more storage)
→ Decision: Configurable, default 768 for balance

**Re-ranking on every search:** Better quality vs slower
→ Decision: Optional, user-controlled

**Index all transcripts vs on-demand:** Complete coverage vs initial cost
→ Decision: Background indexing with priority queue

## Open Questions

1. Should semantic search work across non-YouTube documents (PDF, EPUB)?
   - Recommendation: Yes, but as a separate feature phase

2. How to handle transcripts without speaker attribution?
   - Recommendation: Graceful degradation, filter unavailable

3. Should embeddings be synced across devices (if cloud sync is added)?
   - Recommendation: No, re-generate per device for privacy

4. What's the maximum number of chunks to show in search results?
   - Recommendation: 20 chunks, with pagination

5. How to handle transcript updates (re-uploads, corrections)?
   - Recommendation: Re-index on content change detection
