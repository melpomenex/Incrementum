# GitHub Actions Failure Baseline

Last updated: 2026-03-01 (UTC)
Repository: `melpomenex/incrementum-tauri`

## Source runs reviewed

- Build Incrementum: https://github.com/melpomenex/incrementum-tauri/actions/runs/22513271731
- Release: https://github.com/melpomenex/incrementum-tauri/actions/runs/22513271736
- Mobile Build Incrementum: https://github.com/melpomenex/incrementum-tauri/actions/runs/22513271758

## Recurring blocking signatures

1. Linux deb verification false-negative
- Workflow/job: `Build Incrementum` -> `build (ubuntu-latest)`
- Failed step: `Verify Linux deb bundle includes NotebookLM runtime`
- Error: `Missing whisper sidecar in ... .deb`
- Mapping: `.github/workflows/build.yml` + `scripts/verify-deb-bundle.sh`

2. Windows NSIS bundle failure with NotebookLM runtime payload
- Workflow/job: `Build Incrementum` -> `build (windows-latest)`
- Failed step: `Build Tauri application (Windows)`
- Error: NSIS `failed opening file ... notebooklm-runtime ... manifest.json` and `failed to bundle project`
- Mapping: `.github/workflows/build.yml` and `.github/workflows/release.yml` Windows build path

3. Arch package link failure (sqlite)
- Workflow/job: `Build Incrementum` -> `build-arch`
- Failed step: `Create Pacman package`
- Error: `/usr/bin/ld: /usr/lib/libsqlite3.so.0: error adding symbols: DSO missing from command line`
- Mapping: `.github/workflows/build.yml` (`build-arch` job); same risk in `.github/workflows/release.yml` (`release-arch` job)

## Intended remediation in this change

- Add GH CLI triage automation and workflow summary output to make failures quickly attributable by architecture/job/step.
- Introduce explicit architecture matrix metadata (`id`, `arch`, `required`) and optional/non-blocking targets.
- Stabilize Arch packaging builds by forcing explicit sqlite linker configuration.
