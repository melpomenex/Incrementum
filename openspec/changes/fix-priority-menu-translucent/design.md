## Context

The document viewer (`DocumentViewer.tsx`) includes a compact `PriorityControl` dropdown that uses `bg-popover` for its panel background. The Tailwind v4 theme at `src/index.css` defines colors like `--color-background`, `--color-card`, `--color-muted`, etc., but `--color-popover` is missing. This causes the dropdown to render with a transparent background, making document content bleed through.

Other components (e.g., `GeneratedCardsPopover.tsx`) also reference `bg-popover` and `text-popover-foreground`, so they share the same issue.

## Goals / Non-Goals

**Goals:**
- Give all popover/dropdown panels a solid, opaque background in both light and dark modes
- Match the existing visual style (popover should look like a card — solid white in light mode, dark opaque in dark mode)

**Non-Goals:**
- Refactoring the PriorityControl or other popover components
- Changing the glassmorphism system or other theme variables
- Adding new UI features

## Decisions

1. **Add `--color-popover` and `--color-popover-foreground` to the `@theme` block**
   - Light mode: `--color-popover: #ffffff` (same as card), `--color-popover-foreground: #020817` (same as foreground)
   - Dark mode: Override in the existing dark-mode section with appropriate dark values (e.g., `#1e293b` background, `#f8fafc` foreground)
   - Rationale: Popovers are semantically similar to cards — elevated surfaces with opaque backgrounds. Reusing the same color family keeps consistency.

2. **Use the existing `@custom-variant dark` pattern for dark overrides**
   - The project already defines `@custom-variant dark (&:where(.dark, .dark *))` and uses `.dark` selectors for overrides. We'll add popover dark-mode overrides in the same section.
   - Rationale: Consistent with the existing theme override pattern.

3. **No changes to component TSX files**
   - `PriorityControl.tsx` and `GeneratedCardsPopover.tsx` already use `bg-popover` / `text-popover-foreground`. Once the variables exist, they'll work.
   - Rationale: Minimal change surface — the components are correct, only the theme is broken.

## Risks / Trade-offs

- **Risk**: Other components may also reference undefined `bg-popover` and behave differently once the variable is added → **Mitigation**: A solid white popover is the expected behavior for any dropdown; any component already using `bg-popover` will improve, not break.
- **Risk**: Dark-mode popover color may not match user expectations → **Mitigation**: Use the same dark card color already used elsewhere in the theme (`#1e293b` is a standard slate-800, consistent with the existing palette).
