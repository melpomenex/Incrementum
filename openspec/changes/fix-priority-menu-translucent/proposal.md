## Why

The "Set Priority" dropdown menu in the document viewer (PDFs, EPUBs, etc.) has a translucent/see-through background, making text from the document bleed through and the menu unreadable. The root cause is that `PriorityControl.tsx` uses the Tailwind class `bg-popover` on its dropdown panel, but the corresponding `--color-popover` CSS variable is never defined in `src/index.css`, resulting in a transparent background.

## What Changes

- Define `--color-popover` (and `--color-popover-foreground`) in the theme configuration at `src/index.css`
- Ensure the popover colors work correctly in both light and dark modes
- Verify other components using `bg-popover` (e.g., `GeneratedCardsPopover.tsx`) also benefit from the fix

## Capabilities

### New Capabilities

- `popover-theme-colors`: Define popover background and foreground color variables in the app theme, ensuring all popover/dropdown UI elements have a solid, opaque background.

### Modified Capabilities

_(None — no existing specs are changing their requirements.)_

## Impact

- **`src/index.css`**: Add `--color-popover` and `--color-popover-foreground` to the `@theme` block
- **`src/components/viewer/PriorityControl.tsx`**: The dropdown panel already uses `bg-popover` — it will render correctly once the variable is defined
- **`src/components/common/GeneratedCardsPopover.tsx`**: Uses `bg-popover text-popover-foreground` — will also benefit
- **Dark mode**: Any dark-mode color overrides in `index.css` should include popover color adjustments
