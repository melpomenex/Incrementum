# NotebookLM Integration

## Overview

Incrementum includes a NotebookLM integration workspace in `Integrations` for:

- Connecting a NotebookLM account/session
- Managing notebooks and sources
- Running chat/research prompts
- Generating study artifacts (flashcards, quiz, report, audio/video, mind map, data table)
- Previewing and syncing generated items into Incrementum learning items

## Feature Flag

- Frontend flag: `settings.features.notebooklmEnabled`
- Integration setting: `integration_settings.notebooklm.enabled`
- Backend setting file: `<app_data_dir>/notebooklm/settings.json`

If the flag is disabled, NotebookLM should be considered non-production for that user profile.

## Providers

NotebookLM provider modes:

- `mock` (default): local scaffold for development/testing without external dependencies
- `cli`: scaffold path intended for `notebooklm` CLI integration

Current implementation uses `mock` as the stable default and persists provider choice.

## Auth and Session Recovery

NotebookLM state files are stored under:

- `<app_data_dir>/notebooklm/auth.json`
- `<app_data_dir>/notebooklm/storage_state.json` (if provided)

On Unix-like systems these files are written with `0600` permissions.

Recovery workflow:

1. Open Integrations -> NotebookLM Workspace
2. Click `Disconnect` to clear stale session
3. Click `Connect` and choose provider
4. Validate status via connection message and notebook list

## Jobs and Status Model

Generation tasks are stored in:

- `<app_data_dir>/notebooklm/jobs.json`

Supported states:

- `queued`
- `running`
- `succeeded`
- `failed`
- `expired-auth`

`expired-auth` is set when command errors appear auth/session-related.

## Sync and Dedupe

Sync paths:

- Flashcard payload preview -> sync
- Quiz payload preview (`all` or `missed-only`) -> sync

Dedupe key is normalized `(question, answer)` against existing learning items.
When duplicates are found and dedupe is enabled, existing items are updated with merged tags.

## Telemetry / Logging

Backend emits tracing events for key lifecycle points:

- `notebooklm.connect`
- `notebooklm.disconnect`
- `notebooklm.settings.updated`
- `notebooklm.job.started`
- `notebooklm.job.succeeded`
- `notebooklm.job.failed`
- `notebooklm.sync.flashcards`
- `notebooklm.sync.quiz`
- `notebooklm.sync.preview`

Review logs to diagnose provider/runtime failures and high-latency flows.

## Known Stability Constraints

- NotebookLM upstream APIs are unofficial and can break without notice.
- `cli` provider is scaffolded but not fully implemented for live NotebookLM parsing.
- `mock` provider is intended for implementation progress and UI/workflow validation.

## Rollout Guidance

1. Keep NotebookLM disabled by default.
2. Enable per tester profile and validate core workflows:
   - source ingest
   - artifact generation
   - preview
   - sync to learning items
3. Monitor failures (`failed`, `expired-auth`) and only widen rollout after stability checks.
