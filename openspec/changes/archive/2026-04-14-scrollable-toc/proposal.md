## Why

The User Handbook's Table of Contents sidebar grows with the number of headings and has no independent scroll constraint. When the TOC is taller than the viewport, users must scroll the entire document to reach lower TOC entries, which defeats the purpose of quick navigation. The TOC should scroll independently within its sticky container.

## What Changes

- Add `max-h-[calc(100vh-theme(spacing.12))]` and `overflow-y-auto` to the TOC's inner container so it scrolls independently within its sticky viewport
- Add smooth scrolling behavior to the TOC nav for a polished feel

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

_(none — this is a pure CSS/layout fix with no behavioral requirement changes)_

## Impact

- **`src/components/settings/HandbookSettings.tsx`** — CSS classes on the TOC `<aside>` or its inner container
- No API or backend changes
- No dependency changes
