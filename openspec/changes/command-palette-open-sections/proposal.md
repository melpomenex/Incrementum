## Why

The command palette currently resolves and opens documents but does not let users jump directly to core app sections like Settings. Adding section navigation reduces clicks and makes the palette a single, fast navigation surface.

## What Changes

- Extend command palette search results to include app sections (for example: Settings) in addition to existing document results.
- Allow users to move through mixed results with keyboard arrows and activate the highlighted entry with Enter.
- Open the selected app section using the same palette selection flow users already use to open documents.
- Preserve existing document-opening behavior and ranking while adding section entries.

## Capabilities

### New Capabilities
- `command-palette-navigation`: Support searching, selecting, and opening application sections from the command palette alongside documents.

### Modified Capabilities
- None.

## Impact

- Affected code: command palette result construction, keyboard selection handling, and app navigation routing.
- Affected UX: command palette now acts as a unified navigation entry point for documents and app sections.
- Dependencies: no new external services expected; internal route/section identifiers must be exposed to palette search.
