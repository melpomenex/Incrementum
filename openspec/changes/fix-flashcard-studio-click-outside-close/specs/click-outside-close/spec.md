# FlashcardStudio Click-Outside-to-Close

## Spec

### Backdrop click handler
- The outer backdrop `div` (`className="fixed inset-0 z-[120]..."`) must have an `onClick` handler that calls `onClose()`
- The inner modal panel `div` (`className="flex h-[90vh] w-full max-w-7xl..."`) must call `e.stopPropagation()` on click to prevent closing when interacting with the modal content

### Consistency
- Matches the existing pattern used by image lightboxes in the same file (lines 2043-2057, 2265-2268)

### No behavior changes
- ESC handling remains unchanged (cascade: editing card → chat view → close modal)
- Modal open/close state management unchanged
- No changes to keyboard shortcuts
