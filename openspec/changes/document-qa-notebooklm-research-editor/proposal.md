## Why

Document Q&A users need a faster path from source documents to usable study content. Adding NotebookLM-assisted research and inline editing in the same tab removes context switching and enables immediate conversion of research output into learning artifacts.

## What Changes

- Add a NotebookLM toggle within the Document Q&A tab to enable or disable NotebookLM-backed research workflows.
- Add an inline research editor that renders NotebookLM output as editable rich/plain text in an editor-like surface.
- Support text selection actions in the inline editor to create cloze deletions and Q&A cards directly from selected spans.
- Add brainstorming helpers (prompt chips/templates) for common research intents such as summarize, compare, timeline, and key concepts.
- Persist draft edits and generated study artifacts so users can refine content before saving to their study workflow.

## Capabilities

### New Capabilities
- `document-qa-notebooklm-research`: NotebookLM toggle, research request/response handling, and research session state in Document Q&A.
- `document-qa-inline-research-editing`: Inline editable research surface with selection-aware actions and draft persistence.
- `document-qa-study-artifact-generation`: Creation of cloze deletions, Q&A cards, and brainstorm-derived artifacts from selected or highlighted text.

### Modified Capabilities
- None.

## Impact

- Affected UI: Document Q&A tab toolbar, research panel, inline editor controls, and selection context actions.
- Affected integration: NotebookLM service/client adapter, request throttling, error handling, and feature flag/toggle behavior.
- Affected data model: Research drafts, generated artifact metadata, provenance links to source document spans.
- Affected systems: Card generation pipeline, potential analytics events for research actions and artifact creation.
