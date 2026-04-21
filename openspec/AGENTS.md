# OpenSpec Workflow

This repo carries its OpenSpec workflow for Codex in repo-local prompt files under `.codex/prompts/` and mirrored skills under `.codex/skills/`.

## Codex Invocation

Some Codex builds may register repo-local prompt files as slash commands. If your Codex client does that, these wrappers may appear:

- `/opsx:explore`
  Think through ideas, investigate architecture, and clarify requirements without implementing application code.
- `/opsx:propose <name-or-description>`
  Create a new OpenSpec change and generate the proposal/design/tasks artifacts needed to start implementation.
- `/opsx:apply <change-name>`
  Implement tasks from an OpenSpec change, using the change artifacts as context.
- `/opsx:archive <change-name>`
  Archive a completed change and sync its delta specs into the main `openspec/specs/` tree.

In this repository, the supported Codex path is to invoke the matching skills directly in plain language:

- `openspec-explore`
- `openspec-propose`
- `openspec-apply-change`
- `openspec-archive-change`

Examples:

- "Use `openspec-explore` to think through offline sync."
- "Use `openspec-propose` to create a change for offline sync."
- "Use `openspec-apply-change` for `add-offline-sync`."
- "Use `openspec-archive-change` for `add-offline-sync`."

Do not assume `.codex/prompts/` will be auto-registered as slash commands in every Codex runtime.

## Repo Layout

- `openspec/project.md`: project context used by OpenSpec
- `openspec/config.yaml`: OpenSpec configuration
- `openspec/specs/`: main capability specs
- `openspec/changes/`: active and archived change proposals
- `.codex/prompts/opsx-*.md`: optional slash-command prompt definitions for Codex builds that support repo-local prompt registration
- `.codex/skills/openspec-*`: the supported Codex skill entry points for this workflow

## CLI Equivalents

The workflow wrappers are thin adapters around the OpenSpec CLI:

- `openspec list`
- `openspec status --change <name>`
- `openspec instructions <artifact> --change <name>`
- `openspec new change <name>`
- `openspec archive <name>`
- `openspec validate <name> --strict`

## Typical Flow

1. Use `openspec-explore` if the work is still fuzzy.
2. Use `openspec-propose` to create or refine a change.
3. Use `openspec-apply-change` to implement the change tasks.
4. Use `openspec-archive-change` after implementation is complete and specs are ready to sync.
