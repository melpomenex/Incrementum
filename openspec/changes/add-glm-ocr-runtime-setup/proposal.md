# Change: Add GLM-OCR Runtime Setup (Ollama + vLLM)

## Why
Users want a one-click, cross-platform way to run GLM-OCR locally without manual installs. Most users will rely on CPU or integrated GPUs, while power users can use a GPU for higher throughput.

## What Changes
- Add an in-app setup flow for GLM-OCR that can download and configure a local runtime on Windows, macOS, and Linux.
- Use Ollama for CPU-friendly local OCR by default, and offer vLLM for GPU-accelerated setups.
- Manage runtime start/stop on demand and persist configuration in OCR settings.
- Keep cloud OCR as a separate manual API-key option in OCR providers (no MaaS setup wizard).

## Impact
- Affected specs: `ocr-runtime-setup` (new capability)
- Affected code: `src/components/settings/OCRSettings.tsx`, `src/components/onboarding/OCROnboarding.tsx`, `src/stores/settingsStore.ts`, `src/api/ocrCommands.ts`, `src-tauri/src/ocr/*`, `src-tauri/src/commands/*`, plus new runtime management modules.
