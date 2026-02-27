## Context

Incrementum already includes NotebookLM integration logic in the Tauri backend, including runtime candidate resolution and fallback bootstrap behavior. In development, users can run NotebookLM via an activated venv, but AppImage users do not reliably get a working runtime because packaged paths, executable permissions, environment variables, and runtime asset completeness can diverge from dev assumptions.

The project already carries prebuilt runtime assets under `src-tauri/bin/notebooklm-runtime/<triple>/` and runtime lookup code in `src-tauri/src/notebooklm.rs`. The change should align packaging and runtime launch behavior so the packaged AppImage can execute NotebookLM without external setup.

## Goals / Non-Goals

**Goals:**
- Make NotebookLM work in AppImage using bundled runtime artifacts only.
- Guarantee runtime discovery picks packaged assets first and uses deterministic paths.
- Ensure required environment values (`PYTHONPATH`, runtime home, Playwright/browser paths) are set consistently in packaged execution.
- Add validation checks so missing/incomplete runtime assets surface clear diagnostics.
- Define build/release validation for NotebookLM in packaged Linux artifacts.

**Non-Goals:**
- Re-architect NotebookLM feature behavior or frontend UX.
- Add support for new providers beyond existing NotebookLM modes.
- Fully redesign cross-platform packaging for all operating systems in this change.

## Decisions

1. **Treat bundled runtime as primary for packaged builds**
- Decision: When running from packaged AppImage context, resolve NotebookLM from bundled runtime location first and only fall back to managed bootstrap/system CLI when explicitly needed.
- Rationale: AppImage users should not depend on host Python tooling; deterministic in-bundle runtime reduces environment drift.
- Alternatives considered:
  - Keep current fallback-first behavior: easier short term but leaves AppImage non-deterministic.
  - Force managed runtime install on first run: increases startup time and requires host Python/network availability.

2. **Introduce runtime manifest validation before first command execution**
- Decision: Validate expected runtime layout (`python` executable, `site-packages/notebooklm`, optional playwright/browser payload) at startup/health-check boundaries.
- Rationale: Detecting incomplete packaging early yields actionable errors instead of late command failures.
- Alternatives considered:
  - Lazy failure only when command execution breaks: poor diagnosability.
  - Build-time validation only: insufficient if packaged file permissions or extraction behavior differ at runtime.

3. **Codify AppImage packaging inputs for NotebookLM runtime**
- Decision: Explicitly declare NotebookLM runtime directories and binaries in Linux packaging/build scripts/config used for AppImage creation.
- Rationale: Avoid silent omission of large runtime trees and ensure reproducible builds.
- Alternatives considered:
  - Rely on implicit inclusion from current folder structure: brittle under refactors.
  - Download runtime during app startup: adds network dependency and failure modes.

4. **Standardize runtime execution environment construction**
- Decision: Build a single environment assembly path for NotebookLM commands (Python home, site-packages path, Playwright/browser path, PATH extension) used by both health checks and command execution.
- Rationale: Consistent env setup prevents dev/package divergence and reduces one-off command bugs.
- Alternatives considered:
  - Per-command env setup: easy to drift and harder to test.

## Risks / Trade-offs

- **[Risk] AppImage size growth due to bundled Python + browser assets** -> Mitigation: document expected size change; optionally split browser payload strategy in a follow-up.
- **[Risk] Runtime assets become stale relative to `notebooklm-py` updates** -> Mitigation: pin runtime manifest/version metadata and include a controlled refresh workflow.
- **[Risk] Linux distro compatibility for bundled interpreter/libs** -> Mitigation: validate on target distros in CI/release checklist and keep fallback diagnostics clear.
- **[Trade-off] Deterministic bundling over dynamic install** -> Mitigation: accept larger artifact for predictable offline behavior.

## Migration Plan

- Add/update packaging declarations for NotebookLM runtime assets in Linux AppImage build configuration.
- Update runtime resolution + validation flow in NotebookLM backend module.
- Add diagnostic logging/error messages specific to missing bundled runtime components.
- Build AppImage and run NotebookLM smoke checks (health, notebook listing, at least one command execution path).
- If regressions appear, rollback by restoring previous runtime selection logic and disabling bundled-first enforcement via guarded flag/config.

## Open Questions

- Should Playwright browser binaries be fully bundled for Linux or partially deferred with a guided first-run install?
- Do we want one runtime per architecture committed to repo, or generated during release and injected into build artifacts?
- Should managed bootstrap remain enabled by default in AppImage, or be disabled to enforce strictly bundled behavior?
