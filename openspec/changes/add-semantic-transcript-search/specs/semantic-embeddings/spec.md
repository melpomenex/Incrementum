# semantic-embeddings Specification

## Purpose
Manages the generation, storage, and retrieval of vector embeddings for transcript chunks to enable semantic search capabilities.

## ADDED Requirements

### Requirement: Embedding Provider Configuration
The system SHALL support multiple embedding providers with user configuration.

#### Scenario: Configure OpenAI embedding provider
- **GIVEN** the user is in Settings
- **WHEN** the user selects OpenAI as the embedding provider
- **AND** enters a valid API key
- **THEN** the system SHALL save the configuration securely
- **AND** use OpenAI embeddings for future indexing

#### Scenario: Configure Cohere embedding provider
- **GIVEN** the user is in Settings
- **WHEN** the user selects Cohere as the embedding provider
- **AND** enters a valid API key
- **THEN** the system SHALL save the configuration securely
- **AND** use Cohere embeddings for future indexing

#### Scenario: Configure OpenRouter embedding provider
- **GIVEN** the user is in Settings
- **WHEN** the user selects OpenRouter as the embedding provider
- **AND** enters a valid OpenRouter API key
- **THEN** the system SHALL validate the API key
- **AND** fetch available embedding models from OpenRouter
- **AND** display the list of models with their dimensions and pricing
- **AND** allow the user to select a model from the list

#### Scenario: Select OpenRouter embedding model
- **GIVEN** OpenRouter is configured as the embedding provider
- **WHEN** the embedding model selection UI is displayed
- **THEN** the system SHALL show available models including:
  - openai/text-embedding-3-small (1536 dimensions)
  - openai/text-embedding-3-large (3072 dimensions)
  - cohere/embed-english-v3.0 (1024 dimensions)
  - cohere/embed-multilingual-v3.0 (1024 dimensions)
  - google/text-embedding-004 (768 dimensions)
  - mistral/mistral-embed (1024 dimensions)
  - And any additional models available via OpenRouter
- **AND** display model information (provider, dimensions, pricing per million tokens)
- **AND** save the selected model for future embeddings

#### Scenario: Refresh OpenRouter model list
- **GIVEN** OpenRouter is configured as the embedding provider
- **WHEN** the user clicks "Refresh Models"
- **THEN** the system SHALL fetch the latest available models from OpenRouter
- **AND** update the model selection list
- **AND** preserve the user's current selection if still available

#### Scenario: Configure local Ollama embedding provider
- **GIVEN** the user has Ollama running locally
- **WHEN** the user selects Ollama as the embedding provider
- **AND** enters the Ollama URL and model name
- **THEN** the system SHALL validate the connection
- **AND** use the local Ollama instance for embeddings

#### Scenario: Switch embedding providers
- **GIVEN** the user has existing embeddings with one provider
- **WHEN** the user switches to a different provider
- **THEN** the system SHALL ask if the user wants to re-index existing transcripts
- **AND** use the new provider for future embeddings

### Requirement: Transcript Chunking
The system SHALL chunk transcripts into overlapping segments for embedding generation.

#### Scenario: Chunk a standard transcript
- **GIVEN** a video transcript is available
- **WHEN** the system processes the transcript for embedding
- **THEN** the system SHALL split the transcript into chunks of ~500 tokens
- **AND** each chunk SHALL overlap with adjacent chunks by ~50 tokens
- **AND** each chunk SHALL preserve its timestamp range

#### Scenario: Chunk transcript with speaker attribution
- **GIVEN** a transcript includes speaker labels
- **WHEN** chunking the transcript
- **THEN** the system SHALL preserve speaker information in each chunk
- **AND** indicate if a chunk contains multiple speakers

#### Scenario: Handle short transcripts
- **GIVEN** a video has a very short transcript (< 100 tokens)
- **WHEN** processing for embedding
- **THEN** the system SHALL create a single chunk with the entire transcript
- **AND** not apply overlap rules

#### Scenario: Handle long transcripts
- **GIVEN** a video has a very long transcript (> 2 hours)
- **WHEN** processing for embedding
- **THEN** the system SHALL create chunks efficiently
- **AND** display indexing progress to the user

### Requirement: Embedding Generation
The system SHALL generate vector embeddings for transcript chunks.

#### Scenario: Generate embedding for a single chunk
- **GIVEN** a transcript chunk exists
- **WHEN** the embedding is requested
- **THEN** the system SHALL call the configured embedding provider
- **AND** store the resulting vector with the chunk
- **AND** record the provider and model used

#### Scenario: Batch embedding generation
- **GIVEN** a video has multiple transcript chunks
- **WHEN** indexing the video
- **THEN** the system SHALL generate embeddings in batches
- **AND** use the provider's batch API for efficiency
- **AND** track progress for the batch operation

#### Scenario: Embedding generation retry
- **GIVEN** an embedding API call fails
- **WHEN** the failure is transient (rate limit, network)
- **THEN** the system SHALL retry with exponential backoff
- **AND** log the retry attempt
- **AND** notify the user if retries are exhausted

### Requirement: Vector Storage
The system SHALL store embeddings efficiently for fast retrieval.

