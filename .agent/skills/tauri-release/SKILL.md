---
name: tauri-release
description: Automates the entire project release workflow, including version bumping across package.json, Cargo.toml, and tauri.conf.json, appending to CHANGELOG.md, committing and tagging in git, pushing to remote, and creating a GitHub release draft.
license: MIT
compatibility: Requires node and gh CLI.
metadata:
  author: Antigravity
  version: "1.0"
---

# Tauri Release Automation

This skill automates the workflow for preparing and triggering a new release of a Tauri application.

## Prerequisites

- **GitHub CLI (`gh`)** must be installed and authenticated (`gh auth status`).
- **Node.js** must be installed to run the bump script.

## Usage

Run the release script from the root of the project repository:

```bash
node scripts/release.js [version]
```

### Parameters

- `[version]` (optional): The target version to bump to (e.g. `1.47.9`). If omitted, it automatically increments the patch version (e.g., `1.47.8` -> `1.47.9`).

## What it does

1. Reads the current version from `package.json`.
2. Computes the target version (either auto-incremented patch or user-supplied).
3. Bumps version strings in:
   - `package.json`
   - `package-lock.json`
   - `src-tauri/tauri.conf.json`
   - `src-tauri/Cargo.toml`
4. Automatically formats and prepends the recent changes to the top of `CHANGELOG.md`.
5. Stages all modified files, creates a release commit (`chore: release v<version>`), and creates a git tag (`v<version>`).
6. Pushes the commit and tags to the remote repository (`origin main`), triggering the CI pipeline (GitHub Actions).
7. Uses the GitHub CLI to create a new draft Release on GitHub populated with the changelog description.
