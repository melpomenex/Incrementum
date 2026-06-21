# Implementation Tasks

## 1. Backend
- [ ] 1.1 Define `CardSourceContext` response struct (`document_id`, `document_title`, `extract_id`, `extract_snippet`, `page_number`, `source_url`)
- [ ] 1.2 Implement `get_card_source_context` Tauri command in `commands/review.rs`
- [ ] 1.3 Register command in `lib.rs`

## 2. Frontend
- [ ] 2.1 Add `CardSourceContext` type + `getCardSourceContext` wrapper to `api/review.ts`
- [ ] 2.2 Create `src/components/review/CardSourceContext.tsx` (collapsed summary + expandable snippet)
- [ ] 2.3 Render `CardSourceContext` inside `ReviewCard.tsx` (above answer, below question)
- [ ] 2.4 Add `showSourceContext` review preference to settings type + SettingsPage toggle

## 3. Spec
- [ ] 3.1 Write `specs/review-source-context/spec.md`
