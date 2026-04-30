# Design: Streamline PDF OCR → Extract

## Current Flow
1. User enters OCR mode → selects region
2. `PdfOcrManager` captures canvas, runs OCR
3. On success → state becomes `previewing` → `OcrTextPreview` panel renders
4. User edits text (optional) → clicks "Create Extract"
5. `onCreateExtract` callback fires → `DocumentViewer` opens `CreateExtractDialog`

**Problem:** Step 3-4 forces every user through an edit panel. Most OCR results are good enough.

## New Flow
1. User enters OCR mode → selects region
2. `PdfOcrManager` captures canvas, runs OCR
3. On success with text → **auto-create extract** → exit OCR mode → show toast
4. Toast includes "Edit" button → opens `CreateExtractDialog` pre-filled with the extract
5. On failure/empty → show `OcrTextPreview` with retry controls (unchanged)

## Architecture Decisions

### AD-1: Direct API call for auto-create
Instead of routing through the CreateExtractDialog, call `createExtract()` directly in the `onCreateExtract` callback chain. This avoids the modal entirely.

**Why:** The CreateExtractDialog is a full form. We just need `createExtract({ document_id, content, page_number })`. No need for tags, category, or notes on the fast path — the user can add those later via Edit.

### AD-2: Edit action reopens with extract ID
The toast's "Edit" button stores the created extract's ID. Clicking it opens CreateExtractDialog in edit mode (not create mode) pre-populated from the extract data.

**Why:** This way the user's edits update the existing extract rather than creating a duplicate.

### AD-3: Remove OcrTextPreview from happy path
`OcrTextPreview` only renders in `error` or `processing` states. On `previewing` (successful OCR), we skip straight to extract creation. The `previewing` state becomes transient — it transitions to `idle` after the API call completes.

**Why:** Keeping the OcrTextPreview for retries is still valuable (wrong language, bad region). But it shouldn't gate the 90% case.

### AD-4: Toast component
Use the existing `useToast` hook (already used throughout the app) with an action button. Toast config:
- Message: "Extract created" + truncated preview (first ~80 chars)
- Action: "Edit" button
- Duration: ~5 seconds
- On click: open CreateExtractDialog with the extract ID

## File Changes

| File | Change |
|------|--------|
| `src/components/viewer/PDFViewer.tsx` | Modify `onCreateExtract` callback to auto-create + show toast instead of opening dialog; pass `documentId` context down; add toast action for edit |
| `src/components/viewer/DocumentViewer.tsx` | Change `onOcrExtractText` handler: call `createExtract` directly + show toast with Edit action; no longer open `CreateExtractDialog` by default |
| `src/components/viewer/OcrTextPreview.tsx` | No functional change needed (still used for error/retry); could add an optional "Edit & Create" prop for future |
| `src/components/extracts/CreateExtractDialog.tsx` | Add optional `extractId` prop to support edit mode pre-population |

## Key Implementation Details

### DocumentViewer changes (`onOcrExtractText` handler)
```typescript
onOcrExtractText={async (text, pageNum) => {
  try {
    const extract = await createExtract({
      document_id: currentDocument.id,
      content: text,
      page_number: pageNum,
    });
    toast.show({
      message: `Extract created: "${text.slice(0, 80)}${text.length > 80 ? '…' : ''}"`,
      action: { label: "Edit", onClick: () => {
        setEditExtractId(extract.id);
        setSelectedText(text);
        setIsExtractDialogOpen(true);
      }}
    });
  } catch (err) {
    toast.show({ message: "Failed to create extract", type: "error" });
  }
}}
```

### Toast action button
The existing `useToast` needs to support an `action` field (button in the toast). Check if it already does — if not, add it. This is a common toast pattern.
