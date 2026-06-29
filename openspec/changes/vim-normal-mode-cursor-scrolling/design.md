## Context

The vim reading mode (`src/utils/vim/VimCursorEngine.ts`) already has a `scrollToCursor()` method that fires after every motion via `applyMotion()`. Currently it checks if the cursor token midpoint is outside the viewport bounds (`tokenMid < 0 || tokenMid > viewportHeight` for iframes, `tokenMid < containerRect.top || tokenMid > containerRect.bottom` for main document), and if so, scrolls to center the cursor.

The problem is purely reactive — the cursor must be *completely off-screen* before scrolling triggers. There is no concept of a buffer zone or margin. The `vimModeStore` has no scroll-related state fields.

The line grouper (`src/utils/vim/lineGrouper.ts`) already produces `LineGroup[]` with `y` and `height` properties for each line, and tokens have cached bounding rects. The `desiredColumn` field in the store tracks horizontal position across vertical motions.

## Goals / Non-Goals

**Goals:**
- Scroll the document proactively when the cursor approaches the viewport edge, keeping at least `scrolloff` lines visible above and below the cursor
- Default `scrolloff` to 3 lines (same as Vim's default)
- Allow users to configure `scrolloff` from 0 to 20 via a settings slider
- Handle both iframe-based viewers (EPUB, PDF) and main-document viewers (Markdown, HTML)
- Maintain smooth scrolling behavior (`behavior: "smooth"`)
- When `scrolloff=0`, preserve the current edge-triggered behavior exactly

**Non-Goals:**
- Horizontal scrolloff (`sidescrolloff`) — not requested, and horizontal scrolling is less relevant for reading
- Half-page scrolling (`Ctrl-D` / `Ctrl-U`) — separate feature
- Different scrolloff values for top vs bottom — keep symmetric like Vim
- Smooth scroll animation tuning/customization
- Per-viewer-type scrolloff — one global setting

## Decisions

### Decision 1: Scrolloff computed in pixels from line height, not fixed px

**Choice:** Convert the `scrolloff` line count to pixels by multiplying by the current line height (from the token's bounding rect height + line gap), then use that pixel threshold in the viewport boundary check.

**Why:**
- Line heights vary by viewer, font size, and document type — a fixed pixel value would be too large or too small depending on the context
- The `lineGrouper` already computes line groups with `height` values, so `scrolloff * avgLineHeight` is cheap to compute
- Matches how Vim works: scrolloff is in lines, not pixels

### Decision 2: Scroll only when cursor enters the scrolloff zone, not when it's already past it

**Choice:** The check becomes: scroll if `tokenTop < scrollContainer.top + scrolloffPx` or `tokenBottom > scrollContainer.bottom - scrolloffPx`. When scrolling triggers, scroll by the minimum amount needed to bring the cursor back to the scrolloff boundary (not jump to center).

**Why over alternatives:**
- Alternative A: Always center the cursor on every j/k press → disorienting, loses sense of position in the document
- Alternative B: Use `scrollIntoView({ block: "center" })` → forces center, same problem as A
- The scrolloff approach (scroll just enough to restore the margin) is how Vim behaves and feels natural — the view drifts smoothly as you read, only shifting when needed
- Exception: for large jumps (`G`, `gg`, `{`, `}`), center the cursor since the user jumped a significant distance

### Decision 3: Store scrolloff in vimModeStore with persistence to settings

**Choice:** Add `scrolloff: number` (default 3) to `vimModeStore.ts`. Persist to the app's existing settings store (`useSettingsStore`) so it survives restarts.

**Why:**
- The vim mode store already holds all vim-related state
- The settings store already has infrastructure for persisting user preferences
- A simple number field is lightweight and avoids over-engineering

### Decision 4: Scrolloff line-height derived from current line group height

**Choice:** When computing the pixel threshold, use the height of the current cursor's line group (not an average across the document). Fall back to the token's own bounding rect height if line group data is unavailable.

**Why:**
- The current line's height is the most accurate reference — if the user is in a section with larger text (headings, blockquotes), the scrolloff zone adapts automatically
- Avoids needing to pre-compute an average that may not represent the current area

## Risks / Trade-offs

- **Stale bounding rects after scroll** → After `scrollTo` fires, cached `token.rect` values become stale (they were viewport-relative). Mitigation: after scrolling, call `refreshRects()` to recalculate — this is already available in the cursor engine.
- **Smooth scroll animation race condition** → If the user presses `j` rapidly, multiple smooth scrolls queue up and fight each other. Mitigation: debounce or cancel pending smooth scrolls by switching to `behavior: "instant"` when a new scroll is requested within 150ms of the last.
- **EPUB iframe resize** → If the iframe dimensions change, line heights change, and scrolloff pixels become wrong. Mitigation: recalculate on the existing resize observer.
