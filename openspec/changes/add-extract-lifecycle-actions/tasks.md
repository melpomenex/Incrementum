# Implementation Tasks

## 1. Backend: storage & model
- [ ] 1.1 Migration `011_add_extract_dismissed.sql`
- [ ] 1.2 Add `is_dismissed` to `Extract` model + defaults
- [ ] 1.3 Update all extract read/write paths for `is_dismissed`
- [ ] 1.4 Filter dismissed in `get_due_extracts`, `get_new_extracts`
- [ ] 1.5 Add `update_extract_dismissed` repository method

## 2. Backend: commands
- [ ] 2.1 `forget_extract` (reset memory state)
- [ ] 2.2 `dismiss_extract` (set is_dismissed)
- [ ] 2.3 `graduate_extract` (schedule far future + high stability)
- [ ] 2.4 Register all three in `lib.rs`

## 3. Frontend
- [ ] 3.1 Wrappers in `api/extracts.ts`
- [ ] 3.2 Action buttons in extract review UI + dismissed badge

## 4. Spec
- [ ] 4.1 Write `specs/extract-lifecycle/spec.md`
