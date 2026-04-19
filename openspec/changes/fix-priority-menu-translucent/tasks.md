## 1. Theme Color Definitions

- [x] 1.1 Add `--color-popover: #ffffff` and `--color-popover-foreground: #020817` to the `@theme` block in `src/index.css` (after the existing `--color-card-foreground` line)
- [x] 1.2 Add dark-mode overrides for popover colors in the `.dark` section of `src/index.css`: set `--color-popover` to a dark opaque color (e.g., `#1e293b`) and `--color-popover-foreground` to a light color (e.g., `#f8fafc`)

## 2. Verification

- [ ] 2.1 Open a PDF or EPUB document in the viewer, click the "Set Priority" dropdown, and confirm the panel has a solid opaque background in light mode
- [ ] 2.2 Switch to dark mode, open the same dropdown, and confirm the panel has a solid dark opaque background with readable text
