# NotebookLM Document Q&A Rollout Runbook

## Scope

This runbook covers staged rollout of NotebookLM research mode in the Document Q&A tab, including inline editing and selection-based artifact generation.

## Feature Flags

- `settings.features.notebooklmEnabled`: master toggle for Document Q&A NotebookLM workflows.
- Rollout starts disabled by default and is enabled for internal testers first.

## Rollout Stages

1. Internal QA
- Enable `notebooklmEnabled` for test accounts.
- Validate research query success/failure paths.
- Verify draft autosave and recovery after refresh.
- Validate cloze/Q&A draft generation and card commit flow.

2. Limited Cohort
- Enable for a small cohort.
- Track request latency, request failure rate, and artifact save success rate.
- Monitor duplicate card creation and rollback if duplicate rates spike.

3. General Availability
- Enable by default for all users with a kill switch retained.
- Continue monitoring telemetry and error categories.

## Rollback Plan

1. Set `settings.features.notebooklmEnabled = false`.
2. Confirm NotebookLM controls are hidden from Document Q&A.
3. Verify baseline Document Q&A remains available.
4. Keep persisted sessions intact to support later re-enable.

## Operational Checks

- NotebookLM command health returns connected state when expected.
- Research orchestration applies retry/timeout logic.
- Selection validation blocks empty/invalid card-generation requests.
- Saved artifacts include session provenance tags.

## Ownership

- Frontend owner: Document Q&A tab maintainers.
- Integration owner: NotebookLM/Tauri command maintainers.
- Release owner: application release manager.
