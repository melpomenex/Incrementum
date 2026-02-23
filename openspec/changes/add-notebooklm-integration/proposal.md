## Why

Incrementum currently lacks a direct path from external research workflows into incremental study. Integrating NotebookLM enables users to turn mixed-source research into reusable study artifacts (especially flashcards and guides) and sync those outputs into Incrementum's review system.

## What Changes

- Add NotebookLM account connection and notebook linking inside Incrementum.
- Add in-app NotebookLM actions: create/select notebooks, add sources (URL/file/YouTube/text), ask questions, and run research workflows.
- Add artifact generation flows (flashcards, quizzes, study guides, audio/video overviews, mind maps, data tables) and surface progress/results in Incrementum.
- Add sync-to-Incrementum workflows so NotebookLM outputs can be imported as cards, notes, and study decks with incremental scheduling metadata.
- Add idea-driven quick actions so users can start common flows quickly, including:
- "Research a topic, produce a study guide, and schedule review cards."
- "Generate flashcards from a notebook and import to a target deck."
- "Generate a quiz and turn missed items into review cards."
- "Create an audio overview and attach it to a study item."
- "Export mind map/data table content into structured notes."
- Add reliability guardrails for an unofficial upstream API (auth/session expiry handling, retries, and feature flagging).

## Capabilities

### New Capabilities

- `notebooklm-in-app-workspace`: Connect NotebookLM and manage notebooks/sources/chat/research within Incrementum.
- `notebooklm-artifact-generation`: Generate and view NotebookLM artifacts (flashcards, quizzes, reports, audio/video, mind maps, tables) from Incrementum.
- `notebooklm-study-sync`: Convert NotebookLM outputs into Incrementum-native study entities and schedule incremental review.

### Modified Capabilities

- None.

## Impact

- Affected code: frontend assistant/research UX, backend integration layer, task/job orchestration, import pipeline, and scheduling pipeline.
- External dependency: `notebooklm-py` (unofficial Google NotebookLM API wrapper) and associated auth/session management.
- API/data impact: new internal endpoints/commands for NotebookLM operations; new mapping format from NotebookLM artifacts to Incrementum card/note models.
- Operational impact: background task polling for long-running generation jobs; additional observability for upstream failures and rate limits.
