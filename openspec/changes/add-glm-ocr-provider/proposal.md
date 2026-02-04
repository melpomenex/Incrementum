# Change: Add GLM-OCR Local Provider

## Why
Users want a local OCR option that can turn documents into Markdown and then into themed HTML, with GPU acceleration when available, while keeping cloud OCR as a fallback for users without local hardware.

## What Changes
- Add a new local OCR provider backed by GLM-OCR served via vLLM's OpenAI-compatible API.
- Add configuration fields for GLM-OCR endpoint/model (and optional API key if required by the server).
- Convert GLM-OCR Markdown output to HTML using the existing Markdown pipeline and theme styling.
- Surface GLM-OCR in OCR settings alongside existing local/cloud providers.
- Add a clear UI label indicating GLM-OCR is GPU-recommended for best performance.

## Impact
- Affected specs: `document-ocr` (new capability)
- Affected code: `src-tauri/src/ocr/*`, `src-tauri/src/commands/ocr.rs`, `src/api/ocrCommands.ts`, `src/stores/settingsStore.ts`, `src/components/settings/OCRSettings.tsx`, `src/utils/documentAutoExtract.ts`, `src/utils/markdown.ts`, `src/components/viewer/DocumentViewer.tsx`
