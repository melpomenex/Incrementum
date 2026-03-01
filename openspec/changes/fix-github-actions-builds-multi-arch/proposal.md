## Why

Recent GitHub Actions build runs are failing before producing all expected artifacts, which blocks reliable releases. We need a repeatable workflow to diagnose failures with GitHub CLI and expand CI packaging coverage to additional architectures.

## What Changes

- Add a CI troubleshooting workflow that uses `gh` commands to inspect failed workflow runs, jobs, and step-level errors.
- Add multi-architecture build support in GitHub Actions so releases are produced for more target CPU architectures.
- Define validation expectations for architecture coverage and failure visibility in CI outputs.

## Capabilities

### New Capabilities
- `github-actions-multi-arch-builds`: Define requirements for diagnosing failed GitHub Actions builds and producing release artifacts across multiple architectures.

### Modified Capabilities
- None.

## Impact

- Affected systems: GitHub Actions workflows under `.github/workflows/`.
- Affected tooling: GitHub CLI (`gh`) usage for operational diagnosis and run triage.
- Affected release outputs: Architecture-specific desktop build artifacts and workflow summary outputs.
