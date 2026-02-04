## Context
GLM-OCR supports deployment with vLLM, SGLang, and Ollama, and documents how to run vLLM with an OpenAI-compatible API endpoint. We already added a GLM-OCR provider that speaks to an OpenAI-compatible endpoint; this change adds first-run setup and runtime management so users do not have to install or operate a server manually.

## Goals / Non-Goals
- Goals:
  - Provide an in-app setup flow for GLM-OCR that works on Windows, macOS, and Linux.
  - Use Ollama for CPU-friendly setups, and offer vLLM for GPU-accelerated setups.
  - Install into the app data directory and start/stop the runtime on demand.
  - Persist and validate runtime configuration (endpoint, model, backend type).
- Non-Goals:
  - Provide a managed cloud OCR service (MaaS) setup flow.
  - Replace existing OCR providers or cloud API-key workflows.

## Decisions
- Decision: Implement a GLM-OCR Setup Wizard inside OCR settings.
  - Rationale: Users already configure OCR providers there, and setup is optional.
- Decision: Default to Ollama for CPU installs and offer vLLM for GPU installs.
  - Rationale: Ollama is easier to run on CPU systems, while vLLM provides better GPU throughput.
- Decision: Store runtime binaries and downloaded models in the app data directory.
  - Rationale: Predictable permissions and easier cleanup per user.
- Decision: Manage runtime lifecycle with start/stop and health checks per session.
  - Rationale: Avoid background services by default, reduce resource usage, and support on-demand OCR.

## Risks / Trade-offs
- vLLM GPU support varies by OS and GPU driver availability; the setup must detect capabilities and provide clear fallbacks.
- Ollama and vLLM have different model naming and configuration requirements; mapping GLM-OCR models must be explicit in the UI.
- Auto-downloading models can be large; the setup should show expected disk usage and allow cancellation.

## Migration Plan
- No data migration required. New runtime settings are additive and optional.

## Open Questions
- None.
