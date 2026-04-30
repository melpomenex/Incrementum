# Proposal: Streamline PDF OCR → Extract Flow

## Intent

Currently, OCR in the PDF viewer forces every user through the OcrTextPreview edit modal before creating an extract. This adds friction for the common case where the OCR result is good enough. The user wants a **quick-extract** default (one-click → extract created, no modal) with an optional edit-before-save path.

## Scope

**In scope:**
- Change the default OCR flow to auto-create an extract from OCR results (no modal)
- Add a well-designed "Edit & Create" button in the OCR result feedback that opens the CreateExtractDialog pre-filled with OCR text
- Preserve the retry/cancel flow when OCR fails or returns empty text
- Show a brief confirmation toast after auto-extraction

**Out of scope:**
- Changes to the CreateExtractDialog itself (already well-designed)
- Changes to non-PDF OCR flows (video, image)
- Changes to text selection → highlight → extract flow

## Approach

1. **Auto-create on success:** When OCR produces text, immediately call `createExtract` with the OCR text and exit OCR mode. Show a toast with the result + an "Edit" action button.
2. **Toast with edit action:** The toast includes an "Edit" button that reopens the CreateExtractDialog pre-filled with the just-created extract's data, allowing the user to add tags, category, notes, etc.
3. **Remove the OcrTextPreview panel from the default flow:** The full edit panel (OcrTextPreview) only appears in error/retry scenarios, not the happy path.
4. **Flow states:** The OCR manager's `previewing` state transitions to `idle` (not modal). A new `created` transient state provides the toast context.
