## 1. Implementation
- [ ] 1.1 Add GLM-OCR provider type, config fields, and availability checks in Rust OCR module.
- [ ] 1.2 Implement GLM-OCR provider HTTP call to vLLM OpenAI-compatible API using base64 data URL inputs and Markdown output parsing.
- [ ] 1.3 Plumb new config fields through Tauri OCR commands and frontend `OCRConfig` types.
- [ ] 1.4 Update settings store defaults and validation to include the GLM-OCR provider and config.
- [ ] 1.5 Update OCR settings UI to surface GLM-OCR provider, configuration inputs, and a GPU-recommended label.
- [ ] 1.6 Convert GLM-OCR Markdown output to HTML using existing `renderMarkdown` pipeline and theme-aware HTML rendering.
- [ ] 1.7 Add or update tests for OCR provider selection, configuration, and Markdown rendering path.

## 2. Validation
- [ ] 2.1 Run OCR-related unit tests and any OCR workflow E2E tests that are impacted.
- [ ] 2.2 Manually verify GLM-OCR config UI fields appear and can be saved.
