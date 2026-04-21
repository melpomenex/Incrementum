## Context

The app has a complete Rust segmentation engine (`segmentation.rs`) with 4 strategies (Smart, Semantic, Paragraph, Fixed), 6 registered Tauri commands, and a settings UI with `autoProcessOnImport` toggle and segmentation configuration (method, target length, overlap). None of this is wired together — imports extract full text but never segment it into extracts. The frontend `documentProcessor.ts` contains duplicate segmentation logic that is never imported.

Key backend commands already available:
- `auto_segment_and_create_extracts(doc_id, method?, target?, overlap?)` — segments and persists extracts
- `preview_segmentation(doc_id, count?, method?, target?, overlap?)` — dry-run first N segments
- `get_recommended_segmentation(file_type)` — per-format defaults (EPUB: Paragraph/400w, PDF: Smart/300w)
- `segment_document(doc_id, method?, target?, overlap?)` — segments without persisting
- `batch_segment_documents(doc_ids, method?, target?, overlap?)` — multi-doc segmentation

## Goals / Non-Goals

**Goals:**
- Auto-segment documents on import when `autoProcessOnImport` is enabled
- Provide a manual "Segment" action for unsegmented documents
- Show segmentation progress during import so users aren't left waiting
- Route user to extracts view after segmentation completes (not back to import screen)
- Respect per-format recommended defaults when user hasn't configured segmentation

**Non-Goals:**
- Changing Rust segmentation algorithms or adding new strategies
- Building a segmentation preview/editor UI (preview command exists but no UI needed yet)
- Re-segmentation of already-segmented documents
- Segmentation of non-import formats (clips, manual entries)

## Decisions

### 1. Trigger auto-segmentation in the import store action, not the Rust command

**Decision**: Call `auto_segment_and_create_extracts` from the frontend `importFromFiles`/`importFromFile` flow in `documentStore.ts`, conditioned on `autoProcessOnImport`.

**Rationale**: Keeps the import flow orchestrating decisions in one place. The Rust command already handles segmentation + extract creation atomically. No need to modify the Rust import command — the frontend controls the conditional logic based on settings.

**Alternative considered**: Adding segmentation directly into the Rust `import_document` command. Rejected because it would make import slower unconditionally and complicate the import response (would need to return extracts too).

### 2. Use per-format recommended defaults as fallback

**Decision**: When `autoProcessOnImport` is on but the user hasn't customized segmentation settings, call `get_recommended_segmentation(file_type)` to get sensible defaults rather than using the hardcoded store defaults.

**Rationale**: The backend already knows EPUBs work best with Paragraph/400w and PDFs with Smart/300w. Using the generic default (Semantic/200w) for all formats would produce poor results for PDFs.

### 3. Navigate to the document's extract list after segmentation

**Decision**: After auto-segmentation completes during import, navigate to the document detail/extracts view. For manual segmentation, stay on the current view and show a success toast with extract count.

**Rationale**: Auto-segmentation is the primary workflow — the user imported a document expecting extracts, so show them the result. Manual segmentation is secondary — the user triggered it from wherever they are, so don't yank them away.

### 4. Segment large documents with progress feedback

**Decision**: For documents with likely high segment counts (>50 segments), show a progress indicator. Use the `preview_segmentation` command first to get a count estimate, then proceed with `auto_segment_and_create_extracts`.

**Rationale**: Large PDFs or EPUBs could take several seconds. Silent waiting would feel broken. A lightweight preview call adds minimal overhead but enables accurate progress messaging.

### 5. Remove dead `documentProcessor.ts`

**Decision**: Delete `src/utils/documentProcessor.ts` entirely. The backend handles segmentation better (proper Rust performance, access to document metadata, persistable extracts).

**Rationale**: It's never imported, duplicates backend logic, and would confuse future developers into thinking client-side segmentation is the path.

## Risks / Trade-offs

- **[Slow import for large documents]** → Segmentation adds latency to import. Mitigate with progress feedback and the preview-count check. Users who don't want it can leave `autoProcessOnImport` off.
- **[Settings mismatch]** → Users may have `autoProcessOnImport` enabled from a previous install but not realize it. The setting already defaults to `false`, and the settings UI is clear. Low risk.
- **[Segmentation quality varies]** → Smart/Paragraph heuristics won't perfectly segment all documents. This is inherent to heuristic segmentation. Users can re-segment manually with different settings later if needed (out of scope for this change).
