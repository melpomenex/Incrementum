## 1. Add scrolloff state to vimModeStore

- [x] 1.1 Add `scrolloff: number` field (default `3`) to `src/stores/vimModeStore.ts`
- [x] 1.2 Add `setScrolloff(value: number)` action with clamping to `[0, 20]`
- [x] 1.3 On store initialization, read persisted scrolloff value from `useSettingsStore` and use it as initial value

## 2. Rewrite scrollToCursor with scrolloff logic

- [x] 2.1 Add a helper method `computeScrolloffPx()` to `VimCursorEngine.ts` — looks up the current cursor's line group height, returns `store.scrolloff * lineHeight` (fallback to token rect height if no line group)
- [x] 2.2 Rewrite the iframe branch of `scrollToCursor()`: change the boundary check from `tokenMid < 0 || tokenMid > viewportHeight` to `tokenTop < scrolloffPx || tokenBottom > viewportHeight - scrolloffPx`. When triggered, scroll by the minimum delta needed to restore the scrolloff margin (not center)
- [x] 2.3 Rewrite the main-document branch similarly: check `tokenTop < containerRect.top + scrolloffPx || tokenBottom > containerRect.bottom - scrolloffPx`, scroll minimum delta
- [x] 2.4 For large-jump motions (`G`, `gg`, `{`, `}`), keep the existing center-scroll behavior — detect these via a `isLargeJump: boolean` flag on `MotionResult` or by checking if the cursor moved more than N line groups
- [ ] 2.5 After `scrollTo`/`scrollBy`, call `refreshRects()` to update cached bounding rects for the new scroll position
- [x] 2.6 Add debouncing: if a scroll was triggered within the last 150ms, use `behavior: "instant"` instead of `behavior: "smooth"` to prevent animation queuing

## 3. Persist scrolloff to app settings

- [x] 3.1 Add `vimScrolloff` key to the settings persistence layer — write to `useSettingsStore` whenever `setScrolloff()` is called
- [x] 3.2 Ensure the vimModeStore reads the persisted value on app startup / store init

## 4. Add scrolloff UI control to settings

- [x] 4.1 Add a "Cursor Scroll Margin (scrolloff)" slider (range 0–20, step 1) to the Vim Reading section in `KeyboardShortcutsSettings.tsx`
- [x] 4.2 Wire the slider to `vimModeStore.setScrolloff()`
- [x] 4.3 Add a brief description label: "Lines to keep visible above/below the cursor while scrolling"

## 5. Testing

- [ ] 5.1 Unit test: `computeScrolloffPx()` returns correct pixel value for various scrolloff settings and line heights
- [ ] 5.2 Unit test: `scrollToCursor()` scrolls when cursor is within scrolloff zone but still visible, and does NOT scroll when cursor is well within the safe zone
- [ ] 5.3 Unit test: `scrollToCursor()` uses center behavior for large jumps and minimum-delta behavior for single-line motions
- [ ] 5.4 Unit test: `scrollToCursor()` with `scrolloff=0` behaves identically to the old edge-triggered logic
- [ ] 5.5 Unit test: `setScrolloff()` clamps values to [0, 20]
- [ ] 5.6 Integration test: navigate with `j` through a long document, verify the document scrolls before cursor reaches the bottom edge, maintaining 3 lines of visible text below cursor
