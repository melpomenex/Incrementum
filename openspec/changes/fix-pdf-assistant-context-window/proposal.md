# Change: Fix PDF assistant context window delivery

## Why
PDF reading currently exposes an Assistant panel, but the context sent to the chosen LLM service is not reliable. A user can be reading a PDF, ask for a summary of the section they are currently on, and still get a response saying the model does not have the necessary context.

The current flow depends on a live PDF.js text-window callback populating `context.content` before the assistant request is made. That creates several failure modes:
- The visible PDF window has not finished extracting text when the user asks a question.
- The PDF has a weak or missing text layer, so the live extraction path yields little or no text.
- The assistant request does not include section-aware anchors, so prompts like "summarize section 4.5" are not tied to the user’s current heading/location.
- When no PDF context is available, the system silently falls back to an effectively empty document context instead of surfacing a clear reason or trying a stronger fallback.

This breaks the core expectation that asking a question while positioned on a PDF section should feed that section into the provider/model the user selected.

## What Changes
- Make PDF assistant context assembly deterministic instead of best-effort:
  - Build the request from a dedicated PDF context resolver, not directly from transient viewer state alone.
  - Require the resolver to return either usable context or an explicit "context unavailable" reason before the LLM call is made.
- Add a fallback chain for PDF context:
  - Prioritize user selection when present.
  - Otherwise use the current page plus adjacent pages around the active reading position.
  - If the PDF text layer is insufficient, fall back to OCR/HTML-derived text already available for the document.
  - If no usable text source exists, return a user-visible failure state instead of sending an empty context payload.
- Make PDF context section-aware:
  - Include current page, nearby pages, and current outline/heading label when available.
  - Treat prompts like "this section", "section 4.5", or "the heading I’m on" as requests against the active reading location even if the query terms do not strongly match the extracted text.
- Preserve provider independence:
  - The same resolved PDF context must be sent to whichever LLM provider/model the user selected.
  - Context-window trimming must happen after the PDF-specific fallback resolution so the chosen service receives the best available excerpt within budget.
- Add observability and UX guards:
  - Log when PDF context is empty, truncated, or sourced from fallback OCR/HTML text.
  - Show a clear assistant-side message when the app cannot assemble PDF context, instead of letting the model answer as though no context exists.

## Impact
- Affected specs:
  - `assistant-document-context` (strengthen PDF context guarantees and failure handling)
- Affected code:
  - `src/components/viewer/PDFViewer.tsx`
  - `src/components/viewer/DocumentViewer.tsx`
  - `src/components/viewer/DocumentViewerWrapper.tsx`
  - `src/components/assistant/AssistantPanel.tsx`
  - `src/components/assistant/PwaAssistantButton.tsx`
  - `src/api/llm/index.ts`
  - `src-tauri/src/commands/llm.rs`
- Related changes:
  - `openspec/changes/add-web-reading-collections/specs/assistant-document-context/spec.md`
  - OCR-related changes such as `fix-ocr-html-full-pdf` and `add-glm-ocr-provider` should be treated as fallback sources, not prerequisites for basic PDF context delivery.
