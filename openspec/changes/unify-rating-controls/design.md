## Context

The app has two separate rating UI surfaces for documents:

1. **Orb buttons** (QueueScrollPage.tsx lines 2335-2456) — circular `rounded-full` buttons positioned on the right side of the window via `absolute right-6 top-1/2 -translate-y-1/2`. Four color-coded orbs (red/orange/blue/green) for reviewed docs, single "Mark as Read" orb for new docs. Always visible, no hover interaction needed.

2. **Hover bar** (HoverRatingControls.tsx) — an invisible 32px hover zone at the bottom of the screen in DocumentViewer that reveals a full-width rating bar on mouse proximity. Also has a compact floating "Rate" pill mode for mobile EPUB. Only used in DocumentViewer.tsx (line 4833).

Both call the same backend (`rateDocument` / `rateDocumentEngaging`) with different handler paths. The orb buttons use `rateDocumentEngaging` (FSRS-6 with engagement), while HoverRatingControls uses `rateDocument` (basic FSRS).

## Goals / Non-Goals

**Goals:**
- Remove HoverRatingControls entirely — both hover-bar and compact-mode variants
- Add orb-style rating buttons to DocumentViewer, matching the QueueScrollPage pattern
- Keep keyboard shortcuts (1-4) working in document viewer context
- Use `rateDocumentEngaging` for the new orb buttons (consistent with queue behavior)

**Non-Goals:**
- Changing the ReviewSession grid buttons or inline flashcard/extract rating buttons
- Changing the Zen review mode or QuickReviewWidget
- Changing PriorityControl (that's priority, not FSRS rating)
- Extracting a shared RatingOrbs component (the duplication is manageable and the two contexts have different handlers)

## Decisions

### 1. Inline the orb buttons in DocumentViewer rather than extracting a shared component

**Rationale:** QueueScrollPage orbs use `rateDocumentEngaging` / `submitReview` / `markItemReadAuto` / `submitExtractReview` depending on item type, while DocumentViewer only needs `rateDocument` via `handleRating`. The JSX is ~120 lines but differs enough in handlers and conditions that a shared component would need excessive prop drilling. Inline duplication is simpler and clearer.

**Alternative:** Extract a `RatingOrbs` component. Rejected because the two call sites have fundamentally different rating backends and navigation logic, making a shared component awkward.

### 2. Position orbs at `absolute right-4 top-1/2 -translate-y-1/2` in DocumentViewer

**Rationale:** Same positioning as QueueScrollPage but using `right-4` instead of `right-6` to avoid conflicting with the DocumentMinimap (positioned at `right-2`). The minimap is semi-transparent (`opacity-50`) and only shows for PDF/EPUB/Markdown/HTML, so slight overlap is acceptable. The orbs sit above the minimap in z-order.

### 3. Move keyboard shortcut (1-4) handling into DocumentViewer's existing keydown listener

**Rationale:** Currently HoverRatingControls registers its own keydown listener. After removal, DocumentViewer's existing `useEffect` at line 2427 should handle keys 1-4 directly, calling the existing `handleRating` function. This is cleaner than having a separate listener.

### 4. Remove compactMode / mobile EPUB floating pill

**Rationale:** The orb pattern works on mobile too — the orbs are small circular buttons positioned on the side. No separate mobile treatment needed.

## Risks / Trade-offs

- **Risk: Orbs overlap with DocumentMinimap** → Mitigation: orbs get higher z-index (`z-40`) and the minimap is already semi-transparent. If conflict is severe, can adjust minimap position slightly.
- **Risk: Orbs obscure EPUB content** → Mitigation: orbs are small (48px) and positioned at the far right edge. Same trade-off already accepted in QueueScrollPage.
- **Risk: Rating API divergence** → The existing DocumentViewer `handleRating` uses `rateDocument` (basic), while queue uses `rateDocumentEngaging`. Switching to `rateDocumentEngaging` changes scheduling behavior slightly. → Mitigation: this is actually an improvement — engagement-aware scheduling is more accurate.
