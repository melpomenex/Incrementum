## Why

Users need reliable text selection in PDFs to quote, copy, and create extracts quickly. Today selection is inconsistent in many PDFs, which blocks core reading and extraction workflows even when a text layer is present.

## What Changes

- Ensure PDF rendering prioritizes a robust text layer path so selecting text is easy and predictable in normal reading flow.
- Improve selection ergonomics (hit targets, drag behavior, and selection persistence) so users can select with fewer retries.
- Ensure selected PDF text can be extracted through existing capture/extract workflows without extra manual steps.
- Keep image-only/scanned PDFs out of scope for guaranteed selection behavior unless OCR-generated text is available.

## Capabilities

### New Capabilities
- `pdf-text-selection-extraction`: Reliable text selection and extraction behavior for PDFs that include a text layer.

### Modified Capabilities
- None.

## Impact

- Affected areas: PDF reader UI, PDF.js text layer handling, selection-to-extract pipeline, and related state management.
- Potential dependencies: PDF rendering configuration, extraction parsing utilities, and regression coverage for PDF interaction behaviors.
