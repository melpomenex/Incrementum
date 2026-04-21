## 1. Context Assembly
- [ ] 1.1 Introduce a dedicated PDF assistant-context resolver that assembles selection, page-window text, page metadata, and fallback document text before an LLM request.
- [ ] 1.2 Ensure assistant requests wait for the resolver result and never send an empty PDF context silently.
- [ ] 1.3 Preserve the resolved context across desktop assistant panel and PWA assistant entry points.

## 2. Fallbacks And UX
- [ ] 2.1 Add fallback use of OCR/HTML-derived PDF text when live PDF.js page extraction is unavailable or insufficient.
- [ ] 2.2 Add explicit assistant-facing error states for "PDF context not ready" and "PDF text unavailable".
- [ ] 2.3 Include current page/section metadata in the resolved context so section-relative prompts can be grounded to the active reading position.

## 3. Validation
- [ ] 3.1 Add tests for text-layer PDFs, scanned/OCR PDFs, and race conditions where the user asks before page extraction finishes.
- [ ] 3.2 Verify that the same resolved PDF context is passed through to each supported LLM provider path.
- [ ] 3.3 Run `openspec validate fix-pdf-assistant-context-window --strict`.
