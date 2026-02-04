## 1. Implementation
- [ ] 1.1 Add runtime settings schema for GLM-OCR backend selection (Ollama/vLLM), install status, endpoint, model, and data directory.
- [ ] 1.2 Implement a Tauri-side runtime manager with start/stop, health checks, and status reporting for Ollama and vLLM.
- [ ] 1.3 Implement installer/download flow for Ollama binaries and model pull into app data directory (opt-in).
- [ ] 1.4 Implement vLLM setup flow (GPU path), including dependency checks and model download instructions, with clear fallback to Ollama.
- [ ] 1.5 Wire the setup wizard into OCR settings UI with progress, disk usage, and error handling.
- [ ] 1.6 Connect the OCR provider config to the runtime manager so selecting GLM-OCR can start the runtime on demand.
- [ ] 1.7 Add telemetry-safe logging and failure UX for setup/start errors.
- [ ] 1.8 Add tests for runtime state transitions and settings persistence.

## 2. Validation
- [ ] 2.1 Run OCR-related unit tests and settings validation tests.
- [ ] 2.2 Manual smoke test: setup wizard, start/stop runtime, run OCR and toggle PDF/OCR HTML view.
