# Proposal: FlashcardStudioModal Must Not Close Queue Tab on Escape

## Intent
When a user is in Scroll Mode or Optimal Queue Scroll Mode, selects text, right-clicks → "Create Flashcard", the FlashcardStudioModal opens. After creating flashcard(s) and closing the modal (via Escape or clicking X), the user is unexpectedly ejected from the queue tab entirely. The modal's close action bubbles to the queue's capture-phase Escape handler which closes the tab.

## Scope
In scope:
- FlashcardStudioModal close behavior when invoked from QueueScrollPage
- Escape key handling conflict between modal and queue scroll page
- ClozeCreatorPopup and QACreatorPopup close behavior (same issue if applicable)

Out of scope:
- FlashcardStudioModal behavior outside queue contexts (already correct)
- ReviewQueueView (does not embed FlashcardStudioModal)

## Approach
The QueueScrollPage registers a `keydown` listener at capture phase that calls `closeTab()` on every Escape press. The FlashcardStudioModal registers its own `keydown` listener at bubble phase. Since capture fires first, the tab closes before the modal can handle the event.

Fix: Guard the queue's Escape handler so it does not close the tab when a modal/popover is open. The FlashcardStudioModal, ClozeCreatorPopup, and QACreatorPopup are all portalled overlays — we can check for their presence via state flags already tracked in QueueScrollPage.
