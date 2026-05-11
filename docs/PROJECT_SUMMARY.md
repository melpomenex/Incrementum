# Project Summary

Architecture and technical details for Incrementum developers.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Frontend Architecture](#frontend-architecture)
5. [Backend Architecture](#backend-architecture)
6. [Database Schema](#database-schema)
7. [Key Algorithms](#key-algorithms)
   - [FSRS-6 Algorithm](#fsrs-6-algorithm)
   - [SM-18 Algorithm](#sm-18-algorithm-supermemo-18)
   - [SM-20 Algorithm](#sm-20-algorithm-supermemo-20)
8. [API Reference](#api-reference)
9. [Development Workflow](#development-workflow)
10. [Testing Strategy](#testing-strategy)

---

## Architecture Overview

Incrementum is a desktop application built with **Tauri 2.0**, combining a **React 19** frontend with a **Rust** backend. This architecture provides:

- **Native Performance**: Rust backend for compute-intensive tasks
- **Modern UI**: React with TypeScript for type-safe frontend development
- **Cross-Platform**: Single codebase for Windows, macOS, and Linux
- **Small Bundle Size**: Tauri apps are significantly smaller than Electron
- **Security**: Rust's memory safety and Tauri's security model

```
Frontend (React)                     Backend (Rust)
├── Pages                            ├── Commands
├── Components                       ├── Models
├── Stores (Zustand)                 ├── Database (SQLite)
└── API (Tauri IPC)                  └── Processors
         |                                  
         +-------- IPC Commands ----------+
```

---

## Tech Stack

### Frontend

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Framework | React | 19.x | UI library |
| Language | TypeScript | 5.x | Type safety |
| Styling | Tailwind CSS | 3.x | Utility-first CSS |
| State | Zustand | 4.x | State management |
| Routing | React Router | 6.x | Client-side routing |
| Data Fetching | React Query | 5.x | Server state management |
| Build Tool | Vite | 5.x | Fast development builds |
| Icons | Lucide React | Latest | Icon library |
| Charts | Recharts | 2.x | Data visualization |

### Backend

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Framework | Tauri | 2.0 | Desktop app framework |
| Language | Rust | 1.70+ | Systems programming |
| Database | SQLite | 3.x | Embedded database |
| ORM | SQLx | 0.7 | Type-safe SQL |
| Runtime | Tokio | 1.x | Async runtime |
| Serialization | Serde | 1.x | JSON serialization |

### Document Processing

| Format | Library | Purpose |
|--------|---------|---------|
| PDF | PDF.js | Rendering and extraction |
| EPUB | EPUB.js | EPUB rendering |
| Markdown | marked | Markdown parsing |
| HTML | readability | Article extraction |

---

## Project Structure

```
incrementum-tauri/
├── src/                          # Frontend source
│   ├── api/                      # Tauri command wrappers
│   ├── components/               # React components
│   ├── hooks/                    # Custom React hooks
│   ├── pages/                    # Page components
│   ├── stores/                   # Zustand stores
│   ├── themes/                   # Theme definitions
│   ├── types/                    # TypeScript types
│   └── utils/                    # Utility functions
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── commands/             # Tauri command handlers
│   │   ├── models/               # Data models
│   │   ├── database/             # Database layer
│   │   ├── algorithms/           # FSRS, SM-2, SM-18, SM-20, schedulers
│   │   ├── processor/            # Document processors
│   │   └── integrations/         # External integrations
│   ├── Cargo.toml               # Rust dependencies
│   └── tauri.conf.json          # Tauri configuration
├── docs/                         # Documentation
├── openspec/                     # Specification management
└── browser_extension/            # Browser extension
```

---

## Frontend Architecture

### Component Organization

Components follow a feature-based structure:

```
src/components/
├── common/           # Reusable UI components
├── layout/           # Layout components
├── documents/        # Document management
├── review/           # Review session
└── ...
```

### State Management (Zustand)

Stores are organized by domain:

```typescript
// Example: Document store
interface DocumentStore {
  documents: Document[];
  selectedDocument: Document | null;
  filters: DocumentFilters;
  fetchDocuments: () => Promise<void>;
  selectDocument: (id: string) => void;
}
```

Key stores:
- `useDocumentStore` - Document management
- `useReviewStore` - Review session state
- `useSettingsStore` - User preferences
- `useThemeStore` - Theme and appearance

### API Layer

Tauri commands are wrapped in typed functions:

```typescript
// src/api/documents.ts
export async function fetchDocuments(): Promise<Document[]> {
  return invoke('get_documents');
}
```

### Routing

Routes are defined in App.tsx with React Router.

---

## Backend Architecture

### Command Pattern

Tauri commands are the API boundary:

```rust
#[tauri::command]
pub async fn get_documents(
    db: State<'_, Database>,
) -> Result<Vec<Document>, String> {
    db.get_documents().await.map_err(|e| e.to_string())
}
```

### Database Layer

SQLite with SQLx for type-safe queries:

```rust
pub struct Database {
    pool: SqlitePool,
}

impl Database {
    pub async fn get_documents(&self) -> Result<Vec<Document>> {
        sqlx::query_as::<_, Document>(
            "SELECT * FROM documents ORDER BY created_at DESC"
        )
        .fetch_all(&self.pool)
        .await
    }
}
```

### Document Processing Pipeline

```
Input File
    |
    v
Detector    -> Determine file type
    |
    v
Parser      -> Extract content
    |
    v
Segmenter   -> Split into sections
    |
    v
Database    -> Store with metadata
```

---

## Database Schema

### Core Tables

```sql
-- Documents (source materials)
CREATE TABLE documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT,
    file_path TEXT,
    document_type TEXT,
    category_id TEXT,
    tags TEXT,
    word_count INTEGER,
    reading_time INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Extracts (key points from documents)
CREATE TABLE extracts (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    content TEXT NOT NULL,
    position_info TEXT,
    category_id TEXT,
    priority INTEGER DEFAULT 50,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Learning Items (flashcards, cloze, etc.)
CREATE TABLE items (
    id TEXT PRIMARY KEY,
    extract_id TEXT,
    item_type TEXT,
    front_content TEXT,
    back_content TEXT,
    category_id TEXT,
    priority INTEGER DEFAULT 50,
    tags TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Review Schedule (FSRS algorithm state)
CREATE TABLE review_schedule (
    item_id TEXT PRIMARY KEY,
    due_date DATETIME,
    stability REAL,
    difficulty REAL,
    reps INTEGER DEFAULT 0,
    lapses INTEGER DEFAULT 0,
    last_review DATETIME,
    next_interval INTEGER,
    state INTEGER
);

-- Review Logs (history)
CREATE TABLE review_logs (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    rating INTEGER,
    review_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    elapsed_days INTEGER,
    scheduled_days INTEGER
);

-- Categories
CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    color TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Key Indexes

```sql
CREATE INDEX idx_items_due_date ON review_schedule(due_date);
CREATE INDEX idx_items_category ON items(category_id);
CREATE INDEX idx_documents_category ON documents(category_id);
CREATE INDEX idx_review_logs_item ON review_logs(item_id);
CREATE INDEX idx_review_logs_date ON review_logs(review_date);
```

---

## Key Algorithms

### FSRS-6 Algorithm

The Free Spaced Repetition Scheduler (FSRS) v6 is implemented in Rust:

```rust
pub struct FSRSCalculator {
    parameters: FSRSParameters,
}

impl FSRSCalculator {
    pub fn calculate_next_review(
        &self,
        current_stability: f64,
        current_difficulty: f64,
        rating: Rating,
    ) -> ReviewResult {
        let new_stability = self.update_stability(
            current_stability, current_difficulty, rating
        );
        let new_difficulty = self.update_difficulty(current_difficulty, rating);
        let interval = self.calculate_interval(new_stability);
        
        ReviewResult {
            stability: new_stability,
            difficulty: new_difficulty,
            interval_days: interval,
            due_date: Utc::now() + Duration::days(interval as i64),
        }
    }
}
```

Key parameters:
- **Desired Retention**: Target recall probability (default 90%)
- **Stability**: How long a memory lasts (in days)
- **Difficulty**: Item difficulty (1-10 scale)

### SM-18 Algorithm (SuperMemo 18)

The latest publicly available SuperMemo algorithm, reverse-engineered from `sm18.exe` via Ghidra decompilation and ported to Rust. SM-18 uses a three-dimensional lookup table for stability increases rather than closed-form formulas.

**Source**: `src-tauri/src/algorithms/sm18.rs`, `sm18_data.rs`
**Reference**: [sm18-re](https://github.com/melpomenex/sm18-re)

#### Core Formulas

- **Retrievability**: `R = 0.9^(t/S)` — exponential forgetting with 0.9 half-life base
- **Stability update (success, grade ≥ 3)**: `S_new = S × SInc[D][S][R]` — looked up from a 21³ (9261-entry) SInc matrix indexed by difficulty bin, stability bin, and retrievability bin
- **Stability update (failure, grade < 3)**: `S_new = max(S × 0.87 / (1 + 0.1 × lapses), 0.5)` — penalized by lapse count
- **Difficulty update**: `D_new = f × RepDiff + (1-f) × D_old` where `f = max(0.10, 0.80 - (rep-1) × 0.06)` — adaptive blending between repetition-based difficulty and stored difficulty
- **Interval**: `S × ln(1-FI) / ln(0.9)` — derived from desired forgetting index (default FI = 0.10)

#### Key Data Structures

```rust
pub struct SM18State {
    pub difficulty: f64,   // D ∈ [0, 1]
    pub stability: f64,    // Memory stability in days
    pub interval: f64,     // Current interval in days
    pub repetition: u32,   // Resets on lapse
    pub lapses: u32,       // Number of failures
}
```

#### SInc Matrix

The Stability Increase (SInc) matrix is the heart of SM-18. It's a 21×21×21 lookup table loaded from `data/sinc_matrix.bin` (74 KB) at compile time via `include_bytes!`. Layout: `flat[D * 441 + S * 21 + R]` where D is slowest-varying and R is fastest. Indices 0–19 are active; index 20 is a sentinel (value 0). The matrix was extracted from the original `StabilityIncrease.dat` shipped with SuperMemo 18.

#### Grade Mapping

| App Rating | SM-18 Grade | Classification |
|------------|-------------|----------------|
| Again | 0 | Failure (lapse) |
| Hard | 2 | Success (low) |
| Good | 3 | Success (normal) |
| Easy | 5 | Success (high) |

#### Key Constants (from 80-bit x87 decompilation)

- Startup stability: `1.2`, startup interval: `6.9` days
- Post-lapse modifier: `0.87`, post-lapse interval: `2.4` days
- BW weight (blended deviation): `0.70`
- Default difficulty: `0.5`
- Grade-to-retrievability mapping: grades 0–2 → `0.0`, grade 3 → `0.9`, grade 4 → `0.95`, grade 5 → `0.99`

---

### SM-20 Algorithm (SuperMemo 20)

A native Rust implementation of the SuperMemo 20 algorithm, reverse-engineered from `sm20.exe` via Ghidra (75 functions, 44K fully decompiled). SM-20 is the most complex algorithm in the codebase, supporting three interval formula versions (V2/V4/V6) and an integrated FSRS-family branch.

**Source**: `src-tauri/src/algorithms/sm20.rs`

#### Architecture

SM-20 operates on a **Dual-Stability-Retrievability (DSR) model** and supports two algorithm branches selected per-item via the `algorithm_branch` flag:

1. **Classic SM-20 branch** (`algorithm_branch == 0`): Uses interval matrices with Bayesian smoothing
2. **FSRS-family branch** (`algorithm_branch == 1`): Uses a 3-expert mixture model for retrievability estimation

#### Key Data Structures

```rust
pub struct SM20State {
    pub version: u8,           // Algorithm version (2, 4, or 6)
    pub stability: f64,        // Memory stability in days
    pub difficulty: f64,       // D ∈ [0, 1]
    pub repetition: u32,       // Repetition counter
    pub lapses: u32,           // Failure count
    pub interval: f64,         // Current interval in days
    pub last_quality: f64,     // Last review quality
    pub algorithm_branch: u8,  // 0 = classic, 1 = FSRS
    pub retrov: f64,           // Retrievability estimate
    pub s_factor: f64,         // Stability scaling factor
    pub multiplier: f64,       // Interval multiplier
}
```

#### Classic SM-20 Interval Formulas

Three versions of the interval calculation:

- **V2** (SM-19 compatible): `interval = (scale - offset) × S^power + bias` × `2^(-penalty × D)` — stability-scale-based with difficulty penalty
- **V4** (SM-20 proper): Linear combination `interval = (p3 × p5 + 1)(p1 × p7 + p2) + p4` — matrix-derived parameters
- **V6** (FSRS-style): `interval = p4 + p1 × 2^p6 × 2^(-p3 × p5)` — exponential blending of matrix parameters

All three versions share the same Bayesian smoothing core for initial intervals.

#### Bayesian Smoothing Core

The interval matrix is smoothed using a 3×3×3 neighborhood Bayesian approach:

- **Prior**: Formula-based initial interval for each (R, S, D) cell
- **Target cell**: Weighted by observation count vs. prior weight (500)
- **Neighbor cells**: 3×3×3 neighborhood weighted by accumulated observation counts
- **Blend**: `sigmoid(target_count, 500) × 10` for target, `sigmoid(neighbor_count, 1000) × cube_weight` for neighbors, combined with neutral baseline

This allows sparse user data to be smoothly interpolated while dense data dominates the schedule.

#### FSRS-Family Branch

When `algorithm_branch == 1`, SM-20 uses a **3-expert weighted mixture** for retrievability estimation instead of the classic formula:

- **Expert 1** (power-law): `S × (S/(S+t))^pow(p[0]/0.9, 2)` — activated when threshold < param and threshold < S
- **Expert 2** (FSRS-style): `(1 + t/S)^log₂(0.9)` — bounded proper forgetting curve ≈ `(1+t/S)^(-0.152)`
- **Expert 3** (exponential): `2^(-|t/S| × 0.105)` ≈ `0.9296^(t/S)`

Expert weights are computed via sigmoid functions over stability and difficulty parameters. The mixture output drives both difficulty and stability updates (separate formulas for lapses vs. recall).

35 FSRS-family parameters are extracted from runtime memory (expert weights, initial difficulty/stability per grade, lapse decay, recall stability, hard bonus, etc.).

#### Index Conversions

SM-20 maps continuous values to discrete matrix indices:

- **Stability**: `floor((S - 2)^1/2.904) + 1`, clamped to [1, 20] — power-law binning
- **Difficulty**: `floor(D × 19) + 1`, clamped to [1, 10]
- **Retrievability**: `floor(2^(R × 20))`, clamped to [0, 20]

#### U-Factor Table

A 20-entry difficulty table extracted from runtime memory, mapping difficulty index to a stability multiplier. Used in the classic interval computation path.

#### Key Constants

- Stability power: `2.9039`, stability cap: `0.7`, stability max: `44530`
- V2 stability scale: [1.3, 9.29], V2 penalty: slope `-1.88`, intercept `1.58`
- Bayesian weights: prior `500.0`, target scale `10.0`, neighbor denom `1000.0`, cube weight `3.0`
- Rounding thresholds: wide [0.8, 20.0], narrow [0.5, 2.0]

---

### Position Tracking

Unified position model for different document types:

```rust
pub enum DocumentPosition {
    Page { page: u32, offset: f32 },      // PDFs
    Scroll { percent: f32 },              // Web, Markdown
    CFI { cfi: String, offset: f32 },     // EPUBs
    Time { seconds: u32 },                // Videos
}
```

---

## API Reference

### Document Commands

| Command | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `get_documents` | - | Vec<Document> | List all documents |
| `get_document` | id: String | Document | Get single document |
| `import_document` | path: String | Document | Import from file |
| `import_url` | url: String | Document | Import from URL |
| `delete_document` | id: String | () | Delete document |
| `update_document` | id, updates | Document | Update metadata |

### Item Commands

| Command | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `get_items` | filters | Vec<Item> | List learning items |
| `create_item` | data | Item | Create new item |
| `update_item` | id, updates | Item | Update item |
| `delete_item` | id | () | Delete item |

### Review Commands

| Command | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `get_due_items` | - | Vec<Item> | Get items due today |
| `submit_review` | item_id, rating | ReviewResult | Submit rating |
| `get_review_stats` | - | ReviewStats | Get statistics |

---

## Development Workflow

### Setting Up Development Environment

1. Install dependencies (see INSTALL.md)
2. Start development server: `npm run tauri:dev`
3. Run web-only (faster): `npm run dev`

### Code Style

**TypeScript/React**:
- Prettier for formatting
- ESLint for linting
- Functional components with hooks

**Rust**:
- `cargo fmt` for formatting
- `cargo clippy` for linting

### Git Workflow

1. Create feature branch: `git checkout -b feature/name`
2. Make changes with descriptive commits
3. Run tests: `npm run test`
4. Submit pull request

---

## Testing Strategy

### Frontend Tests

Run tests:
```bash
npm run test          # Unit tests
npm run test:ui       # UI component tests
npm run test:coverage # Coverage report
```

### Backend Tests

Run tests:
```bash
cargo test            # Rust tests
cargo test --lib      # Library tests only
```

### Integration Tests

```bash
npm run test:integration
```

---

## Performance Considerations

### Frontend

- **Virtual Lists**: Render only visible items for large lists
- **Memoization**: Use React.memo and useMemo appropriately
- **Code Splitting**: Lazy load routes and heavy components
- **Debouncing**: Debounce search inputs (100ms)

### Backend

- **Connection Pooling**: SQLite connection pool for concurrent access
- **Async/Await**: Non-blocking I/O with Tokio
- **Caching**: In-memory cache for frequently accessed data
- **Batch Operations**: Batch database writes for better performance

---

## Security

### Tauri Security

- **CSP**: Content Security Policy configured
- **IPC**: Commands are explicitly exposed
- **FS Access**: Scoped to specific directories
- **No Remote Content**: All assets bundled locally

### Data Security

- Local SQLite database
- No cloud transmission (unless explicitly configured)
- Optional encryption for sensitive data

---

## Contributing

See OpenSpec Workflow (openspec/AGENTS.md) for the contribution process.

---

*Last updated: May 2026*
