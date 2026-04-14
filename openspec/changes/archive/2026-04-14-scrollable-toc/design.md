## Context

The User Handbook (`HandbookSettings.tsx`) renders a TOC sidebar alongside the article body. The sidebar uses `md:sticky md:top-6` to float alongside the article as the user scrolls the parent `overflow-y-auto` container. However, the TOC has no `max-height` or `overflow` constraint — when it exceeds the viewport height, bottom entries are unreachable without scrolling the entire document.

The scroll container hierarchy is:
```
SettingsPage overflow-y-auto div  ← user scrolls this
  └── HandbookSettings flex row
        ├── aside (md:sticky)  ← TOC, grows unconstrained
        └── article             ← content
```

## Goals / Non-Goals

**Goals:**
- TOC scrolls independently within its sticky container when entries exceed the visible area
- Scrolling the TOC does NOT scroll the main document

**Non-Goals:**
- Active-heading highlighting or scroll-spy behavior
- Collapsible TOC sections
- Mobile layout changes (TOC already stacks vertically on small screens)

## Decisions

### Constrain TOC height to viewport with overflow scroll

Add `max-h-[calc(100vh-theme(spacing.48))]` and `overflow-y-auto` to the TOC's inner `<div>` (the one with `border rounded-lg ...`). This bounds the TOC to the visible viewport minus the sticky offset, and enables an independent scrollbar.

**Alternative considered**: Putting `max-h` on the `<aside>` itself — rejected because `sticky` positioning interacts better when the constrained element is the inner box rather than the sticky anchor.

### Why `theme(spacing.48)` (12rem / 192px)?

The sticky offset is `top-6` (1.5rem) plus the parent padding `p-4 md:p-6` and the settings header. Using `calc(100vh - 12rem)` provides generous room for the header, padding, and the sticky top offset. This value can be tuned during implementation.

## Risks / Trade-offs

- **Scrollbar appearance** — A thin scrollbar appears inside the TOC box when entries overflow. On some platforms this may feel unexpected, but Tailwind's default scrollbar styling is acceptable. A custom thin scrollbar (`scrollbar-thin`) could be added if needed.
