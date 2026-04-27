## ADDED Requirements

### Requirement: Persistent disk-backed audio cache
The system SHALL cache generated audio chunks to disk for reuse within and across sessions.

#### Scenario: Cache hit skips API call
- **WHEN** a chunk was previously generated with the same (provider, voice, speed, text) combination
- **THEN** the cached audio file is used instead of calling the TTS API

#### Scenario: Cache miss triggers generation
- **WHEN** a chunk has no matching cache entry
- **THEN** the system calls the TTS API and writes the result to the cache

#### Scenario: Cross-session cache persistence
- **WHEN** the app is closed and reopened to the same document with the same TTS settings
- **THEN** previously cached audio chunks are available without regeneration

### Requirement: Cache key includes provider, voice, speed, and text hash
The system SHALL derive cache keys from the full set of parameters that affect audio output.

#### Scenario: Same text, different voice = separate cache entry
- **WHEN** the same text is generated with voice "Vivian" then with voice "Serena"
- **THEN** two separate cache entries exist for the same text

#### Scenario: Same text, different speed = separate cache entry
- **WHEN** the same text is generated at 1.0x speed then at 1.5x speed
- **THEN** two separate cache entries exist

### Requirement: Cache index on disk
The system SHALL maintain a JSON index file (`cache-index.json`) in the cache directory for O(1) key lookup without scanning files.

#### Scenario: Index loaded on app start
- **WHEN** the app initializes the TTS cache
- **THEN** the cache index is loaded from disk into memory

#### Scenario: Index updated on new cache entry
- **WHEN** a new audio chunk is cached
- **THEN** the index is updated in memory and persisted to disk

### Requirement: LRU eviction with configurable max size
The system SHALL evict least-recently-used cache entries when the total cache size exceeds a configurable limit.

#### Scenario: Eviction on cache full
- **WHEN** a new cache entry would cause total cache size to exceed the limit
- **THEN** the least-recently-used entries are deleted until the new entry fits

#### Scenario: Configurable cache limit
- **WHEN** user changes the cache size limit in TTS settings
- **THEN** the cache is trimmed to fit the new limit

### Requirement: No playback stalls from generation latency
The system SHALL pre-buffer at least 60 seconds of audio ahead of the current playback position to prevent buffer underruns.

#### Scenario: Aggressive pre-buffering on start
- **WHEN** TTS starts playing
- **THEN** the system immediately begins generating chunks until at least 60 seconds of audio is buffered

#### Scenario: Continuous pre-buffering during playback
- **WHEN** a chunk finishes playing
- **THEN** the system immediately queues the next chunk for generation if the buffer falls below 60 seconds

#### Scenario: Empty buffer wait
- **WHEN** the next chunk is not yet cached or generated
- **THEN** the system shows a "Buffering" state and waits for generation to complete before continuing

### Requirement: Waterfall generation priority
The system SHALL prioritize chunk generation: immediately-needed chunks first, then pre-buffer chunks, then far-ahead chunks.

#### Scenario: Next chunk generated before pre-buffer
- **WHEN** chunks 5, 6, 7, 8 all need generation
- **THEN** chunk 5 (next to play) is generated before chunks 6, 7, 8
