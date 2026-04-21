## Why

Auto-segmentation has complete backend infrastructure (Rust segmentation engine with 4 strategies, 6 Tauri commands, settings UI) but is completely unwired on the frontend. Users import EPUB/PDF documents and get full text extraction, but no segmentation into extracts ever occurs. The `autoProcessOnImport` setting exists and defaults to `false`, and even when enabled, nothing consumes it. The user handbook claims auto-segmentation "begins automatically" after import, but this is aspirational documentation, not reality. This gap means the core incremental reading workflow is broken for imported documents.

## What Changes

- Wire `autoProcessOnImport` to actually trigger segmentation after document import completes
- Add a manual "Segment" action for documents that were imported without auto-segmentation
- After segmentation completes, navigate to the newly created extracts list instead of leaving the user on the import screen
- Show segmentation progress feedback during import (segmenting can take time for large documents)
- Remove or integrate the dead `documentProcessor.ts` client-side utilities
- Update user handbook to reflect actual behavior

## Capabilities

### New Capabilities
- `import-segmentation-flow`: Connects the import pipeline to the segmentation engine — auto-segment on import when enabled, show progress, and route user to the result
- `manual-segmentation-action`: Provides an on-demand "Segment" button/action on documents that haven't been segmented yet

### Modified Capabilities
<!-- None — existing document-management spec defines intended behavior but it's aspirational;
     the actual integration is a new capability, not a modification of existing requirements -->

## Impact

- **Frontend**: `documentStore.ts` import flow, potentially new UI components for segmentation progress and manual trigger
- **Backend**: `segmentation.rs` commands are already registered and ready — no Rust changes needed
- **Settings**: `settingsStore.ts` segmentation config and `autoProcessOnImport` are stored but need to be consumed
- **Docs**: `USER_HANDBOOK.md` line ~80 claims auto-segmentation works — needs accuracy update
- **Dead code**: `src/utils/documentProcessor.ts` — unused client-side segmentation that should be removed or replaced with backend calls
