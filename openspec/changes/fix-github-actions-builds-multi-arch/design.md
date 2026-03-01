## Context

Current release workflows in `.github/workflows/` are failing before all build jobs complete, and the failure signals are scattered across workflow, job, and step logs. The team needs a deterministic operator path using GitHub CLI to identify blockers quickly, plus workflow changes that expand architecture coverage without reducing build reliability.

The repository already uses GitHub Actions and `gh` automation for workflow/run inspection. This change must stay compatible with existing release triggers while adding architecture matrix behavior and standardized failure diagnostics.

## Goals / Non-Goals

**Goals:**
- Define a standard GH CLI triage path that pinpoints failing workflow jobs and step errors.
- Expand build workflows to produce artifacts for additional target architectures.
- Ensure architecture-specific failures are visible and actionable from workflow outputs.
- Keep existing primary release flow intact while introducing multi-arch coverage.

**Non-Goals:**
- Rebuild the entire release process or switch away from GitHub Actions.
- Introduce non-GitHub CI platforms.
- Add new product features unrelated to CI/build reliability and architecture output.

## Decisions

1. **Use GH CLI as the primary triage interface for failed builds**
- Decision: Standardize investigation commands around `gh run list`, `gh run view`, and job/step introspection.
- Rationale: GH CLI provides consistent, scriptable access to run metadata and logs without requiring manual UI navigation.
- Alternatives considered:
  - GitHub web UI-only debugging: slower and less repeatable.
  - Custom log scraping scripts only: adds maintenance overhead and duplicates GH CLI capabilities.

2. **Adopt an explicit architecture matrix in build workflows**
- Decision: Move architecture definitions into a matrix strategy and generate per-architecture artifacts with clear naming.
- Rationale: Matrix execution makes architecture coverage explicit and scalable as targets are added.
- Alternatives considered:
  - Separate workflow files per architecture: harder to keep synchronized.
  - Single-architecture builds with manual reruns: does not meet coverage goals.

3. **Require summary outputs that map failures to architecture and step**
- Decision: Add standardized workflow summary/reporting so each failed run identifies architecture, job, and failed step.
- Rationale: Reduces mean time to diagnose and avoids ambiguous “workflow failed” outcomes.
- Alternatives considered:
  - Depend on raw logs only: useful but too noisy for fast triage.

## Risks / Trade-offs

- **[Risk] Added architectures increase build time and CI cost** -> Mitigation: parallelize matrix jobs and tune caching/concurrency.
- **[Risk] Architecture-specific toolchain incompatibilities break previously stable workflows** -> Mitigation: add per-arch preflight checks and fail with explicit diagnostics.
- **[Trade-off] More CI complexity for broader artifact support** -> Mitigation: centralize matrix config and keep shared steps reusable.

## Migration Plan

- Baseline current failing runs using GH CLI and capture recurring failure signatures.
- Update GitHub Actions workflow(s) to use architecture matrix definitions and per-arch artifact naming.
- Add triage/reporting steps so failure outputs include architecture/job/step attribution.
- Validate with at least one full run covering all configured architectures.
- Rollback path: disable new architectures in matrix while retaining diagnostic improvements if stability issues occur.

## Open Questions

- Which exact architecture set is required for initial rollout (for example `x86_64`, `aarch64`, and OS-specific variants)?
- Should all architectures be required for release gating, or should some remain non-blocking initially?
- Do we need self-hosted runners for any architecture that GitHub-hosted runners cannot build reliably?