#### Scenario: Store embedding with chunk
- **GIVEN** an embedding has been generated
- **WHEN** storing in the database
- **THEN** the system SHALL save the vector data
- **AND** link it to the transcript chunk
- **AND** record metadata (provider, model, timestamp)

#### Scenario: Vector search retrieval
- **GIVEN** the user performs a semantic search
- **WHEN** the query embedding is generated
- **THEN** the system SHALL find similar vectors using cosine similarity
- **AND** return the top N matching chunks
- **AND** include the similarity score with each result

#### Scenario: Delete embeddings for removed video
- **GIVEN** a video is deleted from the library
- **WHEN** the deletion is processed
- **THEN** the system SHALL remove all associated embeddings
- **AND** clean up orphaned vector data

### Requirement: Index Management
The system SHALL manage the indexing of video transcripts.

#### Scenario: Index new video on import
- **GIVEN** the user imports a new YouTube video
- **WHEN** the transcript is available
- **THEN** the system SHALL automatically queue the video for indexing
- **AND** notify the user when indexing completes

#### Scenario: Manual index all videos
- **GIVEN** the user has existing videos without embeddings
- **WHEN** the user clicks "Index All Videos" in settings
- **THEN** the system SHALL queue all unindexed videos
- **AND** display overall progress
- **AND** allow pausing or cancelling the batch operation

#### Scenario: Re-index video on transcript update
- **GIVEN** a video's transcript is updated or corrected
- **WHEN** the change is detected
- **THEN** the system SHALL remove old embeddings
- **AND** regenerate embeddings from the updated transcript

#### Scenario: Clear all embeddings
- **GIVEN** the user wants to remove all embeddings
- **WHEN** the user clicks "Clear All Embeddings" in settings
- **THEN** the system SHALL ask for confirmation
- **AND** delete all embedding data on confirmation
- **AND** update storage usage indicators

### Requirement: Storage Management
The system SHALL manage storage used by embeddings.

#### Scenario: Display embedding storage usage
- **GIVEN** the user views the embedding settings
- **WHEN** the page loads
- **THEN** the system SHALL display total storage used by embeddings
- **AND** show count of indexed videos
- **AND** show count of indexed chunks

#### Scenario: Storage optimization
- **GIVEN** the user has limited disk space
- **WHEN** storage is running low
- **THEN** the system SHALL warn the user
- **AND** suggest options (clear old embeddings, use smaller dimensions)

### Requirement: Embedding API Integration
The system SHALL integrate with embedding provider APIs.

#### Scenario: OpenAI API integration
- **GIVEN** OpenAI is configured as the provider
- **WHEN** generating embeddings
- **THEN** the system SHALL use the text-embedding-3-small model by default
- **AND** allow configuration for text-embedding-3-large
- **AND** handle API errors gracefully

#### Scenario: Cohere API integration
- **GIVEN** Cohere is configured as the provider
- **WHEN** generating embeddings
- **THEN** the system SHALL use the embed-v3 model
- **AND** support batch embedding requests
- **AND** handle API errors gracefully

#### Scenario: OpenRouter API integration
- **GIVEN** OpenRouter is configured as the provider
- **WHEN** generating embeddings
- **THEN** the system SHALL call the OpenRouter embeddings API endpoint
- **AND** use the user-selected model (e.g., openai/text-embedding-3-small)
- **AND** include the OpenRouter API key in the request header
- **AND** support batch embedding requests
- **AND** handle API errors gracefully (rate limits, invalid model, etc.)
- **AND** retry with exponential backoff on transient failures
- **AND** use the fallback model if the selected model is unavailable

#### Scenario: Fetch OpenRouter available models
- **GIVEN** OpenRouter is configured as the embedding provider
- **WHEN** the user views embedding settings
- **THEN** the system SHALL call the OpenRouter models API
- **AND** retrieve available embedding models
- **AND** cache the model list for 24 hours
- **AND** display models with their pricing information

#### Scenario: Ollama API integration
- **GIVEN** Ollama is configured as the provider
- **WHEN** generating embeddings
- **THEN** the system SHALL call the local Ollama endpoint
- **AND** use the configured model (e.g., nomic-embed-text)
- **AND** handle connection errors gracefully

### Requirement: Re-ranking
The system SHALL support optional re-ranking of search results.

#### Scenario: Cross-encoder re-ranking
- **GIVEN** the user has cross-encoder re-ranking enabled
- **WHEN** semantic search returns initial results
- **THEN** the system SHALL apply cross-encoder scoring
- **AND** re-sort results by the combined score
- **AND** display re-ranked results

#### Scenario: LLM re-ranking
- **GIVEN** the user has LLM re-ranking enabled
- **WHEN** semantic search returns initial results
- **THEN** the system SHALL send results to the LLM for re-scoring
- **AND** re-sort results based on LLM relevance judgments
- **AND** display re-ranked results with quality indicators

#### Scenario: No re-ranking
- **GIVEN** the user has re-ranking disabled
- **WHEN** semantic search is performed
- **THEN** the system SHALL return results based solely on vector similarity
- **AND** display results without additional processing delay
