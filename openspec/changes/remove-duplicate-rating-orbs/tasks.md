## 1. DocumentViewer — Add hideRatingOrbs prop

- [x] 1.1 Add `hideRatingOrbs?: boolean` prop to `DocumentViewer` component in `src/components/viewer/DocumentViewer.tsx`
- [x] 1.2 Gate the orb rating buttons section (~lines 4911-4991) behind `!hideRatingOrbs`

## 2. QueueScrollPage — Pass the prop

- [x] 2.1 In `src/pages/QueueScrollPage.tsx`, pass `hideRatingOrbs={true}` to the `DocumentViewer` instance rendered for document-type items

## 3. Verification

- [x] 3.1 Confirm no duplicate orbs in Scroll Mode (Optimal Session) with a document item
- [x] 3.2 Confirm orb rating buttons still appear in standalone Document view
