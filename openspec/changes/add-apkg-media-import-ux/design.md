## Context

Incrementum imports Anki `.apkg` decks into learning items but currently does not extract and resolve package media in a robust way. Card fields may contain references like `<img src="foo.png">`, `[sound:bar.mp3]`, or other media placeholders that point to APKG-internal files. Today these references are typically unresolved after import, yielding broken visuals and a poor migration experience. The implementation spans Rust/Tauri import commands, browser import parsing, and review rendering surfaces.

Constraints:
- Maintain existing FSRS scheduling behavior and duplicate-note safeguards.
- Support both desktop (Rust backend) and browser fallback import paths.
- Reuse existing image registry and learning-item `image_asset_ids` where possible.

## Goals / Non-Goals

**Goals:**
- Parse APKG media manifests and extract referenced files during import.
- Resolve note-field media references into renderable HTML/content in Incrementum.
- Attach imported image media to `image_asset_ids` for consistent review gallery UX.
- Preserve graceful fallback when media files are missing/corrupt.

**Non-Goals:**
- Full parity for every Anki plugin-specific media macro.
- New rich-media editors for imported content.
- Cloud media syncing.

## Decisions

### 1. Parse APKG media map once and build a filename->bytes index
- Rationale: deterministic reference resolution for all notes/cards and avoids repeated ZIP lookups.
- Alternative considered: on-demand per-field ZIP reads. Rejected for complexity/perf overhead.

### 2. Normalize imported HTML/media references during import, not at render time
- Rationale: store durable learning-item content that renders consistently across views.
- Alternative considered: resolving in UI at render time. Rejected because UI lacks APKG context and would duplicate logic.

### 3. Ingest image media into existing image registry and attach IDs to learning items
- Rationale: existing registry already supports dedup, persistence, and gallery rendering in review mode.
- Alternative considered: embed base64 in card HTML only. Rejected due to payload bloat and inconsistent UX.

### 4. Use data URLs for non-image referenced media when direct playback markup is present
- Rationale: supports basic audio/video references without introducing a new storage model.
- Alternative considered: skip non-image media entirely. Rejected to avoid losing user content during migration.

## Risks / Trade-offs

- [Risk] Large APKG media payloads can increase import memory use. -> Mitigation: process manifest-driven subset and avoid loading unreferenced files where possible.
- [Risk] Filename/path mismatches between media manifest and field references can leave broken links. -> Mitigation: normalize names, decode escaped references, and keep unresolved fallback text.
- [Risk] Browser import path may differ from Rust behavior. -> Mitigation: share equivalent normalization rules and add targeted tests for both paths.
- [Trade-off] Storing image assets separately plus transformed HTML adds implementation complexity, but delivers stable rendering and reusable visuals.

## Migration Plan

1. Extend APKG parsing layer to read media manifest and referenced payloads.
2. Add field-normalization utilities that resolve `<img>`, sound/media markers, and missing-file fallbacks.
3. Persist imported image media through image registry and set `learning_items.image_asset_ids`.
4. Update review rendering so imported APKG media appears in a clean, non-duplicative layout.
5. Validate with representative APKG fixtures (image-only, mixed media, missing media references).

Rollback:
- Keep existing import paths available behind previous code path fallback.
- If issues appear, disable media attachment while preserving core note/card text import.

## Open Questions

- Should unsupported non-image media markers be rendered as links, inline controls, or hidden by default?
- Should duplicate `<img>` references in card HTML be removed once gallery images are attached, or retained for strict fidelity?
