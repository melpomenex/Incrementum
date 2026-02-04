## Context
We already support multiple OCR providers in Rust and expose a settings UI in the desktop app. We need a new local provider that uses GLM-OCR, which is intended to run behind a vLLM OpenAI-compatible endpoint. The output should be Markdown and then rendered as themed HTML using the existing Markdown rendering pipeline.

## Goals / Non-Goals
- Goals:
  - Add a GLM-OCR local provider using a vLLM OpenAI-compatible endpoint.
  - Convert GLM-OCR Markdown output to HTML using existing Markdown rendering and theme classes.
  - Keep existing OCR providers and UI patterns intact.
- Non-Goals:
  - Replace the existing OCR pipeline for non-GLM providers.
  - Build a full GLM-OCR server installer or auto-downloader.

## Decisions
- Decision: Implement GLM-OCR as a new OCR provider type in `src-tauri/src/ocr/providers.rs`.
  - Rationale: Keeps provider selection consistent with existing OCR routing and availability checks.
- Decision: Communicate with GLM-OCR through vLLM's OpenAI-compatible `chat/completions` endpoint using base64 data URLs for image inputs.
  - Rationale: Data URLs avoid vLLM local media path configuration and reduce setup friction for users. We can stream smaller payloads per image and avoid requiring filesystem access by the vLLM process.
- Decision: Store GLM-OCR configuration in OCR settings (endpoint, model, optional API key) and surface those fields when the provider is selected.
  - Rationale: Matches existing provider configuration patterns and keeps the UI simple.
- Decision: Treat GLM-OCR output as Markdown, then pass through `renderMarkdown` and existing themed HTML wrappers.
  - Rationale: Reuses existing Markdown->HTML renderer and theme styles without introducing new pipelines.

## Risks / Trade-offs
- Base64 data URLs increase payload size compared to file paths. We should send per-page/per-image requests and avoid batching large PDFs in a single request.
- GLM-OCR may not be CPU-friendly depending on model size; we will not assume CPU availability and keep cloud OCR providers as fallback. The UI should surface a clear GPU recommendation.

## Migration Plan
- No data migration required. Existing settings remain valid; GLM-OCR fields are optional and only used when the provider is selected.

## Open Questions
- None.
