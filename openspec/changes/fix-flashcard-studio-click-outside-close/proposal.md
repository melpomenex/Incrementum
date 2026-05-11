# Fix: FlashcardStudio Click-Outside-to-Close

## Problem

When a user opens the FlashcardStudio modal from the scroll queue (Optimal Session), there is no way to dismiss the modal by clicking outside of it. The user must press Escape — but Escape is also the key to exit the scroll queue entirely. This creates a frustrating two-step escape where the user has to:

1. Press Escape to close the FlashcardStudio modal
2. Press Escape again to close the scroll queue tab

There is no click-outside-to-close behavior on the FlashcardStudio backdrop, unlike the image lightbox modals in the same file which do support it.

## Root Cause

`FlashcardStudioModal` renders a full-screen backdrop `div` (line ~3933) but has no `onClick` handler on it. The inner modal content `div` does not call `e.stopPropagation()`, so a click handler on the backdrop would naturally fire when clicking outside the modal panel — but no handler exists.

## Proposed Fix

Add an `onClick` handler to the backdrop `div` that calls `onClose()`, and add `e.stopPropagation()` on the inner modal panel `div` to prevent clicks inside the modal from bubbling to the backdrop.

This is consistent with the existing lightbox patterns in the same file (lines 2043-2057, 2265-2268) which already use this backdrop-click-to-close pattern.
