## Why

In vim normal mode, pressing `j`/`k` moves the cursor to the next/previous line, but the document **only scrolls after the cursor has already left the viewport**. The user can navigate the cursor all the way to the top or bottom edge of the visible area without any scroll occurring. This means the cursor frequently goes off-screen before the view catches up — a jarring experience that breaks reading flow and makes it impossible to comfortably scan for passages to highlight.

Vim's `scrolloff` setting keeps the cursor at least N lines away from the top/bottom edge, scrolling the view proactively as the cursor approaches the boundary. This change brings that same smooth, proactive scrolling to Incrementum's vim reading mode.

## What Changes

- Add a **`scrolloff` behavior** to `scrollToCursor()` in `VimCursorEngine.ts` — instead of only scrolling when the cursor is completely out of view, scroll proactively when the cursor approaches within a configurable margin of the viewport edge
- Add a **`scrolloff` setting** (default: 3 lines) to `vimModeStore.ts` so users can customize the buffer zone
- Add a **`scrolloff` slider** to the Vim Reading settings section in KeyboardShortcutsSettings
- Ensure all vertical motions (`j`, `k`, `w`, `b`, `e`, `{`, `}`, `G`, `gg`) trigger proactive scrolling
- Handle both iframe viewers (EPUB/PDF) and main-document viewers (Markdown/HTML)

## Capabilities

### Modified Capabilities
- `vim-cursor-navigation`: Scroll behavior upgraded from reactive (only when cursor off-screen) to proactive (scroll before cursor reaches edge, respecting scrolloff margin)

### New Capabilities
- `vim-scrolloff-setting`: User-configurable scrolloff value (0–20 lines) persisted in settings, exposed in the Vim Reading settings panel

## Impact

- **VimCursorEngine.ts**: `scrollToCursor()` rewritten to use a scrolloff margin instead of edge-triggered scrolling
- **vimModeStore.ts**: New `scrolloff` state field with setter action
- **KeyboardShortcutsSettings.tsx**: New scrolloff slider control in the Vim Reading section
- **Existing behavior preserved**: Users with `scrolloff=0` get the current edge-triggered behavior as a fallback
